'use strict'

const { test } = require('node:test')
const assert = require('node:assert/strict')
const path = require('path')
const os = require('os')
process.env.LOG_DIR = path.join(os.tmpdir(), 'dorara-test-logs')
const root = path.join(__dirname, '..')
const { createTripPlannerService, withDeadline, createAiMemo } = require(path.join(root, 'services/tripPlanner/tripPlanner.service'))
const { createFlightService } = require(path.join(root, 'services/providers/flight.service'))
const { createAccommodationService } = require(path.join(root, 'services/providers/accommodation.service'))
const { createProviderCache, createMemoryStore } = require(path.join(root, 'services/providers/providerCache.service'))
const { createQuota, createMemoryUsageStore } = require(path.join(root, 'services/providers/quota.service'))
const { generateTripContent } = require(path.join(root, 'services/tripPlanner/tripAI.service'))
const airports = require(path.join(root, 'services/airports.service'))
const flightsJson = require('./fixtures/serpapi-flights.sample.json')
const hotelsJson = require('./fixtures/serpapi-hotels.sample.json')

const NOW = () => new Date('2026-10-05T10:00:00Z')
const dest = { id: 'lisbon', name: 'Lisbon, Portugal', country: 'Portugal', avgTempC: 20, safetyIndex: 90 }
const answers = (o = {}) => ({
  budget: { min: 1, max: 3000, currency: 'EUR' },
  dates: { start: '2027-03-10', end: null, durationDays: 4 },
  party: 'Couple',
  interest_type: ['Food & nightlife'],
  weather: ['Warm & sunny'],
  departure_location: 'Delhi',
  ...o,
})
const input = (o) => ({ destination: dest, answers: answers(o) })

function services({ client, aiGenerate, aiEnabled = true } = {}) {
  const cfg = { monthlyLimit: 250, stopRatio: 0.8, dailyLimit: 50, hourlyLimit: 40, guestDaily: 10, userDaily: 10, salt: 's' }
  const cache = createProviderCache(createMemoryStore(), () => NOW().getTime())
  const quota = createQuota({ store: createMemoryUsageStore(), config: cfg, now: NOW })
  const calls = { search: [], ai: 0 }
  const c = client === null ? null : { search: client ?? (async (q) => (calls.search.push(q.engine), { empty: false, json: q.engine === 'google_flights' ? flightsJson : hotelsJson })) }
  const aiDeps = { enabled: aiEnabled, model: 'm', timeoutMs: 400, log: () => {}, generate: aiGenerate ?? (async () => { calls.ai++; throw new Error('no ai') }) }
  const svc = createTripPlannerService({
    flights: createFlightService({ client: c, cache, quota, now: NOW }),
    stays: createAccommodationService({ client: c, cache, quota, now: NOW }),
    airports,
    ai: (args) => generateTripContent(args, aiDeps),
    weather: async () => null,
    now: NOW,
    deadlineMs: 5000,
    save: async ({ userId }) => ({ id: `plan-${userId}` }),
    recordAdjustment: async ({ planId }) => planId === 'owned',
  })
  return { svc, calls }
}

const goodAi = (days) => ({
  days: Array.from({ length: days }, (_, i) => ({
    day: i + 1, title: `Day ${i + 1} in the old quarters`, theme: 'Food & nightlife',
    activities: [{ time: '10:00', title: 'Market tasting', description: 'Sample local snacks at a covered market.', interests: ['Food & nightlife'], estimatedCostLevel: 'low' }],
  })),
  fit: { matches: [{ ref: 'interest_type', text: 'You chose Food & nightlife, so the plan leans on markets and dining.' }], considerations: ['Reserve popular spots ahead when you can.'] },
})

test('zero provider keys + no AI: a complete plan, everything labelled demo/fallback, never an error', async () => {
  const { svc } = services({ client: null, aiEnabled: false })
  const plan = await svc.generate({ input: input(), who: {}, requestId: 'r1' })
  assert.deepEqual(plan.meta.sectionStatus, { itinerary: 'fallback', stays: 'demo', flights: 'demo' })
  assert.equal(plan.meta.isDemo, true)
  assert.equal(plan.meta.source, 'server')
  assert.equal(plan.meta.itinerarySource, 'fallback')
  assert.ok(plan.meta.warnings.length >= 3)
  assert.equal(plan.itinerary.length, 4)
  assert.ok(plan.accommodations.every((a) => a.dataSource === 'demo' && !a.bookingUrl))
  assert.ok(plan.flights.every((f) => f.dataSource === 'demo' && !f.bookingUrl))
  assert.equal(plan.budget.total, plan.budget.lines.reduce((s, l) => s + l.amount, 0))
  assert.equal(plan.meta.savedPlanId, undefined, 'guest plans are never saved')
})

test('with keys: live flights + stays, labelled live; isDemo only because the itinerary is a template', async () => {
  const { svc, calls } = services({ aiEnabled: false })
  const plan = await svc.generate({ input: input(), who: { ip: '1.1.1.1' } })
  assert.equal(plan.meta.sectionStatus.flights, 'ok')
  assert.equal(plan.meta.sectionStatus.stays, 'ok')
  assert.ok(plan.flights.every((f) => f.dataSource === 'live' && f.travelers === 2))
  assert.ok(plan.accommodations.every((a) => a.dataSource === 'live'))
  assert.equal(plan.meta.isDemo, true, 'any non-ok section => isDemo')
  assert.equal(plan.meta.categorySources.flights, 'live')
  assert.ok(!plan.meta.estimatedCategories.includes('flights'))
  assert.ok(plan.meta.estimatedCategories.includes('food'))
  assert.deepEqual(calls.search.sort(), ['google_flights', 'google_hotels'])
  assert.equal(plan.meta.searched.flights.origin, 'DEL')
  assert.equal(plan.meta.searched.flights.return, '2027-03-13', 'return = start + (days-1)')
  assert.equal(plan.meta.searched.stays.checkOut, '2027-03-13')
})

test('everything live + AI ok => isDemo false, "live" disclaimer', async () => {
  const { svc } = services({ aiGenerate: async () => ({ object: goodAi(4) }) })
  const plan = await svc.generate({ input: input(), who: { ip: '1.1.1.1' } })
  assert.deepEqual(plan.meta.sectionStatus, { itinerary: 'ok', stays: 'ok', flights: 'ok' })
  assert.equal(plan.meta.isDemo, false)
  assert.equal(plan.meta.itinerarySource, 'ai')
  assert.equal(plan.meta.fitSource, 'ai')
  assert.match(plan.meta.disclaimer, /live search/)
})

test('a failing section never fails the plan: provider throws -> demo + warning, others unaffected', async () => {
  const { svc } = services({ client: async () => { throw new Error('boom') }, aiGenerate: async () => ({ object: goodAi(4) }) })
  const plan = await svc.generate({ input: input(), who: { ip: '1.1.1.1' } })
  assert.equal(plan.meta.sectionStatus.itinerary, 'ok')
  assert.equal(plan.meta.sectionStatus.flights, 'demo')
  assert.equal(plan.meta.sectionStatus.stays, 'demo')
  assert.ok(plan.meta.warnings.some((w) => /temporarily unavailable/.test(w)))
})

test('departure city skipped / unmatched / 1-day trip get specific, accurate messages', async () => {
  const { svc } = services()
  const skipped = await svc.generate({ input: input({ departure_location: undefined }), who: { ip: '1.1.1.1' } })
  assert.ok(skipped.meta.warnings.some((w) => /No departure city was saved/.test(w)))
  assert.equal(skipped.meta.sectionStatus.flights, 'demo')
  const unmatched = await svc.generate({ input: input({ departure_location: 'Nowhereville' }), who: { ip: '1.1.1.1' } })
  assert.ok(unmatched.meta.warnings.some((w) => /couldn’t match “Nowhereville”/.test(w)))
  const oneDay = await svc.generate({ input: input({ dates: { start: '2027-03-10', end: null, durationDays: 1 } }), who: { ip: '1.1.1.1' } })
  assert.ok(oneDay.meta.warnings.some((w) => /1-day trip/.test(w)))
})

test('hard deadline: a hung AI call and hung providers still return a plan in time', async () => {
  const hang = () => new Promise(() => {})
  const cfg = { monthlyLimit: 250, stopRatio: 0.8, dailyLimit: 50, hourlyLimit: 40, guestDaily: 10, userDaily: 10, salt: 's' }
  const cache = createProviderCache(createMemoryStore(), () => NOW().getTime())
  const quota = createQuota({ store: createMemoryUsageStore(), config: cfg, now: NOW })
  const client = { search: hang }
  const svc = createTripPlannerService({
    flights: createFlightService({ client, cache, quota, now: NOW }),
    stays: createAccommodationService({ client, cache, quota, now: NOW }),
    airports, ai: hang, weather: hang, hero: { getHeroImage: hang }, now: NOW, deadlineMs: 150,
  })
  const t0 = Date.now()
  const plan = await svc.generate({ input: input(), who: { ip: '1.1.1.1' } })
  assert.ok(Date.now() - t0 < 1500, 'returned promptly')
  assert.equal(plan.meta.sectionStatus.itinerary, 'fallback')
  assert.equal(plan.meta.sectionStatus.flights, 'demo')
  assert.ok(plan.meta.warnings.some((w) => /took too long/.test(w)))
  assert.equal(plan.itinerary.length, 4)
})

test('signed-in users: plan is auto-saved and the id returned; a save failure only adds a warning', async () => {
  const { svc } = services({ client: null, aiEnabled: false })
  const plan = await svc.generate({ input: input(), who: { userId: 'u1' } })
  assert.equal(plan.meta.savedPlanId, 'plan-u1')
  const failing = createTripPlannerService({ airports, ai: async () => ({ itinerary: [], itinerarySource: 'fallback', aiFit: null, fitSource: 'fallback' }), flights: { search: async () => ({ options: [], dataSource: 'demo', status: 'demo', warnings: [] }) }, stays: { search: async () => ({ options: [], dataSource: 'demo', status: 'demo', warnings: [] }) }, weather: async () => null, now: NOW, deadlineMs: 2000, save: async () => { throw new Error('db') } })
  const p2 = await failing.generate({ input: input(), who: { userId: 'u1' } })
  assert.equal(p2.meta.savedPlanId, undefined)
  assert.ok(p2.meta.warnings.some((w) => /could not be saved/.test(w)))
})

test('adjust: budget change flips feasibility, estimate unchanged; AI itinerary is reused (no 2nd AI call)', async () => {
  let aiCalls = 0
  const { svc } = services({ aiGenerate: async () => (aiCalls++, { object: goodAi(4) }) })
  const a = await svc.generate({ input: input(), who: { ip: '1.1.1.1' } })
  const b = await svc.adjust({ input: input(), adjustments: { budget: 800 }, who: { ip: '1.1.1.1' } })
  assert.equal(aiCalls, 1, 'itinerary came from the in-memory memo')
  assert.equal(a.budget.total, b.budget.total)
  assert.equal(b.feasibility.status, 'above')
  assert.equal(b.effective.budget, 800)
  assert.deepEqual(a.itinerary, b.itinerary, 'content stays stable across What-if changes')
})

test('adjust: duration change re-plans days, nights, stay total and the estimate', async () => {
  const { svc } = services({ aiEnabled: false })
  const a = await svc.generate({ input: input(), who: {} })
  const b = await svc.adjust({ input: input(), adjustments: { durationDays: 7 }, who: {} })
  assert.equal(b.itinerary.length, 7)
  assert.equal(b.effective.nights, 6)
  assert.ok(b.budget.total > a.budget.total)
})

test('adjust: history is recorded only for a plan the signed-in user owns', async () => {
  const { svc } = services({ client: null, aiEnabled: false })
  assert.equal((await svc.adjust({ input: input(), adjustments: { budget: 900 }, planId: 'owned', who: { userId: 'u1' } })).meta.savedPlanId, 'owned')
  assert.equal((await svc.adjust({ input: input(), adjustments: { budget: 900 }, planId: 'someone-elses', who: { userId: 'u1' } })).meta.savedPlanId, undefined)
  assert.equal((await svc.adjust({ input: input(), adjustments: { budget: 900 }, planId: 'owned', who: {} })).meta.savedPlanId, undefined, 'guests cannot touch saved plans')
})

test('adjustments are bounded server-side: tiny/odd values never crash or invent numbers', async () => {
  const { svc } = services({ client: null, aiEnabled: false })
  const p = await svc.generate({ input: input({ budget: null }), who: {} })
  assert.equal(p.feasibility.status, 'unknown')
  const q = await svc.adjust({ input: input({ budget: null }), adjustments: { budget: 5000 }, who: {} })
  assert.equal(q.feasibility.status, 'unknown', 'no saved budget => still neutral')
})

test('the plan is plain JSON (no undefined keys) and matches the frontend TripPlan top-level shape', async () => {
  const { svc } = services({ client: null, aiEnabled: false })
  const plan = await svc.generate({ input: input(), who: {} })
  assert.deepEqual(plan, JSON.parse(JSON.stringify(plan)))
  assert.deepEqual(Object.keys(plan).sort(), ['accommodations', 'budget', 'destination', 'effective', 'feasibility', 'fit', 'flights', 'itinerary', 'limits', 'meta', 'requirements'])
  assert.deepEqual(Object.keys(plan.fit).sort(), ['considerations', 'matches'])
  assert.ok(plan.fit.matches.concat(plan.fit.considerations).every((x) => typeof x.id === 'string' && typeof x.text === 'string'))
})

test('hero image (Pexels) is optional and attributed when present', async () => {
  const hero = { getHeroImage: async () => ({ provider: 'pexels', url: 'https://images.pexels.com/x.jpg', photographer: 'Ann', photographerUrl: 'https://www.pexels.com/@ann', sourceUrl: 'https://www.pexels.com/photo/1' }) }
  const svc = createTripPlannerService({ airports, ai: async () => ({ itinerary: [], itinerarySource: 'fallback', aiFit: null, fitSource: 'fallback' }), flights: { search: async () => ({ options: [], dataSource: 'demo', status: 'demo', warnings: [] }) }, stays: { search: async () => ({ options: [], dataSource: 'demo', status: 'demo', warnings: [] }) }, weather: async () => null, hero, now: NOW, deadlineMs: 2000 })
  const plan = await svc.generate({ input: input(), who: {} })
  assert.equal(plan.destination.heroImage.photographer, 'Ann')
  assert.ok(plan.destination.heroImage.photographerUrl)
})

test('weather forecast note (real data only) is added to considerations when provided', async () => {
  const { svc } = services({ client: null, aiEnabled: false })
  const svc2 = createTripPlannerService({ airports, ai: async () => ({ itinerary: [], itinerarySource: 'fallback', aiFit: null, fitSource: 'fallback' }), flights: { search: async () => ({ options: [], dataSource: 'demo', status: 'demo', warnings: [] }) }, stays: { search: async () => ({ options: [], dataSource: 'demo', status: 'demo', warnings: [] }) }, weather: async () => 'Forecast for the first 3 days of your trip: highs around 20–22°C (Open-Meteo).', now: NOW, deadlineMs: 2000 })
  const plan = await svc2.generate({ input: input(), who: {} })
  assert.ok(plan.fit.considerations.some((c) => /Open-Meteo/.test(c.text)))
  void svc
})

test('withDeadline + ai memo helpers', async () => {
  assert.equal(await withDeadline(new Promise(() => {}), 20, () => 'late'), 'late')
  assert.equal(await withDeadline(Promise.resolve('fast'), 200, () => 'late'), 'fast')
  let t = 0
  const memo = createAiMemo(() => t)
  memo.set('k', 1)
  assert.equal(memo.get('k'), 1)
  t += 61 * 60 * 1000
  assert.equal(memo.get('k'), null)
})
