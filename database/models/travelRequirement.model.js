'use strict'

const mongoose = require('mongoose')
const baseSchemaPlugin = require('./plugins/baseSchema')

const { Schema } = mongoose

/**
 * TravelRequirement
 * -----------------
 * A single submission of the Travel questionnaire — the normalized "Answers"
 * payload the frontend collects in the consult store. This is the pivot of the
 * core relationship chain:
 *
 *     User -> TravelRequirement -> DestinationRecommendation
 *
 * Answers are stored both as a raw map (`answers`, faithful to the frontend's
 * flexible AnswerValue union) AND as a set of extracted, queryable fields so the
 * data can be filtered/aggregated (e.g. "average budget of family travellers").
 */

const budgetAnswerSchema = new Schema(
  {
    min: { type: Number, default: null },
    max: { type: Number, default: null },
    currency: { type: String, uppercase: true, trim: true, default: 'USD' },
  },
  { _id: false },
)

const datesAnswerSchema = new Schema(
  {
    start: { type: Date, default: null },
    end: { type: Date, default: null },
    durationDays: { type: Number, min: 1, max: 365, default: null },
  },
  { _id: false },
)

const travelRequirementSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // Which questionnaire (vertical + version) produced these answers.
    questionnaire: {
      type: Schema.Types.ObjectId,
      ref: 'Questionnaire',
      default: null,
    },
    vertical: {
      type: String,
      default: 'travel',
      lowercase: true,
      trim: true,
      index: true,
    },

    // Name captured for the personalized greeting on the results page.
    userName: { type: String, trim: true, default: '' },

    // Raw, schema-flexible answer map — mirrors `Answers` on the frontend.
    answers: {
      type: Schema.Types.Mixed,
      default: {},
    },

    // ---- Extracted / normalized fields for querying + aggregation ----
    destinationPreference: { type: String, default: '' },
    budget: { type: budgetAnswerSchema, default: () => ({}) },
    dates: { type: datesAnswerSchema, default: () => ({}) },
    party: { type: String, default: '' },
    ageGroup: { type: String, default: '' },
    weather: { type: [String], default: [] },
    interestType: { type: [String], default: [] },
    safetyImportance: { type: Number, min: 1, max: 5, default: null },
    visaRequirements: { type: String, default: '' },
    foodLanguage: { type: [String], default: [] },
    extraNotes: { type: String, maxlength: 1000, default: '' },

    status: {
      type: String,
      enum: ['draft', 'submitted', 'processed'],
      default: 'submitted',
      index: true,
    },
    completedAt: { type: Date, default: null },
  },
  { collection: 'travel_requirements' },
)

travelRequirementSchema.plugin(baseSchemaPlugin)

// Common access pattern: a user's most recent requirements first.
travelRequirementSchema.index({ user: 1, createdAt: -1 })
travelRequirementSchema.index({ vertical: 1, status: 1 })

module.exports =
  mongoose.models.TravelRequirement ||
  mongoose.model('TravelRequirement', travelRequirementSchema)
