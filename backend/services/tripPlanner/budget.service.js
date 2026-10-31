'use strict'

const { formatMoney, pluralize } = require('./format')
const { moneyFromUsd } = require('./itinerary.fallback')

/**
 * Budget engine — deterministic, server-side, pure (no I/O, no AI).
 *
 * Mirrors the rules of lib/travel/trip-planner-service.ts so the preview and the
 * server agree (tests/budgetParity.test.js compares them). Every function here is
 * a pure function of its arguments.
 *
 * RULES TABLE (all amounts are ESTIMATES, derived from the destination's cost factor):
 *   flights        mid-priced option's total (price per traveler x travelers)
 *   accommodation  mid-priced option's total (price per room per night x nights x rooms)
 *   food           28 USD per person per day  x costFactor, converted to the user's currency
 *   local transport 8 USD per person per day  x costFactor
 *   activities     sum of the itinerary's per-person estimated costs x travelers
 *   miscellaneous  7% of the subtotal above
 * Each category is rounded to a whole currency unit BEFORE summing, so
 * total === sum(lines) exactly (no rounding drift).
 */

const MISC_RATE = 0.07
const FOOD_USD_PER_PERSON_DAY = 28
const TRANSPORT_USD_PER_PERSON_DAY = 8
/** Within this fraction of the budget the trip is "close" to it. */
const CLOSE_TO_BUDGET_THRESHOLD = 0.9

/**
 * Per-person USD estimate for AI-suggested activities, which carry only a
 * cost LEVEL (the AI never produces amounts). Scaled by the destination's cost
 * factor and converted to the user's currency like every other estimate.
 */
const ACTIVITY_LEVEL_USD = { free: 0, low: 10, medium: 35, high: 90 }

/** Middle-priced option (used as the basis of the budget). Stable for ties. */
function middleByPrice(items, price) {
  if (!items || items.length === 0) return undefined
  const sorted = [...items].sort((x, y) => price(x) - price(y))
  return sorted[Math.floor((sorted.length - 1) / 2)]
}

/** Accommodation total for a different number of nights (price per night basis). */
function stayTotalFor(option, nights, rooms) {
  if (option.nights === nights && option.rooms === rooms) return option.totalPrice
  return Math.round(option.pricePerNight * Math.max(nights, 0) * rooms)
}

const withMisc = (amount) => Math.round(amount * (1 + MISC_RATE))

/**
 * @param {object} ctx
 * @param {object} ctx.p                 resolved params (currency, rate, travelers, rooms, fixture)
 * @param {number} ctx.days
 * @param {Array}  ctx.itinerary
 * @param {Array}  ctx.accommodations    each may carry dataSource 'live'|'demo'
 * @param {Array}  ctx.flights
 * @returns {{breakdown: object, categorySources: Record<string,string>}}
 */
function calculateBudgetBreakdown(ctx) {
  const { p, days, itinerary, accommodations, flights } = ctx
  const nights = Math.max(days - 1, 0)

  const stayBase = middleByPrice(accommodations, (x) => stayTotalFor(x, nights, p.rooms))
  const flight = middleByPrice(flights, (x) => x.totalPrice)
  const stayTotal = stayBase ? stayTotalFor(stayBase, nights, p.rooms) : 0

  const foodPerDay = moneyFromUsd(FOOD_USD_PER_PERSON_DAY * p.fixture.costFactor, p.rate)
  const transportPerDay = moneyFromUsd(TRANSPORT_USD_PER_PERSON_DAY * p.fixture.costFactor, p.rate)
  const activityPerPerson = itinerary
    .flatMap((d) => d.activities)
    .reduce((sum, act) => sum + (act.estimatedCost ?? 0), 0)

  const money = (n) => formatMoney(n, p.currency)
  const flightLive = flight?.dataSource === 'live'
  const stayLive = stayBase?.dataSource === 'live'

  const lines = [
    {
      key: 'flights',
      label: 'Flights',
      amount: flight?.totalPrice ?? 0,
      detail: flight
        ? `${money(flight.pricePerTraveler)} × ${pluralize(p.travelers, 'traveler')} (mid-priced ${flightLive ? 'live search result' : 'demo fare'})`
        : 'No flight options available',
    },
    {
      key: 'accommodation',
      label: 'Accommodation',
      amount: stayTotal,
      detail: stayBase
        ? nights > 0
          ? `${money(stayBase.pricePerNight)} × ${pluralize(nights, 'night')} × ${pluralize(p.rooms, 'room')} (mid-priced ${stayLive ? 'live search result' : 'demo stay'})`
          : 'No overnight stay in a 1-day trip'
        : 'No accommodation options available',
    },
    {
      key: 'food',
      label: 'Food',
      amount: foodPerDay * p.travelers * days,
      detail: `${money(foodPerDay)} per person per day × ${pluralize(p.travelers, 'traveler')} × ${pluralize(days, 'day')}`,
    },
    {
      key: 'activities',
      label: 'Activities',
      amount: activityPerPerson * p.travelers,
      detail: `${money(activityPerPerson)} per person across the itinerary × ${pluralize(p.travelers, 'traveler')}`,
    },
    {
      key: 'transport',
      label: 'Local transport',
      amount: transportPerDay * p.travelers * days,
      detail: `${money(transportPerDay)} per person per day × ${pluralize(p.travelers, 'traveler')} × ${pluralize(days, 'day')}`,
    },
  ]
  const subtotal = lines.reduce((s, l) => s + l.amount, 0)
  lines.push({
    key: 'misc',
    label: 'Miscellaneous',
    amount: Math.round(subtotal * MISC_RATE),
    detail: `${Math.round(MISC_RATE * 100)}% allowance for tips, SIM cards, small purchases`,
  })

  const categorySources = {
    flights: flight ? (flightLive ? 'live' : 'demo') : 'none',
    accommodation: stayBase ? (stayLive ? 'live' : 'demo') : 'none',
    food: 'estimate',
    activities: 'estimate',
    transport: 'estimate',
    misc: 'estimate',
  }

  const basisNote = buildBasisNote(categorySources)

  return {
    breakdown: {
      currency: p.currency,
      lines,
      // Exact sum of the (already rounded) lines.
      total: lines.reduce((s, l) => s + l.amount, 0),
      basisNote,
      basis: { flightId: flight?.id, accommodationId: stayBase?.id },
    },
    categorySources,
  }
}

function buildBasisNote(src) {
  const parts = []
  const demo = []
  const live = []
  for (const k of ['flights', 'accommodation']) {
    if (src[k] === 'demo') demo.push(k === 'flights' ? 'flights' : 'accommodation')
    if (src[k] === 'live') live.push(k === 'flights' ? 'flights' : 'accommodation')
  }
  if (demo.length) parts.push(`Demo data: ${demo.join(' and ')} use mid-priced demo options and are not live prices.`)
  if (live.length) {
    parts.push(
      `${live.join(' and ')} use the mid-priced result of a live search made when this plan was generated; prices can change and nothing is booked.`,
    )
  }
  parts.push('Food, local transport, activities and miscellaneous are server-side estimates from a fixed rules table, not quotes.')
  return `Estimate. ${parts.join(' ')}`
}

/** Plan total for a different trip length (used by the shorten-trip suggestion). */
function estimateTotalForDays(ctx, d) {
  const itinerary = ctx.itineraryFor(d)
  return calculateBudgetBreakdown({ ...ctx, days: d, itinerary }).breakdown.total
}

/**
 * Specific, actionable suggestions driven by REAL plan numbers (never AI).
 * Only called when the plan is over/close to the budget.
 */
function generateSuggestions(ctx, budget) {
  const { p, days, itinerary, accommodations, flights, breakdown } = ctx
  const money = (n) => formatMoney(n, p.currency)
  const nights = Math.max(days - 1, 0)
  const out = []

  const priced = (o) => stayTotalFor(o, nights, p.rooms)
  const stay = middleByPrice(accommodations, priced)
  const cheapestStay = [...accommodations].sort((x, y) => priced(x) - priced(y))[0]
  if (stay && cheapestStay && priced(stay) > priced(cheapestStay)) {
    const saving = withMisc(priced(stay) - priced(cheapestStay))
    out.push({
      id: 'cheaper-stay',
      title: 'Choose a lower-cost accommodation estimate',
      detail: `Using the ${String(cheapestStay.type).toLowerCase()} option instead of the mid-priced one could save about ${money(saving)} in this estimate.`,
      saving,
    })
  }

  const paid = itinerary
    .flatMap((d) => d.activities)
    .filter((x) => (x.estimatedCost ?? 0) > 0)
    .sort((x, y) => (y.estimatedCost ?? 0) - (x.estimatedCost ?? 0))
    .slice(0, 2)
  if (paid.length > 0) {
    const saving = withMisc(paid.reduce((s, x) => s + (x.estimatedCost ?? 0), 0) * p.travelers)
    out.push({
      id: 'fewer-paid-activities',
      title: 'Swap your priciest paid activities',
      detail: `Replacing ${paid.map((x) => `“${x.title}”`).join(' and ')} with free or lower-cost options could save about ${money(saving)}.`,
      saving,
    })
  }

  if (days > 1) {
    let fit = null
    for (let d = days - 1; d >= 1; d--) {
      const total = estimateTotalForDays(ctx, d)
      if (total <= budget) {
        fit = { days: d, total }
        break
      }
    }
    const oneLess = estimateTotalForDays(ctx, days - 1)
    if (fit) {
      out.push({
        id: 'shorten-trip',
        title: `Shorten the trip to ${pluralize(fit.days, 'day')}`,
        detail: `A ${fit.days}-day version is estimated at ${money(fit.total)}, which fits your budget in this estimate.`,
        saving: breakdown.total - fit.total,
      })
    } else {
      out.push({
        id: 'shorten-trip',
        title: 'Shorten the trip',
        detail: `Removing one day would save about ${money(breakdown.total - oneLess)}, though it may not be enough on its own.`,
        saving: breakdown.total - oneLess,
      })
    }
  }

  const flight = middleByPrice(flights, (x) => x.totalPrice)
  const cheapestFlight = [...flights].sort((x, y) => x.totalPrice - y.totalPrice)[0]
  if (flight && cheapestFlight && flight.totalPrice > cheapestFlight.totalPrice) {
    const saving = withMisc(flight.totalPrice - cheapestFlight.totalPrice)
    const live = cheapestFlight.dataSource === 'live'
    out.push({
      id: 'cheaper-flight',
      title: 'Consider a lower flight estimate',
      detail: `The lowest ${live ? 'search result' : 'demo fare'} (${pluralize(cheapestFlight.stops, 'stop')}) is about ${money(saving)} less than the mid-priced one. ${live ? 'Fares change and may differ when you book.' : 'Real fares and availability will differ.'}`,
      saving,
    })
  }

  // Largest-category pointer, computed from the real breakdown.
  const largest = [...breakdown.lines].sort((a, b) => b.amount - a.amount)[0]
  if (largest && breakdown.total > 0 && !out.some((s) => s.id === `focus-${largest.key}`)) {
    const share = Math.round((largest.amount / breakdown.total) * 100)
    if (share >= 35 && ['accommodation', 'flights'].includes(largest.key)) {
      out.push({
        id: `focus-${largest.key}`,
        title: `${largest.label} is ${share}% of the estimate`,
        detail: `${largest.label} is your biggest cost (${money(largest.amount)} of ${money(breakdown.total)}), so it is the most effective place to save.`,
      })
    }
  }

  return out.sort((x, y) => (y.saving ?? 0) - (x.saving ?? 0)).slice(0, 4)
}

/**
 * Status rules: "above" when estimate > budget; "close" when it is within 10% below
 * the budget (ratio >= 0.9); "within" otherwise; "unknown" without a usable budget.
 * (These are the frontend's rules: within | close | above | unknown.)
 */
function calculateFeasibility({ budget, total, currency, budgetAmountSaved, suggestionsFn }) {
  const money = (n) => formatMoney(n, currency)

  if (budget === null) {
    const reason =
      budgetAmountSaved === null
        ? 'No budget was saved, so there is nothing to compare the estimate against.'
        : 'Your budget currency is missing or not supported for estimates, so the estimate cannot be compared with it.'
    return {
      status: 'unknown',
      label: 'Budget Not Available',
      message: reason,
      budget: null,
      total,
      difference: null,
      ratio: null,
      suggestions: [],
    }
  }

  const difference = budget - total
  const ratio = total / budget

  if (total > budget) {
    return {
      status: 'above',
      label: 'Above Your Budget',
      message: `Estimated at ${money(total)} — about ${money(-difference)} over your ${money(budget)} budget.`,
      budget,
      total,
      difference,
      ratio,
      suggestions: suggestionsFn(),
    }
  }

  if (ratio >= CLOSE_TO_BUDGET_THRESHOLD) {
    return {
      status: 'close',
      label: 'Close to Your Budget',
      message: `Estimated at ${money(total)}, within 10% of your ${money(budget)} budget with about ${money(difference)} to spare. Small price changes could push it over.`,
      budget,
      total,
      difference,
      ratio,
      suggestions: suggestionsFn().slice(0, 2),
    }
  }

  return {
    status: 'within',
    label: 'Within Your Budget',
    message: `Estimated at ${money(total)}, leaving about ${money(difference)} of your ${money(budget)} budget.`,
    budget,
    total,
    difference,
    ratio,
    suggestions: [],
  }
}

/** Convenience: feasibility for a built breakdown (suggestions computed lazily). */
function buildFeasibility(ctx, budget) {
  return calculateFeasibility({
    budget,
    total: ctx.breakdown.total,
    currency: ctx.p.currency,
    budgetAmountSaved: ctx.p.req.budget.amount,
    suggestionsFn: () => generateSuggestions(ctx, budget),
  })
}

// --- Adjustment limits (What if? controls) -----------------------------------------

function niceStep(value) {
  const exp = Math.floor(Math.log10(value)) - 1
  return Math.max(1, 10 ** exp)
}

function roundToStep(value, step) {
  return Math.max(step, Math.round(value / step) * step)
}

function buildLimits(p, baseDays, maxPlannedDays) {
  const original = p.currencyAssumed ? null : p.req.budget.amount
  let budgetRange = null
  if (original !== null) {
    const step = niceStep(original)
    const min = roundToStep(original * 0.5, step)
    const max = roundToStep(original * 1.5, step)
    if (max > min) budgetRange = { min, max, step }
  }
  const options = new Set()
  for (let offset = -3; offset <= 3; offset++) {
    const d = baseDays + offset
    if (d >= 1 && d <= maxPlannedDays) options.add(d)
  }
  return {
    original: { budget: original, durationDays: baseDays },
    budgetRange,
    durationOptions: [...options].sort((x, y) => x - y),
  }
}

module.exports = {
  MISC_RATE,
  FOOD_USD_PER_PERSON_DAY,
  TRANSPORT_USD_PER_PERSON_DAY,
  CLOSE_TO_BUDGET_THRESHOLD,
  ACTIVITY_LEVEL_USD,
  middleByPrice,
  stayTotalFor,
  calculateBudgetBreakdown,
  generateSuggestions,
  calculateFeasibility,
  buildFeasibility,
  buildLimits,
}
