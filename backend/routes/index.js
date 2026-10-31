'use strict'

const express = require('express')

/**
 * Route aggregator. Wires all module routes together under the API prefix.
 *
 * Routes are namespaced:
 * - /api/v1/auth       — authentication
 * - /api/v1/users      — user profiles & preferences
 * - /api/v1/travel     — travel module (requirements, recommendations, search, bookmarks)
 * - /api/v1/trip-planner — personalized trip plans (generate, adjust, saved plans, airports)
 */
const router = express.Router()

// ----- Modules -----
const authRoutes = require('./auth.routes')
const userRoutes = require('./user.routes')
const travelRoutes = require('./travel.routes')
const tripPlannerRoutes = require('./tripPlanner.routes')

// ----- Namespace and mount -----
router.use('/auth', authRoutes)
router.use('/users', userRoutes)
router.use('/travel', travelRoutes)
router.use('/trip-planner', tripPlannerRoutes)

// Friendly API root
router.get('/', (_req, res) => {
  res.json({
    message: 'Dorara API v1',
    modules: {
      auth: '/auth',
      users: '/users',
      travel: '/travel',
      tripPlanner: '/trip-planner',
    },
  })
})

module.exports = router
