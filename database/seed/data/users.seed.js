'use strict'

/**
 * Demo users. Passwords are provided in PLAIN TEXT here purely for local seeding
 * convenience — the User model's pre-save hook hashes them with bcrypt before
 * they ever reach MongoDB. The demo credentials match the frontend mock
 * (demo@dorara.ai / dorara123).
 */

module.exports = [
  {
    firstName: 'Alex',
    lastName: 'Rivera',
    username: 'alex.rivera',
    email: 'demo@dorara.ai',
    password: 'dorara123',
    countryCode: '+351',
    phoneNumber: '912345678',
    country: 'Portugal',
    city: 'Lisbon',
    preferredLanguage: 'en',
    timeZone: 'Europe/Lisbon',
    isEmailVerified: true,
    role: 'user',
    status: 'active',
    profile: {
      bio: 'Exploring the best places to live, work, and study.',
      location: 'Lisbon, Portugal',
      nationality: 'American',
      theme: 'light',
      travelPreferences: {
        interests: ['Culture & history', 'Food & nightlife'],
        weather: ['Warm & sunny'],
        preferredParty: 'Solo',
        safetyImportance: 4,
      },
      budgetPreference: { currency: 'USD', typicalMin: 1500, typicalMax: 4000, tier: 'mid' },
      notificationPreferences: { recommendations: true, product: false, tips: true },
      privacySettings: { profileVisibility: 'private', allowDataForRecommendations: true },
      favouriteDestinationSlugs: ['lisbon', 'tokyo'],
    },
  },
  {
    firstName: 'Priya',
    lastName: 'Menon',
    username: 'priya.menon',
    email: 'priya@dorara.ai',
    password: 'dorara123',
    countryCode: '+91',
    phoneNumber: '9876543210',
    country: 'India',
    city: 'Bengaluru',
    preferredLanguage: 'en',
    timeZone: 'Asia/Kolkata',
    isEmailVerified: true,
    role: 'user',
    status: 'active',
    profile: {
      bio: 'Planning my next big adventure abroad.',
      location: 'Bengaluru, India',
      nationality: 'Indian',
      theme: 'system',
      travelPreferences: {
        interests: ['Adventure', 'Nature & outdoors'],
        weather: ['Cool & mild'],
        preferredParty: 'Group of friends',
        safetyImportance: 5,
      },
      budgetPreference: { currency: 'INR', typicalMin: 80000, typicalMax: 250000, tier: 'mid' },
      favouriteDestinationSlugs: ['queenstown'],
    },
  },
  {
    firstName: 'Dorara',
    lastName: 'Admin',
    username: 'admin',
    email: 'admin@dorara.ai',
    password: 'admin12345',
    country: 'United States',
    preferredLanguage: 'en',
    timeZone: 'UTC',
    isEmailVerified: true,
    role: 'admin',
    status: 'active',
    profile: {
      bio: 'Platform administrator.',
      nationality: 'American',
    },
  },
]
