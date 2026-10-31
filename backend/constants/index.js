'use strict'

/**
 * Shared, immutable constants for the Dorara backend.
 *
 * ERROR_CODES intentionally mirror the codes the frontend maps to friendly
 * messages in `lib/services/auth-service.ts#messageForCode`, so the UI can keep
 * showing the correct copy without any changes.
 */

const HTTP_STATUS = Object.freeze({
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
})

// Codes consumed by the frontend (messageForCode) + additional API codes.
const ERROR_CODES = Object.freeze({
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  EMAIL_TAKEN: 'EMAIL_TAKEN',
  INVALID_TOKEN: 'INVALID_TOKEN',
  WRONG_PASSWORD: 'WRONG_PASSWORD',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  RATE_LIMITED: 'RATE_LIMITED',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  ACCOUNT_SUSPENDED: 'ACCOUNT_SUSPENDED',
  OTP_INVALID: 'OTP_INVALID',
  OTP_EXPIRED: 'OTP_EXPIRED',
  OTP_MAX_RETRIES: 'OTP_MAX_RETRIES',
  UPLOAD_ERROR: 'UPLOAD_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  INTERNAL: 'INTERNAL',
})

const ROLES = Object.freeze({
  USER: 'user',
  ADMIN: 'admin',
  PARTNER: 'partner',
  MODERATOR: 'moderator',
})

const USER_STATUS = Object.freeze({
  ACTIVE: 'active',
  PENDING: 'pending',
  SUSPENDED: 'suspended',
  BANNED: 'banned',
})

const TOKEN_TYPES = Object.freeze({
  ACCESS: 'access',
  REFRESH: 'refresh',
})

const COOKIES = Object.freeze({
  ACCESS: 'dorara_access',
  REFRESH: 'dorara_refresh',
  SESSION: 'dorara_session',
})

const VERTICALS = Object.freeze({
  TRAVEL: 'travel',
})

module.exports = {
  HTTP_STATUS,
  ERROR_CODES,
  ROLES,
  USER_STATUS,
  TOKEN_TYPES,
  COOKIES,
  VERTICALS,
}
