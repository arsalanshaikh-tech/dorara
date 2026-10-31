'use strict'

const mongoose = require('mongoose')
const baseSchemaPlugin = require('./plugins/baseSchema')

const { Schema } = mongoose

/**
 * Destination
 * -----------
 * The catalog the recommendation engine ranks over. Mirrors the DestinationSeed
 * used by the frontend mock engine, with the visa fields kept as an embedded
 * `visa` object (the frontend surfaces exactly these fields in the VisaWidget).
 *
 * Country/city are stored as fields here (as the frontend does) rather than as
 * separate collections, since the UI never manages standalone Country/City/Hotel
 * records — this keeps the schema to what the frontend actually requires while
 * remaining easy to normalize later if a future module needs it.
 */

const visaInfoSchema = new Schema(
  {
    visaType: { type: String, default: '' }, // e.g. "Tourist eVisa"
    processingTime: { type: String, default: '' }, // e.g. "0–15 days"
    officialLink: { type: String, default: '' },
  },
  { _id: false },
)

const INTEREST_TAGS = [
  'Adventure',
  'Culture & history',
  'Luxury',
  'Nature & outdoors',
  'Food & nightlife',
  'Wellness',
]

const WEATHER_PROFILES = ['Warm & sunny', 'Cool & mild', 'Cold & snowy']

const destinationSchema = new Schema(
  {
    // Stable human-readable key from the seed (e.g. "tokyo", "chiang-mai").
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    name: { type: String, required: true, trim: true, index: true },
    country: { type: String, required: true, trim: true, index: true },
    countryCode: { type: String, trim: true, uppercase: true, default: '' }, // ISO-3166 alpha-2
    city: { type: String, trim: true, default: '' },

    // Which interest tags this destination satisfies.
    tags: {
      type: [String],
      enum: INTEREST_TAGS,
      default: [],
    },
    // Weather profiles matched by the engine.
    weather: {
      type: [String],
      enum: WEATHER_PROFILES,
      default: [],
    },

    avgTempC: { type: Number, default: null },
    safetyIndex: { type: Number, min: 0, max: 100, default: 50 },
    // Relative daily-cost multiplier used by the cost estimator.
    costFactor: { type: Number, min: 0, default: 1 },

    image: { type: String, default: '' },
    reason: { type: String, default: '' }, // short "why go" blurb

    visa: { type: visaInfoSchema, default: () => ({}) },

    // Editorial / ranking controls.
    popularity: { type: Number, default: 0 },
    isFeatured: { type: Boolean, default: false },
  },
  { collection: 'destinations' },
)

destinationSchema.plugin(baseSchemaPlugin)

// Query patterns: filter by tags/weather, sort by safety/cost/popularity.
destinationSchema.index({ tags: 1 })
destinationSchema.index({ weather: 1 })
destinationSchema.index({ safetyIndex: -1 })
destinationSchema.index({ costFactor: 1 })
destinationSchema.index({ popularity: -1 })
// Full-text search across name/country/city/reason.
destinationSchema.index({ name: 'text', country: 'text', city: 'text', reason: 'text' })

module.exports =
  mongoose.models.Destination || mongoose.model('Destination', destinationSchema)
