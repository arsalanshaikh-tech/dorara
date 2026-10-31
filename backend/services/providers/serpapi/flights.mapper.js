'use strict'

const { z } = require('zod')
const { durationLabel } = require('../demo/demoFlights')

/**
 * Maps a SerpApi Google Flights response to the frontend FlightOption contract.
 *
 * PRICE SEMANTICS (important): the search is ALWAYS made for 1 adult, so
 * `price` is unambiguously the ROUND-TRIP price for ONE traveler in the requested
 * currency. totalPrice = pricePerTraveler x travelers is computed by us (see
 * applyTravelers). Real group fares can differ slightly; the UI labels it an estimate.
 *
 * Flight legs / times shown are the OUTBOUND itinerary (that is what SerpApi
 * returns for a round-trip search); the price is the round-trip fare.
 *
 * Honesty rules enforced here:
 *  - an option exists only if the response has a numeric price > 0;
 *  - bookingUrl is only ever the Google Flights results URL the response itself
 *    supplies (https, www.google.com) — never constructed, never a checkout link;
 *  - everything mapped is dataSource "live".
 */

const airportSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  time: z.string().optional(),
  date: z.string().optional(),
})

const legSchema = z.object({
  departure_airport: airportSchema,
  arrival_airport: airportSchema,
  airline: z.string().optional(),
  duration: z.number().optional(),
})

const itinerarySchema = z.object({
  price: z.number().positive(),
  flights: z.array(legSchema).min(1),
  layovers: z.array(z.unknown()).optional(),
  total_duration: z.number().positive().optional(),
})

/** Parses "2026-11-19 17:00" | "2026-11-19T17:00" | "17:00" (+ optional separate date). */
function parseWhen(time, date) {
  if (typeof time !== 'string') return null
  const full = time.match(/(\d{4}-\d{2}-\d{2})[ T](\d{1,2}):(\d{2})/)
  if (full) return { date: full[1], hhmm: `${full[2].padStart(2, '0')}:${full[3]}` }
  const t = time.match(/(\d{1,2}):(\d{2})/)
  if (!t) return null
  const d = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null
  return { date: d, hhmm: `${t[1].padStart(2, '0')}:${t[2]}` }
}

function dayDiff(a, b) {
  if (!a || !b) return 0
  const diff = Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000)
  return Number.isFinite(diff) && diff > 0 ? diff : 0
}

function airlineLabel(legs) {
  const names = [...new Set(legs.map((l) => l.airline).filter(Boolean))]
  if (names.length === 0) return 'Airline not specified'
  if (names.length <= 2) return names.join(' + ')
  return `${names[0]} + ${names.length - 1} more`
}

function safeGoogleFlightsUrl(json) {
  const url = json?.search_metadata?.google_flights_url
  if (typeof url !== 'string') return undefined
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && u.hostname === 'www.google.com' ? u.toString() : undefined
  } catch {
    return undefined
  }
}

/**
 * @param {any} json SerpApi response
 * @param {{originIata:string,destIata:string,maxOptions?:number}} ctx
 * @returns {{options: Array<object>, searchUrl: string|undefined}} options priced for ONE traveler
 */
function mapFlightResults(json, { originIata, destIata, maxOptions = 4 }) {
  const raw = [...(json?.best_flights ?? []), ...(json?.other_flights ?? [])]
  const searchUrl = safeGoogleFlightsUrl(json)

  const parsed = []
  const seen = new Set()
  for (const item of raw) {
    const r = itinerarySchema.safeParse(item)
    if (!r.success) continue
    const it = r.data
    const first = it.flights[0]
    const last = it.flights[it.flights.length - 1]
    const dep = parseWhen(first.departure_airport.time, first.departure_airport.date)
    const arr = parseWhen(last.arrival_airport.time, last.arrival_airport.date)
    if (!dep || !arr) continue

    const minutes =
      it.total_duration ?? it.flights.reduce((s, l) => s + (l.duration ?? 0), 0)
    if (!(minutes > 0)) continue

    const airline = airlineLabel(it.flights)
    const dedupeKey = `${airline}|${dep.hhmm}|${arr.hhmm}|${Math.round(it.price)}`
    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)

    const arrDays = dayDiff(dep.date, arr.date)
    const stops = Array.isArray(it.layovers) ? it.layovers.length : it.flights.length - 1
    const price = Math.round(it.price)

    parsed.push({
      minutes,
      option: {
        id: '',
        airline,
        originLabel: first.departure_airport.name
          ? `${first.departure_airport.name} (${first.departure_airport.id ?? originIata})`
          : (first.departure_airport.id ?? originIata),
        destinationAirport: last.arrival_airport.id ?? destIata,
        departureTime: dep.hhmm,
        arrivalTime: arr.hhmm,
        arrivalNote: arrDays > 0 ? `+${arrDays} day${arrDays > 1 ? 's' : ''}` : undefined,
        durationLabel: durationLabel(Math.round(minutes)),
        stops,
        pricePerTraveler: price,
        totalPrice: price, // 1 traveler basis; scaled by applyTravelers()
        travelers: 1,
        bookingUrl: searchUrl,
        dataSource: 'live',
      },
    })
  }

  // Cheapest first (3), plus the shortest-duration option if it is not among them.
  const byPrice = [...parsed].sort((a, b) => a.option.pricePerTraveler - b.option.pricePerTraveler)
  const picked = byPrice.slice(0, Math.max(1, maxOptions - 1))
  const shortest = [...parsed].sort((a, b) => a.minutes - b.minutes)[0]
  if (shortest && !picked.includes(shortest) && picked.length < maxOptions) picked.push(shortest)

  const options = picked
    .sort((a, b) => a.option.pricePerTraveler - b.option.pricePerTraveler)
    .map((p, i) => ({ ...p.option, id: `flight-live-${destIata}-${i + 1}` }))

  return { options, searchUrl }
}

/** Scale one-traveler options to the party size (a pure function). */
function applyTravelers(options, travelers) {
  return options.map((o) => ({
    ...o,
    travelers,
    totalPrice: o.pricePerTraveler * travelers,
  }))
}

module.exports = { mapFlightResults, applyTravelers, parseWhen, safeGoogleFlightsUrl }
