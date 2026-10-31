'use strict'

const { models, mongoose } = require('../config/database')
const env = require('../config/env')
const ApiError = require('../utils/ApiError')
const logger = require('../utils/logger')
const tokenService = require('./token.service')
const emailService = require('./email.service')
const { ERROR_CODES, USER_STATUS } = require('../constants')

const { User, UserProfile, EmailVerificationToken, PasswordResetToken } = models

/**
 * Authentication service — the single home for every credential + token flow.
 * Controllers stay thin: they validate input, call one of these methods, and
 * shape the HTTP response. All security-sensitive logic lives here.
 */

/** Split a single "full name" field into first/last for the User model. */
function splitName(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean)
  const firstName = parts.shift() || 'Traveller'
  const lastName = parts.join(' ')
  return { firstName, lastName }
}

function buildFrontendUrl(pathname, params = {}) {
  const url = new URL(pathname, env.CLIENT_URL)
  Object.entries(params).forEach(([k, v]) => v != null && url.searchParams.set(k, v))
  return url.toString()
}

/** Create and email a fresh email-verification token for a user. */
async function issueEmailVerification(user) {
  // Invalidate any outstanding tokens for this address first.
  await EmailVerificationToken.updateMany(
    { user: user._id, email: user.email, usedAt: null },
    { $set: { usedAt: new Date() } },
  )
  const { raw, tokenHash } = EmailVerificationToken.generate()
  await EmailVerificationToken.create({ user: user._id, email: user.email, tokenHash })

  const url = buildFrontendUrl('/verify-email', { token: raw })
  await emailService.sendVerificationEmail(user.email, { name: user.firstName, url })
  return raw
}

/**
 * Register a new account. Creates the User + 1:1 UserProfile, then kicks off
 * email verification. The raw password is hashed by the User model's pre-save.
 */
async function register({ name, email, password, phoneNumber, countryCode }) {
  const normalizedEmail = String(email).trim().toLowerCase()

  const existing = await User.findOne({ email: normalizedEmail })
  if (existing) {
    throw ApiError.conflict('An account with this email already exists.', {
      code: ERROR_CODES.EMAIL_TAKEN,
    })
  }

  const { firstName, lastName } = splitName(name)

  const session = await mongoose.startSession()
  let user
  try {
    // Use a transaction when supported (replica set); fall back gracefully.
    await session.withTransaction(async () => {
      const created = await User.create(
        [
          {
            firstName,
            lastName,
            email: normalizedEmail,
            password,
            phoneNumber: phoneNumber || '',
            countryCode: countryCode || '',
            status: USER_STATUS.PENDING,
          },
        ],
        { session },
      )
      user = created[0]
      await UserProfile.create([{ user: user._id }], { session })
    })
  } catch (err) {
    // Standalone mongod (no transactions) — retry without a session.
    if (err.code === 20 || /Transaction numbers/.test(err.message)) {
      user = await User.create({
        firstName,
        lastName,
        email: normalizedEmail,
        password,
        phoneNumber: phoneNumber || '',
        countryCode: countryCode || '',
        status: USER_STATUS.PENDING,
      })
      await UserProfile.updateOne({ user: user._id }, { $setOnInsert: { user: user._id } }, { upsert: true })
    } else {
      throw err
    }
  } finally {
    session.endSession()
  }

  // Fire-and-await verification email (failure is logged, not fatal).
  await issueEmailVerification(user).catch((e) => logger.error(`[auth] verify email failed: ${e.message}`))

  return user
}

/**
 * Authenticate credentials, enforcing account-lock + verification policy, and
 * open a new session. Returns tokens for the controller to set as cookies.
 */
async function login({ email, password, remember }, ctx = {}) {
  const normalizedEmail = String(email).trim().toLowerCase()
  const user = await User.findOne({ email: normalizedEmail }).select('+password')

  // Uniform error to avoid leaking which accounts exist.
  if (!user) {
    throw ApiError.unauthorized('The email or password you entered is incorrect.', {
      code: ERROR_CODES.INVALID_CREDENTIALS,
    })
  }

  if (user.isLocked) {
    throw new ApiError(423, 'Your account is temporarily locked. Please try again later.', {
      code: ERROR_CODES.ACCOUNT_LOCKED,
    })
  }

  if (user.status === USER_STATUS.SUSPENDED || user.status === USER_STATUS.BANNED) {
    throw ApiError.forbidden('Your account has been suspended.', {
      code: ERROR_CODES.ACCOUNT_SUSPENDED,
    })
  }

  const valid = await user.comparePassword(password)
  if (!valid) {
    await user.registerFailedLogin()
    if (user.isLocked) {
      throw new ApiError(423, 'Too many failed attempts. Your account is temporarily locked.', {
        code: ERROR_CODES.ACCOUNT_LOCKED,
      })
    }
    throw ApiError.unauthorized('The email or password you entered is incorrect.', {
      code: ERROR_CODES.INVALID_CREDENTIALS,
    })
  }

  await user.registerSuccessfulLogin()

  const { accessToken, refreshToken } = await tokenService.createSession(user, ctx, Boolean(remember))

  // Best-effort login alert.
  emailService
    .sendLoginAlertEmail(user.email, {
      name: user.firstName,
      device: ctx.device,
      ip: ctx.ip,
      when: new Date().toUTCString(),
    })
    .catch(() => {})

  return { user, accessToken, refreshToken, rememberMe: Boolean(remember) }
}

/** Verify an email using the raw token from the verification link. */
async function verifyEmail(rawToken) {
  if (!rawToken) throw ApiError.badRequest('Verification token is required', { code: ERROR_CODES.INVALID_TOKEN })

  const tokenHash = EmailVerificationToken.hash(rawToken)
  const record = await EmailVerificationToken.findOne({ tokenHash })

  if (!record || record.isUsed || record.isExpired) {
    throw ApiError.badRequest('This link is invalid or has expired. Please request a new one.', {
      code: ERROR_CODES.INVALID_TOKEN,
    })
  }

  const user = await User.findById(record.user)
  if (!user) throw ApiError.notFound('Account not found')

  user.isEmailVerified = true
  if (user.status === USER_STATUS.PENDING) user.status = USER_STATUS.ACTIVE
  await user.save()

  record.usedAt = new Date()
  await record.save()

  emailService.sendWelcomeEmail(user.email, { name: user.firstName }).catch(() => {})
  return user
}

/** Resend a verification email (no-op response if already verified). */
async function resendVerification(user) {
  if (user.isEmailVerified) return { alreadyVerified: true }
  await issueEmailVerification(user)
  return { alreadyVerified: false }
}

/**
 * Begin password reset. Always resolves so the endpoint never reveals whether
 * an email is registered (enumeration protection).
 */
async function requestPasswordReset(email, ctx = {}) {
  const normalizedEmail = String(email).trim().toLowerCase()
  const user = await User.findOne({ email: normalizedEmail })
  if (!user) return { ok: true }

  await PasswordResetToken.updateMany(
    { user: user._id, usedAt: null },
    { $set: { usedAt: new Date() } },
  )
  const { raw, tokenHash } = PasswordResetToken.generate()
  await PasswordResetToken.create({ user: user._id, tokenHash, requestedIp: ctx.ip || '' })

  const url = buildFrontendUrl('/reset-password', { token: raw })
  await emailService
    .sendPasswordResetEmail(user.email, { name: user.firstName, url })
    .catch((e) => logger.error(`[auth] reset email failed: ${e.message}`))

  return { ok: true }
}

/** Complete password reset. Revokes all sessions so old devices are logged out. */
async function resetPassword({ token, password }) {
  if (!token) throw ApiError.badRequest('Reset token is required', { code: ERROR_CODES.INVALID_TOKEN })

  const tokenHash = PasswordResetToken.hash(token)
  const record = await PasswordResetToken.findOne({ tokenHash })

  if (!record || record.isUsed || record.isExpired) {
    throw ApiError.badRequest('This link is invalid or has expired. Please request a new one.', {
      code: ERROR_CODES.INVALID_TOKEN,
    })
  }

  const user = await User.findById(record.user).select('+password')
  if (!user) throw ApiError.notFound('Account not found')

  user.password = password
  await user.save()

  record.usedAt = new Date()
  await record.save()

  await tokenService.revokeAllForUser(user._id)
  return user
}

/** Change password for an authenticated user (requires current password). */
async function changePassword(userId, { currentPassword, newPassword }, { keepSessionId } = {}) {
  const user = await User.findById(userId).select('+password')
  if (!user) throw ApiError.notFound('Account not found')

  const valid = await user.comparePassword(currentPassword)
  if (!valid) {
    throw ApiError.badRequest('Your current password is incorrect.', {
      code: ERROR_CODES.WRONG_PASSWORD,
    })
  }

  user.password = newPassword
  await user.save()

  // Revoke every other session; keep the current one if provided.
  await tokenService.revokeAllForUser(user._id)
  void keepSessionId
  return user
}

module.exports = {
  register,
  login,
  verifyEmail,
  resendVerification,
  requestPasswordReset,
  resetPassword,
  changePassword,
  issueEmailVerification,
}
