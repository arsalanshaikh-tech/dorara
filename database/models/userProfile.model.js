'use strict'

const mongoose = require('mongoose')
const baseSchemaPlugin = require('./plugins/baseSchema')

const { Schema } = mongoose

/**
 * UserProfile
 * -----------
 * Extended, mostly-optional profile data kept separate from the credential-bearing
 * `User` document. This keeps the hot auth collection lean while giving the
 * product surfaces (Profile page, Settings page, questionnaire personalization)
 * a rich place to store preferences.
 *
 * Relationship: UserProfile 1:1 User (via unique `user` ref).
 */

const notificationPreferencesSchema = new Schema(
  {
    // Mirrors the toggles on the Settings page.
    recommendations: { type: Boolean, default: true },
    product: { type: Boolean, default: false },
    tips: { type: Boolean, default: true },
    channelEmail: { type: Boolean, default: true },
    channelPush: { type: Boolean, default: false },
  },
  { _id: false },
)

const privacySettingsSchema = new Schema(
  {
    profileVisibility: {
      type: String,
      enum: ['public', 'private', 'contacts'],
      default: 'private',
    },
    showEmail: { type: Boolean, default: false },
    showActivity: { type: Boolean, default: false },
    allowDataForRecommendations: { type: Boolean, default: true },
  },
  { _id: false },
)

// Structured travel preferences that seed / bias the recommendation engine.
const travelPreferencesSchema = new Schema(
  {
    interests: {
      type: [String],
      // Matches the questionnaire "interest_type" options.
      enum: [
        'Adventure',
        'Culture & history',
        'Luxury',
        'Nature & outdoors',
        'Food & nightlife',
        'Wellness',
      ],
      default: [],
    },
    weather: {
      type: [String],
      enum: ['Warm & sunny', 'Cool & mild', 'Cold & snowy', 'No preference'],
      default: [],
    },
    preferredParty: {
      type: String,
      enum: ['Solo', 'Couple', 'Family (kids)', 'Group of friends', ''],
      default: '',
    },
    dietary: { type: [String], default: [] },
    languages: { type: [String], default: [] },
    safetyImportance: { type: Number, min: 1, max: 5, default: 3 },
  },
  { _id: false },
)

const budgetPreferenceSchema = new Schema(
  {
    currency: { type: String, uppercase: true, trim: true, default: 'USD', maxlength: 3 },
    typicalMin: { type: Number, min: 0, default: null },
    typicalMax: { type: Number, min: 0, default: null },
    tier: {
      type: String,
      enum: ['budget', 'mid', 'premium', 'luxury', ''],
      default: '',
    },
  },
  { _id: false },
)

const userProfileSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },

    // Free-form profile fields surfaced on the Profile page.
    bio: { type: String, maxlength: 280, default: '' },
    location: { type: String, trim: true, default: '' }, // "City, Country" convenience string
    nationality: { type: String, trim: true, default: '' },

    travelPreferences: { type: travelPreferencesSchema, default: () => ({}) },
    budgetPreference: { type: budgetPreferenceSchema, default: () => ({}) },

    // Denormalized quick-access list; canonical bookmarks live in SavedTrip.
    favouriteDestinations: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Destination',
      },
    ],

    notificationPreferences: { type: notificationPreferencesSchema, default: () => ({}) },
    privacySettings: { type: privacySettingsSchema, default: () => ({}) },

    // UI preference stored per the Settings "Appearance" control.
    theme: {
      type: String,
      enum: ['light', 'dark', 'system'],
      default: 'system',
    },
  },
  { collection: 'user_profiles' },
)

userProfileSchema.plugin(baseSchemaPlugin)

userProfileSchema.index({ nationality: 1 })

module.exports =
  mongoose.models.UserProfile || mongoose.model('UserProfile', userProfileSchema)
