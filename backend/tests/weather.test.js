'use strict'

const { test } = require('node:test')
const assert = require('node:assert/strict')
const path = require('path')
const { getForecastNote } = require(path.join(__dirname, '..', 'services/tripPlanner/weather'))
const { createPexelsService } = require(path.join(__dirname, '..', 'services/pexels.service'))
const { createProviderCache, createMemoryStore } = require(path.join(__dirname, '..', 'services/providers/providerCache.service'))
const schemas = require(path.join(__dirname, '..', 'validators/tripPlanner.schemas'))

const now = () => new Date('2026-10-05T10:00:00Z')
const okFetch = (daily) => async () => ({ ok: true, json: async () => ({ daily }) })
const daily = { temperature_2m_max: Array.from({ length: 14 }, (_, i) => 20 + i), temperature_2m_min: Array.from({ length: 14 }, (_, i) => 10 + i), precipitation_probability_max: Array.from({ length: 14 }, () => 40) }

test('forecast: real numbers only, inside the 14-day window, with coordinates', async () => {
  const note = await getForecastNote({ lat: 38.7, lon: -9.1, start: '2026-10-07', days: 3, now, fetchImpl: okFetch(daily) })
  assert.match(note, /first 3 days/)
  assert.match(note, /highs around 22–24°C/)
  assert.match(note, /lows around 12–14°C/)
  assert.match(note, /up to 40% chance of rain/)
})

test('forecast: null when too far ahead, no coordinates, bad date, API failure or empty data', async () => {
  const f = okFetch(daily)
  assert.equal(await getForecastNote({ lat: 1, lon: 1, start: '2027-03-10', days: 3, now, fetchImpl: f }), null)
  assert.equal(await getForecastNote({ lat: null, lon: null, start: '2026-10-07', days: 3, now, fetchImpl: f }), null)
  assert.equal(await getForecastNote({ lat: 1, lon: 1, start: 'soon', days: 3, now, fetchImpl: f }), null)
  assert.equal(await getForecastNote({ lat: 1, lon: 1, start: '2026-10-07', days: 3, now, fetchImpl: async () => ({ ok: false }) }), null)
  assert.equal(await getForecastNote({ lat: 1, lon: 1, start: '2026-10-07', days: 3, now, fetchImpl: okFetch({}) }), null)
  assert.equal(await getForecastNote({ lat: 1, lon: 1, start: '2026-10-07', days: 3, now, fetchImpl: async () => { throw new Error('x') } }), null)
})

test('pexels: attributed image, cached; no key / failure / no photo => null', async () => {
  let calls = 0
  const photo = { photos: [{ src: { large2x: 'https://images.pexels.com/a.jpg' }, photographer: 'Ann', photographer_url: 'https://www.pexels.com/@ann', url: 'https://www.pexels.com/photo/9' }] }
  const cache = createProviderCache(createMemoryStore(), () => now().getTime())
  const svc = createPexelsService({ apiKey: 'k', cache, fetchImpl: async (u, o) => (calls++, assert.equal(o.headers.Authorization, 'k'), { ok: true, json: async () => photo }) })
  const a = await svc.getHeroImage({ placeName: 'Lisbon', country: 'Portugal' })
  const b = await svc.getHeroImage({ placeName: 'Lisbon', country: 'Portugal' })
  assert.deepEqual(a, b)
  assert.equal(calls, 1, 'second call is a cache hit')
  assert.equal(a.photographer, 'Ann')
  assert.equal(await createPexelsService({ apiKey: '', cache }).getHeroImage({ placeName: 'Lisbon' }), null)
  assert.equal(await createPexelsService({ apiKey: 'k', cache, fetchImpl: async () => ({ ok: false }) }).getHeroImage({ placeName: 'Oslo' }), null)
  assert.equal(await createPexelsService({ apiKey: 'k', cache, fetchImpl: async () => ({ ok: true, json: async () => ({ photos: [] }) }) }).getHeroImage({ placeName: 'Nowhere' }), null)
  assert.equal(await createPexelsService({ apiKey: 'k', cache, fetchImpl: async () => ({ ok: true, json: async () => ({ photos: [{ src: { large: 'http://insecure/x.jpg' } }] }) }) }).getHeroImage({ placeName: 'Insecure' }), null, 'non-https rejected')
})

const dest = { id: 'lisbon', name: 'Lisbon, Portugal' }
const good = { destination: dest, answers: { budget: { min: 1, max: 3000, currency: 'EUR' }, dates: { start: '2027-03-10', end: '2027-03-15', durationDays: 5 }, departure_location: 'Delhi' } }

test('validator: accepts a valid request; field-level 400 errors otherwise', () => {
  assert.equal(schemas.parse(schemas.generateBody, { input: good }).input.destination.id, 'lisbon')
  const bad = (answers, field) => {
    try {
      schemas.parse(schemas.generateBody, { input: { destination: dest, answers } })
      assert.fail(`should reject ${field}`)
    } catch (e) {
      assert.equal(e.statusCode, 422)
      assert.equal(e.code, 'VALIDATION_ERROR')
      assert.ok(e.details?.some((d) => d.field === field) || e.message.includes(field), `${field}: ${e.message}`)
    }
  }
  bad({ dates: { start: '10/03/2027' } }, 'dates.start')
  bad({ dates: { durationDays: 0 } }, 'dates.durationDays')
  bad({ dates: { durationDays: 366 } }, 'dates.durationDays')
  bad({ budget: { max: -5 } }, 'budget.max')
  bad({ budget: { max: 0 } }, 'budget.max')
  bad({ departure_location: 'x'.repeat(101) }, 'departure_location')
  bad({ extra_notes: 'x'.repeat(1001) }, 'extra_notes')
  bad({ blob: 'x'.repeat(11_000) }, 'answers')
})

test('validator: destination required and bounded; adjustments strict; ids must be ObjectIds', () => {
  assert.throws(() => schemas.parse(schemas.generateBody, { input: { answers: {} } }), (e) => e.statusCode === 422)
  assert.throws(() => schemas.parse(schemas.generateBody, { input: { destination: { id: '', name: 'x' }, answers: {} } }), (e) => e.statusCode === 422)
  assert.throws(() => schemas.parse(schemas.generateBody, {}), (e) => e.statusCode === 422)
  const ok = schemas.parse(schemas.adjustBody, { input: good, adjustments: { budget: 2000, durationDays: 4 }, planId: 'a'.repeat(24) })
  assert.equal(ok.adjustments.durationDays, 4)
  for (const adjustments of [{ budget: -1 }, { durationDays: 2.5 }, { durationDays: 99 }, { evil: true }]) {
    assert.throws(() => schemas.parse(schemas.adjustBody, { input: good, adjustments }), (e) => e.statusCode === 422, JSON.stringify(adjustments))
  }
  assert.throws(() => schemas.parse(schemas.adjustBody, { input: good, adjustments: {}, planId: 'nope' }), (e) => e.statusCode === 422)
  assert.deepEqual(schemas.parse(schemas.listQuery, {}), { page: 1, limit: 12 })
  assert.throws(() => schemas.parse(schemas.listQuery, { limit: 500 }), (e) => e.statusCode === 422)
  assert.throws(() => schemas.parse(schemas.patchPlanBody, {}), (e) => e.statusCode === 422)
  assert.throws(() => schemas.parse(schemas.airportQuery, { q: 'a' }), (e) => e.statusCode === 422)
})
