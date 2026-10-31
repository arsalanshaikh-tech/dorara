'use strict'

const { z } = require('zod')

/**
 * Schemas for what the model may return. Deliberately has NO price, currency,
 * URL, availability or visa field: the AI can only suggest activities with a
 * qualitative cost LEVEL, and explain fit by citing the traveller's own answers.
 * (Written with the zod API shared by v3 and v4.)
 */

const activitySchema = z.object({
  time: z.string().min(1).max(24),
  title: z.string().min(2).max(90),
  description: z.string().min(5).max(280),
  interests: z.array(z.string().max(60)).max(4).optional(),
  bookingRequired: z.boolean().optional(),
  estimatedCostLevel: z.enum(['free', 'low', 'medium', 'high']).optional(),
})

const daySchema = z.object({
  day: z.number().int().min(1).max(30),
  title: z.string().min(2).max(100),
  theme: z.string().min(2).max(60),
  activities: z.array(activitySchema).min(1).max(6),
})

const fitSchema = z.object({
  matches: z
    .array(
      z.object({
        ref: z.string().min(1).max(40),
        text: z.string().min(10).max(300),
      }),
    )
    .max(8),
  considerations: z.array(z.string().min(10).max(300)).max(6),
})

/** Full response (what we hand to generateObject so the model sees the structure). */
const tripContentSchema = z.object({
  days: z.array(daySchema).min(1).max(21),
  fit: fitSchema,
})

module.exports = { activitySchema, daySchema, fitSchema, tripContentSchema }
