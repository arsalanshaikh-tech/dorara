'use strict'

const mongoose = require('mongoose')

const { Schema } = mongoose

/**
 * ProviderUsage
 * -------------
 * Atomic counters that protect the free-tier quota of paid-by-the-search
 * providers (SerpApi). One document per (provider, scope, key):
 *
 *   scope 'month'     key '2026-10'                 (total live calls this month)
 *   scope 'day'       key '2026-10-02'              (global daily cap)
 *   scope 'hour'      key '2026-10-02T14'           (provider hourly throughput)
 *   scope 'ip_day'    key '<hashed ip>:2026-10-02'  (guest per-IP daily cap)
 *   scope 'user_day'  key '<userId>:2026-10-02'     (signed-in per-user daily cap)
 *
 * Counters are incremented with a conditional atomic update (increment only if
 * below the limit) so concurrent requests can never overshoot a cap. IPs are
 * stored hashed, never raw. Non-monthly counters expire via the TTL index.
 */
const providerUsageSchema = new Schema(
  {
    provider: { type: String, required: true, lowercase: true },
    scope: {
      type: String,
      enum: ['month', 'day', 'hour', 'ip_day', 'user_day'],
      required: true,
    },
    key: { type: String, required: true },
    count: { type: Number, default: 0, min: 0 },
    expiresAt: { type: Date, required: true },
  },
  { collection: 'provider_usage', timestamps: true },
)

providerUsageSchema.index({ provider: 1, scope: 1, key: 1 }, { unique: true })
providerUsageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

module.exports =
  mongoose.models.ProviderUsage || mongoose.model('ProviderUsage', providerUsageSchema)
