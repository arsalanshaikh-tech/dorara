'use strict'

const crypto = require('crypto')
const { models } = require('../config/database')
const jwtUtil = require('../utils/jwt')
const env = require('../config/env')
const logger = require('../utils/logger')
const ApiError = require('../utils/ApiError')
const { ERROR_CODES } = require('../constants')

const { Session, RefreshToken } = models

/**
 * Token & session service.
 * ------------------------
 * Implements the login spec's session model:
 *   • one Session per device (powers logout / logout-all / remember-me)
 *   • short-lived stateless JWT access tokens
 *   • opaque, hashed, rotating refresh tokens with reuse detection
 *
 * Only refresh-token HASHES are persisted (see RefreshToken model), so a
 * database leak cannot be replayed. On every refresh the presented token is
 * rotated; if an already-rotated/revoked token is replayed, the entire token
 * family + session are revoked (stolen-token containment).
 */

function newFamilyId() {
  return crypto.randomUUID()
}

function newSessionToken() {
  return crypto.randomBytes(48).toString('hex')
}

/** Sign an access JWT that carries the user id, role and session id. */
function issueAccessToken(user, session) {
  return jwtUtil.signAccessToken({
    sub: String(user._id),
    sid: String(session._id),
    role: user.role,
    email: user.email,
  })
}

/**
 * Create a brand-new session for a successful login, returning the access token
 * and the RAW refresh token (only time it exists in plaintext).
 */
async function createSession(user, ctx = {}, rememberMe = false) {
  const ttlDays = rememberMe ? env.REFRESH_TOKEN_TTL_DAYS : env.SESSION_SHORT_TTL_DAYS
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000)

  const session = await Session.create({
    user: user._id,
    sessionToken: newSessionToken(),
    userAgent: ctx.userAgent || '',
    ip: ctx.ip || '',
    device: ctx.device || '',
    rememberMe,
    expiresAt,
  })

  const { raw, tokenHash } = RefreshToken.generate()
  const family = newFamilyId()
  await RefreshToken.create({
    user: user._id,
    session: session._id,
    tokenHash,
    family,
    userAgent: ctx.userAgent || '',
    ip: ctx.ip || '',
    expiresAt,
  })

  const accessToken = issueAccessToken(user, session)
  return { accessToken, refreshToken: raw, session }
}

/**
 * Rotate a refresh token. Validates the presented token, detects reuse, issues
 * a fresh refresh token in the same family, and returns a new access token.
 */
async function rotateRefreshToken(rawToken, ctx = {}) {
  if (!rawToken) {
    throw ApiError.unauthorized('Missing refresh token', { code: ERROR_CODES.INVALID_TOKEN })
  }

  const tokenHash = RefreshToken.hash(rawToken)
  const current = await RefreshToken.findOne({ tokenHash })

  if (!current) {
    throw ApiError.unauthorized('Invalid session. Please sign in again.', {
      code: ERROR_CODES.INVALID_TOKEN,
    })
  }

  // Reuse detection: a token that was already rotated/revoked is being replayed.
  if (!current.isUsable) {
    logger.warn(`[token] refresh reuse detected for family ${current.family} — revoking family`)
    await revokeFamily(current.family)
    await Session.findByIdAndUpdate(current.session, { revokedAt: new Date(), isActive: false })
    throw ApiError.unauthorized('Session expired. Please sign in again.', {
      code: ERROR_CODES.INVALID_TOKEN,
    })
  }

  const session = await Session.findById(current.session)
  if (!session || session.isRevoked || session.expiresAt.getTime() <= Date.now()) {
    throw ApiError.unauthorized('Session expired. Please sign in again.', {
      code: ERROR_CODES.INVALID_TOKEN,
    })
  }

  const user = await models.User.findById(current.user)
  if (!user || user.isDeleted) {
    throw ApiError.unauthorized('Account not found', { code: ERROR_CODES.UNAUTHENTICATED })
  }

  // Issue the successor token in the same family.
  const { raw, tokenHash: nextHash } = RefreshToken.generate()
  const next = await RefreshToken.create({
    user: current.user,
    session: current.session,
    tokenHash: nextHash,
    family: current.family,
    userAgent: ctx.userAgent || '',
    ip: ctx.ip || '',
    expiresAt: session.expiresAt,
  })

  current.rotatedAt = new Date()
  current.replacedByTokenHash = nextHash
  await current.save()

  session.lastUsedAt = new Date()
  await session.save()

  const accessToken = issueAccessToken(user, session)
  void next
  return { accessToken, refreshToken: raw, user, session }
}

/** Revoke every (usable) refresh token in a family. */
async function revokeFamily(family) {
  await RefreshToken.updateMany(
    { family, revokedAt: null },
    { $set: { revokedAt: new Date(), isActive: false } },
  )
}

/** Logout: revoke a single session + its refresh tokens. */
async function revokeSession(sessionId) {
  if (!sessionId) return
  await Promise.all([
    Session.findByIdAndUpdate(sessionId, { revokedAt: new Date(), isActive: false }),
    RefreshToken.updateMany(
      { session: sessionId, revokedAt: null },
      { $set: { revokedAt: new Date(), isActive: false } },
    ),
  ])
}

/** Logout everywhere: revoke every session + refresh token for a user. */
async function revokeAllForUser(userId) {
  await Promise.all([
    Session.updateMany(
      { user: userId, revokedAt: null },
      { $set: { revokedAt: new Date(), isActive: false } },
    ),
    RefreshToken.updateMany(
      { user: userId, revokedAt: null },
      { $set: { revokedAt: new Date(), isActive: false } },
    ),
  ])
}

/** List a user's active sessions (for a "manage devices" screen). */
async function listSessions(userId) {
  return Session.find({ user: userId, revokedAt: null })
    .sort({ lastUsedAt: -1 })
    .lean()
}

module.exports = {
  issueAccessToken,
  createSession,
  rotateRefreshToken,
  revokeSession,
  revokeAllForUser,
  revokeFamily,
  listSessions,
}
