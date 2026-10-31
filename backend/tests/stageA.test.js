'use strict'

/**
 * Stage A tests: request IDs, CORS 403, health payload, env fail-fast + limits,
 * explicit index builder, and (when Mongoose is installed) the new model indexes.
 * Run:  cd backend && npm test
 */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const path = require('path')
const os = require('os')
const { spawnSync } = require('child_process')

// Keep logger output out of the repo while testing.
process.env.LOG_DIR = path.join(os.tmpdir(), 'dorara-test-logs')

const root = path.join(__dirname, '..')
const requestId = require(path.join(root, 'middlewares/requestId.middleware'))
const { createOriginHandler, buildAllowedOrigins } = require(path.join(root, 'middlewares/cors.middleware'))
const { buildHealth } = require(path.join(root, 'services/health.service'))
const { ensureTripPlannerIndexes } = require(path.join(root, 'config/ensureIndexes'))

/** Load a config module in a clean child process with exactly the given env. */
function loadInChild(modulePath, envVars) {
  const code = `const m=require(${JSON.stringify(modulePath)});process.stdout.write(JSON.stringify(m))`
  return spawnSync(process.execPath, ['-e', code], {
    cwd: os.tmpdir(), // so a developer's .env is not picked up by dotenv
    env: { PATH: process.env.PATH, NODE_PATH: process.env.NODE_PATH || '', ...envVars },
    encoding: 'utf8',
  })
}

// ----- request id -----
test('requestId: generates an id and echoes it in X-Request-Id', () => {
  const headers = {}
  const req = { headers: {} }
  const res = { setHeader: (k, v) => (headers[k] = v) }
  let called = false
  requestId(req, res, () => (called = true))
  assert.ok(called)
  assert.match(req.id, /^[0-9a-f-]{36}$/)
  assert.equal(headers['X-Request-Id'], req.id)
})

test('requestId: reuses a safe incoming id, replaces an unsafe one', () => {
  const run = (incoming) => {
    const req = { headers: { 'x-request-id': incoming } }
    requestId(req, { setHeader() {} }, () => {})
    return req.id
  }
  assert.equal(run('abc12345-req.id_1'), 'abc12345-req.id_1')
  assert.notEqual(run('bad id\nwith newline'), 'bad id\nwith newline')
  assert.notEqual(run('x'), 'x') // too short
  assert.notEqual(run('a'.repeat(200)), 'a'.repeat(200)) // too long
})

// ----- CORS -----
test('cors: allows no-origin, allowlisted and trailing-slash origins', () => {
  const handler = createOriginHandler(['https://app.example.com/'])
  const check = (origin) => {
    let result
    handler(origin, (err, ok) => (result = { err, ok }))
    return result
  }
  assert.deepEqual(check(undefined), { err: null, ok: true })
  assert.deepEqual(check('https://app.example.com'), { err: null, ok: true })
})

test('cors: a disallowed origin yields a 403 FORBIDDEN ApiError (not a 500)', () => {
  const handler = createOriginHandler(['https://app.example.com'])
  let err
  handler('https://evil.example.net', (e) => (err = e))
  assert.ok(err)
  assert.equal(err.statusCode, 403)
  assert.equal(err.code, 'FORBIDDEN')
  assert.equal(err.isOperational, true)
})

test('cors: buildAllowedOrigins merges CLIENT_URL and CORS_ORIGINS', () => {
  const list = buildAllowedOrigins({ CLIENT_URL: 'https://a.app/', CORS_ORIGINS: ['https://b.app'] })
  assert.deepEqual(list, ['https://a.app', 'https://b.app'])
})

// ----- health -----
test('health: ok when DB connected; degraded otherwise; providers are booleans only', () => {
  const ok = buildHealth({ connection: { readyState: 1 } })
  assert.equal(ok.status, 'ok')
  assert.equal(ok.db, 'connected')
  for (const v of Object.values(ok.providers)) assert.equal(typeof v, 'boolean')
  const bad = buildHealth({ connection: { readyState: 0 } })
  assert.equal(bad.status, 'degraded')
  assert.equal(buildHealth(undefined).db, 'unknown')
  assert.ok(!JSON.stringify(ok).toLowerCase().includes('key'))
})

// ----- env -----
const baseProd = {
  NODE_ENV: 'production',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
}

test('env (backend): production without MONGODB_URI fails fast', () => {
  const r = loadInChild(path.join(root, 'config/env.js'), baseProd)
  assert.notEqual(r.status, 0)
  assert.match(r.stderr, /MONGODB_URI/)
})

test('env (database package): production without MONGODB_URI fails fast', () => {
  const r = loadInChild(path.join(root, '..', 'database/config/env.js'), { NODE_ENV: 'production' })
  assert.notEqual(r.status, 0)
  assert.match(r.stderr, /MONGODB_URI/)
})

test('env: production starts with only required vars; optional providers are off', () => {
  const r = loadInChild(path.join(root, 'config/env.js'), {
    ...baseProd,
    MONGODB_URI: 'mongodb://example.invalid/dorara',
  })
  assert.equal(r.status, 0, r.stderr)
  const e = JSON.parse(r.stdout)
  assert.equal(e.features.serpapi, false)
  assert.equal(e.features.pexels, false)
  assert.equal(e.SERPAPI_MONTHLY_LIMIT, 250)
  assert.equal(e.SERPAPI_DAILY_LIMIT, 8)
  assert.equal(e.LIVE_SEARCH_GUEST_DAILY, 3)
  assert.equal(e.LIVE_SEARCH_USER_DAILY, 10)
  assert.equal(e.SERPAPI_QUOTA_STOP_RATIO, 0.8)
})

test('env: non-production keeps the local dev fallback for MONGODB_URI', () => {
  const r = loadInChild(path.join(root, 'config/env.js'), { NODE_ENV: 'development' })
  assert.equal(r.status, 0, r.stderr)
  assert.match(JSON.parse(r.stdout).MONGODB_URI, /^mongodb:\/\/127\.0\.0\.1/)
})

test('env: quota variables are clamped / validated', () => {
  const r = loadInChild(path.join(root, 'config/env.js'), {
    NODE_ENV: 'development',
    SERPAPI_QUOTA_STOP_RATIO: '5',
    SERPAPI_DAILY_LIMIT: '-3',
    SERPAPI_MONTHLY_LIMIT: 'abc',
    SERPAPI_API_KEY: 'x',
  })
  const e = JSON.parse(r.stdout)
  assert.equal(e.SERPAPI_QUOTA_STOP_RATIO, 1)
  assert.equal(e.SERPAPI_DAILY_LIMIT, 8)
  assert.equal(e.SERPAPI_MONTHLY_LIMIT, 250)
  assert.equal(e.features.serpapi, true)
})

// ----- indexes -----
test('ensureTripPlannerIndexes: builds all four, and one failure does not stop the rest', async () => {
  const calls = []
  const mk = (name, fail) => ({
    createIndexes: async () => {
      calls.push(name)
      if (fail) throw new Error('boom')
    },
  })
  const models = {
    TripPlan: mk('TripPlan'),
    ProviderCache: mk('ProviderCache', true),
    ProviderUsage: mk('ProviderUsage'),
    AIGenerationLog: mk('AIGenerationLog'),
  }
  const res = await ensureTripPlannerIndexes(models)
  assert.deepEqual(calls, ['TripPlan', 'ProviderCache', 'ProviderUsage', 'AIGenerationLog'])
  assert.equal(res.TripPlan, 'ok')
  assert.match(res.ProviderCache, /^failed: boom/)
  assert.equal(res.AIGenerationLog, 'ok')
})

// ----- models (needs mongoose installed; skipped otherwise) -----
let mongooseAvailable = true
try {
  require.resolve('mongoose', { paths: [root] })
} catch {
  mongooseAvailable = false
}

test('models: indexes are defined as designed', { skip: !mongooseAvailable && 'mongoose not installed' }, () => {
  const find = (model, fields) =>
    model.schema.indexes().find(([spec]) => JSON.stringify(spec) === JSON.stringify(fields))
  const cache = require(path.join(root, '..', 'database/models/providerCache.model'))
  assert.equal(find(cache, { key: 1 })[1].unique, true)
  assert.equal(find(cache, { expiresAt: 1 })[1].expireAfterSeconds, 0)
  const usage = require(path.join(root, '..', 'database/models/providerUsage.model'))
  assert.equal(find(usage, { provider: 1, scope: 1, key: 1 })[1].unique, true)
  assert.equal(find(usage, { expiresAt: 1 })[1].expireAfterSeconds, 0)
  const plan = require(path.join(root, '..', 'database/models/tripPlan.model'))
  assert.ok(find(plan, { user: 1, createdAt: -1 }))
  const log = require(path.join(root, '..', 'database/models/aiGenerationLog.model'))
  assert.equal(find(log, { expiresAt: 1 })[1].expireAfterSeconds, 0)
  // The AI log must never store prompt/response text.
  assert.equal(log.schema.path('prompt'), undefined)
})
