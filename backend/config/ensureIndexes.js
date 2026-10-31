'use strict'

const logger = require('../utils/logger')

/**
 * The shared database package connects with `autoIndex: false` in production, so
 * Mongoose will not build indexes on its own there. The trip-planner collections
 * depend on indexes for correctness (unique cache key, unique usage counters)
 * and housekeeping (TTL expiry), so build them explicitly at boot.
 *
 * `createIndexes()` is idempotent and cheap on already-indexed collections. A
 * failure is logged and never stops the server from starting.
 */
const TRIP_PLANNER_MODELS = ['TripPlan', 'ProviderCache', 'ProviderUsage', 'AIGenerationLog']

async function ensureTripPlannerIndexes(models) {
  const results = {}
  for (const name of TRIP_PLANNER_MODELS) {
    try {
      await models[name].createIndexes()
      results[name] = 'ok'
    } catch (err) {
      results[name] = `failed: ${err.message}`
      logger.error(`[indexes] could not build indexes for ${name}`, { message: err.message })
    }
  }
  return results
}

module.exports = { ensureTripPlannerIndexes, TRIP_PLANNER_MODELS }
