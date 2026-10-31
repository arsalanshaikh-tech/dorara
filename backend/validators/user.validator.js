'use strict'

const { body } = require('express-validator')

const updateProfileRules = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('bio')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Bio must not exceed 500 characters'),
  body('location')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Location must not exceed 100 characters'),
  body('nationality')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Nationality must be valid'),
]

const avatarUploadRules = [
  body('avatar')
    .notEmpty()
    .withMessage('Avatar file is required'),
]

const updatePreferencesRules = [
  body('travelPreferences')
    .optional()
    .isObject()
    .withMessage('Travel preferences must be an object'),
  body('budgetPreference')
    .optional()
    .isIn(['budget', 'moderate', 'luxury'])
    .withMessage('Invalid budget preference'),
  body('notificationPreferences')
    .optional()
    .isObject()
    .withMessage('Notification preferences must be an object'),
  body('privacySettings')
    .optional()
    .isObject()
    .withMessage('Privacy settings must be an object'),
  body('theme')
    .optional()
    .isIn(['light', 'dark', 'system'])
    .withMessage('Invalid theme selection'),
]

const deleteAccountRules = [
  body('password')
    .notEmpty()
    .withMessage('Password is required to delete account'),
]

module.exports = {
  updateProfileRules,
  avatarUploadRules,
  updatePreferencesRules,
  deleteAccountRules,
}
