'use strict'

/**
 * INTEGRATION TESTS (written; they need `npm install` because they boot the REAL
 * Express app against an in-memory MongoDB via mongodb-memory-server, like
 * scripts/smoke-test.js). No supertest dependency: Node's fetch talks to an
 * ephemeral port. No provider keys are set, so providers/AI use their labelled
 * fallbacks — exactly the "zero keys" deployment.
 *
 * Run:  npm run test:integration
 * NOT run in the authoring environment (no node_modules / no network).
 */
const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')

let mongod
let server
let base
let connectDB
let disconnectDB

before(async () => {
  const { MongoMemoryServer } = require('mongodb-memory-server')
  mongod = await MongoMemoryServer.create()
  Object.assign(process.env, {
    NODE_ENV: 'test',
    MONGODB_URI: mongod.getUri(),
    DB_NAME: 'dorara_integration',
    JWT_ACCESS_SECRET: 'integration_access_secret_0123456789',
    JWT_REFRESH_SECRET: 'integration_refresh_secret_0123456789',
    CLIENT_URL: 'https://app.example.test',
    PORT: '0',
    SERPAPI_API_KEY: '',
    AI_GATEWAY_API_KEY: '',
    OPENAI_API_KEY: '',
    TRIP_RATE_LIMIT_GUEST_PER_HOUR: '1000',
  })
  ;({ connectDB, disconnectDB } = require('../../config/database'))
  const { ensureTripPlannerIndexes } = require('../../config/ensureIndexes')
  await connectDB(mongod.getUri())
  await ensureTripPlannerIndexes(require('../../config/database').models)
  const app = require('../../app')()
  await new Promise((r) => (server = app.listen(0, r)))
  base = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  await new Promise((r) => server.close(r))
  await disconnectDB()
  await mongod.stop()
})

/** Tiny client with its own cookie jar (one per simulated browser). */
function client() {
  let cookie = ''
  return async (method, path, body, headers = {}) => {
    const res = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const set = res.headers.get('set-cookie')
    if (set) {
      const jar = new Map(cookie.split('; ').filter(Boolean).map((c) => c.split('=')))
      for (const c of set.split(/,(?=[^ ;]+=)/)) {
        const [kv] = c.split(';')
        const [k, ...v] = kv.trim().split('=')
        jar.set(k, v.join('='))
      }
      cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ')
    }
    let json = null
    try {
      json = await res.json()
    } catch {
      /* 204 / non-JSON */
    }
    return { status: res.status, json, headers: res.headers }
  }
}

const destination = { id: 'lisbon', name: 'Lisbon, Portugal', country: 'Portugal', avgTempC: 20, safetyIndex: 90 }
const answers = {
  budget: { min: 1, max: 3000, currency: 'EUR' },
  dates: { start: '2027-03-10', end: '2027-03-15', durationDays: 5 },
  party: 'Couple',
  interest_type: ['Food & nightlife'],
  departure_location: 'Delhi',
}
const input = { destination, answers }

async function signUp(api, tag) {
  const email = `it_${tag}_${Date.now()}@dorara.test`
  const res = await api('POST', '/api/v1/auth/register', { name: 'Integration User', email, password: 'Sup3rSecret!23' })
  assert.ok([200, 201].includes(res.status), `register ${res.status}`)
  return email
}

test('health: db connected, providers booleans only (no keys configured)', async () => {
  const r = await client()('GET', '/health')
  assert.equal(r.status, 200)
  assert.equal(r.json.data.db, 'connected')
  assert.equal(r.json.data.providers.flights, false)
  assert.equal(typeof r.json.data.providers.ai, 'boolean')
  assert.ok(r.headers.get('x-request-id'))
})

test('CORS: allowed origin passes preflight; a disallowed origin gets 403 (not 500)', async () => {
  const ok = await fetch(`${base}/api/v1/trip-planner/generate`, { method: 'OPTIONS', headers: { Origin: 'https://app.example.test', 'Access-Control-Request-Method': 'POST' } })
  assert.ok([200, 204].includes(ok.status))
  const bad = await fetch(`${base}/api/v1/trip-planner/airports?q=lis`, { headers: { Origin: 'https://evil.example.net' } })
  assert.equal(bad.status, 403)
  assert.equal((await bad.json()).error.code, 'FORBIDDEN')
})

test('airports autocomplete is public and validates input', async () => {
  const api = client()
  const r = await api('GET', '/api/v1/trip-planner/airports?q=lisb')
  assert.equal(r.status, 200)
  assert.equal(r.json.data[0].iata, 'LIS')
  assert.equal((await api('GET', '/api/v1/trip-planner/airports?q=a')).status, 422)
})

test('generate (guest, zero keys): complete labelled-demo plan, not saved', async () => {
  const r = await client()('POST', '/api/v1/trip-planner/generate', { input })
  assert.equal(r.status, 200)
  const plan = r.json.data
  assert.equal(r.json.success, true)
  assert.equal(plan.meta.isDemo, true)
  assert.equal(plan.meta.sectionStatus.flights, 'demo')
  assert.equal(plan.meta.sectionStatus.stays, 'demo')
  assert.equal(plan.meta.sectionStatus.itinerary, 'fallback')
  assert.equal(plan.meta.savedPlanId, undefined)
  assert.equal(plan.itinerary.length, 5)
  assert.ok(plan.accommodations.every((a) => a.dataSource === 'demo' && a.bookingUrl === undefined))
  assert.equal(plan.budget.total, plan.budget.lines.reduce((s, l) => s + l.amount, 0))
  assert.ok(!JSON.stringify(r.json).includes('passwordHash'))
})

test('generate: invalid input returns field-level 422 in the standard envelope', async () => {
  const api = client()
  const bad = await api('POST', '/api/v1/trip-planner/generate', { input: { destination, answers: { dates: { durationDays: 99 } } } })
  assert.equal(bad.status, 422)
  assert.equal(bad.json.success, false)
  assert.equal(bad.json.error.code, 'VALIDATION_ERROR')
  assert.equal((await api('POST', '/api/v1/trip-planner/generate', {})).status, 422)
})

test('adjust (guest): budget change updates feasibility; invalid adjustments rejected', async () => {
  const api = client()
  const ok = await api('POST', '/api/v1/trip-planner/adjust', { input, adjustments: { budget: 500 } })
  assert.equal(ok.status, 200)
  assert.equal(ok.json.data.feasibility.status, 'above')
  assert.equal((await api('POST', '/api/v1/trip-planner/adjust', { input, adjustments: { budget: -1 } })).status, 422)
  const dur = await api('POST', '/api/v1/trip-planner/adjust', { input, adjustments: { durationDays: 8 } })
  assert.equal(dur.json.data.itinerary.length, 8)
})

test('saved plans require login (401) for list/get/patch/delete', async () => {
  const api = client()
  for (const [m, p] of [['GET', '/api/v1/trip-planner/plans'], ['GET', '/api/v1/trip-planner/plans/aaaaaaaaaaaaaaaaaaaaaaaa'], ['PATCH', '/api/v1/trip-planner/plans/aaaaaaaaaaaaaaaaaaaaaaaa'], ['DELETE', '/api/v1/trip-planner/plans/aaaaaaaaaaaaaaaaaaaaaaaa']]) {
    assert.equal((await api(m, p, m === 'PATCH' ? { title: 'x' } : undefined)).status, 401, `${m} ${p}`)
  }
})

test('signed-in: plan auto-saved; list/get/patch/delete work; ownership enforced; adjust history recorded', async () => {
  const alice = client()
  await signUp(alice, 'alice')
  const gen = await alice('POST', '/api/v1/trip-planner/generate', { input })
  assert.equal(gen.status, 200)
  const id = gen.json.data.meta.savedPlanId
  assert.match(id, /^[a-f\d]{24}$/)

  const list = await alice('GET', '/api/v1/trip-planner/plans')
  assert.equal(list.status, 200)
  assert.equal(list.json.meta.total, 1)
  assert.equal(list.json.data[0].destinationName, 'Lisbon, Portugal')
  assert.equal(list.json.data[0].plan, undefined, 'summaries do not include the big plan document')

  const one = await alice('GET', `/api/v1/trip-planner/plans/${id}`)
  assert.equal(one.status, 200)
  assert.equal(one.json.data.plan.destination.id, 'lisbon')
  assert.equal(one.json.data.destinationSnapshot.id, 'lisbon')

  const adj = await alice('POST', '/api/v1/trip-planner/adjust', { input, adjustments: { budget: 900 }, planId: id })
  assert.equal(adj.json.data.meta.savedPlanId, id)
  const after = await alice('GET', `/api/v1/trip-planner/plans/${id}`)
  assert.equal(after.json.data.adjustments.length, 1)
  assert.equal(after.json.data.version, 2)

  // Another user can neither see, modify nor delete it — and gets 404, not 403 (no existence leak).
  const bob = client()
  await signUp(bob, 'bob')
  assert.equal((await bob('GET', `/api/v1/trip-planner/plans/${id}`)).status, 404)
  assert.equal((await bob('PATCH', `/api/v1/trip-planner/plans/${id}`, { title: 'mine now' })).status, 404)
  assert.equal((await bob('DELETE', `/api/v1/trip-planner/plans/${id}`)).status, 404)
  assert.equal((await bob('GET', '/api/v1/trip-planner/plans')).json.meta.total, 0)
  const bobAdjust = await bob('POST', '/api/v1/trip-planner/adjust', { input, adjustments: { budget: 900 }, planId: id })
  assert.equal(bobAdjust.json.data.meta.savedPlanId, undefined, 'cannot write history to someone else\'s plan')

  const patched = await alice('PATCH', `/api/v1/trip-planner/plans/${id}`, { title: 'Lisbon with friends', favorite: true })
  assert.equal(patched.json.data.title, 'Lisbon with friends')
  assert.equal(patched.json.data.favorite, true)
  assert.equal((await alice('PATCH', `/api/v1/trip-planner/plans/${id}`, { title: '' })).status, 422)
  assert.equal((await alice('GET', '/api/v1/trip-planner/plans/not-an-id')).status, 404)

  assert.equal((await alice('DELETE', `/api/v1/trip-planner/plans/${id}`)).status, 204)
  assert.equal((await alice('GET', `/api/v1/trip-planner/plans/${id}`)).status, 404)
  assert.equal((await alice('GET', '/api/v1/trip-planner/plans')).json.meta.total, 0)
})

test('auth (existing system): me, refresh rotation and logout still work', async () => {
  const api = client()
  await signUp(api, 'auth')
  assert.equal((await api('GET', '/api/v1/users/me')).status, 200)
  const refreshed = await api('POST', '/api/v1/auth/refresh', {})
  assert.equal(refreshed.status, 200)
  assert.equal((await api('POST', '/api/v1/auth/logout', {})).status, 200)
  assert.equal((await api('GET', '/api/v1/users/me')).status, 401)
  const wrong = await client()('POST', '/api/v1/auth/login', { email: 'nobody@dorara.test', password: 'wrong-password-1' })
  assert.equal(wrong.status, 401)
  assert.equal(wrong.json.error.code, 'INVALID_CREDENTIALS')
})

test('new indexes exist (autoIndex is off in production, so they are built at boot)', async () => {
  const { models } = require('../../config/database')
  const cacheIdx = await models.ProviderCache.collection.indexes()
  assert.ok(cacheIdx.some((i) => i.key.key === 1 && i.unique))
  assert.ok(cacheIdx.some((i) => i.key.expiresAt === 1 && i.expireAfterSeconds === 0))
  const planIdx = await models.TripPlan.collection.indexes()
  assert.ok(planIdx.some((i) => i.key.user === 1 && i.key.createdAt === -1))
})
