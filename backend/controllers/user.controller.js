'use strict'

const asyncHandler = require('../utils/asyncHandler')
const userService = require('../services/user.service')
const { toAuthUser } = require('../serializers/user.serializer')
const { sendSuccess, sendCreated } = require('../utils/ApiResponse')
const ApiError = require('../utils/ApiError')

/**
 * User controller. Manages profile, preferences, and account operations.
 */

/** GET /users/me — fetch the current user's profile */
const getMe = asyncHandler(async (req, res) => {
  const user = await userService.getUser(req.userId)
  if (!user) throw ApiError.notFound('User not found')

  sendSuccess(res, {
    message: 'User profile retrieved',
    data: { user: toAuthUser(user) },
  })
})

/** PATCH /users/me — update current user's profile */
const updateProfile = asyncHandler(async (req, res) => {
  const { name, bio, location, nationality } = req.body

  const user = await userService.updateProfile(req.userId, {
    name,
    bio,
    location,
    nationality,
  })

  sendSuccess(res, {
    message: 'Profile updated successfully',
    data: { user: toAuthUser(user) },
  })
})

/** POST /users/me/avatar — upload profile avatar */
const uploadAvatar = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('No file provided')

  const result = await userService.updateAvatar(req.userId, req.file)

  sendSuccess(res, {
    message: 'Avatar uploaded successfully',
    data: { user: result, avatarUrl: result.profilePicture },
  })
})

/** DELETE /users/me/avatar — remove profile avatar */
const deleteAvatar = asyncHandler(async (req, res) => {
  const result = await userService.deleteAvatar(req.userId)

  sendSuccess(res, {
    message: 'Avatar removed successfully',
    data: { user: result },
  })
})

/** GET /users/me/preferences — fetch user preferences */
const getPreferences = asyncHandler(async (req, res) => {
  const prefs = await userService.getPreferences(req.userId)

  sendSuccess(res, {
    message: 'User preferences retrieved',
    data: { preferences: prefs },
  })
})

/** PATCH /users/me/preferences — update user preferences */
const updatePreferences = asyncHandler(async (req, res) => {
  const { travelPreferences, budgetPreference, notificationPreferences, privacySettings } = req.body

  const prefs = await userService.updatePreferences(req.userId, {
    travelPreferences,
    budgetPreference,
    notificationPreferences,
    privacySettings,
  })

  sendSuccess(res, {
    message: 'Preferences updated successfully',
    data: { preferences: prefs },
  })
})

/** DELETE /users/me — soft-delete user account */
const deleteAccount = asyncHandler(async (req, res) => {
  // Require password confirmation for destructive action
  const { password } = req.body
  if (!password) throw ApiError.badRequest('Password required to delete account')

  await userService.deleteAccount(req.userId, password)

  // Clear auth cookies since the account no longer exists
  res.clearCookie('accessToken', { httpOnly: true, secure: true })
  res.clearCookie('refreshToken', { httpOnly: true, secure: true })

  sendSuccess(res, {
    message: 'Account deleted successfully. All your data has been removed.',
  })
})

module.exports = {
  getMe,
  updateProfile,
  uploadAvatar,
  deleteAvatar,
  getPreferences,
  updatePreferences,
  deleteAccount,
}
