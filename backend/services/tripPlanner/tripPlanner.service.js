'use strict'

const { normalizeRequirements, resolveParams, resolveShape } = require('./requirements')
const { generateFallbackItinerary } = require('./itinerary.fallback')
const { buildPlanCore } = require('./planCore')
const { buildFallbackFit } = require('./fit.fallback')
const { assembleFit } = require('./aiValidate')
const { buildDemoStays } = require('../providers/demo/demoStays')
const { buildDemoFlights } = require('../providers/demo/demoFlights')
const { makeCacheKey } = require('../providers/providerCache.service')
const { addDaysIso } = require('./format')

/**
 * Trip-plan orchestrator.
 *
 * Runs the itinerary (AI), flights and stays in PARALLEL with a hard overall deadline;
 * every section fails independently and falls back to labelled content, so a plan is
 * ALWAYS returned (partial data + meta.sectionStatus + meta.warnings), never a 500.
 * Then it computes the deterministic budget / feasibility / limits and the fit section.
 *
 * Honesty: meta.isDemo is true when ANY section is not live/AI (never one flag for
 * mixed data); every stay/flight carries its own dataSource.
 *
 * Dependencies are injected (defaults are wired lazily) so the whole flow is unit-testable.
 */

const AI_CACHE_TTL_MS = 60 * 60 * 1000
const AI_CACHE_MAX = 200

function createAiMemo(now = () => Date.now()) {
  const map = new Map()
  return {
    get(key) {
      const e = map.get(key)
      if (!e) return null
      if (e.expires <= now()) {
        map.delete(key)
        return null
      }
      return e.value
    },
    set(key, value) {
      if (map.size >= AI_CACHE_MAX) map.delete(map.keys().next().value)
      map.set(key, { value, expires: now() + AI_CACHE_TTL_MS })
    },
    size: () => map.size,
  }
}

function withDeadline(promise, ms, onTimeout) {
  let timer
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve({ __timeout: true }), Math.max(ms, 0))
  })
  return Promise.race([promise, timeout])
    .then((r) => (r && r.__timeout ? onTimeout() : r))
    .finally(() => clearTimeout(timer))
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Replace the facade's generic reason text with one that matches what actually happened. */
function flightWarning(result, ctx) {
  if (result.status === 'ok') return []
  if (result.reason === 'no_origin' && !ctx.departureText) {
    return ['No departure city was saved, so demo flights are shown. Add one to search live flights.']
  }
  if (result.reason === 'no_origin') {
    return [`We couldn’t match “${ctx.departureText.slice(0, 60)}” to an airport, so demo flights are shown.`]
  }
  if (result.reason === 'no_dates' && ctx.days < 2 && ctx.hasStart) {
    return ['A 1-day trip has no return flight to search, so demo flights are shown.']
  }
  return result.warnings
}

function createTripPlannerService(deps = {}) {
  const lazy = {
    get flights() {
      return deps.flights ?? require('../providers').getFlightService()
    },
    get stays() {
      return deps.stays ?? require('../providers').getAccommodationService()
    },
    get airports() {
      return deps.airports ?? require('../airports.service')
    },
    get ai() {
      return deps.ai ?? require('./tripAI.service').generateTripContent
    },
    get hero() {
      return deps.hero ?? null
    },
    get weather() {
      return deps.weather ?? require('./weather').getForecastNote
    },
    get save() {
      return deps.save ?? null
    },
  }
  const now = deps.now ?? (() => new Date())
  const deadlineMs = deps.deadlineMs ?? (() => require('../../config/env').TRIP_GENERATE_DEADLINE_MS)
  const memo = deps.aiMemo ?? createAiMemo()

  /**
   * @param {{input:{destination:object,answers:object}, adjustments?:object, who?:{userId?:string|null,ip?:string}, requestId?:string}} args
   * @returns {Promise<object>} a TripPlan (frontend contract + optional meta/dataSource fields)
   */
  async function buildPlan({ input, adjustments = {}, who = {}, requestId = '' }) {
    const started = Date.now()
    const budgetMs = typeof deadlineMs === 'function' ? deadlineMs() : deadlineMs
    const remaining = () => Math.max(budgetMs - (Date.now() - started), 0)

    const req = normalizeRequirements(input.answers)
    const p = resolveParams(input, req)
    const shape = resolveShape(req, p, adjustments)
    const { days } = shape
    const nights = Math.max(days - 1, 0)
    const start = req.dates.start
    const checkIn = start
    const checkOut = start ? addDaysIso(start, nights) : null
    const warnings = []

    const origin = req.departureLocation ? lazy.airports.resolve(req.departureLocation) : null
    const dest = lazy.airports.resolveDestinationAirport(lazy.airports.defaultIndex ?? lazy.airports, {
      placeName: p.placeName,
      fixtureAirport: p.fixture.airport,
      hasFixture: p.hasFixture,
    })
    const placeLabel = input.destination.country ? `${p.placeName}, ${input.destination.country}` : p.placeName

    // ----- Parallel sections, each guarded by the shared deadline and isolated -----
    const itineraryTask = (async () => {
      const key = makeCacheKey('trip_ai', {
        d: input.destination.id, days, i: req.interests, w: req.weather, party: req.partyLabel, age: req.ageGroup,
        s: req.safetyImportance, n: req.notes, f: req.foodLanguage, m: start ? start.slice(0, 7) : null,
        t: p.travelers, b: req.budget.amount, c: p.currency,
      })
      const memoed = memo.get(key)
      if (memoed) return memoed
      const out = await lazy.ai({ input, p, req, days, ctx: { userId: who.userId ?? null, requestId, deadlineAt: started + budgetMs } })
      if (out.itinerarySource === 'ai' || out.fitSource === 'ai') memo.set(key, out)
      return out
    })()

    const flightsTask = lazy.flights.search({
      originIata: origin?.iata ?? null,
      destIata: dest?.iata ?? null,
      outboundDate: start,
      returnDate: days >= 2 ? checkOut : null,
      travelers: p.travelers,
      currency: p.currency,
      params: p,
      who,
    })

    const staysTask = lazy.stays.search({
      destinationQuery: `Hotels in ${placeLabel}`,
      placeName: p.placeName,
      checkIn,
      checkOut,
      nights,
      rooms: p.rooms,
      travelers: p.travelers,
      currency: p.currency,
      params: p,
      who,
    })

    const heroTask = lazy.hero
      ? lazy.hero.getHeroImage({ placeName: p.placeName, country: input.destination.country }).catch(() => null)
      : Promise.resolve(null)

    const weatherTask = Promise.resolve(
      lazy.weather({ lat: dest?.lat, lon: dest?.lon, start, days, now }),
    ).catch(() => null)

    const aiFallback = () => ({
      itinerary: generateFallbackItinerary(p, days), itinerarySource: 'fallback', aiFit: null, fitSource: 'fallback', outcome: 'timeout',
    })
    const flightFallback = (why) => ({
      options: buildDemoFlights(p), dataSource: 'demo', status: 'demo', warnings: [why], reason: 'timeout',
    })
    const stayFallback = (why) => ({
      options: buildDemoStays(p, nights), dataSource: 'demo', status: 'demo', warnings: [why], reason: 'timeout',
    })

    const settled = await Promise.allSettled([
      withDeadline(itineraryTask, remaining(), aiFallback),
      withDeadline(flightsTask, remaining(), () => flightFallback('Flight search took too long, so demo flights are shown.')),
      withDeadline(staysTask, remaining(), () => stayFallback('Stay search took too long, so demo stays are shown.')),
      withDeadline(heroTask, Math.min(remaining(), 3500), () => null),
      withDeadline(weatherTask, Math.min(remaining(), 4500), () => null),
    ])
    const [aiR, flR, stR, heroR, weatherR] = settled

    const ai = aiR.status === 'fulfilled' ? aiR.value : aiFallback()
    const fl = flR.status === 'fulfilled' ? flR.value : flightFallback('Flight search failed, so demo flights are shown.')
    const st = stR.status === 'fulfilled' ? stR.value : stayFallback('Stay search failed, so demo stays are shown.')
    const hero = heroR.status === 'fulfilled' ? heroR.value : null
    const forecastNote = weatherR.status === 'fulfilled' ? weatherR.value : null

    warnings.push(...flightWarning(fl, { departureText: req.departureLocation, days, hasStart: Boolean(start) }))
    if (st.status !== 'ok') warnings.push(...st.warnings)
    if (ai.itinerarySource === 'fallback') {
      warnings.push(
        ai.outcome === 'disabled'
          ? 'AI itinerary generation is not configured, so a template itinerary built from your answers is shown.'
          : 'The AI itinerary was unavailable, so a template itinerary built from your answers is shown.',
      )
    }

    // ----- Deterministic numbers, then the fit section -----
    const core = buildPlanCore({
      req, p, shape, itinerary: ai.itinerary, accommodations: st.options, flights: fl.options,
      itineraryFor: (d) => generateFallbackItinerary(p, d),
    })

    const sources = { flights: core.categorySources.flights, accommodation: core.categorySources.accommodation }
    const fallbackFit = buildFallbackFit({
      input, p, itinerary: ai.itinerary, feasibility: core.feasibility, days,
      durationAssumed: shape.durationAssumed, durationCapped: shape.durationCapped, sources,
      extraConsiderations: forecastNote ? [forecastNote] : [],
    })
    const { fit, fitSource } = assembleFit(ai.aiFit, fallbackFit, req)

    const sectionStatus = {
      itinerary: ai.itinerarySource === 'ai' ? 'ok' : 'fallback',
      stays: st.dataSource === 'live' ? 'ok' : 'demo',
      flights: fl.dataSource === 'live' ? 'ok' : 'demo',
    }
    const isDemo = Object.values(sectionStatus).some((s) => s !== 'ok')
    const estimatedCategories = Object.entries(core.categorySources).filter(([, v]) => v !== 'live').map(([k]) => k)

    const plan = {
      meta: {
        isDemo,
        source: 'server',
        disclaimer: isDemo
          ? 'Parts of this plan use demo data or estimates — see the label on each section. Nothing here is a booking or a guaranteed price.'
          : 'Flight and stay prices come from a live search made when this plan was generated and can change. Nothing here is a booking.',
        generatedAt: now().toISOString(),
        requestId,
        sectionStatus,
        itinerarySource: ai.itinerarySource,
        fitSource,
        warnings,
        categorySources: core.categorySources,
        estimatedCategories,
        searched: { flights: fl.searched, stays: st.searched },
      },
      destination: {
        id: input.destination.id,
        name: input.destination.name,
        country: input.destination.country,
        imageRef: input.destination.imageRef,
        ...(hero ? { heroImage: hero } : {}),
      },
      requirements: req,
      effective: core.effective,
      itinerary: ai.itinerary,
      accommodations: st.options,
      flights: fl.options,
      budget: core.breakdown,
      feasibility: core.feasibility,
      fit,
      limits: core.limits,
    }
    return JSON.parse(JSON.stringify(plan)) // drop undefined keys: the plan is a plain JSON document
  }

  /** Generate (and auto-save for signed-in users; guest plans are never stored). */
  async function generate({ input, who = {}, requestId = '' }) {
    const plan = await buildPlan({ input, who, requestId })
    if (who.userId && lazy.save) {
      try {
        const saved = await lazy.save({ userId: who.userId, input, plan })
        if (saved?.id) plan.meta.savedPlanId = String(saved.id)
      } catch {
        plan.meta.warnings.push('Your plan could not be saved to your account this time.')
      }
    }
    return plan
  }

  /** What-if: recompute with the adjustments; record history on a saved plan the user owns. */
  async function adjust({ input, adjustments, planId, who = {}, requestId = '' }) {
    const plan = await buildPlan({ input, adjustments, who, requestId })
    if (who.userId && planId && deps.recordAdjustment) {
      try {
        const ok = await deps.recordAdjustment({ userId: who.userId, planId, adjustments, plan })
        if (ok) plan.meta.savedPlanId = String(planId)
      } catch {
        /* history is best effort */
      }
    }
    return plan
  }

  return { generate, adjust, buildPlan, _memo: memo }
}

module.exports = { createTripPlannerService, createAiMemo, withDeadline, flightWarning }
