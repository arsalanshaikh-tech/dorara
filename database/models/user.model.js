'use strict'

const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const baseSchemaPlugin = require('./plugins/baseSchema')
const env = require('../config/env')

const { Schema } = mongoose

/**
 * User
 * ----
 * Core identity + credential record. Mirrors the sign-up / login / profile
 * surfaces in the Dorara frontend and the authentication specification.
 *
 * Passwords are ALWAYS stored as bcrypt hashes — the raw value never touches
 * the database. The `password` field uses `select: false` so it is excluded
 * from queries unless explicitly requested with `.select('+password')`.
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const userSchema = new Schema(
  {
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
      minlength: 1,
      maxlength: 60,
    },
    lastName: {
      type: String,
      trim: true,
      maxlength: 60,
      default: '',
    },
    username: {
      type: String,
      trim: true,
      lowercase: true,
      minlength: 3,
      maxlength: 30,
      match: [/^[a-z0-9_.]+$/, 'Username may only contain letters, numbers, dot and underscore'],
      // sparse unique — usernames are optional but must be unique when present.
      unique: true,
      sparse: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
      unique: true,
      match: [EMAIL_REGEX, 'Enter a valid email address'],
    },
    phoneNumber: {
      type: String,
      trim: true,
      default: '',
      maxlength: 20,
    },
    countryCode: {
      type: String,
      trim: true,
      default: '',
      maxlength: 6, // e.g. "+91"
    },
    // Bcrypt hash only — never plain text.
    password: {
      type: String,
      required: [true, 'Password is required'],
      select: false,
    },
    profilePicture: {
      type: String,
      default: '',
    },
    dateOfBirth: {
      type: Date,
      default: null,
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'non_binary', 'prefer_not_to_say', 'other'],
      default: 'prefer_not_to_say',
    },
    country: { type: String, trim: true, default: '' },
    state: { type: String, trim: true, default: '' },
    city: { type: String, trim: true, default: '' },
    preferredLanguage: {
      type: String,
      trim: true,
      default: 'en',
    },
    timeZone: {
      type: String,
      trim: true,
      default: 'UTC',
    },

    // Verification + security flags
    isEmailVerified: { type: Boolean, default: false },
    isPhoneVerified: { type: Boolean, default: false },
    isTwoFactorEnabled: { type: Boolean, default: false },

    // Authorization
    role: {
      type: String,
      enum: ['user', 'admin', 'partner', 'moderator'],
      default: 'user',
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'pending', 'suspended', 'banned'],
      default: 'pending',
      index: true,
    },

    // Login analytics + brute-force protection
    lastLogin: { type: Date, default: null },
    loginCount: { type: Number, default: 0, min: 0 },
    failedLoginAttempts: { type: Number, default: 0, min: 0 },
    accountLockedUntil: { type: Date, default: null },
  },
  { collection: 'users' },
)

userSchema.plugin(baseSchemaPlugin)

/* -------------------------------------------------------------------------- */
/* Virtuals                                                                    */
/* -------------------------------------------------------------------------- */

userSchema.virtual('fullName').get(function fullName() {
  return [this.firstName, this.lastName].filter(Boolean).join(' ').trim()
})

userSchema.virtual('isLocked').get(function isLocked() {
  return Boolean(this.accountLockedUntil && this.accountLockedUntil.getTime() > Date.now())
})

// 1:1 link to the extended profile document.
userSchema.virtual('profile', {
  ref: 'UserProfile',
  localField: '_id',
  foreignField: 'user',
  justOne: true,
})

/* -------------------------------------------------------------------------- */
/* Hooks                                                                       */
/* -------------------------------------------------------------------------- */

// Hash the password whenever it is set/changed.
userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next()
  try {
    const salt = await bcrypt.genSalt(env.BCRYPT_SALT_ROUNDS)
    this.password = await bcrypt.hash(this.password, salt)
    next()
  } catch (err) {
    next(err)
  }
})

/* -------------------------------------------------------------------------- */
/* Instance methods                                                            */
/* -------------------------------------------------------------------------- */

userSchema.methods.comparePassword = function comparePassword(candidate) {
  // `this.password` must have been selected (`.select('+password')`).
  return bcrypt.compare(candidate, this.password)
}

userSchema.methods.registerFailedLogin = function registerFailedLogin() {
  this.failedLoginAttempts += 1
  if (this.failedLoginAttempts >= env.MAX_LOGIN_ATTEMPTS) {
    this.accountLockedUntil = new Date(Date.now() + env.ACCOUNT_LOCK_MINUTES * 60_000)
  }
  return this.save()
}

userSchema.methods.registerSuccessfulLogin = function registerSuccessfulLogin() {
  this.failedLoginAttempts = 0
  this.accountLockedUntil = null
  this.lastLogin = new Date()
  this.loginCount += 1
  if (this.status === 'pending' && this.isEmailVerified) this.status = 'active'
  return this.save()
}

/* -------------------------------------------------------------------------- */
/* Indexes                                                                     */
/* -------------------------------------------------------------------------- */

// email + username uniqueness declared inline above.
userSchema.index({ role: 1, status: 1 })
userSchema.index({ createdAt: -1 })
// Case-insensitive text search across identity fields (admin user search).
userSchema.index({ firstName: 'text', lastName: 'text', email: 'text', username: 'text' })

module.exports = mongoose.models.User || mongoose.model('User', userSchema)
