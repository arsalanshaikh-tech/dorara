'use strict'

const { models } = require('../config/database')
const recommendationService = require('./recommendation.service')
const ApiError = require('../utils/ApiError')

/**
 * Travel module service. Handles all travel-related business logic:
 * questionnaire submissions, recommendations, destination search, bookmarks,
 * and activity history.
 */

/**
 * Create a new travel requirement from questionnaire answers.
 * @param {string} userId - MongoDB user ID
 * @param {Object} data - { vertical, answers }
 * @returns {Promise<Object>} Created travel requirement
 */
async function createRequirement(userId, data) {
  const { vertical, answers } = data

  // Validate that questionnaire exists
  const questionnaire = await models.Questionnaire.findOne({ vertical, isPublished: true })
  if (!questionnaire) {
    throw ApiError.badRequest(`Questionnaire for "${vertical}" not found or not published`)
  }

  // Create the travel requirement document
  const requirement = await models.TravelRequirement.create({
    user: userId,
    vertical,
    answers,
  })

  // Create search history entry
  await models.SearchHistory.create({
    user: userId,
    vertical,
    requirementId: requirement._id,
    actionType: 'submission',
  })

  // Generate recommendations asynchronously (fire and forget)
  setImmediate(() => {
    recommendationService
      .generateRecommendations(userId, requirement._id)
      .catch((err) => console.error('[travel.service] Async recommendation generation failed:', err))
  })

  return requirement
}

/**
 * List all travel requirements for a user.
 * @param {string} userId - MongoDB user ID
 * @param {Object} options - { page, limit, vertical }
 * @returns {Promise<Object>} Paginated requirements
 */
async function listRequirements(userId, options = {}) {
  const { page = 1, limit = 10, vertical } = options

  const query = { user: userId, isDeleted: false }
  if (vertical) query.vertical = vertical

  const skip = (page - 1) * limit
  const [requirements, total] = await Promise.all([
    models.TravelRequirement.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    models.TravelRequirement.countDocuments(query),
  ])

  return {
    data: requirements,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  }
}

/**
 * Fetch a single travel requirement.
 * @param {string} userId - MongoDB user ID
 * @param {string} requirementId - Requirement MongoDB ID
 * @returns {Promise<Object|null>} Travel requirement or null
 */
async function getRequirement(userId, requirementId) {
  return models.TravelRequirement.findOne({
    _id: requirementId,
    user: userId,
    isDeleted: false,
  }).lean()
}

/**
 * Update travel requirement answers.
 * @param {string} userId - MongoDB user ID
 * @param {string} requirementId - Requirement MongoDB ID
 * @param {Object} data - { answers }
 * @returns {Promise<Object|null>} Updated requirement or null
 */
async function updateRequirement(userId, requirementId, data) {
  const { answers } = data

  const requirement = await models.TravelRequirement.findOneAndUpdate(
    { _id: requirementId, user: userId, isDeleted: false },
    { answers, status: 'pending' }, // Reset to pending since answers changed
    { new: true },
  ).lean()

  if (requirement) {
    // Regenerate recommendations after update
    setImmediate(() => {
      recommendationService
        .generateRecommendations(userId, requirement._id)
        .catch((err) => console.error('[travel.service] Async recommendation generation failed:', err))
    })
  }

  return requirement
}

/**
 * Delete a travel requirement (soft delete).
 * @param {string} userId - MongoDB user ID
 * @param {string} requirementId - Requirement MongoDB ID
 * @returns {Promise<boolean>} Success flag
 */
async function deleteRequirement(userId, requirementId) {
  const result = await models.TravelRequirement.findOneAndUpdate(
    { _id: requirementId, user: userId },
    { isDeleted: true, deletedAt: new Date() },
    { new: true },
  )

  return !!result
}

/**
 * Fetch recommendations for a requirement.
 * @param {string} userId - MongoDB user ID
 * @param {string} requirementId - Requirement MongoDB ID
 * @returns {Promise<Object|null>} Recommendation or null
 */
async function getRecommendation(userId, requirementId) {
  return models.DestinationRecommendation.findOne({
    user: userId,
    travelRequirement: requirementId,
    isDeleted: false,
  })
    .populate('travelRequirement')
    .lean()
}

/**
 * Search destinations with filters.
 * @param {Object} options - Search criteria
 * @returns {Promise<Object>} Paginated destinations
 */
async function searchDestinations(options = {}) {
  const {
    query,
    tags = [],
    weather = [],
    safetyMin = 0,
    costMax,
    page = 1,
    limit = 20,
    sort = '-popularity',
  } = options

  const filter = { isDeleted: false }

  // Text search on name/country/city
  if (query) {
    filter.$text = { $search: query }
  }

  // Filter by tags (any tag match)
  if (tags.length > 0) {
    filter.tags = { $in: tags }
  }

  // Filter by weather
  if (weather.length > 0) {
    filter.weather = { $in: weather }
  }

  // Safety index minimum
  if (safetyMin > 0) {
    filter.safetyIndex = { $gte: safetyMin }
  }

  // Cost factor maximum
  if (costMax !== undefined) {
    filter.costFactor = { $lte: costMax }
  }

  const skip = (page - 1) * limit
  const [destinations, total] = await Promise.all([
    models.Destination.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    models.Destination.countDocuments(filter),
  ])

  return {
    data: destinations,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  }
}

/**
 * Fetch a single destination by slug.
 * @param {string} slug - Destination slug
 * @returns {Promise<Object|null>} Destination or null
 */
async function getDestination(slug) {
  return models.Destination.findOne({
    slug,
    isDeleted: false,
  }).lean()
}

/**
 * Bookmark/save a trip destination.
 * @param {string} userId - MongoDB user ID
 * @param {Object} data - { destinationId, recommendationId, snapshot }
 * @returns {Promise<Object>} Saved trip record
 */
async function saveTripBookmark(userId, data) {
  const { destinationId, recommendationId, snapshot } = data

  // Check if already saved to avoid duplicates
  const existing = await models.SavedTrip.findOne({
    user: userId,
    destination: destinationId,
  })

  if (existing && !existing.isDeleted) {
    throw ApiError.badRequest('This trip is already bookmarked')
  }

  // If soft-deleted, restore it
  if (existing && existing.isDeleted) {
    existing.isDeleted = false
    existing.deletedAt = null
    await existing.save()
    return existing
  }

  // Create new saved trip
  const savedTrip = await models.SavedTrip.create({
    user: userId,
    destination: destinationId,
    recommendation: recommendationId,
    snapshot,
  })

  // Log to search history
  await models.SearchHistory.create({
    user: userId,
    vertical: 'travel',
    actionType: 'bookmark',
    destinationId,
  })

  return savedTrip
}

/**
 * List all saved trip bookmarks for a user.
 * @param {string} userId - MongoDB user ID
 * @param {Object} options - { page, limit }
 * @returns {Promise<Object>} Paginated saved trips
 */
async function listSavedTrips(userId, options = {}) {
  const { page = 1, limit = 10 } = options

  const skip = (page - 1) * limit
  const [savedTrips, total] = await Promise.all([
    models.SavedTrip.find({ user: userId, isDeleted: false })
      .populate('destination')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    models.SavedTrip.countDocuments({ user: userId, isDeleted: false }),
  ])

  return {
    data: savedTrips,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  }
}

/**
 * Remove a saved trip bookmark.
 * @param {string} userId - MongoDB user ID
 * @param {string} savedTripId - SavedTrip MongoDB ID
 * @returns {Promise<boolean>} Success flag
 */
async function deleteSavedTrip(userId, savedTripId) {
  const result = await models.SavedTrip.findOneAndUpdate(
    { _id: savedTripId, user: userId },
    { isDeleted: true, deletedAt: new Date() },
    { new: true },
  )

  return !!result
}

/**
 * Fetch search history/activity log for a user.
 * @param {string} userId - MongoDB user ID
 * @param {Object} options - { vertical, page, limit }
 * @returns {Promise<Object>} Paginated history
 */
async function getSearchHistory(userId, options = {}) {
  const { vertical, page = 1, limit = 20 } = options

  const query = { user: userId }
  if (vertical) query.vertical = vertical

  const skip = (page - 1) * limit
  const [history, total] = await Promise.all([
    models.SearchHistory.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    models.SearchHistory.countDocuments(query),
  ])

  return {
    data: history,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  }
}

/**
 * Clear all search history for a user.
 * @param {string} userId - MongoDB user ID
 * @returns {Promise<void>}
 */
async function clearSearchHistory(userId) {
  await models.SearchHistory.deleteMany({ user: userId })
}

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
