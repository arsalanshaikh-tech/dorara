'use strict'

/**
 * Seed runner.
 *
 *   node database/seed          # upsert seed data (safe to re-run)
 *   node database/seed --fresh  # wipe the seeded collections first
 *
 * Requires a reachable MongoDB (set MONGODB_URI). Idempotent: destinations and
 * questionnaires are upserted by their natural keys; users by email.
 */

const { connectDB, disconnectDB } = require('../config/db')
const {
  User,
  UserProfile,
  Destination,
  Questionnaire,
  TravelRequirement,
  DestinationRecommendation,
  SearchHistory,
} = require('../models')

const destinationsSeed = require('./data/destinations.seed')
const questionnaireSeed = require('./data/questionnaire.seed')
const usersSeed = require('./data/users.seed')

const FRESH = process.argv.includes('--fresh')

async function seedDestinations() {
  const ops = destinationsSeed.map((d) => ({
    updateOne: { filter: { slug: d.slug }, update: { $set: d }, upsert: true },
  }))
  await Destination.bulkWrite(ops)
  console.log(`[seed] destinations: ${destinationsSeed.length} upserted`)
}

async function seedQuestionnaires() {
  for (const q of questionnaireSeed) {
    await Questionnaire.updateOne(
      { vertical: q.vertical, version: q.version },
      { $set: q },
      { upsert: true },
    )
  }
  console.log(`[seed] questionnaires: ${questionnaireSeed.length} upserted`)
}

async function seedUsers() {
  for (const entry of usersSeed) {
    const { profile = {}, ...userData } = entry
    // Use findOne + save so the password-hashing pre-save hook runs.
    let user = await User.findOne({ email: userData.email }).select('+password')
    if (!user) {
      user = new User(userData)
      await user.save()
    } else {
      Object.assign(user, userData)
      await user.save()
    }

    // Resolve favourite destination slugs -> ObjectIds.
    const { favouriteDestinationSlugs = [], ...profileData } = profile
    let favouriteDestinations = []
    if (favouriteDestinationSlugs.length) {
      const docs = await Destination.find({ slug: { $in: favouriteDestinationSlugs } }).select('_id')
      favouriteDestinations = docs.map((d) => d._id)
    }

    await UserProfile.updateOne(
      { user: user._id },
      { $set: { ...profileData, favouriteDestinations, user: user._id } },
      { upsert: true },
    )
  }
  console.log(`[seed] users + profiles: ${usersSeed.length} upserted`)
}

/** Create one example requirement -> recommendation chain for the demo user. */
async function seedSampleConsultation() {
  const user = await User.findOne({ email: 'demo@dorara.ai' })
  if (!user) return

  const existing = await TravelRequirement.findOne({ user: user._id })
  if (existing) {
    console.log('[seed] sample consultation already present — skipped')
    return
  }

  const requirement = await TravelRequirement.create({
    user: user._id,
    vertical: 'travel',
    userName: 'Alex',
    status: 'processed',
    completedAt: new Date(),
    answers: {
      destination_preference: 'Open to suggestions',
      budget: { min: 1500, max: 4000, currency: 'USD' },
      dates: { start: null, end: null, durationDays: 10 },
      party: 'Solo',
      age_group: '26-35',
      weather: ['Warm & sunny'],
      interest_type: ['Culture & history', 'Food & nightlife'],
      safety_importance: 4,
      visa_requirements: 'I have a passport and visa-ready',
      food_language: ['Vegetarian-friendly'],
      extra_notes: 'Prefer walkable cities with great public transport.',
    },
    destinationPreference: 'Open to suggestions',
    budget: { min: 1500, max: 4000, currency: 'USD' },
    dates: { durationDays: 10 },
    party: 'Solo',
    ageGroup: '26-35',
    weather: ['Warm & sunny'],
    interestType: ['Culture & history', 'Food & nightlife'],
    safetyImportance: 4,
    visaRequirements: 'I have a passport and visa-ready',
    foodLanguage: ['Vegetarian-friendly'],
    extraNotes: 'Prefer walkable cities with great public transport.',
  })

  const [tokyo, lisbon, barcelona] = await Promise.all([
    Destination.findOne({ slug: 'tokyo' }),
    Destination.findOne({ slug: 'lisbon' }),
    Destination.findOne({ slug: 'barcelona' }),
  ])

  const recommendation = await DestinationRecommendation.create({
    user: user._id,
    travelRequirement: requirement._id,
    vertical: 'travel',
    userName: 'Alex',
    recommendedDestinations: [
      {
        destination: tokyo?._id,
        slug: 'tokyo',
        name: 'Tokyo, Japan',
        country: 'Japan',
        score: 94,
        shortReason: tokyo?.reason,
        primaryTags: ['Culture & history', 'Food & nightlife'],
        imageRef: tokyo?.image,
        avgTempC: 16,
        safetyIndex: 96,
        rank: 1,
      },
      {
        destination: lisbon?._id,
        slug: 'lisbon',
        name: 'Lisbon, Portugal',
        country: 'Portugal',
        score: 90,
        shortReason: lisbon?.reason,
        primaryTags: ['Culture & history', 'Food & nightlife'],
        imageRef: lisbon?.image,
        avgTempC: 21,
        safetyIndex: 88,
        rank: 2,
      },
      {
        destination: barcelona?._id,
        slug: 'barcelona',
        name: 'Barcelona, Spain',
        country: 'Spain',
        score: 87,
        shortReason: barcelona?.reason,
        primaryTags: ['Culture & history', 'Food & nightlife'],
        imageRef: barcelona?.image,
        avgTempC: 20,
        safetyIndex: 82,
        rank: 3,
      },
    ],
    costEstimate: {
      currency: 'USD',
      low: 2100,
      mid: 2900,
      high: 4500,
      notes: 'Estimate for 10 days, solo. Includes flights, stay, and daily spend.',
    },
    visaSummary: [
      {
        country: 'Japan',
        visaRequired: 'Likely ready',
        visaType: 'Tourist eVisa / visa on arrival',
        processingTime: '0–15 days',
        officialLink: 'https://www.mofa.go.jp/j_info/visit/visa/',
      },
    ],
    prosCons: {
      advantages: [
        'Strong match for your interests: Culture & history, Food & nightlife.',
        'High safety index (96/100).',
        'Comfortable average temperature around 16°C.',
      ],
      disadvantages: [
        'Higher accommodation and dining costs during peak season.',
        'Prices vary significantly by season — booking early helps.',
      ],
    },
    alternatives: [
      { name: 'Reykjavik, Iceland', reason: 'Northern lights and geothermal spas.' },
      { name: 'Dubai, UAE', reason: 'Ultra-modern luxury and a global dining scene.' },
    ],
    actionPlan: [
      { stepNumber: 1, title: 'Confirm dates & budget', details: 'Lock your 10-day window and a working budget near $2,900.', eta: '1 day' },
      { stepNumber: 2, title: 'Book flights', details: 'Search round-trip flights 2–3 months ahead to save 15–25%.', eta: '2–3 days' },
      { stepNumber: 3, title: 'Sort visa & documents', details: 'Start the eVisa process early — typical processing is 0–15 days.', eta: '1–2 weeks' },
      { stepNumber: 4, title: 'Reserve accommodation', details: 'Choose a central neighborhood to cut local transport time and cost.', eta: '1 week' },
      { stepNumber: 5, title: 'Build a day-by-day plan', details: 'Group activities around Culture & history, Food & nightlife.', eta: '2–3 days' },
    ],
    dataSources: ['costOfLivingAPI', 'visaAPI', 'weatherAPI', 'safetyIndexAPI'],
    confidenceScore: 92,
  })

  await SearchHistory.create({
    user: user._id,
    vertical: 'travel',
    query: 'Warm, mid-budget solo cultural trip',
    travelRequirement: requirement._id,
    recommendation: recommendation._id,
    filters: { party: 'Solo', weather: ['Warm & sunny'], budgetMax: 4000 },
    resultCount: 3,
  })

  console.log('[seed] sample consultation (requirement + recommendation + history) created')
}

async function main() {
  await connectDB()

  if (FRESH) {
    console.log('[seed] --fresh: clearing seeded collections')
    await Promise.all([
      Destination.deleteMany({}),
      Questionnaire.deleteMany({}),
      User.deleteMany({}),
      UserProfile.deleteMany({}),
      TravelRequirement.deleteMany({}),
      DestinationRecommendation.deleteMany({}),
      SearchHistory.deleteMany({}),
    ])
  }

  await seedDestinations()
  await seedQuestionnaires()
  await seedUsers()
  await seedSampleConsultation()

  console.log('[seed] done ✔')
}

main()
  .catch((err) => {
    console.error('[seed] failed:', err)
    process.exitCode = 1
  })
  .finally(async () => {
    await disconnectDB()
  })
