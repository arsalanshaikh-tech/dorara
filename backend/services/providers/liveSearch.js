'use strict'

const { dedupe } = require('./inflight')
const { makeCacheKey } = require('./providerCache.service')
const { SerpApiError } = require('./serpapi/client')
const logger = require('../../utils/logger')

/**
 * Shared guard rail around ONE real provider search:
 *
 *   cache hit  -> return it (no quota, no cap, no network)
 *   cache miss -> dedupe identical in-flight calls -> reserve quota -> call -> map -> cache
 *
 * Outcomes (never throws):
 *   { state: 'live',    options, fromCache }   real priced results
 *   { state: 'empty',   fromCache }            valid search, nothing priced (counts as a call)
 *   { state: 'blocked', reason, message }      quota / cap stopped the call (nothing was spent)
 *   { state: 'error',   reason, message }      provider failure (the reservation is released)
 *
 * The caller turns anything other than 'live' into labelled demo data.
 */
async function runLiveSearch({
  provider,
  kind,
  keyParams,
  ttlSeconds,
  emptyTtlSeconds = 3600,
  cache,
  quota,
  who,
  call, // () => Promise<{ empty: boolean, json: any }>
  map, // (json) => options[]
}) {
  const key = makeCacheKey(provider, keyParams)

  const cached = await cache.get(key)
  if (cached) {
    const p = cached.payload
    if (p && p.empty) return { state: 'empty', fromCache: true }
    if (p && Array.isArray(p.options) && p.options.length > 0) {
      return { state: 'live', options: p.options, fromCache: true, extra: p.extra }
    }
  }

  return dedupe(key, async () => {
    const reservation = await quota.reserve({ provider, userId: who?.userId ?? null, ip: who?.ip ?? 'unknown' })
    if (!reservation.ok) {
      logger.info(`[${provider}] live call blocked`, { reason: reservation.reason })
      return { state: 'blocked', reason: reservation.reason, message: reservation.message }
    }

    let result
    try {
      result = await call()
    } catch (err) {
      // Provider errors / timeouts are not billed by SerpApi: give the units back.
      await reservation.release()
      const reason = err instanceof SerpApiError ? err.kind : 'unexpected'
      logger.warn(`[${provider}] live call failed`, { kind, reason })
      return { state: 'error', reason, message: 'The live search failed.' }
    }

    if (result.empty) {
      await cache.set(key, { provider, kind, payload: { empty: true }, dataSource: 'live', ttlSeconds: emptyTtlSeconds })
      return { state: 'empty', fromCache: false }
    }

    let mapped
    try {
      mapped = map(result.json)
    } catch (err) {
      logger.warn(`[${provider}] could not map response`, { kind, message: err.message })
      return { state: 'error', reason: 'mapping', message: 'The live search response could not be read.' }
    }

    const options = mapped.options
    if (!Array.isArray(options) || options.length === 0) {
      // A real search that yielded nothing priced still cost a call: keep the units, cache briefly.
      await cache.set(key, { provider, kind, payload: { empty: true }, dataSource: 'live', ttlSeconds: emptyTtlSeconds })
      return { state: 'empty', fromCache: false }
    }

    await cache.set(key, { provider, kind, payload: { options, extra: mapped.extra }, dataSource: 'live', ttlSeconds })
    return { state: 'live', options, fromCache: false, extra: mapped.extra }
  })
}

module.exports = { runLiveSearch }
