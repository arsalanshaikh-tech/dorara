'use strict'

const rateLimit = require('express-rate-limit')
const env = require('../config/env')
const { HTTP_STATUS, ERROR_CODES } = require('../constants')

/**
 * Rate limiters. A generous global limiter protects the whole API, while a
 * stricter limiter guards sensitive auth endpoints (login, register, forgot /
 * reset password, OTP) against brute force and abuse.
 */

function buildLimiter({ windowMs, max, message }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(HTTP_STATUS.TOO_MANY_REQUESTS).json({
        success: false,
        error: { code: ERROR_CODES.RATE_LIMITED, message },
      })
    },
  })
}

const globalLimiter = buildLimiter({
  windowMs: env.RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
  max: env.RATE_LIMIT_MAX,
  message: 'Too many requests. Please slow down and try again shortly.',
})

const authLimiter = buildLimiter({
  windowMs: env.RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
  max: env.AUTH_RATE_LIMIT_MAX,
  message: 'Too many attempts. Please wait a moment and try again.',
})

// Very strict limiter for OTP + password reset requests.
const sensitiveLimiter = buildLimiter({
  windowMs: 10 * 60 * 1000,
  max: 6,
  message: 'Too many requests for this action. Please wait a few minutes.',
})

module.exports = { globalLimiter, authLimiter, sensitiveLimiter }
