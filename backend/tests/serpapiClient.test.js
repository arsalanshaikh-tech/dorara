'use strict'

const { test } = require('node:test')
const assert = require('node:assert/strict')
const path = require('path')
const os = require('os')
process.env.LOG_DIR = path.join(os.tmpdir(), 'dorara-test-logs')
const { createSerpApiClient, SerpApiError } = require(path.join(__dirname, '..', 'services/providers/serpapi/client'))

const KEY = 'SECRET_KEY_123'
const json = (status, body) => ({ status, ok: status >= 200 && status < 300, json: async () => body })
const client = (fetchImpl, over = {}) => createSerpApiClient({ apiKey: KEY, fetchImpl, retryDelayMs: 1, timeoutMs: 200, ...over })

test('client: sends params + key + output=json; drops empty params', async () => {
  let seen
  const c = client(async (url) => ((seen = url), json(200, { best_flights: [] })))
  const res = await c.search({ engine: 'google_flights', departure_id: 'DEL', empty: '', nothing: undefined })
  assert.equal(res.empty, false)
  assert.equal(seen.searchParams.get('engine'), 'google_flights')
  assert.equal(seen.searchParams.get('api_key'), KEY)
  assert.equal(seen.searchParams.get('output'), 'json')
  assert.equal(seen.searchParams.has('empty'), false)
  assert.equal(seen.searchParams.has('nothing'), false)
})

test('client: "no results" is not an error', async () => {
  const c = client(async () => json(200, { error: "Google Flights hasn't returned any results for this query." }))
  assert.equal((await c.search({})).empty, true)
})

test('client: retries ONCE on 5xx, then succeeds', async () => {
  let calls = 0
  const c = client(async () => (++calls === 1 ? json(503, {}) : json(200, { ok: 1 })))
  const r = await c.search({})
  assert.equal(calls, 2)
  assert.equal(r.json.ok, 1)
})

test('client: gives up after one retry', async () => {
  let calls = 0
  const c = client(async () => (calls++, json(500, {})))
  await assert.rejects(() => c.search({}), (e) => e instanceof SerpApiError && e.kind === 'http')
  assert.equal(calls, 2)
})

test('client: 429, auth errors and API errors are NOT retried', async () => {
  for (const [status, body, kind] of [
    [429, {}, 'rate_limit'],
    [401, {}, 'auth'],
    [200, { error: 'Invalid API key. Your API key should be here: https://serpapi.com/manage-api-key' }, 'auth'],
    [200, { error: 'Something odd happened' }, 'api'],
  ]) {
    let calls = 0
    const c = client(async () => (calls++, json(status, body)))
    await assert.rejects(() => c.search({}), (e) => e.kind === kind, `${status} ${kind}`)
    assert.equal(calls, 1, `${kind} not retried`)
  }
})

test('client: timeout aborts the request and is retried once', async () => {
  let calls = 0
  const hang = (url, { signal }) =>
    new Promise((_, reject) => {
      calls++
      signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))
    })
  const c = client(hang, { timeoutMs: 20 })
  await assert.rejects(() => c.search({}), (e) => e.kind === 'timeout')
  assert.equal(calls, 2)
})

test('client: network errors are transient (one retry)', async () => {
  let calls = 0
  const c = client(async () => {
    calls++
    throw new TypeError('fetch failed')
  })
  await assert.rejects(() => c.search({}), (e) => e.kind === 'network')
  assert.equal(calls, 2)
})

test('client: the API key never appears in any error message or serialised error', async () => {
  const cases = [
    async () => json(200, { error: `bad request for api_key=${KEY}` }),
    async () => {
      throw new Error(`failed https://serpapi.com/search.json?api_key=${KEY}`)
    },
    async () => json(500, {}),
  ]
  for (const f of cases) {
    try {
      await client(f).search({})
      assert.fail('should throw')
    } catch (e) {
      assert.ok(!String(e.message).includes(KEY), e.message)
      assert.ok(!JSON.stringify(e).includes(KEY))
    }
  }
})
