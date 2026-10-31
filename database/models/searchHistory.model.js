'use strict'

const mongoose = require('mongoose')
const baseSchemaPlugin = require('./plugins/baseSchema')

const { Schema } = mongoose

/**
 * SearchHistory
 * -------------
 * A lightweight activity log of the consultations / searches a user runs.
 * Powers the dashboard "Recent activity" feed and the profile "Search History".
 * Each entry links to the requirement + resulting recommendation when available.
 */

const searchHistorySchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    vertical: {
      type: String,
      default: 'travel',
      lowercase: true,
      trim: true,
      index: true,
    },
    // Human-readable summary, e.g. "Warm, mid-budget solo trip".
    query: { type: String, default: '' },

    travelRequirement: {
      type: Schema.Types.ObjectId,
      ref: 'TravelRequirement',
      default: null,
    },
    recommendation: {
      type: Schema.Types.ObjectId,
      ref: 'DestinationRecommendation',
      default: null,
    },

    // Snapshot of key filters for quick display without a populate.
    filters: { type: Schema.Types.Mixed, default: {} },
    resultCount: { type: Number, default: 0 },

    ip: { type: String, default: '' },
    userAgent: { type: String, default: '' },
  },
  { collection: 'search_history' },
)

searchHistorySchema.plugin(baseSchemaPlugin)

// Most-recent-first per user, and per-vertical analytics.
searchHistorySchema.index({ user: 1, createdAt: -1 })
searchHistorySchema.index({ vertical: 1, createdAt: -1 })

module.exports =
  mongoose.models.SearchHistory || mongoose.model('SearchHistory', searchHistorySchema)
