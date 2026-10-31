'use strict'

/**
 * User service.
 * -------------
 * Business logic for the authenticated user's own account: reading and
 * updating profile data, preferences, avatar, password change, and account
 * deletion. All operations are scoped to the caller's own `userId` — there is
 * no cross-user access here (admin lives in a separate module).
 */

const { User, UserProfile, Session, RefreshToken } = require('../../database/models')
const ApiError = require('../utils/ApiError')
const { toProfile, toAuthUser } = require('../serializers/user.serializer')
const storageService = require('./storage.service')
const logger = require('../utils/logger')

/** Ensure a profile document exists for a user, creating an empty one lazily. */
async function ensureProfile(userId) {
  let profile = await UserProfile.findOne({ user: userId })
  if (!profile) {
    profile = await UserProfile.create({ user: userId })
  }
  return profile
}

/** GET /users/me — identity object for the auth store. */
async function getMe(userId) {
  const user = await User.findById(userId)
  if (!user) throw ApiError.notFound('User not found')
  const profile = await UserProfile.findOne({ user: userId })
  return toAuthUser(user, profile)
}

/** GET /users/me/profile — full profile view. */
async function getProfile(userId) {
  const user = await User.findById(userId)
  if (!user) throw ApiError.notFound('User not found')
  const profile = await ensureProfile(userId)
  return toProfile(user, profile)
}

// Fields that live on the User document itself.
const USER_FIELDS = [
  'firstName',
  'lastName',
  'phoneNumber',
  'countryCode',
  'dateOfBirth',
  'gender',
  'country',
  'state',
  'city',
  'preferredLanguage',
  'timeZone',
]

// Fields that live on the UserProfile document.
const PROFILE_FIELDS = [
  'bio',
  'location',
  'nationality',
  'travelPreferences',
  'budgetPreference',
  'theme',
]

/** PATCH /users/me/profile — partial update across User + UserProfile. */
async function updateProfile(userId, payload = {}) {
  const user = await User.findById(userId)
  if (!user) throw ApiError.notFound('User not found')
  const profile = await ensureProfile(userId)

  // "name" convenience: split into first/last when provided.
  if (typeof payload.name === 'string' && payload.name.trim()) {
    const [first, ...rest] = payload.name.trim().split(/\s+/)
    user.firstName = first
    user.lastName = rest.join(' ') || user.lastName
  }

  for (const field of USER_FIELDS) {
    if (payload[field] !== undefined) user[field] = payload[field]
  }
  for (const field of PROFILE_FIELDS) {
    if (payload[field] === undefined) continue
    if (
      typeof payload[field] === 'object' &&
      payload[field] !== null &&
      !Array.isArray(payload[field])
    ) {
      // Shallow-merge nested preference objects so partial updates work.
      profile[field] = { ...(profile[field]?.toObject?.() || profile[field] || {}), ...payload[field] }
    } else {
      profile[field] = payload[field]
    }
  }

  await user.save()
  await profile.save()
  return toProfile(user, profile)
}

/** PATCH /users/me/preferences — notification + privacy toggles. */
async function updatePreferences(userId, payload = {}) {
  const profile = await ensureProfile(userId)
  if (payload.notificationPreferences) {
    profile.notificationPreferences = {
      ...(profile.notificationPreferences?.toObject?.() || profile.notificationPreferences || {}),
      ...payload.notificationPreferences,
    }
  }
  if (payload.privacySettings) {
    profile.privacySettings = {
      ...(profile.privacySettings?.toObject?.() || profile.privacySettings || {}),
      ...payload.privacySettings,
    }
  }
  if (payload.theme) profile.theme = payload.theme
  await profile.save()
  const user = await User.findById(userId)
  return toProfile(user, profile)
}

/** POST /users/me/avatar — upload + persist avatar URL. */
async function updateAvatar(userId, file) {
  if (!file) throw ApiError.badRequest('No image file provided')
  const user = await User.findById(userId)
  if (!user) throw ApiError.notFound('User not found')

  // Best-effort cleanup of the previous avatar (only if we stored a public id).
  if (user.profilePictureId) {
    storageService.destroy(user.profilePictureId).catch((err) =>
      logger.warn('Failed to remove old avatar', { error: err.message }),
    )
  }

  const uploaded = await storageService.uploadImage(file, { folder: 'avatars' })
  user.profilePicture = uploaded.url
  user.profilePictureId = uploaded.publicId || undefined
  await user.save()

  const profile = await UserProfile.findOne({ user: userId })
  return toAuthUser(user, profile)
}

/** PATCH /users/me/password — change password for an already-authenticated user. */
async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await User.findById(userId).select('+password')
  if (!user) throw ApiError.notFound('User not found')

  const ok = await user.comparePassword(currentPassword)
  if (!ok) throw ApiError.badRequest('Current password is incorrect')

  user.password = newPassword // hashed by the model pre-save hook
  user.passwordChangedAt = new Date()
  await user.save()

  // Invalidate every other session for safety.
  await Session.updateMany({ user: userId }, { $set: { isActive: false, revokedAt: new Date() } })
  await RefreshToken.updateMany({ user: userId, revokedAt: null }, { $set: { revokedAt: new Date() } })

  return { success: true }
}

/** DELETE /users/me — soft-delete style deactivation + full session teardown. */
async function deleteAccount(userId, { password } = {}) {
  const user = await User.findById(userId).select('+password')
  if (!user) throw ApiError.notFound('User not found')

  // Require password confirmation when the account has one.
  if (password !== undefined) {
    const ok = await user.comparePassword(password)
    if (!ok) throw ApiError.badRequest('Password is incorrect')
  }

  user.status = 'deleted'
  user.email = `deleted_${user._id}_${user.email}`
  user.deletedAt = new Date()
  await user.save()

  await Session.updateMany({ user: userId }, { $set: { isActive: false, revokedAt: new Date() } })
  await RefreshToken.updateMany({ user: userId, revokedAt: null }, { $set: { revokedAt: new Date() } })

  return { success: true }
}

module.exports = {
  ensureProfile,
  getMe,
  getProfile,
  updateProfile,
  updatePreferences,
  updateAvatar,
  changePassword,
  deleteAccount,
}
