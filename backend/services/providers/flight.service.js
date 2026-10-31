'use strict'

const { runLiveSearch } = require('./liveSearch')
const { mapFlightResults, applyTravelers } = require('./serpapi/flights.mapper')
const { buildDemoFlights } = require('./demo/demoFlights')
const { parseIsoDate } = require('../tripPlanner/format')

/**
 * FlightService facade.
 *   interface FlightService { search(params): Promise<FlightSearchResult>; isAvailable(): boolean; getDataSource(): 'live'|'demo' }
 *
 * Controllers/planner code talk to this facade only — never to SerpApi directly —
 * so Duffel (or any provider) can replace the adapter later without touching callers.
 *
 * Live search happens ONLY when ALL are true: a key is configured, exact future
 * dates exist inside Google Flights' window (~330 days), and BOTH airports were
 * resolved. Otherwise (or on quota/caps/provider failure) labelled demo flights
 * are returned with an explanatory warning. An assumed date is never searched.
 */

const LIVE_WINDOW_DAYS = 330

const todayUtc = (now) => now().toISOString().slice(0, 10)

/** @returns {{ok:true}|{ok:false,reason:string,message:string}} */
function checkLiveEligibility({ outboundDate, returnDate, originIata, destIata, now = () => new Date() }) {
  const out = parseIsoDate(outboundDate)
  const ret = parseIsoDate(returnDate)
  if (!out || !ret) {
    return { ok: false, reason: 'no_dates', message: 'Live flights need exact travel dates, so demo flights are shown.' }
  }
  const today = parseIsoDate(todayUtc(now))
  if (out.getTime() <= today.getTime()) {
    return { ok: false, reason: 'dates_in_past', message: 'Your travel dates are not in the future, so demo flights are shown.' }
  }
  if ((out.getTime() - today.getTime()) / 86_400_000 > LIVE_WINDOW_DAYS) {
    return {
      ok: false,
      reason: 'dates_too_far',
      message: 'Your dates are further ahead than flight search covers, so demo flights are shown.',
    }
  }
  if (ret.getTime() < out.getTime()) {
    return { ok: false, reason: 'bad_return', message: 'The return date is before departure, so demo flights are shown.' }
  }
  if (!originIata) {
    return { ok: false, reason: 'no_origin', message: 'We could not match your departure city to an airport, so demo flights are shown.' }
  }
  if (!destIata) {
    return { ok: false, reason: 'no_destination', message: 'We could not match the destination to an airport, so demo flights are shown.' }
  }
  if (originIata === destIata) {
    return { ok: false, reason: 'same_airport', message: 'Departure and destination airports are the same, so demo flights are shown.' }
  }
  return { ok: true }
}

/**
 * @param {object} deps { client|null, cache, quota, ttlSeconds, now }
 */
function createFlightService({ client, cache, quota, ttlSeconds = 6 * 3600, now = () => new Date() }) {
  const enabled = Boolean(client)

  /**
   * @param {object} q
   * @param {string|null} q.originIata
   * @param {string|null} q.destIata
   * @param {string|null} q.outboundDate  YYYY-MM-DD
   * @param {string|null} q.returnDate
   * @param {number} q.travelers
   * @param {string} q.currency           must be a currency the plan supports
   * @param {object} q.params             resolved plan params (for the demo fallback)
   * @param {{userId?:string|null, ip?:string}} [q.who]
   * @returns {Promise<{options:Array, dataSource:'live'|'demo', status:'ok'|'demo', warnings:string[], reason?:string, searched?:object}>}
   */
  async function search(q) {
    const demo = (warning, reason) => ({
      options: buildDemoFlights(q.params),
      dataSource: 'demo',
      status: 'demo',
      warnings: warning ? [warning] : [],
      reason,
    })

    if (!enabled) {
      return demo('Live flight search is not configured on this server, so demo flights are shown.', 'not_configured')
    }
    const eligible = checkLiveEligibility({ ...q, now })
    if (!eligible.ok) return demo(eligible.message, eligible.reason)

    const outcome = await runLiveSearch({
      provider: 'serpapi_flights',
      kind: 'flights',
      keyParams: { o: q.originIata, d: q.destIata, out: q.outboundDate, ret: q.returnDate, cur: q.currency },
      ttlSeconds,
      cache,
      quota,
      who: q.who,
      call: () =>
        client.search({
          engine: 'google_flights',
          departure_id: q.originIata,
          arrival_id: q.destIata,
          outbound_date: q.outboundDate,
          return_date: q.returnDate,
          currency: q.currency,
          adults: 1, // price semantics: round trip, ONE traveler (we scale by travelers)
          hl: 'en',
          type: 1,
        }),
      map: (json) => mapFlightResults(json, { originIata: q.originIata, destIata: q.destIata }),
    })

    if (outcome.state === 'live') {
      return {
        options: applyTravelers(outcome.options, q.travelers),
        dataSource: 'live',
        status: 'ok',
        warnings: [],
        searched: { origin: q.originIata, destination: q.destIata, outbound: q.outboundDate, return: q.returnDate },
        fromCache: outcome.fromCache,
      }
    }
    if (outcome.state === 'empty') {
      return demo('No live flights were found for these dates and airports, so demo flights are shown.', 'no_results')
    }
    if (outcome.state === 'blocked') {
      return demo(`${outcome.message} Demo flights are shown instead.`, outcome.reason)
    }
    return demo('Live flight search is temporarily unavailable, so demo flights are shown.', outcome.reason)
  }

  return {
    search,
    isAvailable: () => enabled,
    getDataSource: () => (enabled ? 'live' : 'demo'),
  }
}

module.exports = { createFlightService, checkLiveEligibility, LIVE_WINDOW_DAYS }
