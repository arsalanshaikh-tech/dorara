'use strict'

const { body, param } = require('express-validator')

/**
 * express-validator rule chains for the auth endpoints. These mirror the
 * frontend Zod schemas (lib/validators/auth.ts) so the two layers agree, but
 * the backend is the source of truth — frontend validation is never trusted.
 */

const email = () =>
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Enter a valid email address')
    .normalizeEmail()

const strongPassword = (field = 'password') =>
  body(field)
    .isString()
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .isLength({ max: 128 })
    .withMessage('Password is too long')

const registerRules = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Full name is required')
    .isLength({ min: 2 })
    .withMessage('Please enter your full name')
    .isLength({ max: 120 }),
  email(),
  strongPassword('password'),
  body('phoneNumber').optional().isString().isLength({ max: 20 }),
  body('countryCode').optional().isString().isLength({ max: 6 }),
]

const loginRules = [
  email(),
  body('password').notEmpty().withMessage('Password is required'),
  body('remember').optional().isBoolean().toBoolean(),
]

const forgotPasswordRules = [email()]

const resetPasswordRules = [
  body('token').notEmpty().withMessage('Reset token is required'),
  strongPassword('password'),
]

const verifyEmailRules = [
  body('token')
    .optional()
    .isString(),
]

const changePasswordRules = [
  body('currentPassword').notEmpty().withMessage('Enter your current password'),
  strongPassword('newPassword'),
]

const sessionIdRules = [param('id').isMongoId().withMessage('Invalid session id')]

module.exports = {
  registerRules,
  loginRules,
  forgotPasswordRules,
  resetPasswordRules,
  verifyEmailRules,
  changePasswordRules,
  sessionIdRules,
}
