'use strict'

/**
 * End-to-end smoke test.
 *
 * Boots the REAL Express app against an in-memory MongoDB (no external database
 * required), seeds the catalog, and exercises the full happy path:
 *
 *   health -> register -> login -> create requirement -> (async) recommendation
 *   -> fetch recommendation -> search destinations -> saved trips -> history
 *
 * It verifies the live-data integrations by asserting the generated
 * recommendation carries live weather + real data-source provenance.
 *
 * Run:  node scripts/smoke-test.js
 */

/* eslint-disable no-console */

async function main() {
  const { MongoMemoryServer } = require('mongodb-memory-server')

  console.log('› starting in-memory MongoDB…')
  const mongod = await MongoMemoryServer.create()
  const uri = mongod.getUri()

  // Must be set BEFORE any app module reads config/env.
  process.env.NODE_ENV = 'test'
  process.env.MONGODB_URI = uri
  process.env.DB_NAME = 'dorara_test'
  process.env.JWT_ACCESS_SECRET = 'test_access_secret'
  process.env.JWT_REFRESH_SECRET = 'test_refresh_secret'
  process.env.PORT = '0'

  const { connectDB, disconnectDB, models } = require('../config/database')
  const createApp = require('../app')

  let server
  let failures = 0
  const check = (label, cond) => {
    console.log(`${cond ? '  ✓' : '  ✗'} ${label}`)
    if (!cond) failures += 1
  }

  try {
    await connectDB(uri)
    console.log('› connected to in-memory MongoDB')

    // ---- Seed catalog + questionnaire (no external Mongo needed) ----
    const destinationsSeed = require('../../database/seed/data/destinations.seed')
    const questionnaireSeed = require('../../database/seed/data/questionnaire.seed')
    await models.Destination.deleteMany({})
    await models.Destination.insertMany(destinationsSeed)
    for (const q of questionnaireSeed) {
      await models.Questionnaire.updateOne(
        { vertical: q.vertical, version: q.version },
        { $set: q },
        { upsert: true },
      )
    }
    console.log(`› seeded ${destinationsSeed.length} destinations + questionnaire`)

    // ---- Boot the app on an ephemeral port ----
    const app = createApp()
    await new Promise((resolve) => {
      server = app.listen(0, resolve)
    })
    const { port } = server.address()
    const base = `http://127.0.0.1:${port}`
    console.log(`› app listening on ${base}`)

    // ---- Minimal cookie jar so httpOnly auth cookies flow between calls ----
    let cookie = ''
    const api = async (method, path, body) => {
      const res = await fetch(base + path, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(cookie ? { Cookie: cookie } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      })
      const setCookie = res.headers.get('set-cookie')
      if (setCookie) {
        // keep the last value of each cookie name
        cookie = setCookie
          .split(/,(?=[^ ;]+=)/)
          .map((c) => c.split(';')[0].trim())
          .join('; ')
      }
      let json = null
      try {
        json = await res.json()
      } catch {
        /* non-JSON */
      }
      return { status: res.status, json }
    }

    // ---- 1. Health ----
    const health = await api('GET', '/health')
    check(`health 200 (got ${health.status})`, health.status === 200)

    // ---- 2. Register ----
    const email = `smoke_${Date.now()}@dorara.test`
    const reg = await api('POST', '/api/v1/auth/register', {
      name: 'Smoke Test',
      email,
      password: 'Sup3rSecret!23',
    })
    check(`register 201 (got ${reg.status})`, reg.status === 201)

    // Bypass email verification directly in the DB for the test.
    await models.User.updateOne({ email }, { isEmailVerified: true, status: 'active' })

    // ---- 3. Login ----
    const login = await api('POST', '/api/v1/auth/login', {
      email,
      password: 'Sup3rSecret!23',
    })
    check(`login 200 (got ${login.status})`, login.status === 200)
    check('login returns accessToken', Boolean(login.json?.data?.accessToken))

    // ---- 4. Create requirement (triggers async recommendation) ----
    const answers = {
      destination_preference: 'Open to suggestions',
      budget: { min: 1500, max: 4000, currency: 'EUR' },
      dates: { durationDays: 10 },
      party: 'Solo',
      weather: ['Warm & sunny'],
      interest_type: ['Culture & history', 'Food & nightlife'],
      safety_importance: 4,
      visa_requirements: 'I have a passport and visa-ready',
    }
    const reqRes = await api('POST', '/api/v1/travel/requirements', {
      vertical: 'travel',
      answers,
    })
    check(`create requirement 201 (got ${reqRes.status})`, reqRes.status === 201)
    const requirementId = reqRes.json?.data?.requirement?._id
    check('requirement has id', Boolean(requirementId))

    // ---- 5. Poll for the async-generated recommendation ----
    let rec = null
    for (let i = 0; i < 20 && !rec; i += 1) {
      await new Promise((r) => setTimeout(r, 500))
      const r = await api('GET', `/api/v1/travel/recommendations/${requirementId}`)
      if (r.status === 200) rec = r.json?.data?.recommendation
    }
    check('recommendation generated', Boolean(rec))
    if (rec) {
      check(
        `has 3 ranked destinations (got ${rec.recommendedDestinations?.length})`,
        rec.recommendedDestinations?.length === 3,
      )
      const top = rec.recommendedDestinations?.[0]
      check('top destination has live weather', Boolean(top?.liveWeather?.source))
      check(
        `cost estimate in EUR (got ${rec.costEstimate?.currency})`,
        rec.costEstimate?.currency === 'EUR',
      )
      check(
        `data sources include live providers (${(rec.dataSources || []).join(', ')})`,
        (rec.dataSources || []).some((s) => ['open-meteo', 'worldbank', 'ecb-fx'].includes(s)),
      )
      console.log('    → engine:', rec.engine, '| confidence:', rec.confidenceScore)
      console.log('    → top pick:', top?.name, '| live temp:', top?.liveWeather?.tempC, '°C')
      console.log('    → cost (EUR):', rec.costEstimate?.low, '/', rec.costEstimate?.mid, '/', rec.costEstimate?.high)
    }

    // ---- 6. Destination search ----
    const search = await api('GET', '/api/v1/travel/destinations?tags=Food%20%26%20nightlife&limit=5')
    check(`destination search 200 (got ${search.status})`, search.status === 200)
    check('search returns results', (search.json?.data?.data?.length || 0) > 0)

    // ---- 7. Saved trips ----
    const firstDest = search.json?.data?.data?.[0]
    if (firstDest) {
      const save = await api('POST', '/api/v1/travel/saved-trips', { destinationId: firstDest._id })
      check(`save trip 201 (got ${save.status})`, save.status === 201)
      const trips = await api('GET', '/api/v1/travel/saved-trips')
      check('saved trips list has 1', (trips.json?.data?.data?.length || 0) === 1)
    }

    // ---- 8. Search history ----
    const hist = await api('GET', '/api/v1/travel/search-history')
    check(`search history 200 (got ${hist.status})`, hist.status === 200)

    console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED ✔' : `${failures} CHECK(S) FAILED ✗`}`)
  } catch (err) {
    console.error('\nSMOKE TEST CRASHED:\n', err)
    failures += 1
  } finally {
    if (server) server.close()
    await disconnectDB().catch(() => {})
    await mongod.stop()
  }

  process.exit(failures === 0 ? 0 : 1)
}

main()
