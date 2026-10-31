'use strict'

const ApiError = require('../utils/ApiError')
const { ERROR_CODES } = require('../constants')

/**
 * CORS origin handling.
 *
 * A request from an origin that is not on the allowlist is rejected with a
 * clean 403 (code FORBIDDEN) through the central error handler — previously a
 * plain Error was thrown, which surfaced as a 500.
 *
 * Origins are compared without a trailing slash so `CLIENT_URL=https://x.app/`
 * and a browser `Origin: https://x.app` still match.
 */
function normalizeOrigin(origin) {
  return String(origin || '')
    .trim()
    .replace(/\/+$/, '')
}

function buildAllowedOrigins({ CLIENT_URL, CORS_ORIGINS = [] }) {
  return [CLIENT_URL, ...CORS_ORIGINS].filter(Boolean).map(normalizeOrigin)
}

function createOriginHandler(allowedOrigins) {
  const allowed = allowedOrigins.map(normalizeOrigin)
  return function originHandler(origin, cb) {
    // Same-origin / server-to-server (e.g. the Vercel rewrite proxy) / curl.
    if (!origin) return cb(null, true)
    if (allowed.includes(normalizeOrigin(origin))) return cb(null, true)
    return cb(ApiError.forbidden('This origin is not allowed.', { code: ERROR_CODES.FORBIDDEN }))
  }
}

module.exports = { normalizeOrigin, buildAllowedOrigins, createOriginHandler }
