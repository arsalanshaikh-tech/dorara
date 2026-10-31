'use strict'

const express = require('express')
const controller = require('../controllers/auth.controller')
const validate = require('../middlewares/validate.middleware')
const { protect } = require('../middlewares/auth.middleware')
const { authLimiter, sensitiveLimiter } = require('../middlewares/rateLimit.middleware')
const rules = require('../validators/auth.validator')

/**
 * /api/v1/auth
 *
 * Public credential flows are rate-limited; session management endpoints
 * require a valid access token.
 */
const router = express.Router()

// ----- Public -----
router.post('/register', authLimiter, validate(rules.registerRules), controller.register)
router.post('/login', authLimiter, validate(rules.loginRules), controller.login)
router.post('/refresh', controller.refresh)
router.post('/verify-email', validate(rules.verifyEmailRules), controller.verifyEmail)
router.post(
  '/forgot-password',
  sensitiveLimiter,
  validate(rules.forgotPasswordRules),
  controller.forgotPassword,
)
router.post(
  '/reset-password',
  sensitiveLimiter,
  validate(rules.resetPasswordRules),
  controller.resetPassword,
)

// ----- Authenticated -----
router.post('/logout', protect, controller.logout)
router.post('/logout-all', protect, controller.logoutAll)
router.post('/resend-verification', protect, sensitiveLimiter, controller.resendVerification)
router.post(
  '/change-password',
  protect,
  validate(rules.changePasswordRules),
  controller.changePassword,
)
router.get('/sessions', protect, controller.listSessions)
router.delete('/sessions/:id', protect, validate(rules.sessionIdRules), controller.revokeSession)

module.exports = router
