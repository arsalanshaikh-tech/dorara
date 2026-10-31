'use strict'

const crypto = require('crypto')

/**
 * ProviderCache access. Protects the small free-tier quota: a live result is
 * stored under a hash of provider + normalized params and reused until it expires.
 *
 * - Only provider-confirmed results are cached ('live'), plus short-lived
 *   "no results" markers (an empty search still costs quota at SerpApi).
 * - Demo results are never cached.
 * - Cache hits NEVER count against any quota or per-caller cap.
 * - The store is injectable (Mongo by default, in-memory in tests).
 */

/** Stable hash of a provider and its normalized parameters (key order does not matter). */
function makeCacheKey(provider, params) {
  const stable = JSON.stringify(sortKeys({ provider, ...params }))
  return crypto.createHash('sha256').update(stable).digest('hex')
}

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((acc, k) => {
        acc[k] = sortKeys(value[k])
        return acc
      }, {})
  }
  return value
}

/** Default MongoDB store (models are required lazily so unit tests need no Mongoose). */
function createMongoStore(models = require('../../config/database').models) {
  return {
    async get(key) {
      const doc = await models.ProviderCache.findOne({ key }).lean()
      return doc ? { payload: doc.payload, dataSource: doc.dataSource, expiresAt: doc.expiresAt } : null
    },
    async set(key, record) {
      await models.ProviderCache.updateOne({ key }, { $set: record }, { upsert: true })
    },
  }
}

/** In-memory store (tests, or when the DB is unavailable). */
function createMemoryStore() {
  const map = new Map()
  return {
    async get(key) {
      return map.get(key) ?? null
    },
    async set(key, record) {
      map.set(key, record)
    },
    _map: map,
  }
}

/**
 * @param {{get:Function,set:Function}} store
 * @param {() => number} [now]
 */
function createProviderCache(store, now = () => Date.now()) {
  return {
    /** @returns {Promise<{payload:any,dataSource:'live'|'demo'}|null>} */
    async get(key) {
      try {
        const rec = await store.get(key)
        if (!rec) return null
        // TTL deletion can lag by up to ~60s: always re-check expiry on read.
        if (new Date(rec.expiresAt).getTime() <= now()) return null
        return { payload: rec.payload, dataSource: rec.dataSource }
      } catch {
        return null // a cache failure must never break a search
      }
    },
    async set(key, { provider, kind, payload, dataSource, ttlSeconds }) {
      if (dataSource !== 'live') return false // never cache demo data
      try {
        await store.set(key, {
          key,
          provider,
          kind,
          payload,
          dataSource,
          expiresAt: new Date(now() + ttlSeconds * 1000),
        })
        return true
      } catch {
        return false
      }
    },
  }
}

module.exports = { makeCacheKey, createMongoStore, createMemoryStore, createProviderCache }
