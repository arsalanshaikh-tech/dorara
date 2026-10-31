'use strict'

const { formatMoney, joinTitles } = require('./format')
const { DEFAULT_PLANNED_DAYS, MAX_PLANNED_DAYS } = require('./requirements')

/**
 * Deterministic "Why this trip fits you" content (fitSource = "fallback").
 *
 * Every match point is built from a REAL questionnaire answer (interests, weather
 * preference, safety importance) or from the computed budget numbers; nothing is
 * generic marketing text, and preferences the user did not select never appear.
 * Port of buildFit() from lib/travel/trip-planner-service.ts, with the
 * demo/live data notes made source-aware.
 *
 * @param {object} a
 * @param {{destination:object}} a.input
 * @param {object} a.p                 resolved params
 * @param {Array}  a.itinerary
 * @param {object} a.feasibility
 * @param {number} a.days
 * @param {boolean} a.durationAssumed
 * @param {boolean} a.durationCapped
 * @param {{flights:string, accommodation:string}} a.sources  'live' | 'demo' | 'none'
 * @param {string[]} [a.extraConsiderations] extra honest notes from the caller (warnings)
 */
function buildFallbackFit({
  input,
  p,
  itinerary,
  feasibility,
  days,
  durationAssumed,
  durationCapped,
  sources,
  extraConsiderations = [],
}) {
  const { req, placeName, fixture } = p
  const dest = input.destination
  const matches = []
  const considerations = []
  const money = (n) => formatMoney(n, p.currency)

  for (const interest of req.interests) {
    const hits = []
    for (const d of itinerary) {
      for (const act of d.activities) {
        if (act.matchedInterests.includes(interest)) hits.push({ day: d.day, title: act.title })
      }
    }
    if (hits.length > 0) {
      const dayNums = [...new Set(hits.map((h) => h.day))].slice(0, 3)
      matches.push({
        id: `interest-${interest}`,
        text: `You selected “${interest}”, so the itinerary includes ${joinTitles(hits.slice(0, 2).map((h) => h.title))} (${dayNums.length === 1 ? 'day' : 'days'} ${dayNums.join(', ')}).`,
      })
    } else {
      considerations.push({
        id: `interest-missing-${interest}`,
        text: `You selected “${interest}”, but this ${days}-day itinerary has no ${interest.toLowerCase()} activities for ${placeName}. A longer trip or a different destination may cover it better.`,
      })
    }
  }

  const weatherPrefs = req.weather.filter((w) => w !== 'No preference')
  if (weatherPrefs.length > 0 && fixture.weather.length > 0 && typeof dest.avgTempC === 'number') {
    if (weatherPrefs.some((w) => fixture.weather.includes(w))) {
      matches.push({
        id: 'weather',
        text: `You prefer ${weatherPrefs.join(' or ').toLowerCase()} weather, and ${dest.name} averages around ${dest.avgTempC}°C.`,
      })
    } else {
      considerations.push({
        id: 'weather',
        text: `You prefer ${weatherPrefs.join(' or ').toLowerCase()} weather, but ${dest.name} averages around ${dest.avgTempC}°C, which may not match.`,
      })
    }
  }

  if (req.safetyImportance !== null && req.safetyImportance >= 4 && typeof dest.safetyIndex === 'number') {
    if (dest.safetyIndex >= 88) {
      matches.push({
        id: 'safety',
        text: `Safety matters to you (${req.safetyImportance}/5), and ${dest.name} has a safety index of ${dest.safetyIndex}/100.`,
      })
    } else {
      considerations.push({
        id: 'safety',
        text: `Safety matters to you (${req.safetyImportance}/5). ${dest.name} has a safety index of ${dest.safetyIndex}/100, so check current travel advice before booking.`,
      })
    }
  }

  if (feasibility.status === 'within' || feasibility.status === 'close') {
    matches.push({
      id: 'budget',
      text: `The estimate of ${money(feasibility.total)} is ${feasibility.status === 'within' ? 'within' : 'close to'} your ${money(feasibility.budget)} budget.`,
    })
  } else if (feasibility.status === 'above') {
    considerations.push({
      id: 'budget',
      text: `The estimate of ${money(feasibility.total)} is above your ${money(feasibility.budget)} budget. See the cost-reduction ideas in the budget section.`,
    })
  }

  if (p.travelersAssumed && req.partyLabel) {
    considerations.push({
      id: 'party',
      text: `You’re travelling as “${req.partyLabel}”. Estimates assume ${p.travelers} travelers because the exact group size wasn’t saved.`,
    })
  } else if (p.travelersAssumed) {
    considerations.push({ id: 'party', text: 'No travel party was saved, so estimates assume 1 traveler.' })
  }

  if (req.visaStatus && req.visaStatus !== 'I have a passport and visa-ready') {
    considerations.push({
      id: 'visa',
      text: `You told us your visa status is “${req.visaStatus}”. Check entry requirements early — Dorara does not verify them.`,
    })
  }

  if (req.foodLanguage) {
    const note = req.foodLanguage.length > 80 ? `${req.foodLanguage.slice(0, 77)}…` : req.foodLanguage
    considerations.push({
      id: 'food-language',
      text: `You noted “${note}”. The itinerary doesn’t account for this yet — confirm it when choosing restaurants and tours.`,
    })
  }

  if (durationAssumed) {
    considerations.push({
      id: 'duration',
      text: `No trip length was saved, so the plan assumes ${DEFAULT_PLANNED_DAYS} days.`,
    })
  }
  if (durationCapped) {
    considerations.push({
      id: 'duration-capped',
      text: `Your saved trip is longer than ${MAX_PLANNED_DAYS} days. The plan covers the first ${MAX_PLANNED_DAYS} days.`,
    })
  }
  if (!req.departureLocation) {
    considerations.push({
      id: 'departure',
      text: 'No departure city was saved, so flight options are demo placeholders with illustrative durations.',
    })
  }
  if (fixture.costFactor > 1.1) {
    considerations.push({
      id: 'cost-level',
      text: `${placeName} is set to a higher cost level than average in the estimate model, which raises food, transport, and stay estimates.`,
    })
  }

  for (const [i, text] of extraConsiderations.entries()) {
    considerations.push({ id: `note-${i}`, text })
  }

  considerations.push(...dataSourceConsiderations(sources))

  return { matches, considerations }
}

/** Honest, source-aware notes about what is live vs demo. */
function dataSourceConsiderations(sources) {
  const out = []
  const demo = []
  const live = []
  if (sources.flights === 'demo') demo.push('flights')
  if (sources.flights === 'live') live.push('flights')
  if (sources.accommodation === 'demo') demo.push('stays')
  if (sources.accommodation === 'live') live.push('stays')

  if (demo.length) {
    out.push({
      id: 'demo',
      text: `${capitalize(demo.join(' and '))} shown here are demo data with estimated prices — not live availability or bookable offers.`,
    })
  }
  if (live.length) {
    out.push({
      id: 'live-prices',
      text: `Live ${live.join(' and ')} prices come from a search made when this plan was generated and can change before you book. Nothing here is a booking or a confirmed price.`,
    })
  }
  out.push({
    id: 'estimates',
    text: 'Food, local transport, activities and miscellaneous costs are estimates from a fixed rules table, not quotes.',
  })
  return out
}

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1)

module.exports = { buildFallbackFit, dataSourceConsiderations }
