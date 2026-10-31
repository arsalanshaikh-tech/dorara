'use strict'

const express = require('express')
const controller = require('../controllers/travel.controller')
const validate = require('../middlewares/validate.middleware')
const { protect } = require('../middlewares/auth.middleware')
const rules = require('../validators/travel.validator')

/**
 * /api/v1/travel
 *
 * Travel module: questionnaire submissions, recommendations, destination search,
 * saved trips, and search history (all authenticated).
 */
const router = express.Router()

// All endpoints require authentication
router.use(protect)

// ----- Travel Requirements / Questionnaire -----
router.post(
  '/requirements',
  validate(rules.createRequirementRules),
  controller.createRequirement,
)
router.get('/requirements', controller.listRequirements)
router.get('/requirements/:id', controller.getRequirement)
router.patch(
  '/requirements/:id',
  validate(rules.updateRequirementRules),
  controller.updateRequirement,
)
router.delete('/requirements/:id', controller.deleteRequirement)

// ----- Recommendations -----
router.get('/recommendations/:requirementId', controller.getRecommendation)

// ----- Destinations / Search -----
router.get('/destinations', controller.searchDestinations)
router.get('/destinations/:slug', controller.getDestination)

// ----- Saved Trips / Bookmarks -----
router.post(
  '/saved-trips',
  validate(rules.saveTripBookmarkRules),
  controller.saveTripBookmark,
)
router.get('/saved-trips', controller.listSavedTrips)
router.delete('/saved-trips/:id', controller.deleteSavedTrip)

// ----- Search History -----
router.get('/search-history', controller.getSearchHistory)
router.delete('/search-history', controller.clearSearchHistory)

module.exports = router
