'use strict'

const express = require('express')
const controller = require('../controllers/tripPlanner.controller')
const { protect, optionalAuth } = require('../middlewares/auth.middleware')
const { createTripLimiter } = require('../middlewares/tripLimiter.middleware')

/**
 * /api/v1/trip-planner
 *
 *   POST   /generate        optional auth, rate limited  -> TripPlan (auto-saved when signed in)
 *   POST   /adjust          optional auth, rate limited  -> TripPlan (What-if)
 *   GET    /airports?q=     public                       -> departure-city autocomplete
 *   GET    /plans           login                        -> saved plan summaries (paginated)
 *   GET    /plans/:id       login, owner only            -> one saved plan
 *   PATCH  /plans/:id       login, owner only            -> rename / favorite
 *   DELETE /plans/:id       login, owner only            -> soft delete
 */
const router = express.Router()
const tripLimiter = createTripLimiter()

router.get('/airports', controller.searchAirports)

router.post('/generate', optionalAuth, tripLimiter, controller.generate)
router.post('/adjust', optionalAuth, tripLimiter, controller.adjust)

router.get('/plans', protect, controller.listPlans)
router.get('/plans/:id', protect, controller.getPlan)
router.patch('/plans/:id', protect, controller.updatePlan)
router.delete('/plans/:id', protect, controller.deletePlan)

module.exports = router
