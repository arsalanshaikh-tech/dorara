'use strict'

const mongoose = require('mongoose')
const baseSchemaPlugin = require('./plugins/baseSchema')

const { Schema } = mongoose

/**
 * DestinationRecommendation
 * -------------------------
 * The structured result the engine returns for one TravelRequirement — a 1:1
 * mirror of the frontend `Recommendation` type rendered on the results page
 * (destination cards, cost estimator, visa widget, insights, action plan,
 * confidence gauge, data sources).
 *
 * Chain: User -> TravelRequirement -> DestinationRecommendation.
 * Each recommended destination optionally links back to a catalog Destination.
 */

const recommendedDestinationSchema = new Schema(
  {
    // Catalog reference (nullable — engine may propose ad-hoc places).
    destination: { type: Schema.Types.ObjectId, ref: 'Destination', default: null },
    slug: { type: String, default: '' },
    name: { type: String, required: true }, // "Tokyo, Japan"
    country: { type: String, default: '' },
    score: { type: Number, min: 0, max: 100, required: true },
    shortReason: { type: String, default: '' },
    primaryTags: { type: [String], default: [] },
    imageRef: { type: String, default: '' },
    avgTempC: { type: Number, default: null },
    // Live current conditions when a weather provider was reachable.
    liveWeather: {
      type: new Schema(
        {
          tempC: { type: Number, default: null },
          summary: { type: String, default: '' },
          source: { type: String, default: '' },
        },
        { _id: false },
      ),
      default: undefined,
    },
    safetyIndex: { type: Number, min: 0, max: 100, default: null },
    rank: { type: Number, default: 0 },
  },
  { _id: false },
)

const costEstimateSchema = new Schema(
  {
    currency: { type: String, uppercase: true, trim: true, default: 'USD' },
    low: { type: Number, default: 0 },
    mid: { type: Number, default: 0 },
    high: { type: Number, default: 0 },
    notes: { type: String, default: '' },
  },
  { _id: false },
)

const visaSummaryItemSchema = new Schema(
  {
    country: { type: String, required: true },
    visaRequired: { type: String, default: '' },
    visaType: { type: String, default: '' },
    processingTime: { type: String, default: '' },
    officialLink: { type: String, default: '' },
  },
  { _id: false },
)

const prosConsSchema = new Schema(
  {
    advantages: { type: [String], default: [] },
    disadvantages: { type: [String], default: [] },
  },
  { _id: false },
)

const alternativeSchema = new Schema(
  {
    name: { type: String, required: true },
    reason: { type: String, default: '' },
  },
  { _id: false },
)

const actionStepSchema = new Schema(
  {
    stepNumber: { type: Number, required: true },
    title: { type: String, required: true },
    details: { type: String, default: '' },
    eta: { type: String, default: '' },
  },
  { _id: false },
)

const destinationRecommendationSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // The requirement that produced this recommendation.
    travelRequirement: {
      type: Schema.Types.ObjectId,
      ref: 'TravelRequirement',
      required: true,
      index: true,
    },
    vertical: { type: String, default: 'travel', lowercase: true, index: true },
    userName: { type: String, default: '' },

    recommendedDestinations: { type: [recommendedDestinationSchema], default: [] },
    costEstimate: { type: costEstimateSchema, default: () => ({}) },
    visaSummary: { type: [visaSummaryItemSchema], default: [] },
    prosCons: { type: prosConsSchema, default: () => ({}) },
    alternatives: { type: [alternativeSchema], default: [] },
    actionPlan: { type: [actionStepSchema], default: [] },

    // Short natural-language overview (populated when AI ranking is used).
    summary: { type: String, default: '' },

    dataSources: { type: [String], default: [] },
    confidenceScore: { type: Number, min: 0, max: 100, default: 0 },

    // Provenance for auditing / future LLM engines.
    engine: { type: String, default: 'mock-engine' },
    engineVersion: { type: String, default: '1.0.0' },
  },
  { collection: 'destination_recommendations' },
)

destinationRecommendationSchema.plugin(baseSchemaPlugin)

destinationRecommendationSchema.index({ user: 1, createdAt: -1 })
destinationRecommendationSchema.index({ confidenceScore: -1 })

module.exports =
  mongoose.models.DestinationRecommendation ||
  mongoose.model('DestinationRecommendation', destinationRecommendationSchema)
