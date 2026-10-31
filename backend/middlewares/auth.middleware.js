'use strict'

const asyncHandler = require('../utils/asyncHandler')
const ApiError = require('../utils/ApiError')
const jwtUtil = require('../utils/jwt')
const { models } = require('../config/database')
const { COOKIES, ERROR_CODES, USER_STATUS, TOKEN_TYPES } = require('../constants')

/**
 * Extract a bearer access token from either the httpOnly cookie (default for
 * the Next.js frontend) or an `Authorization: Bearer <token>` header (useful
 * for mobile clients / API testing).
 */
function extractToken(req) {
  const header = req.headers.authorization
  if (header && header.startsWith('Bearer ')) return header.slice(7).trim()
  if (req.cookies && req.cookies[COOKIES.ACCESS]) return req.cookies[COOKIES.ACCESS]
  return null
}

async function resolveUser(token) {
  const payload = jwtUtil.verifyAccessToken(token)
  if (payload.type !== TOKEN_TYPES.ACCESS) {
    throw ApiError.unauthorized('Invalid token type', { code: ERROR_CODES.INVALID_TOKEN })
  }
  const user = await models.User.findById(payload.sub)
  if (!user || user.isDeleted) {
    throw ApiError.unauthorized('Account not found', { code: ERROR_CODES.UNAUTHENTICATED })
  }
  return { user, payload }
}

/**
 * Hard gate — request must be authenticated. Attaches `req.user`, `req.userId`
 * and `req.sessionId` for downstream handlers.
 */
const protect = asyncHandler(async (req, _res, next) => {
  const token = extractToken(req)
  if (!token) {
    throw ApiError.unauthorized('You must be signed in to do that.')
  }

  const { user, payload } = await resolveUser(token)

  if (user.status === USER_STATUS.SUSPENDED || user.status === USER_STATUS.BANNED) {
    throw ApiError.forbidden('Your account has been suspended.', {
      code: ERROR_CODES.ACCOUNT_SUSPENDED,
    })
  }

  req.user = user
  req.userId = user._id
  req.sessionId = payload.sid || null
  next()
})

/**
 * Soft gate — attaches `req.user` when a valid token is present, but never
 * blocks the request. Useful for endpoints that personalize when logged in.
 */
const optionalAuth = asyncHandler(async (req, _res, next) => {
  const token = extractToken(req)
  if (!token) return next()
  try {
    const { user, payload } = await resolveUser(token)
    req.user = user
    req.userId = user._id
    req.sessionId = payload.sid || null
  } catch {
    // Ignore invalid tokens for optional auth.
  }
  next()
})

/**
 * Require the request to also have verified their email. The auth spec locks
 * certain actions behind verification.
 */
function requireVerified(req, _res, next) {
  if (!req.user || !req.user.isEmailVerified) {
    return next(
      ApiError.forbidden('Please verify your email address to continue.', {
        code: ERROR_CODES.EMAIL_NOT_VERIFIED,
      }),
    )
  }
  next()
}

/**
 * Role-based access control. Usage: `authorize('admin')`, `authorize('admin','moderator')`.
 */
function authorize(...roles) {
  return function checkRole(req, _res, next) {
    if (!req.user) return next(ApiError.unauthorized())
    if (roles.length && !roles.includes(req.user.role)) {
      return next(ApiError.forbidden('You do not have permission to access this resource.'))
    }
    next()
  }
}

module.exports = { protect, optionalAuth, requireVerified, authorize, extractToken }
