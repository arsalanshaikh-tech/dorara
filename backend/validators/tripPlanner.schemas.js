'use strict'

const { z } = require('zod')
const ApiError = require('../utils/ApiError')

/**
 * zod request schemas for /trip-planner. The frontend's TripPlanInput is the contract:
 *   { destination: RecommendedDestination, answers: Answers }
 * Everything is length-limited: user text ends up in an AI prompt, a database
 * document and API responses, so nothing unbounded is accepted.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const MAX_ANSWERS_JSON = 10_000

const destinationSchema = z.object({
  id: z.string().trim().min(1, 'Destination id is required').max(80),
  name: z.string().trim().min(1, 'Destination name is required').max(120),
  country: z.string().trim().max(80).optional(),
  imageRef: z.string().trim().max(200).optional(),
  avgTempC: z.number().min(-60).max(60).optional(),
  safetyIndex: z.number().min(0).max(100).optional(),
  // Other fields the frontend sends (score, tags…) are accepted and ignored.
}).passthrough()

const answersSchema = z
  .record(z.string().max(60), z.unknown())
  .superRefine((answers, ctx) => {
    if (JSON.stringify(answers).length > MAX_ANSWERS_JSON) {
      ctx.addIssue({ code: 'custom', message: 'Saved answers are too large' })
      return
    }
    const dates = answers.dates
    if (dates && typeof dates === 'object') {
      const d = dates
      for (const k of ['start', 'end']) {
        if (d[k] !== null && d[k] !== undefined && !(typeof d[k] === 'string' && ISO_DATE.test(d[k]))) {
          ctx.addIssue({ code: 'custom', path: ['dates', k], message: `Date "${k}" must be YYYY-MM-DD` })
        }
      }
      const n = d.durationDays
      if (n !== null && n !== undefined && !(typeof n === 'number' && Number.isFinite(n) && n >= 1 && n <= 365)) {
        ctx.addIssue({ code: 'custom', path: ['dates', 'durationDays'], message: 'Trip length must be between 1 and 365 days' })
      }
    }
    const budget = answers.budget
    if (budget && typeof budget === 'object') {
      for (const k of ['min', 'max']) {
        const v = budget[k]
        if (v !== null && v !== undefined && !(typeof v === 'number' && Number.isFinite(v) && v > 0 && v < 1e12)) {
          ctx.addIssue({ code: 'custom', path: ['budget', k], message: 'Budget must be a positive number' })
        }
      }
    }
    const dep = answers.departure_location
    if (dep !== null && dep !== undefined && !(typeof dep === 'string' && dep.length <= 100)) {
      ctx.addIssue({ code: 'custom', path: ['departure_location'], message: 'Departure city must be text up to 100 characters' })
    }
    for (const k of ['extra_notes', 'food_language']) {
      const v = answers[k]
      if (v !== null && v !== undefined && !(typeof v === 'string' && v.length <= 1000)) {
        ctx.addIssue({ code: 'custom', path: [k], message: 'Text is too long' })
      }
    }
  })

const inputSchema = z.object({ destination: destinationSchema, answers: answersSchema.default({}) })

const adjustmentsSchema = z
  .object({
    budget: z.number().positive().max(1e12).nullable().optional(),
    durationDays: z.number().int().min(1).max(30).nullable().optional(),
  })
  .strict()

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id')

const generateBody = z.object({ input: inputSchema })
const adjustBody = z.object({ input: inputSchema, adjustments: adjustmentsSchema, planId: objectId.optional() })
const patchPlanBody = z
  .object({ title: z.string().trim().min(1).max(120).optional(), favorite: z.boolean().optional() })
  .strict()
  .refine((b) => b.title !== undefined || b.favorite !== undefined, { message: 'Nothing to update' })
const listQuery = z.object({
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
})
const airportQuery = z.object({ q: z.string().trim().min(2).max(60), limit: z.coerce.number().int().min(1).max(10).default(8) })

/** Parse with a schema; throw a 400 VALIDATION_ERROR with field-level details. */
function parse(schema, data) {
  const r = schema.safeParse(data)
  if (r.success) return r.data
  const details = r.error.issues.map((i) => ({ field: i.path.join('.') || '(body)', message: i.message }))
  throw ApiError.validation(details[0] ? `${details[0].field}: ${details[0].message}` : 'Invalid request', details)
}

module.exports = { generateBody, adjustBody, patchPlanBody, listQuery, airportQuery, objectId, parse, inputSchema, adjustmentsSchema }
