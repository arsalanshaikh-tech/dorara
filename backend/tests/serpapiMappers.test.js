'use strict'

const { test } = require('node:test')
const assert = require('node:assert/strict')
const path = require('path')
const os = require('os')
process.env.LOG_DIR = path.join(os.tmpdir(), 'dorara-test-logs')
const root = path.join(__dirname, '..')
const { mapFlightResults, applyTravelers, parseWhen, safeGoogleFlightsUrl } = require(path.join(root, 'services/providers/serpapi/flights.mapper'))
const { mapHotelResults, applyRooms, safePropertyLink, spreadPick } = require(path.join(root, 'services/providers/serpapi/hotels.mapper'))
const flightsJson = require('./fixtures/serpapi-flights.sample.json')
const hotelsJson = require('./fixtures/serpapi-hotels.sample.json')

// ----- flights -----
test('flights mapper: only itineraries with a real price > 0 become options', () => {
  const { options } = mapFlightResults(flightsJson, { originIata: 'DEL', destIata: 'LIS' })
  assert.equal(options.length, 3) // 620, 480, 410 (the no-price and zero-price ones are dropped)
  for (const o of options) {
    assert.equal(o.dataSource, 'live')
    assert.ok(o.pricePerTraveler > 0)
    assert.ok(!/No Price Air|Zero Price Air/.test(o.airline))
  }
})

test('flights mapper: sorted cheapest first; fields mapped to the frontend contract', () => {
  const { options } = mapFlightResults(flightsJson, { originIata: 'DEL', destIata: 'LIS' })
  assert.deepEqual(options.map((o) => o.pricePerTraveler), [410, 480, 620])
  const direct = options.find((o) => o.pricePerTraveler === 620)
  assert.equal(direct.airline, 'Sample Carrier A')
  assert.equal(direct.originLabel, 'Indira Gandhi International Airport (DEL)')
  assert.equal(direct.destinationAirport, 'LIS')
  assert.equal(direct.departureTime, '02:30')
  assert.equal(direct.arrivalTime, '11:55')
  assert.equal(direct.durationLabel, '10h 25m')
  assert.equal(direct.stops, 0)
  assert.equal(direct.arrivalNote, undefined)
  const oneStop = options.find((o) => o.pricePerTraveler === 480)
  assert.equal(oneStop.airline, 'Sample Carrier B + Sample Carrier C')
  assert.equal(oneStop.stops, 1)
  assert.equal(oneStop.arrivalNote, '+1 day')
  assert.equal(oneStop.durationLabel, '13h 10m')
})

test('flights mapper: includes the shortest option even if not among the cheapest', () => {
  const { options } = mapFlightResults(flightsJson, { originIata: 'DEL', destIata: 'LIS', maxOptions: 2 })
  assert.equal(options.length, 2)
  assert.ok(options.some((o) => o.durationLabel === '10h 25m'), 'shortest kept')
})

test('flights mapper: bookingUrl is ONLY the google.com URL the response supplied', () => {
  const { options, searchUrl } = mapFlightResults(flightsJson, { originIata: 'DEL', destIata: 'LIS' })
  assert.match(searchUrl, /^https:\/\/www\.google\.com\/travel\/flights/)
  assert.ok(options.every((o) => o.bookingUrl === searchUrl))
  const none = mapFlightResults({ ...flightsJson, search_metadata: {} }, { originIata: 'DEL', destIata: 'LIS' })
  assert.ok(none.options.every((o) => o.bookingUrl === undefined), 'never invented')
  assert.equal(safeGoogleFlightsUrl({ search_metadata: { google_flights_url: 'https://evil.test/x' } }), undefined)
  assert.equal(safeGoogleFlightsUrl({ search_metadata: { google_flights_url: 'http://www.google.com/x' } }), undefined)
})

test('flights mapper: empty or malformed payloads produce no options, never throw', () => {
  for (const j of [null, {}, { best_flights: 'nope' }, { best_flights: [{}] }, { other_flights: [null, 5] }]) {
    assert.deepEqual(mapFlightResults(j, { originIata: 'A', destIata: 'B' }).options, [])
  }
})

test('flights: applyTravelers scales the total, keeps per-traveler price (1-adult search basis)', () => {
  const { options } = mapFlightResults(flightsJson, { originIata: 'DEL', destIata: 'LIS' })
  const scaled = applyTravelers(options, 3)
  assert.deepEqual(scaled.map((o) => o.totalPrice), [1230, 1440, 1860])
  assert.ok(scaled.every((o) => o.travelers === 3))
  assert.deepEqual(scaled.map((o) => o.pricePerTraveler), [410, 480, 620])
})

test('parseWhen handles the documented time formats', () => {
  assert.deepEqual(parseWhen('2027-03-10 02:30'), { date: '2027-03-10', hhmm: '02:30' })
  assert.deepEqual(parseWhen('2027-03-10T9:05'), { date: '2027-03-10', hhmm: '09:05' })
  assert.deepEqual(parseWhen('9:05', '2027-03-10'), { date: '2027-03-10', hhmm: '09:05' })
  assert.equal(parseWhen('soon'), null)
  assert.equal(parseWhen(undefined), null)
})

// ----- hotels -----
test('hotels mapper: requires a real nightly rate; dedupes by name; skips unpriced', () => {
  const { options } = mapHotelResults(hotelsJson, { nights: 5, placeName: 'Lisbon', maxOptions: 20 })
  const names = options.map((o) => o.name)
  assert.ok(!names.includes('No Rate Hotel'))
  assert.equal(names.filter((n) => n === 'Sample Harbour Inn').length, 1)
  assert.ok(options.every((o) => o.pricePerNight > 0 && o.dataSource === 'live'))
})

test('hotels mapper: uses only what the response contains', () => {
  const { options } = mapHotelResults(hotelsJson, { nights: 5, placeName: 'Lisbon', maxOptions: 20 })
  const inn = options.find((o) => o.name === 'Sample Harbour Inn')
  assert.equal(inn.pricePerNight, 62)
  assert.equal(inn.totalPrice, 312, "provider's own total is used when given")
  assert.equal(inn.rating, 4.2)
  assert.deepEqual(inn.facilities, ['Free Wi-Fi', 'Breakfast', 'Air conditioning', 'Pool', 'Gym', 'Bar'], 'strings only, deduped, max 6')
  assert.equal(inn.bookingUrl, 'https://www.example-property.test/harbour')
  assert.equal(inn.imageUrl, 'https://lh3.googleusercontent.com/sample1')
  assert.equal(inn.location, 'Lisbon')
  assert.equal(inn.cancellation, undefined, 'cancellation is never populated')

  const suites = options.find((o) => o.name === 'Sample Old Town Suites')
  assert.equal(suites.bookingUrl, undefined, 'no link in response -> no bookingUrl')
  assert.equal(suites.imageUrl, undefined, 'non-https image rejected')
  assert.equal(suites.totalPrice, 118 * 5, 'no provider total -> nightly x nights')
  assert.deepEqual(suites.facilities, ['Spa'])

  const ad = options.find((o) => o.name === 'Sample Ad Placement')
  assert.equal(ad.bookingUrl, undefined, 'Google ad-click redirect is not a property link')
  assert.equal(ad.rating, undefined, 'missing rating stays undefined')
  assert.deepEqual(ad.facilities, [], 'missing amenities are not invented')

  const palace = options.find((o) => o.name === 'Sample Grand Palace')
  assert.equal(palace.bookingUrl, undefined, 'http (non-https) links rejected')
})

test('hotels mapper: returns 3-6 options spread across price tiers, cheapest first', () => {
  const { options } = mapHotelResults(hotelsJson, { nights: 5, placeName: 'Lisbon' })
  assert.ok(options.length >= 3 && options.length <= 6)
  const prices = options.map((o) => o.pricePerNight)
  assert.deepEqual(prices, [...prices].sort((a, b) => a - b))
  assert.equal(prices[0], 25)
  assert.equal(prices[prices.length - 1], 301)
})

test('hotels: applyRooms multiplies the stay total by rooms; spreadPick/safePropertyLink edge cases', () => {
  const { options } = mapHotelResults(hotelsJson, { nights: 5, placeName: 'Lisbon', maxOptions: 20 })
  const two = applyRooms(options, 2)
  assert.equal(two.find((o) => o.name === 'Sample Harbour Inn').totalPrice, 624)
  assert.equal(two[0].rooms, 2)
  assert.deepEqual(spreadPick([1, 2, 3], 5), [1, 2, 3])
  assert.equal(spreadPick([1, 2, 3, 4, 5, 6, 7, 8], 3).length, 3)
  assert.equal(safePropertyLink('javascript:alert(1)'), undefined)
  assert.equal(safePropertyLink(undefined), undefined)
  assert.deepEqual(mapHotelResults({}, { nights: 3, placeName: 'X' }).options, [])
})
