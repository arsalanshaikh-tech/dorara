'use strict'

/**
 * Request de-duplication. Identical concurrent calls (same key) share ONE
 * underlying promise, so a burst of identical searches costs a single provider
 * call and a single quota unit. The entry is removed as soon as it settles.
 */
const pending = new Map()

/**
 * @template T
 * @param {string} key
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
function dedupe(key, fn) {
  const existing = pending.get(key)
  if (existing) return existing
  const promise = Promise.resolve()
    .then(fn)
    .finally(() => {
      if (pending.get(key) === promise) pending.delete(key)
    })
  pending.set(key, promise)
  return promise
}

function pendingCount() {
  return pending.size
}

module.exports = { dedupe, pendingCount }
