'use strict'

const mongoose = require('mongoose')
const asyncHandler = require('../utils/asyncHandler')
const ApiError = require('../utils/ApiError')
const { sendSuccess, sendNoContent } = require('../utils/ApiResponse')
const { getClientIp } = require('../utils/request')
const { ERROR_CODES } = require('../constants')
const schemas = require('../validators/tripPlanner.schemas')
const airports = require('../services/airports.service')
const { getTripPlannerService } = require('../services/tripPlanner')

/**
 * /api/v1/trip-planner controllers. Thin: validate -> call the service -> envelope.
 * Plan generation never throws for provider/AI problems (partial data + meta instead).
 */
const whoOf = (req) => ({ userId: req.userId ? String(req.userId) : null, ip: getClientIp(req) })

const generate = asyncHandler(async (req, res) => {
  const { input } = schemas.parse(schemas.generateBody, req.body)
  const plan = await getTripPlannerService().generate({ input, who: whoOf(req), requestId: req.id })
  sendSuccess(res, { message: 'Trip plan generated', data: plan, meta: { requestId: req.id } })
})

const adjust = asyncHandler(async (req, res) => {
  const { input, adjustments, planId } = schemas.parse(schemas.adjustBody, req.body)
  const plan = await getTripPlannerService().adjust({ input, adjustments, planId, who: whoOf(req), requestId: req.id })
  sendSuccess(res, { message: 'Trip plan adjusted', data: plan, meta: { requestId: req.id } })
})

const searchAirports = asyncHandler(async (req, res) => {
  const { q, limit } = schemas.parse(schemas.airportQuery, req.query)
  sendSuccess(res, { data: airports.search(q, limit).map(({ iata, name, city, country }) => ({ iata, name, city, country })) })
})

// ----- Saved plans (login required; ownership enforced; 404 for anything not yours) -----
const models = () => require('../config/database').models
const notFound = () => ApiError.notFound('Trip plan not found.', { code: ERROR_CODES.NOT_FOUND })

async function findOwned(req, projection) {
  if (!mongoose.isValidObjectId(req.params.id)) throw notFound()
  const doc = await models().TripPlan.findOne({ _id: req.params.id, user: req.userId }).select(projection)
  if (!doc) throw notFound()
  return doc
}

const SUMMARY_SELECT = '-plan -requirementsSnapshot -destinationSnapshot -adjustments'

const listPlans = asyncHandler(async (req, res) => {
  const { page, limit } = schemas.parse(schemas.listQuery, req.query)
  const filter = { user: req.userId, status: 'active' }
  const [items, total] = await Promise.all([
    models().TripPlan.find(filter).select(SUMMARY_SELECT).sort({ favorite: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    models().TripPlan.countDocuments(filter),
  ])
  sendSuccess(res, { data: items, meta: { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) } })
})

const getPlan = asyncHandler(async (req, res) => {
  const doc = await findOwned(req, '')
  sendSuccess(res, { data: doc })
})

const updatePlan = asyncHandler(async (req, res) => {
  const patch = schemas.parse(schemas.patchPlanBody, req.body)
  const doc = await findOwned(req, SUMMARY_SELECT)
  if (patch.title !== undefined) doc.title = patch.title
  if (patch.favorite !== undefined) doc.favorite = patch.favorite
  await doc.save()
  sendSuccess(res, { message: 'Trip plan updated', data: doc })
})

const deletePlan = asyncHandler(async (req, res) => {
  const doc = await findOwned(req, '_id user isDeleted')
  await doc.softDelete()
  sendNoContent(res)
})

module.exports = { generate, adjust, searchAirports, listPlans, getPlan, updatePlan, deletePlan }
