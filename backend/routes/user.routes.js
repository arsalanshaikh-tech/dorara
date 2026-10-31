'use strict'

const express = require('express')
const controller = require('../controllers/user.controller')
const validate = require('../middlewares/validate.middleware')
const { protect } = require('../middlewares/auth.middleware')
const { uploadImage } = require('../middlewares/upload.middleware')
const rules = require('../validators/user.validator')

/**
 * /api/v1/users
 *
 * User profile and account management endpoints (all protected).
 */
const router = express.Router()

// All endpoints require authentication
router.use(protect)

// ----- Profile -----
router.get('/me', controller.getMe)
router.patch('/me', validate(rules.updateProfileRules), controller.updateProfile)

// ----- Avatar -----
router.post(
  '/me/avatar',
  uploadImage.single('avatar'),
  validate(rules.avatarUploadRules),
  controller.uploadAvatar,
)
router.delete('/me/avatar', controller.deleteAvatar)

// ----- Preferences -----
router.get('/me/preferences', controller.getPreferences)
router.patch(
  '/me/preferences',
  validate(rules.updatePreferencesRules),
  controller.updatePreferences,
)

// ----- Account -----
router.delete('/me', validate(rules.deleteAccountRules), controller.deleteAccount)

module.exports = router
