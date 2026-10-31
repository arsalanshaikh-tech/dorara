'use strict'

/** Default wiring of the trip-planner service (env + Mongo). Created lazily, reused. */
let instance = null

function getTripPlannerService() {
  if (!instance) {
    const env = require('../../config/env')
    const { createTripPlannerService } = require('./tripPlanner.service')
    const { createPexelsService } = require('../pexels.service')
    const { createProviderCache, createMongoStore } = require('../providers/providerCache.service')
    const persistence = require('./persistence')
    instance = createTripPlannerService({
      hero: createPexelsService({ apiKey: env.PEXELS_API_KEY, cache: createProviderCache(createMongoStore()) }),
      save: persistence.savePlan,
      recordAdjustment: persistence.recordAdjustment,
    })
  }
  return instance
}

module.exports = { getTripPlannerService }
