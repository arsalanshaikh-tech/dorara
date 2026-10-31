'use strict'

const mongoose = require('mongoose')
const baseSchemaPlugin = require('./plugins/baseSchema')

const { Schema } = mongoose

/**
 * TripPlan
 * --------
 * A saved Personalized Trip Plan. Only created for signed-in users (guest plans
 * are never stored). `plan` holds the full frontend `TripPlan` payload exactly as
 * returned by the API, so a saved plan re-opens without recomputation; the
 * denormalized summary fields exist so list views never load the big document.
 *
 * `plan` / snapshots are `Mixed` on purpose: the frontend type is the contract
 * and is validated with zod at the API boundary, not by Mongoose.
 */
const adjustmentSchema = new Schema(
  {
    at: { type: Date, default: Date.now },
    // { budget?, durationDays? } as sent by the client.
    adjustments: { type: Schema.Types.Mixed, default: {} },
    summary: { type: String, maxlength: 300, default: '' },
  },
  { _id: false },
)

const tripPlanSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    title: { type: String, trim: true, maxlength: 120, default: '' },
    favorite: { type: Boolean, default: false },
    status: { type: String, enum: ['active', 'archived'], default: 'active' },

    // Inputs that produced the plan (client-supplied, validated before save).
    requirementsSnapshot: { type: Schema.Types.Mixed, default: {} },
    destinationSnapshot: { type: Schema.Types.Mixed, default: {} },

    // Full frontend TripPlan payload.
    plan: { type: Schema.Types.Mixed, required: true },

    // Summary fields for list views.
    destinationName: { type: String, default: '' },
    destinationCountry: { type: String, default: '' },
    durationDays: { type: Number, default: null },
    currency: { type: String, default: '' },
    estimatedTotal: { type: Number, default: null },
    feasibility: {
      type: String,
      enum: ['within', 'close', 'above', 'unknown'],
      default: 'unknown',
    },
    // True when ANY section was demo data (never a single "live" flag).
    isDemo: { type: Boolean, default: true },
    itinerarySource: { type: String, enum: ['ai', 'fallback', ''], default: '' },

    // Bumped on every adjustment that is persisted.
    version: { type: Number, default: 1 },
    adjustments: { type: [adjustmentSchema], default: [] },
  },
  { collection: 'trip_plans' },
)

tripPlanSchema.plugin(baseSchemaPlugin)

tripPlanSchema.index({ user: 1, createdAt: -1 })
tripPlanSchema.index({ user: 1, favorite: 1, createdAt: -1 })

module.exports = mongoose.models.TripPlan || mongoose.model('TripPlan', tripPlanSchema)
