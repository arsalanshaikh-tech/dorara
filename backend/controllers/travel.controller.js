'use strict'

const asyncHandler = require('../utils/asyncHandler')
const travelService = require('../services/travel.service')
const { sendSuccess, sendCreated } = require('../utils/ApiResponse')
const ApiError = require('../utils/ApiError')

/**
 * Travel module controller. Handles questionnaire submissions, recommendations,
 * destination search, saved trips, and search history.
 */

/** POST /travel/requirements — submit a travel requirement/questionnaire */
const createRequirement = asyncHandler(async (req, res) => {
  const { vertical, answers } = req.body

  const requirement = await travelService.createRequirement(req.userId, { vertical, answers })

  sendCreated(res, {
    message: 'Travel requirement created and processing recommendations...',
    data: { requirement },
  })
})

/** GET /travel/requirements — list all travel requirements for the user */
const listRequirements = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, vertical } = req.query

  const result = await travelService.listRequirements(req.userId, {
    page: parseInt(page),
    limit: parseInt(limit),
    vertical,
  })

  sendSuccess(res, {
    message: 'Travel requirements retrieved',
    data: result,
  })
})

/** GET /travel/requirements/:id — fetch a specific requirement */
const getRequirement = asyncHandler(async (req, res) => {
  const requirement = await travelService.getRequirement(req.userId, req.params.id)

  if (!requirement) throw ApiError.notFound('Travel requirement not found')

  sendSuccess(res, {
    message: 'Travel requirement retrieved',
    data: { requirement },
  })
})

/** PATCH /travel/requirements/:id — update a travel requirement */
const updateRequirement = asyncHandler(async (req, res) => {
  const { answers } = req.body

  const requirement = await travelService.updateRequirement(req.userId, req.params.id, { answers })

  if (!requirement) throw ApiError.notFound('Travel requirement not found')

  sendSuccess(res, {
    message: 'Travel requirement updated',
    data: { requirement },
  })
})

/** DELETE /travel/requirements/:id — delete a travel requirement */
const deleteRequirement = asyncHandler(async (req, res) => {
  const success = await travelService.deleteRequirement(req.userId, req.params.id)

  if (!success) throw ApiError.notFound('Travel requirement not found')

  sendSuccess(res, {
    message: 'Travel requirement deleted',
  })
})

/** GET /travel/recommendations/:requirementId — get recommendations for a requirement */
const getRecommendation = asyncHandler(async (req, res) => {
  const recommendation = await travelService.getRecommendation(
    req.userId,
    req.params.requirementId,
  )

  if (!recommendation) throw ApiError.notFound('Recommendations not found')

  sendSuccess(res, {
    message: 'Recommendations retrieved',
    data: { recommendation },
  })
})

/** GET /travel/destinations — search destinations with filters */
const searchDestinations = asyncHandler(async (req, res) => {
  const { query, tags, weather, safetyMin, costMax, page = 1, limit = 20, sort } = req.query

  const result = await travelService.searchDestinations({
    query,
    tags: tags ? (Array.isArray(tags) ? tags : [tags]) : [],
    weather: weather ? (Array.isArray(weather) ? weather : [weather]) : [],
    safetyMin: safetyMin ? parseInt(safetyMin) : 0,
    costMax: costMax ? parseFloat(costMax) : undefined,
    page: parseInt(page),
    limit: parseInt(limit),
    sort,
  })

  sendSuccess(res, {
    message: 'Destinations retrieved',
    data: result,
  })
})

/** GET /travel/destinations/:slug — fetch a specific destination */
const getDestination = asyncHandler(async (req, res) => {
  const destination = await travelService.getDestination(req.params.slug)

  if (!destination) throw ApiError.notFound('Destination not found')

  sendSuccess(res, {
    message: 'Destination retrieved',
    data: { destination },
  })
})

/** POST /travel/saved-trips — bookmark a destination */
const saveTripBookmark = asyncHandler(async (req, res) => {
  const { destinationId, recommendationId, snapshot } = req.body

  const savedTrip = await travelService.saveTripBookmark(req.userId, {
    destinationId,
    recommendationId,
    snapshot,
  })

  sendCreated(res, {
    message: 'Trip bookmarked successfully',
    data: { savedTrip },
  })
})

/** GET /travel/saved-trips — list all saved trip bookmarks */
const listSavedTrips = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query

  const result = await travelService.listSavedTrips(req.userId, {
    page: parseInt(page),
    limit: parseInt(limit),
  })

  sendSuccess(res, {
    message: 'Saved trips retrieved',
    data: result,
  })
})

/** DELETE /travel/saved-trips/:id — remove a bookmarked trip */
const deleteSavedTrip = asyncHandler(async (req, res) => {
  const success = await travelService.deleteSavedTrip(req.userId, req.params.id)

  if (!success) throw ApiError.notFound('Saved trip not found')

  sendSuccess(res, {
    message: 'Saved trip removed',
  })
})

/** GET /travel/search-history — activity log of searches/requirements */
const getSearchHistory = asyncHandler(async (req, res) => {
  const { vertical, page = 1, limit = 20 } = req.query

  const result = await travelService.getSearchHistory(req.userId, {
    vertical,
    page: parseInt(page),
    limit: parseInt(limit),
  })

  sendSuccess(res, {
    message: 'Search history retrieved',
    data: result,
  })
})

/** DELETE /travel/search-history — clear all search history */
const clearSearchHistory = asyncHandler(async (req, res) => {
  await travelService.clearSearchHistory(req.userId)

  sendSuccess(res, {
    message: 'Search history cleared',
  })
})

module.exports = {
  createRequirement,
  listRequirements,
  getRequirement,
  updateRequirement,
  deleteRequirement,
  getRecommendation,
  searchDestinations,
  getDestination,
  saveTripBookmark,
  listSavedTrips,
  deleteSavedTrip,
  getSearchHistory,
  clearSearchHistory,
}
