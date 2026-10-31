'use strict'

const env = require('../config/env')
const { COOKIES } = require('../constants')

/**
 * httpOnly cookie helpers for the access + refresh tokens.
 *
 * The access token is stored in an httpOnly cookie so the Next.js frontend
 * (which currently expects the login endpoint to "set a JWT httpOnly cookie")
 * is authenticated automatically on same-site requests. The refresh token is
 * scoped to the refresh endpoint path to limit its exposure.
 */

function baseOptions() {
  const opts = {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAMESITE,
    path: '/',
  }
  if (env.COOKIE_DOMAIN) opts.domain = env.COOKIE_DOMAIN
  return opts
}

function setAuthCookies(res, { accessToken, refreshToken, rememberMe }) {
  const accessMaxAge = 15 * 60 * 1000 // 15 minutes
  const refreshMaxAge =
    (rememberMe ? env.REFRESH_TOKEN_TTL_DAYS : env.SESSION_SHORT_TTL_DAYS) * 24 * 60 * 60 * 1000

  res.cookie(COOKIES.ACCESS, accessToken, { ...baseOptions(), maxAge: accessMaxAge })
  res.cookie(COOKIES.REFRESH, refreshToken, {
    ...baseOptions(),
    maxAge: refreshMaxAge,
  })
}

function clearAuthCookies(res) {
  res.clearCookie(COOKIES.ACCESS, baseOptions())
  res.clearCookie(COOKIES.REFRESH, baseOptions())
}

module.exports = { setAuthCookies, clearAuthCookies, baseOptions }
