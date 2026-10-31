'use strict'

const jwt = require('jsonwebtoken')
const env = require('../config/env')
const { TOKEN_TYPES } = require('../constants')

/**
 * JWT helpers. Access tokens are short-lived and stateless; refresh handling
 * (rotation, revocation) is done separately via the RefreshToken collection —
 * we only sign a lightweight refresh JWT here to carry the session + family id.
 */

function signAccessToken(payload) {
  return jwt.sign({ ...payload, type: TOKEN_TYPES.ACCESS }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
  })
}

function signRefreshToken(payload, expiresIn = env.JWT_REFRESH_EXPIRES_IN) {
  return jwt.sign({ ...payload, type: TOKEN_TYPES.REFRESH }, env.JWT_REFRESH_SECRET, {
    expiresIn,
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
  })
}

function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET, {
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
  })
}

function verifyRefreshToken(token) {
  return jwt.verify(token, env.JWT_REFRESH_SECRET, {
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
  })
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
}
