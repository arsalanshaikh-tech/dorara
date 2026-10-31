'use strict'

const asyncHandler = require('../utils/asyncHandler')
const authService = require('../services/auth.service')
const tokenService = require('../services/token.service')
const { toAuthUser } = require('../serializers/user.serializer')
const { sendSuccess, sendCreated } = require('../utils/ApiResponse')
const { setAuthCookies, clearAuthCookies } = require('../utils/cookies')
const { getRequestContext } = require('../utils/request')
const { COOKIES } = require('../constants')
const ApiError = require('../utils/ApiError')

/**
 * Auth controller. Thin HTTP layer over auth.service + token.service:
 * validates nothing itself (that's the validators + validate middleware),
 * calls the service, sets/clears cookies, and returns the uniform envelope.
 */

/** POST /auth/register */
const register = asyncHandler(async (req, res) => {
  const { name, email, password, phoneNumber, countryCode } = req.body
  const user = await authService.register({ name, email, password, phoneNumber, countryCode })

  sendCreated(res, {
    message: 'Account created. Please check your email to verify your address.',
    data: { user: toAuthUser(user), emailVerificationSent: true },
  })
})

/** POST /auth/login */
const login = asyncHandler(async (req, res) => {
  const { email, password, remember } = req.body
  const ctx = getRequestContext(req)

  const { user, accessToken, refreshToken, rememberMe } = await authService.login(
    { email, password, remember },
    ctx,
  )

  setAuthCookies(res, { accessToken, refreshToken, rememberMe })

  sendSuccess(res, {
    message: 'Signed in successfully.',
    // Return the token too so non-cookie clients (mobile) can use the header.
    data: { user: toAuthUser(user), accessToken },
  })
})

/** POST /auth/refresh — rotate refresh token, issue a new access token. */
const refresh = asyncHandler(async (req, res) => {
  const raw = req.cookies?.[COOKIES.REFRESH] || req.body?.refreshToken
  const ctx = getRequestContext(req)

  const { user, accessToken, refreshToken, session } = await tokenService.rotateRefreshToken(raw, ctx)
  setAuthCookies(res, { accessToken, refreshToken, rememberMe: session.rememberMe })

  sendSuccess(res, {
    message: 'Session refreshed.',
    data: { user: toAuthUser(user), accessToken },
  })
})

/** POST /auth/logout — revoke the current session. */
const logout = asyncHandler(async (req, res) => {
  await tokenService.revokeSession(req.sessionId)
  clearAuthCookies(res)
  sendSuccess(res, { message: 'Signed out.' })
})

/** POST /auth/logout-all — revoke every session for the user. */
const logoutAll = asyncHandler(async (req, res) => {
  await tokenService.revokeAllForUser(req.userId)
  clearAuthCookies(res)
  sendSuccess(res, { message: 'Signed out of all devices.' })
})

/** POST /auth/verify-email */
const verifyEmail = asyncHandler(async (req, res) => {
  const token = req.body.token || req.query.token
  const user = await authService.verifyEmail(token)
  sendSuccess(res, {
    message: 'Email verified. Your account is now active.',
    data: { user: toAuthUser(user) },
  })
})

/** POST /auth/resend-verification (authenticated). */
const resendVerification = asyncHandler(async (req, res) => {
  const result = await authService.resendVerification(req.user)
  sendSuccess(res, {
    message: result.alreadyVerified
      ? 'Your email is already verified.'
      : 'Verification email sent.',
    data: result,
  })
})

/** POST /auth/forgot-password */
const forgotPassword = asyncHandler(async (req, res) => {
  const ctx = getRequestContext(req)
  await authService.requestPasswordReset(req.body.email, ctx)
  // Always the same response regardless of whether the email exists.
  sendSuccess(res, {
    message: 'If an account exists for that email, a reset link is on its way.',
  })
})

/** POST /auth/reset-password */
const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body
  await authService.resetPassword({ token, password })
  clearAuthCookies(res)
  sendSuccess(res, { message: 'Password updated. Please sign in with your new password.' })
})

/** POST /auth/change-password (authenticated) — keeps the user signed in. */
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body
  const user = await authService.changePassword(req.userId, { currentPassword, newPassword })

  // All sessions were revoked; open a fresh one so the caller stays signed in.
  const ctx = getRequestContext(req)
  const { accessToken, refreshToken } = await tokenService.createSession(user, ctx, true)
  setAuthCookies(res, { accessToken, refreshToken, rememberMe: true })

  sendSuccess(res, {
    message: 'Password changed. Other devices have been signed out.',
    data: { user: toAuthUser(user), accessToken },
  })
})

/** GET /auth/sessions — list active sessions/devices. */
const listSessions = asyncHandler(async (req, res) => {
  const sessions = await tokenService.listSessions(req.userId)
  const data = sessions.map((s) => ({
    id: String(s._id),
    device: s.device,
    ip: s.ip,
    rememberMe: s.rememberMe,
    current: String(s._id) === String(req.sessionId),
    lastUsedAt: s.lastUsedAt,
    createdAt: s.createdAt,
    expiresAt: s.expiresAt,
  }))
  sendSuccess(res, { message: 'Active sessions', data })
})

/** DELETE /auth/sessions/:id — revoke a specific session. */
const revokeSession = asyncHandler(async (req, res) => {
  const { models } = require('../config/database')
  const session = await models.Session.findOne({ _id: req.params.id, user: req.userId })
  if (!session) throw ApiError.notFound('Session not found')
  await tokenService.revokeSession(session._id)
  sendSuccess(res, { message: 'Session revoked.' })
})

module.exports = {
  register,
  login,
  refresh,
  logout,
  logoutAll,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  changePassword,
  listSessions,
  revokeSession,
}
