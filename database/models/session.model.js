'use strict'

const mongoose = require('mongoose')
const baseSchemaPlugin = require('./plugins/baseSchema')
const env = require('../config/env')

const { Schema } = mongoose

/**
 * Session
 * -------
 * One document per authenticated device/browser. Powers "Session management",
 * "Remember me", "Logout", and "Logout all devices" from the login spec.
 *
 * A session groups the refresh tokens issued to a single device so that
 * revoking the session (logout) or revoking every session for a user
 * (logout-all) is a single operation.
 *
 * `expiresAt` is backed by a TTL index so expired sessions self-clean.
 */

const sessionSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // Opaque, high-entropy handle stored client-side (never the JWT itself).
    sessionToken: {
      type: String,
      required: true,
      unique: true,
    },
    userAgent: { type: String, default: '' },
    ip: { type: String, default: '' },
    device: { type: String, default: '' }, // parsed device label, e.g. "Chrome on macOS"
    rememberMe: { type: Boolean, default: false },

    lastUsedAt: { type: Date, default: Date.now },
    revokedAt: { type: Date, default: null },

    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + env.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000),
    },
  },
  { collection: 'sessions' },
)

sessionSchema.plugin(baseSchemaPlugin)

sessionSchema.virtual('isRevoked').get(function isRevoked() {
  return Boolean(this.revokedAt)
})

sessionSchema.methods.revoke = function revoke() {
  this.revokedAt = new Date()
  this.isActive = false
  return this.save()
}

// TTL index — MongoDB removes the doc once `expiresAt` passes.
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })
sessionSchema.index({ user: 1, revokedAt: 1 })

module.exports = mongoose.models.Session || mongoose.model('Session', sessionSchema)
