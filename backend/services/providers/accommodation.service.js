'use strict'

const { runLiveSearch } = require('./liveSearch')
const { mapHotelResults, applyRooms } = require('./serpapi/hotels.mapper')
const { buildDemoStays } = require('./demo/demoStays')
const { parseIsoDate } = require('../tripPlanner/format')
const { LIVE_WINDOW_DAYS } = require('./flight.service')

/**
 * AccommodationService facade (see flight.service.js for the pattern).
 *   interface AccommodationService { search(params): Promise<StaySearchResult>; isAvailable(); getDataSource() }
 *
 * Live search only with a key, exact future check-in/check-out dates within the
 * search window, and at least one night. Otherwise labelled demo stays
 * ("Demo Stay – Central Hotel", no bookingUrl, no image, no cancellation text).
 */

function checkStayEligibility({ checkIn, checkOut, nights, now = () => new Date() }) {
  const a = parseIsoDate(checkIn)
  const b = parseIsoDate(checkOut)
  if (!a || !b) return { ok: false, reason: 'no_dates', message: 'Live stays need exact travel dates, so demo stays are shown.' }
  if (!(nights >= 1)) return { ok: false, reason: 'no_nights', message: 'A 1-day trip has no overnight stay.' }
  const today = parseIsoDate(now().toISOString().slice(0, 10))
  if (a.getTime() <= today.getTime()) {
    return { ok: false, reason: 'dates_in_past', message: 'Your travel dates are not in the future, so demo stays are shown.' }
  }
  if ((a.getTime() - today.getTime()) / 86_400_000 > LIVE_WINDOW_DAYS) {
    return { ok: false, reason: 'dates_too_far', message: 'Your dates are further ahead than stay search covers, so demo stays are shown.' }
  }
  return { ok: true }
}

function createAccommodationService({ client, cache, quota, ttlSeconds = 12 * 3600, now = () => new Date() }) {
  const enabled = Boolean(client)

  /**
   * @param {object} q
   * @param {string} q.destinationQuery  e.g. "Hotels in Lisbon, Portugal"
   * @param {string} q.placeName         label stored as the stay location
   * @param {string|null} q.checkIn
   * @param {string|null} q.checkOut
   * @param {number} q.nights
   * @param {number} q.rooms
   * @param {number} q.travelers
   * @param {string} q.currency
   * @param {object} q.params            resolved plan params (for the demo fallback)
   * @param {{userId?:string|null, ip?:string}} [q.who]
   */
  async function search(q) {
    const demo = (warning, reason) => ({
      options: buildDemoStays(q.params, q.nights),
      dataSource: 'demo',
      status: 'demo',
      warnings: warning ? [warning] : [],
      reason,
    })

    if (!enabled) return demo('Live stay search is not configured on this server, so demo stays are shown.', 'not_configured')
    const eligible = checkStayEligibility({ ...q, now })
    if (!eligible.ok) return demo(eligible.message, eligible.reason)

    const adults = Math.min(Math.max(q.travelers, 1), 2) // price is per ROOM; a room hosts 1-2 adults
    const outcome = await runLiveSearch({
      provider: 'serpapi_hotels',
      kind: 'hotels',
      keyParams: { q: q.destinationQuery, in: q.checkIn, out: q.checkOut, adults, cur: q.currency },
      ttlSeconds,
      cache,
      quota,
      who: q.who,
      call: () =>
        client.search({
          engine: 'google_hotels',
          q: q.destinationQuery,
          check_in_date: q.checkIn,
          check_out_date: q.checkOut,
          adults,
          currency: q.currency,
          hl: 'en',
        }),
      map: (json) => mapHotelResults(json, { nights: q.nights, placeName: q.placeName }),
    })

    if (outcome.state === 'live') {
      return {
        options: applyRooms(outcome.options, q.rooms),
        dataSource: 'live',
        status: 'ok',
        warnings: [],
        searched: { query: q.destinationQuery, checkIn: q.checkIn, checkOut: q.checkOut },
        fromCache: outcome.fromCache,
      }
    }
    if (outcome.state === 'empty') return demo('No live stays were found for these dates, so demo stays are shown.', 'no_results')
    if (outcome.state === 'blocked') return demo(`${outcome.message} Demo stays are shown instead.`, outcome.reason)
    return demo('Live stay search is temporarily unavailable, so demo stays are shown.', outcome.reason)
  }

  return { search, isAvailable: () => enabled, getDataSource: () => (enabled ? 'live' : 'demo') }
}

module.exports = { createAccommodationService, checkStayEligibility }
