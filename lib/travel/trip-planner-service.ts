// Frontend-only Trip Planner service (phase 1).
//
// This module is the ONLY place that knows the plan is mocked. It turns the
// saved questionnaire answers + a chosen destination into a `TripPlan` made of
// clearly-labelled DEMO data, and supports local "What if?" adjustments.
//
// To go live later, keep the exported function signatures
//   loadTripPlan(input, options?)        -> Promise<TripPlan>
//   adjustTripPlan(input, adjustments)   -> Promise<TripPlan>
// and replace their bodies with fetch calls to the backend (see the contract
// notes at the top of `trip-planner-types.ts`). UI components do not need to
// change as long as the returned `TripPlan` keeps the same shape.
//
// No network requests are made here. No booking URLs are ever fabricated.

import type { Answers } from './types'
import {
  ACCOMMODATION_TIERS,
  DEMO_RATES_PER_USD,
  DESTINATION_FIXTURES,
  FLIGHT_TEMPLATES,
  genericFixture,
  type ActivityTemplate,
  type DestinationFixture,
} from './trip-planner-fixtures'
import { formatDayLabel, formatMoney, pluralize } from './trip-planner-format'
import {
  TripPlannerError,
  type AccommodationOption,
  type ActivityItem,
  type AdjustmentLimits,
  type BudgetBreakdown,
  type BudgetFeasibility,
  type BudgetLine,
  type CostSuggestion,
  type FitReason,
  type FlightOption,
  type ItineraryDay,
  type TripAdjustments,
  type TripFit,
  type TripPlan,
  type TripPlanInput,
  type TripRequirements,
} from './trip-planner-types'

export const MAX_PLANNED_DAYS = 21
export const DEFAULT_PLANNED_DAYS = 7
/** Within this fraction below the budget, the trip is "close to" it. */
export const CLOSE_TO_BUDGET_THRESHOLD = 0.9
const MISC_RATE = 0.07
const FOOD_USD_PER_PERSON_DAY = 28
const TRANSPORT_USD_PER_PERSON_DAY = 8

export const DEMO_DISCLAIMER =
  'Preview plan built from demo data on your device. Flights, stays, activities, and prices are illustrative estimates — nothing is live, verified, or bookable yet.'

// --- Input normalisation ------------------------------------------------------------

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function cleanString(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t ? t : null
}

function cleanList(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v
    .filter((x): x is string => typeof x === 'string' && x.trim() !== '')
    .map((x) => x.trim())
}

function cleanNumber(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function daysBetween(start: string | null, end: string | null): number | null {
  if (!start || !end) return null
  const s = Date.parse(`${start}T00:00:00Z`)
  const e = Date.parse(`${end}T00:00:00Z`)
  if (Number.isNaN(s) || Number.isNaN(e)) return null
  const days = Math.round((e - s) / 86_400_000)
  return days > 0 ? days : null
}

/**
 * Reads the saved questionnaire answers defensively. Anything missing or
 * malformed becomes `null` / `[]` — never an invented value.
 */
export function normalizeRequirements(
  answers: Answers | null | undefined,
): TripRequirements {
  const a: Record<string, unknown> = isRecord(answers) ? answers : {}

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
    savedDays !== null && savedDays >= 1
      ? Math.round(savedDays)
      : daysBetween(start, end)

  const partyLabel = cleanString(a.party)
  const travelerCount =
    partyLabel === 'Solo' ? 1 : partyLabel === 'Couple' ? 2 : null

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
    // The current questionnaire has no departure question. If one is added
    // later under either key, it is picked up automatically.
    departureLocation: cleanString(a.departure_location ?? a.departure),
  }
}

function placeNameOf(name: string): string {
  return name.split(',')[0]?.trim() || name
}

// --- Effective parameters -----------------------------------------------------------

type Params = {
  fixture: DestinationFixture
  placeName: string
  req: TripRequirements
  currency: string
  currencyAssumed: boolean
  rate: number
  travelers: number
  travelersAssumed: boolean
  rooms: number
}

function resolveParams(input: TripPlanInput, req: TripRequirements): Params {
  const placeName = placeNameOf(input.destination.name)
  const fixture =
    DESTINATION_FIXTURES[input.destination.id] ??
    genericFixture(input.destination.id, placeName)

  const saved = req.budget.currency
  const supported = saved !== null && saved in DEMO_RATES_PER_USD
  const currency = supported ? (saved as string) : 'USD'
  const rate = DEMO_RATES_PER_USD[currency] ?? 1

  let travelers: number
  let travelersAssumed = false
  if (req.travelerCount !== null) {
    travelers = req.travelerCount
  } else {
    travelersAssumed = true
    travelers =
      req.partyLabel === 'Family (kids)' || req.partyLabel === 'Group of friends'
        ? 4
        : 1
  }

  return {
    fixture,
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

function moneyFromUsd(usd: number, rate: number): number {
  return Math.round(usd * rate)
}

// --- Itinerary ----------------------------------------------------------------------

const TIME_SLOTS = { morning: '9:30 AM', afternoon: '2:00 PM', evening: '7:30 PM' }

function toActivity(
  t: ActivityTemplate,
  day: number,
  time: string,
  interests: string[],
  rate: number,
): ActivityItem {
  return {
    id: `d${day}-${t.id}`,
    time,
    title: t.title,
    description: t.description,
    estimatedCost: moneyFromUsd(t.costUsd, rate),
    bookAheadNote: t.bookAhead,
    matchedInterests: t.interests.filter((i) => interests.includes(i)),
  }
}

function generateItinerary(p: Params, days: number): ItineraryDay[] {
  const { fixture, placeName, req, rate } = p
  const interests = req.interests
  const start = req.dates.start
  const used = new Set<string>()
  const result: ItineraryDay[] = []

  const unused = (slot: 'day' | 'evening') =>
    fixture.highlights.filter((t) => t.slot === slot && !used.has(t.id))
  const matches = (t: ActivityTemplate, i: string) => t.interests.includes(i)
  const matchesAny = (t: ActivityTemplate) =>
    interests.some((i) => t.interests.includes(i))

  const pickDay = (theme: string | null, count: number): ActivityTemplate[] => {
    const picked: ActivityTemplate[] = []
    const take = (list: ActivityTemplate[]) => {
      for (const t of list) {
        if (picked.length >= count) return
        if (!used.has(t.id)) {
          used.add(t.id)
          picked.push(t)
        }
      }
    }
    if (theme) take(unused('day').filter((t) => matches(t, theme)))
    if (interests.length) take(unused('day').filter(matchesAny))
    take(unused('day'))
    return picked
  }

  const pickEvening = (theme: string | null): ActivityTemplate | undefined => {
    const pool = unused('evening')
    const found =
      (theme ? pool.find((t) => matches(t, theme)) : undefined) ??
      (interests.length ? pool.find(matchesAny) : pool[0])
    if (found) used.add(found.id)
    return found
  }

  const openDay = (day: number): ActivityItem[] => [
    {
      id: `d${day}-open-morning`,
      time: TIME_SLOTS.morning,
      title: `Free morning in ${placeName}`,
      description:
        'Nothing scheduled. Revisit a favourite spot, browse a local market, or sleep in.',
      estimatedCost: 0,
      matchedInterests: [],
    },
    {
      id: `d${day}-open-afternoon`,
      time: TIME_SLOTS.afternoon,
      title: 'Café stop & neighbourhood wander',
      description: 'A relaxed, unplanned afternoon to soak up local life.',
      estimatedCost: 0,
      matchedInterests: [],
    },
  ]

  for (let day = 1; day <= days; day++) {
    const dateLabel = formatDayLabel(start, day - 1)
    const isArrival = day === 1 && days > 1
    const isDeparture = day === days && days > 1

    if (isArrival) {
      result.push({
        day,
        title: `Arrive in ${placeName}`,
        theme: 'Arrival',
        dateLabel,
        activities: [
          {
            id: `d${day}-arrive`,
            time: '3:00 PM',
            title: 'Arrive & check in',
            description:
              'Settle in, drop your bags, and get your bearings. Times depend on your actual flight.',
            matchedInterests: [],
          },
          {
            id: `d${day}-first-evening`,
            time: TIME_SLOTS.evening,
            title: 'Easy first evening',
            description:
              'A short walk around your neighbourhood and a relaxed dinner nearby.',
            matchedInterests: [],
          },
        ],
      })
      continue
    }

    if (isDeparture) {
      result.push({
        day,
        title: 'Departure day',
        theme: 'Departure',
        dateLabel,
        activities: [
          {
            id: `d${day}-depart`,
            time: '10:00 AM',
            title: 'Slow morning & departure',
            description:
              'A café stop or last-minute shopping before heading to the airport.',
            matchedInterests: [],
          },
        ],
      })
      continue
    }

    // Regular day. For a 1-day trip, day 1 is a regular day.
    const middleIndex = days > 1 ? day - 2 : 0
    const theme = interests.length ? interests[middleIndex % interests.length] : null
    const dayPicks = pickDay(theme, 2)
    const eveningPick = pickEvening(theme)

    const activities: ActivityItem[] = []
    dayPicks.forEach((t, i) => {
      activities.push(
        toActivity(t, day, i === 0 ? TIME_SLOTS.morning : TIME_SLOTS.afternoon, interests, rate),
      )
    })
    // Keep days realistic: at most 2 daytime activities + 1 evening.
    if (eveningPick && (theme !== null || middleIndex % 2 === 1)) {
      activities.push(toActivity(eveningPick, day, TIME_SLOTS.evening, interests, rate))
    } else if (eveningPick) {
      used.delete(eveningPick.id)
    }

    if (activities.length === 0) {
      result.push({
        day,
        title: 'Open day',
        theme: 'Flexible time',
        dateLabel,
        activities: openDay(day),
      })
      continue
    }

    // Label the day with the selected interest that its activities actually
    // serve most (preferring the planned theme on ties), else a neutral label.
    const countFor = (i: string) =>
      activities.filter((x) => x.matchedInterests.includes(i)).length
    let dayTheme = 'Local highlights'
    let best = 0
    for (const i of interests) {
      const n = countFor(i)
      if (n > best || (n === best && n > 0 && i === theme)) {
        best = n
        dayTheme = i
      }
    }

    const first = dayPicks[0]
    result.push({
      day,
      title: first ? first.title : `Evening in ${placeName}`,
      theme: dayTheme,
      dateLabel,
      activities,
    })
  }

  return result
}

// --- Accommodation & flights ------------------------------------------------------

function buildAccommodations(p: Params, nights: number): AccommodationOption[] {
  return ACCOMMODATION_TIERS.map((tier, i) => {
    const area = p.fixture.areas[i] ?? p.placeName
    const pricePerNight = moneyFromUsd(tier.baseUsd * p.fixture.costFactor, p.rate)
    return {
      id: `stay-${p.fixture.id}-${tier.id}`,
      name: `Sample ${tier.type} · ${area}`,
      type: tier.type,
      location: `${area}, ${p.placeName}`,
      rating: tier.rating,
      facilities: tier.facilities,
      pricePerNight,
      totalPrice: pricePerNight * nights * p.rooms,
      nights,
      rooms: p.rooms,
      cancellation: tier.cancellation,
    }
  })
}

function clock(totalMinutes: number): { time: string; dayOffset: number } {
  const dayOffset = Math.floor(totalMinutes / 1440)
  const m = ((totalMinutes % 1440) + 1440) % 1440
  const hh = String(Math.floor(m / 60)).padStart(2, '0')
  const mm = String(m % 60).padStart(2, '0')
  return { time: `${hh}:${mm}`, dayOffset }
}

function buildFlights(p: Params): FlightOption[] {
  return FLIGHT_TEMPLATES.map((t) => {
    const durationMin = Math.round(p.fixture.flightHours * t.durationFactor * 60)
    const [dh, dm] = t.departure.split(':').map(Number)
    const arrival = clock(dh * 60 + dm + durationMin)
    const pricePerTraveler = moneyFromUsd(p.fixture.flightBaseUsd * t.priceFactor, p.rate)
    return {
      id: `flight-${p.fixture.id}-${t.id}`,
      airline: t.airline,
      originLabel: p.req.departureLocation ?? 'Your departure city (not set)',
      destinationAirport: p.fixture.airport,
      departureTime: t.departure,
      arrivalTime: arrival.time,
      arrivalNote: arrival.dayOffset > 0 ? `+${arrival.dayOffset} day` : undefined,
      durationLabel: `${Math.floor(durationMin / 60)}h ${String(durationMin % 60).padStart(2, '0')}m`,
      stops: t.stops,
      pricePerTraveler,
      totalPrice: pricePerTraveler * p.travelers,
      travelers: p.travelers,
    }
  })
}

/** Middle-priced option, used as the basis for the budget breakdown. */
function middleByPrice<T>(items: T[], price: (x: T) => number): T | undefined {
  if (items.length === 0) return undefined
  const sorted = [...items].sort((x, y) => price(x) - price(y))
  return sorted[Math.floor((sorted.length - 1) / 2)]
}

// --- Budget ---------------------------------------------------------------------------

type Core = {
  itinerary: ItineraryDay[]
  accommodations: AccommodationOption[]
  flights: FlightOption[]
  budget: BudgetBreakdown
}

function buildCore(p: Params, days: number): Core {
  const nights = Math.max(days - 1, 0)
  const itinerary = generateItinerary(p, days)
  const accommodations = buildAccommodations(p, nights)
  const flights = buildFlights(p)

  const stay = middleByPrice(accommodations, (x) => x.totalPrice)
  const flight = middleByPrice(flights, (x) => x.totalPrice)

  const foodPerDay = moneyFromUsd(FOOD_USD_PER_PERSON_DAY * p.fixture.costFactor, p.rate)
  const transportPerDay = moneyFromUsd(
    TRANSPORT_USD_PER_PERSON_DAY * p.fixture.costFactor,
    p.rate,
  )
  const activityPerPerson = itinerary
    .flatMap((d) => d.activities)
    .reduce((sum, act) => sum + (act.estimatedCost ?? 0), 0)

  const money = (n: number) => formatMoney(n, p.currency)
  const lines: BudgetLine[] = [
    {
      key: 'flights',
      label: 'Flights',
      amount: flight?.totalPrice ?? 0,
      detail: flight
        ? `${money(flight.pricePerTraveler)} × ${pluralize(p.travelers, 'traveler')} (mid-priced demo fare)`
        : 'No demo flight options available',
    },
    {
      key: 'accommodation',
      label: 'Accommodation',
      amount: stay?.totalPrice ?? 0,
      detail: stay
        ? nights > 0
          ? `${money(stay.pricePerNight)} × ${pluralize(nights, 'night')} × ${pluralize(p.rooms, 'room')} (mid-priced demo stay)`
          : 'No overnight stay in a 1-day trip'
        : 'No demo accommodation options available',
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
      detail: `${money(activityPerPerson)} per person across the sample itinerary × ${pluralize(p.travelers, 'traveler')}`,
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

  return {
    itinerary,
    accommodations,
    flights,
    budget: {
      currency: p.currency,
      lines,
      total: lines.reduce((s, l) => s + l.amount, 0),
      basisNote:
        'Demo estimate. Flights and accommodation use the mid-priced demo option; activities use the sample itinerary.',
      basis: { flightId: flight?.id, accommodationId: stay?.id },
    },
  }
}

// --- Feasibility ----------------------------------------------------------------------

function withMisc(amount: number): number {
  return Math.round(amount * (1 + MISC_RATE))
}

function buildSuggestions(
  p: Params,
  core: Core,
  budget: number,
  days: number,
): CostSuggestion[] {
  const money = (n: number) => formatMoney(n, p.currency)
  const out: CostSuggestion[] = []

  // 1. Lower-cost accommodation estimate.
  const stay = middleByPrice(core.accommodations, (x) => x.totalPrice)
  const cheapestStay = [...core.accommodations].sort((x, y) => x.totalPrice - y.totalPrice)[0]
  if (stay && cheapestStay && stay.totalPrice > cheapestStay.totalPrice) {
    out.push({
      id: 'cheaper-stay',
      title: 'Choose a lower-cost accommodation estimate',
      detail: `Using the ${cheapestStay.type.toLowerCase()} estimate instead of the mid-priced one could save about ${money(withMisc(stay.totalPrice - cheapestStay.totalPrice))} in this preview.`,
      saving: withMisc(stay.totalPrice - cheapestStay.totalPrice),
    })
  }

  // 2. Reduce paid activities.
  const paid = core.itinerary
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

  // 3. Shorten the trip.
  if (days > 1) {
    let fit: { days: number; total: number } | null = null
    for (let d = days - 1; d >= 1; d--) {
      const total = buildCore(p, d).budget.total
      if (total <= budget) {
        fit = { days: d, total }
        break
      }
    }
    const oneLess = buildCore(p, days - 1).budget.total
    if (fit) {
      out.push({
        id: 'shorten-trip',
        title: `Shorten the trip to ${pluralize(fit.days, 'day')}`,
        detail: `A ${fit.days}-day version is estimated at ${money(fit.total)}, which fits your budget in this preview.`,
        saving: core.budget.total - fit.total,
      })
    } else {
      out.push({
        id: 'shorten-trip',
        title: 'Shorten the trip',
        detail: `Removing one day would save about ${money(core.budget.total - oneLess)}, though it may not be enough on its own.`,
        saving: core.budget.total - oneLess,
      })
    }
  }

  // 4. Lower flight estimate.
  const flight = middleByPrice(core.flights, (x) => x.totalPrice)
  const cheapestFlight = [...core.flights].sort((x, y) => x.totalPrice - y.totalPrice)[0]
  if (flight && cheapestFlight && flight.totalPrice > cheapestFlight.totalPrice) {
    const saving = withMisc(flight.totalPrice - cheapestFlight.totalPrice)
    out.push({
      id: 'cheaper-flight',
      title: 'Consider a lower flight estimate',
      detail: `The lowest demo fare (${cheapestFlight.stops} stops) is about ${money(saving)} less than the mid-priced one. Real fares and availability will differ.`,
      saving,
    })
  }

  return out.sort((x, y) => (y.saving ?? 0) - (x.saving ?? 0)).slice(0, 4)
}

function buildFeasibility(
  p: Params,
  core: Core,
  budget: number | null,
  days: number,
): BudgetFeasibility {
  const total = core.budget.total
  const money = (n: number) => formatMoney(n, p.currency)

  if (budget === null) {
    const reason = p.req.budget.amount === null
      ? 'No budget was saved, so there is nothing to compare the estimate against.'
      : 'Your budget currency is missing or not supported in the preview, so the estimate cannot be compared with it.'
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
      suggestions: buildSuggestions(p, core, budget, days),
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
      suggestions: buildSuggestions(p, core, budget, days).slice(0, 2),
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

// --- Why this trip fits you -------------------------------------------------------

function joinTitles(titles: string[]): string {
  if (titles.length <= 1) return titles[0] ?? ''
  return `${titles[0]} and ${titles[1]}`
}

function buildFit(
  input: TripPlanInput,
  p: Params,
  itinerary: ItineraryDay[],
  feasibility: BudgetFeasibility,
  days: number,
  durationAssumed: boolean,
  durationCapped: boolean,
): TripFit {
  const { req, placeName, fixture } = p
  const dest = input.destination
  const matches: FitReason[] = []
  const considerations: FitReason[] = []
  const money = (n: number) => formatMoney(n, p.currency)

  // Interests -> itinerary activities that were actually chosen for them.
  for (const interest of req.interests) {
    const hits: { day: number; title: string }[] = []
    for (const d of itinerary) {
      for (const act of d.activities) {
        if (act.matchedInterests.includes(interest)) hits.push({ day: d.day, title: act.title })
      }
    }
    if (hits.length > 0) {
      const dayNums = [...new Set(hits.map((h) => h.day))].slice(0, 3)
      matches.push({
        id: `interest-${interest}`,
        text: `You selected “${interest}”, so the sample itinerary includes ${joinTitles(hits.slice(0, 2).map((h) => h.title))} (${dayNums.length === 1 ? 'day' : 'days'} ${dayNums.join(', ')}).`,
      })
    } else {
      considerations.push({
        id: `interest-missing-${interest}`,
        text: `You selected “${interest}”, but this ${days}-day sample has no ${interest.toLowerCase()} activities for ${placeName}. A longer trip or a different destination may cover it better.`,
      })
    }
  }

  // Weather.
  const weatherPrefs = req.weather.filter((w) => w !== 'No preference')
  if (weatherPrefs.length > 0 && fixture.weather.length > 0) {
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

  // Safety.
  if (req.safetyImportance !== null && req.safetyImportance >= 4) {
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

  // Budget.
  if (feasibility.status === 'within' || feasibility.status === 'close') {
    matches.push({
      id: 'budget',
      text: `The demo estimate of ${money(feasibility.total)} is ${feasibility.status === 'within' ? 'within' : 'close to'} your ${money(feasibility.budget as number)} budget.`,
    })
  } else if (feasibility.status === 'above') {
    considerations.push({
      id: 'budget',
      text: `The demo estimate of ${money(feasibility.total)} is above your ${money(feasibility.budget as number)} budget. See the cost-reduction ideas in the budget section.`,
    })
  }

  // Practical considerations.
  if (p.travelersAssumed && req.partyLabel) {
    considerations.push({
      id: 'party',
      text: `You’re travelling as “${req.partyLabel}”. Estimates assume ${p.travelers} travelers because the exact group size wasn’t saved.`,
    })
  } else if (p.travelersAssumed) {
    considerations.push({
      id: 'party',
      text: 'No travel party was saved, so estimates assume 1 traveler.',
    })
  }

  if (req.visaStatus && req.visaStatus !== 'I have a passport and visa-ready') {
    considerations.push({
      id: 'visa',
      text: `You told us your visa status is “${req.visaStatus}”. Check entry requirements early — this preview does not verify them.`,
    })
  }

  if (req.foodLanguage) {
    const note = req.foodLanguage.length > 80 ? `${req.foodLanguage.slice(0, 77)}…` : req.foodLanguage
    considerations.push({
      id: 'food-language',
      text: `You noted “${note}”. The sample itinerary doesn’t account for this yet — confirm it when choosing restaurants and tours.`,
    })
  }

  if (durationAssumed) {
    considerations.push({
      id: 'duration',
      text: `No trip length was saved, so the sample assumes ${DEFAULT_PLANNED_DAYS} days.`,
    })
  }
  if (durationCapped) {
    considerations.push({
      id: 'duration-capped',
      text: `Your saved trip is longer than ${MAX_PLANNED_DAYS} days. The preview shows the first ${MAX_PLANNED_DAYS} days.`,
    })
  }
  if (!req.departureLocation) {
    considerations.push({
      id: 'departure',
      text: 'No departure city was saved, so flight options use a placeholder origin and illustrative durations.',
    })
  }
  if (fixture.costFactor > 1.1) {
    considerations.push({
      id: 'cost-level',
      text: `${placeName} is set to a higher cost level than average in this preview model, which raises food, transport, and stay estimates.`,
    })
  }
  considerations.push({
    id: 'demo',
    text: 'All prices, flights, and stays are demo estimates — not live availability or confirmed bookings.',
  })

  return { matches, considerations }
}

// --- Adjustment limits ------------------------------------------------------------

function niceStep(value: number): number {
  const exp = Math.floor(Math.log10(value)) - 1
  return Math.max(1, 10 ** exp)
}

function roundToStep(value: number, step: number): number {
  return Math.max(step, Math.round(value / step) * step)
}

function buildLimits(p: Params, baseDays: number): AdjustmentLimits {
  const original = p.currencyAssumed ? null : p.req.budget.amount
  let budgetRange: AdjustmentLimits['budgetRange'] = null
  if (original !== null) {
    const step = niceStep(original)
    const min = roundToStep(original * 0.5, step)
    const max = roundToStep(original * 1.5, step)
    if (max > min) budgetRange = { min, max, step }
  }

  const options = new Set<number>()
  for (let offset = -3; offset <= 3; offset++) {
    const d = baseDays + offset
    if (d >= 1 && d <= MAX_PLANNED_DAYS) options.add(d)
  }
  return {
    original: { budget: original, durationDays: baseDays },
    budgetRange,
    durationOptions: [...options].sort((x, y) => x - y),
  }
}

// --- Public API ---------------------------------------------------------------------

function validateInput(input: TripPlanInput | null | undefined): asserts input is TripPlanInput {
  const d = input?.destination
  if (!d || typeof d.id !== 'string' || !d.id || typeof d.name !== 'string' || !d.name) {
    throw new TripPlannerError(
      'INVALID_INPUT',
      'The selected destination is missing or invalid.',
    )
  }
}

/** Pure, synchronous plan builder. Deterministic for the same inputs. */
export function buildTripPlan(
  input: TripPlanInput,
  adjustments: TripAdjustments = {},
): TripPlan {
  validateInput(input)
  const req = normalizeRequirements(input.answers)
  const p = resolveParams(input, req)

  const requestedRaw = cleanNumber(adjustments.durationDays) ?? req.durationDays
  const durationAssumed = requestedRaw === null
  const requested = Math.max(1, Math.round(requestedRaw ?? DEFAULT_PLANNED_DAYS))
  const durationCapped = requested > MAX_PLANNED_DAYS
  const days = Math.min(requested, MAX_PLANNED_DAYS)

  // Budget is only comparable when its currency is usable in the preview.
  const savedBudget = p.currencyAssumed ? null : req.budget.amount
  const adjustedBudget = cleanNumber(adjustments.budget)
  const budget =
    savedBudget === null
      ? null
      : adjustedBudget !== null && adjustedBudget > 0
        ? adjustedBudget
        : savedBudget

  const core = buildCore(p, days)
  const feasibility = buildFeasibility(p, core, budget, days)
  const baseDays = Math.min(req.durationDays ?? DEFAULT_PLANNED_DAYS, MAX_PLANNED_DAYS)

  return {
    meta: {
      isDemo: true,
      source: 'frontend-demo',
      disclaimer: DEMO_DISCLAIMER,
      generatedAt: new Date().toISOString(),
    },
    destination: {
      id: input.destination.id,
      name: input.destination.name,
      country: input.destination.country,
      imageRef: input.destination.imageRef,
    },
    requirements: req,
    effective: {
      durationDays: days,
      nights: Math.max(days - 1, 0),
      travelers: p.travelers,
      travelersAssumed: p.travelersAssumed,
      durationAssumed,
      durationCapped,
      budget,
      currency: p.currency,
      currencyAssumed: p.currencyAssumed,
      rateNote:
        p.currency !== 'USD' && !p.currencyAssumed
          ? `Demo conversion of about ${p.rate} ${p.currency} per USD — approximate, not a live rate.`
          : null,
    },
    itinerary: core.itinerary,
    accommodations: core.accommodations,
    flights: core.flights,
    budget: core.budget,
    feasibility,
    fit: buildFit(input, p, core.itinerary, feasibility, days, durationAssumed, durationCapped),
    limits: buildLimits(p, baseDays),
  }
}

export type LoadOptions = {
  /** Simulated latency so loading states are visible. Default 900ms. */
  delayMs?: number
  signal?: AbortSignal
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

/**
 * Loads the sample plan. FUTURE: replace with `POST /api/v1/trip-plans`
 * (request `TripPlanRequest`, response `TripPlan`).
 */
export async function loadMockTripPlan(
  input: TripPlanInput,
  options: LoadOptions = {},
): Promise<TripPlan> {
  await wait(options.delayMs ?? 900, options.signal)
  try {
    return buildTripPlan(input)
  } catch (err) {
    if (err instanceof TripPlannerError) throw err
    throw new TripPlannerError(
      'LOAD_FAILED',
      'We couldn’t build the sample plan from the saved details.',
    )
  }
}

/**
 * Applies preview-only "What if?" changes. FUTURE: replace with
 * `POST /api/v1/trip-plans/adjust`.
 */
export async function adjustMockTripPlan(
  input: TripPlanInput,
  adjustments: TripAdjustments,
  options: LoadOptions = {},
): Promise<TripPlan> {
  await wait(options.delayMs ?? 350, options.signal)
  try {
    return buildTripPlan(input, adjustments)
  } catch (err) {
    if (err instanceof TripPlannerError) throw err
    throw new TripPlannerError(
      'LOAD_FAILED',
      'We couldn’t apply that change to the sample plan.',
    )
  }
}

// --- Public entry points ------------------------------------------------------------
// The planner UI imports `loadTripPlan` / `adjustTripPlan` from here. With the backend
// (default) they call the API; the demo implementations above are reachable ONLY when
// NEXT_PUBLIC_USE_MOCKS=true (local development / tests). Signatures are unchanged.

import { USE_MOCKS } from '@/lib/api/client'

export async function loadTripPlan(
  input: TripPlanInput,
  options: LoadOptions = {},
): Promise<TripPlan> {
  if (USE_MOCKS) return loadMockTripPlan(input, options)
  const api = await import('./trip-planner-api')
  return api.loadTripPlanApi(input, options)
}

export async function adjustTripPlan(
  input: TripPlanInput,
  adjustments: TripAdjustments,
  options: LoadOptions = {},
): Promise<TripPlan> {
  if (USE_MOCKS) return adjustMockTripPlan(input, adjustments, options)
  const api = await import('./trip-planner-api')
  return api.adjustTripPlanApi(input, adjustments, options)
}
