'use strict'

const crypto = require('crypto')

/**
 * Live-call quota protection (SerpApi Free = 250 searches/month, 50/hour).
 *
 * Before every REAL provider call the facade must `reserve()`. A reservation
 * atomically bumps up to five counters and succeeds only if ALL are under their
 * limit; otherwise everything already bumped is rolled back and the caller gets a
 * reason code so it can serve labelled demo data instead.
 *
 *   caller-day   per signed-in user, or per hashed guest IP   (env-tunable)
 *   day          global daily cap       (SERPAPI_DAILY_LIMIT)
 *   hour         global hourly cap      (SERPAPI_HOURLY_LIMIT, below SerpApi's 50/h)
 *   month        stop at SERPAPI_QUOTA_STOP_RATIO x SERPAPI_MONTHLY_LIMIT (default 80%)
 *
 * Unit of counting = one live provider call. A full plan uses up to 2 calls
 * (flights + stays), so "3 per guest per day" ~ 1.5 plans. Cache hits never call
 * reserve(), so they cost nothing and count against nothing.
 *
 * The counter store is injectable: MongoDB in production (atomic conditional
 * $inc — concurrent requests can never overshoot a cap), in-memory in tests.
 */

const REASONS = {
  caller_daily_cap: 'Daily limit of live searches for your session reached.',
  daily_cap: 'The daily live-search budget for this app has been used.',
  hourly_cap: 'The hourly live-search limit has been reached.',
  monthly_quota: 'The monthly live-search allowance is nearly used up.',
}

const pad = (n) => String(n).padStart(2, '0')
const dayKey = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
const monthKey = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`
const hourKey = (d) => `${dayKey(d)}T${pad(d.getUTCHours())}`

function hashId(value, salt = '') {
  return crypto.createHash('sha256').update(`${salt}|${value}`).digest('hex').slice(0, 24)
}

/** MongoDB-backed counters (conditional atomic increment). */
function createMongoUsageStore(models = require('../../config/database').models) {
  const Usage = models.ProviderUsage
  return {
    async tryIncrement({ provider, scope, key, limit, expiresAt }) {
      if (!(limit > 0)) return false
      try {
        const doc = await Usage.findOneAndUpdate(
          { provider, scope, key, count: { $lt: limit } },
          { $inc: { count: 1 }, $setOnInsert: { expiresAt } },
          { upsert: true, new: true },
        )
        return Boolean(doc)
      } catch (err) {
        // The filter did not match an existing, full counter -> upsert collided
        // with the unique index. That means "limit reached", not an error.
        if (err && err.code === 11000) return false
        throw err
      }
    },
    async decrement({ provider, scope, key }) {
      await Usage.updateOne({ provider, scope, key, count: { $gt: 0 } }, { $inc: { count: -1 } })
    },
    async getCount({ provider, scope, key }) {
      const doc = await Usage.findOne({ provider, scope, key }).lean()
      return doc ? doc.count : 0
    },
  }
}

/** In-memory counters (tests). */
function createMemoryUsageStore() {
  const counts = new Map()
  const k = (x) => `${x.provider}|${x.scope}|${x.key}`
  return {
    async tryIncrement(x) {
      if (!(x.limit > 0)) return false
      const cur = counts.get(k(x)) ?? 0
      if (cur >= x.limit) return false
      counts.set(k(x), cur + 1)
      return true
    },
    async decrement(x) {
      const cur = counts.get(k(x)) ?? 0
      if (cur > 0) counts.set(k(x), cur - 1)
    },
    async getCount(x) {
      return counts.get(k(x)) ?? 0
    },
    _counts: counts,
  }
}

function defaultConfig() {
  const env = require('../../config/env')
  return {
    monthlyLimit: env.SERPAPI_MONTHLY_LIMIT,
    stopRatio: env.SERPAPI_QUOTA_STOP_RATIO,
    dailyLimit: env.SERPAPI_DAILY_LIMIT,
    hourlyLimit: env.SERPAPI_HOURLY_LIMIT,
    guestDaily: env.LIVE_SEARCH_GUEST_DAILY,
    userDaily: env.LIVE_SEARCH_USER_DAILY,
    salt: env.JWT_ACCESS_SECRET || '',
  }
}

/**
 * @param {object} [opts]
 * @param {ReturnType<typeof createMongoUsageStore>} [opts.store]
 * @param {ReturnType<typeof defaultConfig>} [opts.config]
 * @param {() => Date} [opts.now]
 */
function createQuota({ store, config, now = () => new Date() } = {}) {
  const cfg = config ?? defaultConfig()
  const usage = store ?? createMongoUsageStore()
  const monthlyCap = Math.floor(cfg.monthlyLimit * cfg.stopRatio)

  /**
   * @param {{provider:string, userId?:string|null, ip?:string}} who
   * @returns {Promise<{ok:true, release:()=>Promise<void>} | {ok:false, reason:string, message:string}>}
   */
  async function reserve({ provider, userId = null, ip = 'unknown' }) {
    const t = now()
    const callerScope = userId ? 'user_day' : 'ip_day'
    const callerId = userId ? String(userId) : hashId(ip, cfg.salt)
    const plan = [
      {
        scope: callerScope,
        key: `${callerId}:${dayKey(t)}`,
        limit: userId ? cfg.userDaily : cfg.guestDaily,
        reason: 'caller_daily_cap',
        ttlMs: 2 * 86_400_000,
      },
      { scope: 'day', key: dayKey(t), limit: cfg.dailyLimit, reason: 'daily_cap', ttlMs: 2 * 86_400_000 },
      { scope: 'hour', key: hourKey(t), limit: cfg.hourlyLimit, reason: 'hourly_cap', ttlMs: 2 * 3_600_000 },
      { scope: 'month', key: monthKey(t), limit: monthlyCap, reason: 'monthly_quota', ttlMs: 62 * 86_400_000 },
    ]

    const taken = []
    const rollback = async () => {
      for (const c of taken.reverse()) {
        try {
          await usage.decrement({ provider, scope: c.scope, key: c.key })
        } catch {
          /* best effort */
        }
      }
    }

    for (const c of plan) {
      let granted = false
      try {
        granted = await usage.tryIncrement({
          provider,
          scope: c.scope,
          key: c.key,
          limit: c.limit,
          expiresAt: new Date(t.getTime() + c.ttlMs),
        })
      } catch {
        // If the counter store itself fails we must NOT spend quota blindly.
        await rollback()
        return { ok: false, reason: 'counter_unavailable', message: 'Live-search usage could not be checked.' }
      }
      if (!granted) {
        await rollback()
        return { ok: false, reason: c.reason, message: REASONS[c.reason] }
      }
      taken.push(c)
    }

    let released = false
    return {
      ok: true,
      /** Give the units back (provider error / timeout: SerpApi does not bill those). */
      async release() {
        if (released) return
        released = true
        await rollback()
      },
    }
  }

  async function snapshot(provider) {
    const t = now()
    const get = (scope, key) => usage.getCount({ provider, scope, key })
    return {
      month: { used: await get('month', monthKey(t)), stopAt: monthlyCap, limit: cfg.monthlyLimit },
      day: { used: await get('day', dayKey(t)), limit: cfg.dailyLimit },
      hour: { used: await get('hour', hourKey(t)), limit: cfg.hourlyLimit },
    }
  }

  return { reserve, snapshot, REASONS }
}

module.exports = { createQuota, createMongoUsageStore, createMemoryUsageStore, hashId, REASONS }
