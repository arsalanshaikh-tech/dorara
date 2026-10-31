'use strict'

const rateLimit = require('express-rate-limit')
const env = require('../config/env')
const { HTTP_STATUS, ERROR_CODES } = require('../constants')

/**
 * Rate limit for the (expensive: AI + provider) trip-planner endpoints.
 * Guests are limited per IP and more strictly than signed-in users, who are
 * limited per account. Limits are per hour and env-tunable.
 */
const handler = (_req, res) =>
  res.status(HTTP_STATUS.TOO_MANY_REQUESTS).json({
    success: false,
    error: { code: ERROR_CODES.RATE_LIMITED, message: 'You are planning trips very quickly. Please wait a little and try again.' },
  })

const base = { windowMs: 60 * 60 * 1000, standardHeaders: true, legacyHeaders: false, handler }

function createTripLimiter({ guestMax = env.TRIP_RATE_LIMIT_GUEST_PER_HOUR, userMax = env.TRIP_RATE_LIMIT_USER_PER_HOUR } = {}) {
  const guest = rateLimit({ ...base, max: guestMax })
  const user = rateLimit({ ...base, max: userMax, keyGenerator: (req) => `user:${req.userId}`, validate: { keyGeneratorIpFallback: false } })
  return function tripLimiter(req, res, next) {
    return (req.userId ? user : guest)(req, res, next)
  }
}

module.exports = { createTripLimiter }
