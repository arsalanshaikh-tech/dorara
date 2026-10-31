'use strict'

const mongoose = require('mongoose')
const crypto = require('crypto')
const baseSchemaPlugin = require('./plugins/baseSchema')
const env = require('../config/env')

const { Schema } = mongoose

/**
 * EmailVerificationToken
 * ----------------------
 * Backs the "Email Verification" flow (verify-email / resend-verification).
 * Only the hashed token is stored; the raw token travels in the emailed link.
 * Single-use: `usedAt` is stamped on consumption. TTL index auto-expires.
 */

const emailVerificationTokenSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // The address being verified (supports verifying a changed email).
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
    },
    usedAt: { type: Date, default: null },
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + env.EMAIL_VERIFICATION_TTL_HOURS * 60 * 60 * 1000),
    },
  },
  { collection: 'email_verification_tokens' },
)

emailVerificationTokenSchema.plugin(baseSchemaPlugin)

emailVerificationTokenSchema.virtual('isUsed').get(function isUsed() {
  return Boolean(this.usedAt)
})
emailVerificationTokenSchema.virtual('isExpired').get(function isExpired() {
  return this.expiresAt.getTime() <= Date.now()
})

emailVerificationTokenSchema.statics.generate = function generate() {
  const raw = crypto.randomBytes(32).toString('hex')
  const tokenHash = crypto.createHash('sha256').update(raw).digest('hex')
  return { raw, tokenHash }
}
emailVerificationTokenSchema.statics.hash = function hash(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex')
}

emailVerificationTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

module.exports =
  mongoose.models.EmailVerificationToken ||
  mongoose.model('EmailVerificationToken', emailVerificationTokenSchema)
