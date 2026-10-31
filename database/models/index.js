'use strict'

/**
 * Model registry / barrel.
 *
 * Requiring this file guarantees every Mongoose model is registered exactly
 * once (models self-guard with `mongoose.models.X || mongoose.model(...)`).
 * Express controllers can simply:
 *
 *     const { User, TravelRequirement } = require('../database/models')
 */

// ----- Authentication -----
const User = require('./user.model')
const UserProfile = require('./userProfile.model')
const Session = require('./session.model')
const RefreshToken = require('./refreshToken.model')
const EmailVerificationToken = require('./emailVerificationToken.model')
const PasswordResetToken = require('./passwordResetToken.model')

// ----- Travel module -----
const Questionnaire = require('./questionnaire.model')
const Destination = require('./destination.model')
const TravelRequirement = require('./travelRequirement.model')
const DestinationRecommendation = require('./destinationRecommendation.model')
const SavedTrip = require('./savedTrip.model')
const SearchHistory = require('./searchHistory.model')

// ----- Trip planner -----
const TripPlan = require('./tripPlan.model')
const ProviderCache = require('./providerCache.model')
const ProviderUsage = require('./providerUsage.model')
const AIGenerationLog = require('./aiGenerationLog.model')

module.exports = {
  // auth
  User,
  UserProfile,
  Session,
  RefreshToken,
  EmailVerificationToken,
  PasswordResetToken,
  // travel
  Questionnaire,
  Destination,
  TravelRequirement,
  DestinationRecommendation,
  SavedTrip,
  SearchHistory,
  // trip planner
  TripPlan,
  ProviderCache,
  ProviderUsage,
  AIGenerationLog,
}
