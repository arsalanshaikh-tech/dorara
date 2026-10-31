'use strict'

const mongoose = require('mongoose')
const crypto = require('crypto')
const baseSchemaPlugin = require('./plugins/baseSchema')
const env = require('../config/env')

const { Schema } = mongoose

/**
 * PasswordResetToken
 * ------------------
 * Backs "Forgot Password" -> "Reset Password". Only the hashed token is stored;
 * the raw token is emailed. Single-use and short-lived (default 60 min) with a
 * TTL index for automatic cleanup. `requestedIp` aids abuse monitoring.
 */

const passwordResetTokenSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
    },
    usedAt: { type: Date, default: null },
    requestedIp: { type: String, default: '' },
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + env.PASSWORD_RESET_TTL_MINUTES * 60 * 1000),
    },
  },
  { collection: 'password_reset_tokens' },
)

passwordResetTokenSchema.plugin(baseSchemaPlugin)

passwordResetTokenSchema.virtual('isUsed').get(function isUsed() {
  return Boolean(this.usedAt)
})
passwordResetTokenSchema.virtual('isExpired').get(function isExpired() {
  return this.expiresAt.getTime() <= Date.now()
})

passwordResetTokenSchema.statics.generate = function generate() {
  const raw = crypto.randomBytes(32).toString('hex')
  const tokenHash = crypto.createHash('sha256').update(raw).digest('hex')
  return { raw, tokenHash }
}
passwordResetTokenSchema.statics.hash = function hash(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex')
}

passwordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

module.exports =
  mongoose.models.PasswordResetToken ||
  mongoose.model('PasswordResetToken', passwordResetTokenSchema)
