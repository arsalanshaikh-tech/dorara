'use strict'

const mongoose = require('mongoose')
const baseSchemaPlugin = require('./plugins/baseSchema')

const { Schema } = mongoose

/**
 * SavedTrip
 * ---------
 * A bookmark. On the results page users can "save" any recommended destination
 * (the bookmark toggle on RecommendationCard); the dashboard surfaces "saved
 * places". Kept as its own collection (rather than an array on the profile) so
 * it paginates and scales, and so a saved item can retain the full context of
 * the recommendation it came from.
 */

const savedTripSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // Catalog destination that was saved.
    destination: {
      type: Schema.Types.ObjectId,
      ref: 'Destination',
      default: null,
      index: true,
    },
    // Which recommendation it was saved from (for context / re-open).
    recommendation: {
      type: Schema.Types.ObjectId,
      ref: 'DestinationRecommendation',
      default: null,
    },
    travelRequirement: {
      type: Schema.Types.ObjectId,
      ref: 'TravelRequirement',
      default: null,
    },
    vertical: { type: String, default: 'travel', lowercase: true, index: true },

    // Denormalized snapshot so a saved card renders even if the source changes.
    snapshot: {
      slug: { type: String, default: '' },
      name: { type: String, default: '' },
      country: { type: String, default: '' },
      imageRef: { type: String, default: '' },
      score: { type: Number, default: null },
      safetyIndex: { type: Number, default: null },
      avgTempC: { type: Number, default: null },
    },

    note: { type: String, maxlength: 500, default: '' },
    tags: { type: [String], default: [] },
  },
  { collection: 'saved_trips' },
)

savedTripSchema.plugin(baseSchemaPlugin)

// A user cannot save the same destination twice (when a destination is set).
savedTripSchema.index(
  { user: 1, destination: 1 },
  { unique: true, partialFilterExpression: { destination: { $type: 'objectId' } } },
)
savedTripSchema.index({ user: 1, createdAt: -1 })

module.exports = mongoose.models.SavedTrip || mongoose.model('SavedTrip', savedTripSchema)
