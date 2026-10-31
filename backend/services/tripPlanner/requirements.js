'use strict'

const { DESTINATION_FIXTURES, DEMO_RATES_PER_USD, genericFixture } = require('./fixtures')

/**
 * Input normalisation + effective trip parameters.
 *
 * Port of normalizeRequirements / resolveParams / duration+budget resolution
 * from lib/travel/trip-planner-service.ts. The frontend's types are the
 * contract, so the output shapes (TripRequirements, PlanEffective) are identical.
 * Anything missing or malformed becomes null / [] — never an invented value.
 */

const MAX_PLANNED_DAYS = 21
const DEFAULT_PLANNED_DAYS = 7

const isRecord = (v) => typeof v === 'object' && v !== null && !Array.isArray(v)

function cleanString(v) {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t || null
}

function cleanList(v) {
  if (!Array.isArray(v)) return []
  return v.filter((x) => typeof x === 'string' && x.trim() !== '').map((x) => x.trim())
}

function cleanNumber(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function daysBetween(start, end) {
  if (!start || !end) return null
  const s = Date.parse(`${start}T00:00:00Z`)
  const e = Date.parse(`${end}T00:00:00Z`)
  if (Number.isNaN(s) || Number.isNaN(e)) return null
  const days = Math.round((e - s) / 86_400_000)
  return days > 0 ? days : null
}

/**
 * @param {Record<string, unknown>|null|undefined} answers raw questionnaire answers
 * @returns {import('./types').TripRequirements} (see lib/travel/trip-planner-types.ts)
 */
function normalizeRequirements(answers) {
  const a = isRecord(answers) ? answers : {}

  const budgetRaw = isRecord(a.budget) ? a.budget : null
  const min = cleanNumber(budgetRaw?.min)
  const max = cleanNumber(budgetRaw?.max)
  const rawAmount = max ?? min
  const amount = rawAmount !== null && rawAmount > 0 ? rawAmount : null
  const currency = cleanString(budgetRaw?.currency)?.toUpperCase() ?? null

  const datesRaw = isRecord(a.dates) ? a.dates : null
  const start = cleanString(datesRaw?.start)
  const end = cleanString(datesRaw?.end)
  const savedDays = cleanNumber(datesRaw?.durationDays)
  const durationDays =
    savedDays !== null && savedDays >= 1 ? Math.round(savedDays) : daysBetween(start, end)

  const partyLabel = cleanString(a.party)
  const travelerCount = partyLabel === 'Solo' ? 1 : partyLabel === 'Couple' ? 2 : null

  return {
    destinationPreference: cleanString(a.destination_preference),
    budget: { min, amount, currency },
    durationDays,
    dates: { start, end },
    partyLabel,
    travelerCount,
    ageGroup: cleanString(a.age_group),
    weather: cleanList(a.weather),
    interests: cleanList(a.interest_type),
    safetyImportance: cleanNumber(a.safety_importance),
    visaStatus: cleanString(a.visa_requirements),
    foodLanguage: cleanString(a.food_language),
    notes: cleanString(a.extra_notes),
    departureLocation: cleanString(a.departure_location ?? a.departure),
  }
}

function placeNameOf(name) {
  return String(name).split(',')[0]?.trim() || String(name)
}

/**
 * Effective parameters used by every estimate (currency, travelers, rooms…).
 * @param {{destination:{id:string,name:string}}} input
 */
function resolveParams(input, req) {
  const placeName = placeNameOf(input.destination.name)
  const fixture = DESTINATION_FIXTURES[input.destination.id] ?? genericFixture(input.destination.id, placeName)
  const hasFixture = Boolean(DESTINATION_FIXTURES[input.destination.id])

  const saved = req.budget.currency
  const supported = saved !== null && Object.prototype.hasOwnProperty.call(DEMO_RATES_PER_USD, saved)
  const currency = supported ? saved : 'USD'
  const rate = DEMO_RATES_PER_USD[currency] ?? 1

  let travelers
  let travelersAssumed = false
  if (req.travelerCount !== null) {
    travelers = req.travelerCount
  } else {
    travelersAssumed = true
    travelers = req.partyLabel === 'Family (kids)' || req.partyLabel === 'Group of friends' ? 4 : 1
  }

  return {
    fixture,
    hasFixture,
    placeName,
    req,
    currency,
    currencyAssumed: !supported,
    rate,
    travelers,
    travelersAssumed,
    rooms: Math.max(1, Math.ceil(travelers / 2)),
  }
}

/**
 * Resolve the effective duration and budget, applying "What if?" adjustments.
 * @param {{budget?:number|null,durationDays?:number|null}} adjustments
 */
function resolveShape(req, p, adjustments = {}) {
  const requestedRaw = cleanNumber(adjustments.durationDays) ?? req.durationDays
  const durationAssumed = requestedRaw === null
  const requested = Math.max(1, Math.round(requestedRaw ?? DEFAULT_PLANNED_DAYS))
  const durationCapped = requested > MAX_PLANNED_DAYS
  const days = Math.min(requested, MAX_PLANNED_DAYS)

  // The budget is only comparable when its currency is usable in the estimate.
  const savedBudget = p.currencyAssumed ? null : req.budget.amount
  const adjustedBudget = cleanNumber(adjustments.budget)
  const budget =
    savedBudget === null
      ? null
      : adjustedBudget !== null && adjustedBudget > 0
        ? adjustedBudget
        : savedBudget

  const baseDays = Math.min(req.durationDays ?? DEFAULT_PLANNED_DAYS, MAX_PLANNED_DAYS)
  return { days, durationAssumed, durationCapped, budget, baseDays }
}

module.exports = {
  MAX_PLANNED_DAYS,
  DEFAULT_PLANNED_DAYS,
  cleanString,
  cleanNumber,
  normalizeRequirements,
  placeNameOf,
  resolveParams,
  resolveShape,
}
