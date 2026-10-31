'use strict'

/**
 * Default wiring of the provider facades from environment configuration.
 * Controllers/planner code import `getFlightService()` / `getAccommodationService()`
 * from here. Instances are created lazily and reused.
 */
const env = require('../../config/env')
const { createSerpApiClient } = require('./serpapi/client')
const { createProviderCache, createMongoStore } = require('./providerCache.service')
const { createQuota } = require('./quota.service')
const { createFlightService } = require('./flight.service')
const { createAccommodationService } = require('./accommodation.service')

let shared = null

function getShared() {
  if (!shared) {
    shared = {
      client: env.SERPAPI_API_KEY
        ? createSerpApiClient({ apiKey: env.SERPAPI_API_KEY, timeoutMs: env.PROVIDER_TIMEOUT_MS })
        : null,
      cache: createProviderCache(createMongoStore()),
      quota: createQuota(),
    }
  }
  return shared
}

let flights = null
let stays = null

function getFlightService() {
  if (!flights) flights = createFlightService({ ...getShared(), ttlSeconds: env.FLIGHTS_CACHE_TTL_HOURS * 3600 })
  return flights
}

function getAccommodationService() {
  if (!stays) stays = createAccommodationService({ ...getShared(), ttlSeconds: env.HOTELS_CACHE_TTL_HOURS * 3600 })
  return stays
}

module.exports = { getFlightService, getAccommodationService }
