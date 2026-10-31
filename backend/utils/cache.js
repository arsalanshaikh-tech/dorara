'use strict'

const env = require('../config/env')

/**
 * Tiny in-memory TTL cache used to memoize responses from external live-data
 * providers (countries, currency, weather). It is intentionally minimal and
 * process-local; the interface (get/set/wrap) matches what a Redis-backed cache
 * would expose, so it can be swapped for Upstash/Redis later without touching
 * the service layer.
 */

const store = new Map()

function get(key) {
  const entry = store.get(key)
  if (!entry) return undefined
  if (entry.expiresAt <= Date.now()) {
    store.delete(key)
    return undefined
  }
  return entry.value
}

function set(key, value, ttlSeconds = env.CACHE_TTL_SECONDS) {
  store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 })
  return value
}

/** Return the cached value for `key`, or compute + cache it via `producer`. */
async function wrap(key, producer, ttlSeconds = env.CACHE_TTL_SECONDS) {
  const cached = get(key)
  if (cached !== undefined) return cached
  const value = await producer()
  if (value !== undefined && value !== null) set(key, value, ttlSeconds)
  return value
}

function clear() {
  store.clear()
}

module.exports = { get, set, wrap, clear }
