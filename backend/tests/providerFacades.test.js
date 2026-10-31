'use strict'

const { test } = require('node:test')
const assert = require('node:assert/strict')
const path = require('path')
const os = require('os')
process.env.LOG_DIR = path.join(os.tmpdir(), 'dorara-test-logs')
const root = path.join(__dirname, '..')
const { createFlightService, checkLiveEligibility } = require(path.join(root, 'services/providers/flight.service'))
const { createAccommodationService } = require(path.join(root, 'services/providers/accommodation.service'))
const { createProviderCache, createMemoryStore, makeCacheKey } = require(path.join(root, 'services/providers/providerCache.service'))
const { createQuota, createMemoryUsageStore } = require(path.join(root, 'services/providers/quota.service'))
const { SerpApiError } = require(path.join(root, 'services/providers/serpapi/client'))
const { normalizeRequirements, resolveParams } = require(path.join(root, 'services/tripPlanner/requirements'))
const flightsJson = require('./fixtures/serpapi-flights.sample.json')
const hotelsJson = require('./fixtures/serpapi-hotels.sample.json')

const NOW = () => new Date('2026-10-05T10:00:00Z')
const cfg = { monthlyLimit: 250, stopRatio: 0.8, dailyLimit: 8, hourlyLimit: 40, guestDaily: 3, userDaily: 10, salt: 's' }

const dest = { id: 'lisbon', name: 'Lisbon, Portugal', country: 'Portugal' }
const params = (o = {}) => {
  const req = normalizeRequirements({
    budget: { max: 3000, currency: 'EUR' },
    dates: { start: '2027-03-10', end: null, durationDays: 6 },
    party: 'Couple',
    departure_location: 'Delhi',
    ...o,
  })
  return resolveParams({ destination: dest }, req)
}

function setup({ clientImpl, quotaCfg } = {}) {
  const calls = []
  const client = clientImpl === null ? null : {
    search: clientImpl ?? (async (q) => {
      calls.push(q)
      return { empty: false, json: q.engine === 'google_flights' ? flightsJson : hotelsJson }
    }),
  }
  if (client && !clientImpl) {
    // count via the default impl above
  }
  const usage = createMemoryUsageStore()
  const quota = createQuota({ store: usage, config: { ...cfg, ...quotaCfg }, now: NOW })
  const cache = createProviderCache(createMemoryStore(), () => NOW().getTime())
  const flights = createFlightService({ client, cache, quota, now: NOW })
  const stays = createAccommodationService({ client, cache, quota, now: NOW })
  return { calls, flights, stays, usage, cache }
}

const flightQ = (over = {}) => ({
  originIata: 'DEL', destIata: 'LIS', outboundDate: '2027-03-10', returnDate: '2027-03-15',
  travelers: 2, currency: 'EUR', params: params(), who: { ip: '1.1.1.1' }, ...over,
})
const stayQ = (over = {}) => ({
  destinationQuery: 'Hotels in Lisbon, Portugal', placeName: 'Lisbon', checkIn: '2027-03-10', checkOut: '2027-03-15',
  nights: 5, rooms: 1, travelers: 2, currency: 'EUR', params: params(), who: { ip: '1.1.1.1' }, ...over,
})

// ---------- labelling ----------
test('no key configured: demo flights + stays, clearly labelled, with a warning and NO bookingUrl/image', async () => {
  const { flights, stays } = setup({ clientImpl: null })
  const f = await flights.search(flightQ())
  const s = await stays.search(stayQ())
  for (const r of [f, s]) {
    assert.equal(r.dataSource, 'demo')
    assert.equal(r.status, 'demo')
    assert.equal(r.reason, 'not_configured')
    assert.ok(r.warnings.length === 1)
    assert.ok(r.options.length > 0)
    for (const o of r.options) {
      assert.equal(o.dataSource, 'demo')
      assert.equal(o.bookingUrl, undefined)
      assert.equal(o.imageUrl, undefined)
      assert.equal(o.cancellation, undefined)
    }
  }
  assert.ok(s.options.every((o) => /^Demo Stay – /.test(o.name)))
  assert.equal(flights.isAvailable(), false)
  assert.equal(flights.getDataSource(), 'demo')
})

test('with a key + valid inputs: live results, labelled live, scaled to travelers/rooms', async () => {
  const { flights, stays, calls } = setup()
  const f = await flights.search(flightQ({ travelers: 3 }))
  assert.equal(f.dataSource, 'live')
  assert.equal(f.status, 'ok')
  assert.ok(f.options.every((o) => o.dataSource === 'live' && o.travelers === 3 && o.totalPrice === o.pricePerTraveler * 3))
  const s = await stays.search(stayQ({ rooms: 2 }))
  assert.equal(s.dataSource, 'live')
  assert.ok(s.options.every((o) => o.rooms === 2))
  assert.equal(calls.find((c) => c.engine === 'google_flights').adults, 1, 'flight search is always 1 adult (unambiguous price basis)')
  assert.equal(calls.find((c) => c.engine === 'google_hotels').adults, 2)
  assert.equal(flights.getDataSource(), 'live')
})

test('a "live" label requires a real price: a response with no priced options falls back to demo', async () => {
  const noPrice = { best_flights: [{ flights: [{ departure_airport: { id: 'DEL', time: '2027-03-10 08:00' }, arrival_airport: { id: 'LIS', time: '2027-03-10 18:00' }, duration: 600, airline: 'X' }], total_duration: 600 }] }
  const { flights } = setup({ clientImpl: async () => ({ empty: false, json: noPrice }) })
  const r = await flights.search(flightQ())
  assert.equal(r.dataSource, 'demo')
  assert.equal(r.reason, 'no_results')
  assert.ok(r.options.every((o) => o.dataSource === 'demo'))
})

// ---------- eligibility ----------
test('no live call for missing/past/too-far/bad dates, or unresolved/same airports (and no quota spent)', async () => {
  const cases = [
    [{ outboundDate: null, returnDate: null }, 'no_dates'],
    [{ outboundDate: '2026-10-05', returnDate: '2026-10-09' }, 'dates_in_past'],
    [{ outboundDate: '2026-01-01', returnDate: '2026-01-05' }, 'dates_in_past'],
    [{ outboundDate: '2028-03-10', returnDate: '2028-03-15' }, 'dates_too_far'],
    [{ outboundDate: '2027-03-10', returnDate: '2027-03-01' }, 'bad_return'],
    [{ originIata: null }, 'no_origin'],
    [{ destIata: null }, 'no_destination'],
    [{ destIata: 'DEL' }, 'same_airport'],
  ]
  for (const [over, reason] of cases) {
    const { flights, calls, usage } = setup()
    const r = await flights.search(flightQ(over))
    assert.equal(r.dataSource, 'demo', reason)
    assert.equal(r.reason, reason)
    assert.equal(calls.length, 0, `${reason}: no provider call`)
    assert.equal([...usage._counts.values()].reduce((a, b) => a + b, 0), 0, `${reason}: no quota spent`)
  }
})

test('stays: a 1-day trip (0 nights) and past dates never trigger a live search', async () => {
  const { stays, calls } = setup()
  assert.equal((await stays.search(stayQ({ nights: 0 }))).reason, 'no_nights')
  assert.equal((await stays.search(stayQ({ checkIn: '2026-10-01', checkOut: '2026-10-04' }))).reason, 'dates_in_past')
  assert.equal(calls.length, 0)
})

test('eligibility window is ~330 days ahead', () => {
  const base = { returnDate: '2027-12-01', originIata: 'A', destIata: 'B', now: NOW }
  assert.equal(checkLiveEligibility({ ...base, outboundDate: '2027-08-01' }).ok, true)
  assert.equal(checkLiveEligibility({ ...base, outboundDate: '2027-09-30' }).reason, 'dates_too_far')
})

// ---------- cache + quota ----------
test('cache hit: second identical search makes NO provider call and spends NO quota/caps', async () => {
  const { flights, calls, usage } = setup()
  const a = await flights.search(flightQ())
  const used = [...usage._counts.values()].reduce((x, y) => x + y, 0)
  const b = await flights.search(flightQ({ who: { ip: '9.9.9.9' } }))
  assert.equal(calls.length, 1)
  assert.equal(b.fromCache, true)
  assert.equal([...usage._counts.values()].reduce((x, y) => x + y, 0), used, 'cache hit counted nothing')
  assert.deepEqual(b.options.map((o) => o.id), a.options.map((o) => o.id))
})

test('cache key: traveler count does NOT change the key for flights (1-adult basis), dates/route/currency do', async () => {
  const { flights, calls } = setup()
  await flights.search(flightQ({ travelers: 1 }))
  await flights.search(flightQ({ travelers: 4 }))
  assert.equal(calls.length, 1, 'same route/dates/currency shares one provider call')
  await flights.search(flightQ({ returnDate: '2027-03-16' }))
  await flights.search(flightQ({ currency: 'USD' }))
  assert.equal(calls.length, 3)
  assert.equal(makeCacheKey('p', { a: 1, b: 2 }), makeCacheKey('p', { b: 2, a: 1 }), 'key order independent')
})

test('dedupe: identical concurrent searches share ONE provider call and ONE quota unit set', async () => {
  let n = 0
  const { flights, usage } = setup({ clientImpl: async () => { n++; await new Promise((r) => setTimeout(r, 20)); return { empty: false, json: flightsJson } } })
  const rs = await Promise.all(Array.from({ length: 8 }, () => flights.search(flightQ())))
  assert.equal(n, 1)
  assert.ok(rs.every((r) => r.dataSource === 'live'))
  const monthUnits = [...usage._counts.entries()].filter(([k]) => k.includes('|month|')).map(([, v]) => v)
  assert.deepEqual(monthUnits, [1])
})

test('quota blocked (guest cap): demo fallback + clear warning, provider NOT called', async () => {
  const { flights, calls } = setup({ quotaCfg: { guestDaily: 1 } })
  assert.equal((await flights.search(flightQ())).dataSource, 'live')
  const r = await flights.search(flightQ({ returnDate: '2027-03-16' })) // different search, same caller
  assert.equal(r.dataSource, 'demo')
  assert.equal(r.reason, 'caller_daily_cap')
  assert.match(r.warnings[0], /Daily limit.*Demo flights are shown/)
  assert.equal(calls.length, 1)
})

test('monthly quota stop at 80%: live calls end, demo continues', async () => {
  const { flights } = setup({ quotaCfg: { monthlyLimit: 5, stopRatio: 0.8, guestDaily: 99, dailyLimit: 99 } }) // stop at 4
  let live = 0
  for (let i = 0; i < 7; i++) {
    const r = await flights.search(flightQ({ returnDate: `2027-03-${15 + i}`, who: { userId: `u${i}` } }))
    if (r.dataSource === 'live') live++
    else assert.equal(r.reason, 'monthly_quota')
  }
  assert.equal(live, 4)
})

// ---------- failure handling ----------
test('provider failure: demo fallback, warning, and the quota units are released', async () => {
  const { flights, usage } = setup({ clientImpl: async () => { throw new SerpApiError('timeout', 'x', { transient: true }) } })
  const r = await flights.search(flightQ())
  assert.equal(r.dataSource, 'demo')
  assert.equal(r.reason, 'timeout')
  assert.match(r.warnings[0], /temporarily unavailable/)
  assert.equal([...usage._counts.values()].reduce((a, b) => a + b, 0), 0, 'not billed -> released')
})

test('"no results" falls back to demo, costs a call (kept) and is cached so it is not re-spent', async () => {
  let n = 0
  const { flights, usage } = setup({ clientImpl: async () => (n++, { empty: true, json: {} }) })
  const a = await flights.search(flightQ())
  const b = await flights.search(flightQ())
  assert.equal(a.reason, 'no_results')
  assert.equal(b.reason, 'no_results')
  assert.equal(n, 1)
  assert.ok([...usage._counts.values()].some((v) => v > 0), 'empty search keeps its quota units (SerpApi bills it)')
})

test('unreadable provider payload never throws: demo fallback', async () => {
  const { stays } = setup({ clientImpl: async () => ({ empty: false, json: { properties: 'garbage' } }) })
  const r = await stays.search(stayQ())
  assert.equal(r.dataSource, 'demo')
})

test('cache read/write failures never break a search', async () => {
  const brokenStore = { get: async () => { throw new Error('db') }, set: async () => { throw new Error('db') } }
  const cache = createProviderCache(brokenStore, () => NOW().getTime())
  const quota = createQuota({ store: createMemoryUsageStore(), config: cfg, now: NOW })
  const client = { search: async () => ({ empty: false, json: flightsJson }) }
  const flights = createFlightService({ client, cache, quota, now: NOW })
  assert.equal((await flights.search(flightQ())).dataSource, 'live')
})

test('demo data is never written to the cache; expired entries are ignored', async () => {
  const store = createMemoryStore()
  let t = NOW().getTime()
  const cache = createProviderCache(store, () => t)
  assert.equal(await cache.set('k', { provider: 'p', kind: 'flights', payload: { options: [1] }, dataSource: 'demo', ttlSeconds: 60 }), false)
  assert.equal(store._map.size, 0)
  await cache.set('k', { provider: 'p', kind: 'flights', payload: { options: [1] }, dataSource: 'live', ttlSeconds: 60 })
  assert.ok(await cache.get('k'))
  t += 61_000
  assert.equal(await cache.get('k'), null)
})
