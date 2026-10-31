'use strict'

const mongoose = require('mongoose')
const crypto = require('crypto')
const baseSchemaPlugin = require('./plugins/baseSchema')
const env = require('../config/env')

const { Schema } = mongoose

/**
 * RefreshToken
 * ------------
 * Supports JWT refresh + "Refresh Token Rotation" from the login spec.
 *
 * Security model:
 *   • Only the SHA-256 HASH of the token is stored (`tokenHash`), never the raw
 *     value — a database leak cannot be replayed.
 *   • On rotation the old token is marked `rotatedAt` and points at its
 *     successor via `replacedByTokenHash`, enabling reuse-detection: if a token
 *     that has already been rotated is presented again, the whole session/token
 *     family can be revoked.
 *   • TTL index on `expiresAt` auto-removes stale tokens.
 */

const refreshTokenSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    session: {
      type: Schema.Types.ObjectId,
      ref: 'Session',
      required: true,
      index: true,
    },
    // SHA-256 hash of the opaque refresh token.
    tokenHash: {
      type: String,
      required: true,
      unique: true,
    },
    // Token family / lineage id — all rotations of one login share it.
    family: {
      type: String,
      required: true,
      index: true,
    },
    replacedByTokenHash: { type: String, default: null },
    rotatedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },

    userAgent: { type: String, default: '' },
    ip: { type: String, default: '' },

    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
    },
  },
  { collection: 'refresh_tokens' },
)

refreshTokenSchema.plugin(baseSchemaPlugin)

refreshTokenSchema.virtual('isRevoked').get(function isRevoked() {
  return Boolean(this.revokedAt)
})
refreshTokenSchema.virtual('isRotated').get(function isRotated() {
  return Boolean(this.rotatedAt)
})
refreshTokenSchema.virtual('isExpired').get(function isExpired() {
  return this.expiresAt.getTime() <= Date.now()
})
refreshTokenSchema.virtual('isUsable').get(function isUsable() {
  return !this.isRevoked && !this.isRotated && !this.isExpired
})

/**
 * Helper: generate a raw token + its hash. Persist the hash, return the raw
 * value to the caller once (to hand to the client).
 */
refreshTokenSchema.statics.generate = function generate() {
  const raw = crypto.randomBytes(48).toString('hex')
  const tokenHash = crypto.createHash('sha256').update(raw).digest('hex')
  return { raw, tokenHash }
}

refreshTokenSchema.statics.hash = function hash(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex')
}

refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })
refreshTokenSchema.index({ user: 1, revokedAt: 1 })

module.exports =
  mongoose.models.RefreshToken || mongoose.model('RefreshToken', refreshTokenSchema)
