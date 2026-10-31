'use strict'

const { test } = require('node:test')
const assert = require('node:assert/strict')
const path = require('path')
const os = require('os')
process.env.LOG_DIR = path.join(os.tmpdir(), 'dorara-test-logs')
const { createQuota, createMemoryUsageStore, hashId } = require(path.join(__dirname, '..', 'services/providers/quota.service'))

const baseCfg = { monthlyLimit: 250, stopRatio: 0.8, dailyLimit: 8, hourlyLimit: 40, guestDaily: 3, userDaily: 10, salt: 's' }
const T0 = new Date('2026-10-05T10:15:00Z')
const make = (over = {}, now = () => T0) => {
  const store = createMemoryUsageStore()
  return { store, quota: createQuota({ store, config: { ...baseCfg, ...over }, now }) }
}

test('quota: guest cap is 3 per IP per day; the 4th is blocked with a reason', async () => {
  const { quota } = make()
  for (let i = 0; i < 3; i++) assert.equal((await quota.reserve({ provider: 'serpapi', ip: '1.2.3.4' })).ok, true)
  const r = await quota.reserve({ provider: 'serpapi', ip: '1.2.3.4' })
  assert.equal(r.ok, false)
  assert.equal(r.reason, 'caller_daily_cap')
  assert.equal((await quota.reserve({ provider: 'serpapi', ip: '9.9.9.9' })).ok, true, 'other IPs unaffected')
})

test('quota: signed-in users get their own, larger cap (10/day)', async () => {
  const { quota } = make({ dailyLimit: 100 })
  for (let i = 0; i < 10; i++) assert.equal((await quota.reserve({ provider: 'serpapi', userId: 'u1' })).ok, true)
  assert.equal((await quota.reserve({ provider: 'serpapi', userId: 'u1' })).reason, 'caller_daily_cap')
  assert.equal((await quota.reserve({ provider: 'serpapi', userId: 'u2' })).ok, true)
})

test('quota: global daily cap (SERPAPI_DAILY_LIMIT) stops everyone', async () => {
  const { quota } = make({ dailyLimit: 2, guestDaily: 99 })
  assert.equal((await quota.reserve({ provider: 'serpapi', ip: 'a' })).ok, true)
  assert.equal((await quota.reserve({ provider: 'serpapi', ip: 'b' })).ok, true)
  const r = await quota.reserve({ provider: 'serpapi', ip: 'c' })
  assert.equal(r.reason, 'daily_cap')
})

test('quota: monthly stop at 80% of the monthly limit (250 -> 200)', async () => {
  const { quota } = make({ dailyLimit: 1000, hourlyLimit: 1000, guestDaily: 1000, userDaily: 1000 })
  let granted = 0
  for (let i = 0; i < 260; i++) if ((await quota.reserve({ provider: 'serpapi', userId: `u${i}` })).ok) granted++
  assert.equal(granted, 200)
  assert.equal((await quota.reserve({ provider: 'serpapi', userId: 'late' })).reason, 'monthly_quota')
})

test('quota: hourly cap, and a new hour / day / month starts fresh counters', async () => {
  let now = T0
  const { quota } = make({ hourlyLimit: 2, dailyLimit: 100, guestDaily: 100 }, () => now)
  await quota.reserve({ provider: 'serpapi', ip: 'a' })
  await quota.reserve({ provider: 'serpapi', ip: 'b' })
  assert.equal((await quota.reserve({ provider: 'serpapi', ip: 'c' })).reason, 'hourly_cap')
  now = new Date('2026-10-05T11:00:00Z')
  assert.equal((await quota.reserve({ provider: 'serpapi', ip: 'c' })).ok, true, 'next hour')
  const { quota: q2 } = make({ guestDaily: 1 }, () => now)
  await q2.reserve({ provider: 'serpapi', ip: 'z' })
  assert.equal((await q2.reserve({ provider: 'serpapi', ip: 'z' })).ok, false)
  now = new Date('2026-10-06T00:01:00Z')
  assert.equal((await q2.reserve({ provider: 'serpapi', ip: 'z' })).ok, true, 'next day')
})

test('quota: a blocked reservation rolls back every counter it had already taken', async () => {
  const { quota, store } = make({ monthlyLimit: 0, stopRatio: 0.8 }) // monthly cap 0 -> always blocked at the last step
  const r = await quota.reserve({ provider: 'serpapi', ip: 'a' })
  assert.equal(r.reason, 'monthly_quota')
  for (const [k, v] of store._counts) assert.equal(v, 0, `${k} rolled back`)
})

test('quota: release() gives units back exactly once (provider error => not billed)', async () => {
  const { quota, store } = make()
  const r = await quota.reserve({ provider: 'serpapi', ip: 'a' })
  assert.ok([...store._counts.values()].every((v) => v === 1))
  await r.release()
  await r.release() // idempotent
  assert.ok([...store._counts.values()].every((v) => v === 0))
})

test('quota: concurrent reservations can never overshoot a cap', async () => {
  const { quota } = make({ dailyLimit: 5, guestDaily: 100, hourlyLimit: 100 })
  const results = await Promise.all(Array.from({ length: 30 }, (_, i) => quota.reserve({ provider: 'serpapi', ip: `ip${i}` })))
  assert.equal(results.filter((r) => r.ok).length, 5)
})

test('quota: if the counter store fails, NO live call is allowed (fail closed)', async () => {
  const store = createMemoryUsageStore()
  store.tryIncrement = async () => {
    throw new Error('db down')
  }
  const quota = createQuota({ store, config: baseCfg, now: () => T0 })
  const r = await quota.reserve({ provider: 'serpapi', ip: 'a' })
  assert.equal(r.ok, false)
  assert.equal(r.reason, 'counter_unavailable')
})

test('quota: IPs are hashed, never stored raw', async () => {
  const { quota, store } = make()
  await quota.reserve({ provider: 'serpapi', ip: '203.0.113.7' })
  assert.ok(![...store._counts.keys()].some((k) => k.includes('203.0.113.7')))
  assert.equal(hashId('203.0.113.7', 's').length, 24)
})

test('quota: snapshot reports usage against the stop threshold', async () => {
  const { quota } = make()
  await quota.reserve({ provider: 'serpapi', ip: 'a' })
  const s = await quota.snapshot('serpapi')
  assert.deepEqual(s.month, { used: 1, stopAt: 200, limit: 250 })
})
