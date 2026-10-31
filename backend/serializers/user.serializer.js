'use strict'

/**
 * User serializers.
 * -----------------
 * Convert internal Mongoose documents into the exact shapes the frontend
 * expects, and — critically — strip every sensitive field (password hash,
 * security counters, tokens) before anything leaves the API.
 *
 * `toAuthUser` matches the frontend `AuthUser` type consumed by the auth store
 * and profile/settings pages:
 *   { id, name, email, avatarUrl?, location?, bio? }
 */

function fullName(user) {
  return [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
}

/** Minimal identity object the frontend stores after login (GET /users/me). */
function toAuthUser(user, profile = null) {
  if (!user) return null
  const p = profile || user.profile || null
  return {
    id: String(user._id || user.id),
    name: fullName(user) || user.username || user.email,
    email: user.email,
    avatarUrl: user.profilePicture || undefined,
    location: (p && p.location) || [user.city, user.country].filter(Boolean).join(', ') || undefined,
    bio: (p && p.bio) || undefined,
  }
}

/** Richer profile view for the profile / settings pages. */
function toProfile(user, profile = null) {
  if (!user) return null
  const p = profile || user.profile || {}
  return {
    id: String(user._id || user.id),
    firstName: user.firstName,
    lastName: user.lastName,
    name: fullName(user),
    username: user.username || null,
    email: user.email,
    phoneNumber: user.phoneNumber || '',
    countryCode: user.countryCode || '',
    avatarUrl: user.profilePicture || '',
    dateOfBirth: user.dateOfBirth || null,
    gender: user.gender,
    country: user.country || '',
    state: user.state || '',
    city: user.city || '',
    preferredLanguage: user.preferredLanguage || 'en',
    timeZone: user.timeZone || 'UTC',
    isEmailVerified: user.isEmailVerified,
    isPhoneVerified: user.isPhoneVerified,
    role: user.role,
    status: user.status,
    lastLogin: user.lastLogin || null,
    createdAt: user.createdAt,
    // Extended profile
    bio: p.bio || '',
    location: p.location || '',
    nationality: p.nationality || '',
    travelPreferences: p.travelPreferences || {},
    budgetPreference: p.budgetPreference || {},
    notificationPreferences: p.notificationPreferences || {},
    privacySettings: p.privacySettings || {},
    theme: p.theme || 'system',
  }
}

module.exports = { toAuthUser, toProfile, fullName }
