'use strict'

const mongoose = require('mongoose')

const { Schema } = mongoose

/**
 * ProviderCache
 * -------------
 * Short-lived cache of third-party provider responses (flight / hotel searches,
 * hero images) so the small free-tier quotas are spent only on new searches.
 *
 * `key` is a hash of provider + normalized parameters (route/city, dates,
 * travelers, currency). Documents are removed by MongoDB itself when
 * `expiresAt` passes (TTL index, `expireAfterSeconds: 0`).
 *
 * NOTE: the app connects with autoIndex disabled in production, so the TTL and
 * unique indexes are created explicitly at boot by config/ensureIndexes.js.
 */
const providerCacheSchema = new Schema(
  {
    key: { type: String, required: true },
    provider: { type: String, required: true, lowercase: true },
    kind: { type: String, enum: ['flights', 'hotels', 'image', 'other'], default: 'other' },
    payload: { type: Schema.Types.Mixed, required: true },
    // Only provider-confirmed results are cached as 'live'; never relabel on read.
    dataSource: { type: String, enum: ['live', 'demo'], required: true },
    expiresAt: { type: Date, required: true },
  },
  { collection: 'provider_cache', timestamps: true },
)

providerCacheSchema.index({ key: 1 }, { unique: true })
providerCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

module.exports =
  mongoose.models.ProviderCache || mongoose.model('ProviderCache', providerCacheSchema)
