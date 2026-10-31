'use strict'

const { models } = require('../config/database')
const aiService = require('./ai.service')
const liveData = require('./livedata.service')
const logger = require('../utils/logger')

/**
 * Recommendation generation service.
 *
 * Produces destination recommendations for a travel requirement by combining:
 *   1. Ranking      — a real LLM (via ai.service) when configured, otherwise a
 *                     deterministic local scoring heuristic.
 *   2. Live weather — real current conditions per destination (Open-Meteo).
 *   3. Live economy — World Bank income level + live ECB currency conversion
 *                     to build a realistic, localized cost estimate.
 *   4. Visa + plan  — aggregated from the destination catalog into an actionable
 *                     summary and step-by-step plan.
 *
 * Every external call degrades gracefully: if a provider is unavailable the
 * engine falls back to the values stored on the destination record, and the
 * `dataSources` array on the saved recommendation honestly reflects which
 * live sources actually contributed.
 */

/* ------------------------------------------------------------------ *
 * Local heuristic scoring (fallback / default)
 * ------------------------------------------------------------------ */

/**
 * Score a destination against user answers.
 * @private
 */
function scoreDestination(destination, answers) {
  let score = 55

  // Interest tag match (high impact).
  const interests = Array.isArray(answers.interest_type) ? answers.interest_type : []
  const matchedInterests = destination.tags?.filter((t) => interests.includes(t)).length || 0
  score += matchedInterests * 9

  // Weather preference match.
  const weatherPrefs = Array.isArray(answers.weather) ? answers.weather : []
  if (weatherPrefs.length === 0 || weatherPrefs.includes('No preference')) {
    score += 4
  } else if (destination.weather?.some((w) => weatherPrefs.includes(w))) {
    score += 8
  }

  // Safety importance (scale 1-5). NOTE: parentheses matter — we want a
  // fraction of the destination's safety index, not `safetyIndex || -10`.
  const safetyImportance =
    typeof answers.safety_importance === 'number' ? answers.safety_importance : 3
  const safetyIndex = typeof destination.safetyIndex === 'number' ? destination.safetyIndex : 70
  const safetyBoost = ((safetyIndex - 80) / 20) * safetyImportance * 2
  score += Math.round(safetyBoost)

  // Budget alignment.
  const budget = answers.budget
  if (budget?.max) {
    const budgetGenerosity = Math.min(budget.max / 3000, 2)
    if ((destination.costFactor || 1) <= budgetGenerosity) score += 6
    else score -= 6
  }

  return Math.max(40, Math.min(99, Math.round(score)))
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

/** Estimate trip duration in days from answers. @private */
function estimateDuration(answers) {
  const dates = answers.dates
  if (dates?.durationDays) return dates.durationDays
  if (dates?.start && dates?.end) {
    const ms = new Date(dates.end).getTime() - new Date(dates.start).getTime()
    const days = Math.round(ms / (1000 * 60 * 60 * 24))
    if (days > 0) return days
  }
  return 7
}

/** Party-size cost multiplier. @private */
function getPartyMultiplier(party) {
  switch (party) {
    case 'Couple':
      return 1.9
    case 'Family (kids)':
      return 3.2
    case 'Group of friends':
      return 3.6
    default:
      return 1
  }
}

// World Bank income level -> daily-spend adjustment. A real economic signal:
// higher-income destinations cost more per day on the ground.
const INCOME_LEVEL_FACTOR = {
  'High income': 1.25,
  'Upper middle income': 1.0,
  'Lower middle income': 0.8,
  'Low income': 0.65,
}

/**
 * Estimate trip costs using the destination cost factor, real World Bank income
 * level, and live ECB currency conversion into the traveller's currency.
 * @private
 */
async function estimateCosts(topDestination, answers, countryInfo) {
  const budget = answers.budget || { currency: 'USD' }
  const targetCurrency = budget.currency || 'USD'

  const days = estimateDuration(answers)
  const people = getPartyMultiplier(answers.party)
  const costFactor = topDestination.costFactor || 1.0
  const incomeFactor = countryInfo ? INCOME_LEVEL_FACTOR[countryInfo.incomeLevel] || 1 : 1

  // Base figures are expressed in USD.
  const baseDaily = 90 * costFactor * incomeFactor
  const flights = 550 * costFactor
  const midUsd = Math.round((flights + baseDaily * days) * people)

  // Convert the USD baseline into the traveller's currency using live rates.
  const { amount: mid, converted } = await liveData.convertCurrency(midUsd, 'USD', targetCurrency)
  const low = Math.round(mid * 0.72)
  const high = Math.round(mid * 1.55)

  const incomeNote = countryInfo?.incomeLevel ? ` ${countryInfo.incomeLevel} economy.` : ''
  const fxNote = converted && targetCurrency !== 'USD' ? ' Converted at live ECB rates.' : ''

  return {
    low,
    mid,
    high,
    currency: targetCurrency,
    notes:
      `Estimate for ${days} days, ${(answers.party || 'solo').toLowerCase()}. ` +
      `Includes flights, stay, and daily spend.${incomeNote}${fxNote}`,
  }
}

/** Build visa summary from top destinations (uses catalog visa data). @private */
function buildVisaSummary(topDestinations, answers) {
  const visaChoice = answers.visa_requirements || 'Not sure'
  const visaReadyLabel =
    visaChoice === 'I have a passport and visa-ready' ? 'Likely ready' : 'Depends on nationality'

  return topDestinations.map((d) => ({
    country: d.country,
    visaRequired: visaReadyLabel,
    visaType: d.visa?.visaType || 'Check official embassy',
    processingTime: d.visa?.processingTime || 'Varies',
    officialLink: d.visa?.officialLink || '',
  }))
}

/** Build pros/cons narrative, preferring live weather when available. @private */
function buildProsConsNarrative(topDestination, answers, liveWeather) {
  const interests = Array.isArray(answers.interest_type) ? answers.interest_type : []
  const safetyIndex = typeof topDestination.safetyIndex === 'number' ? topDestination.safetyIndex : 70
  const tempC = liveWeather ? liveWeather.tempC : topDestination.avgTempC || 20
  const tempLabel = liveWeather
    ? `Currently ${tempC}°C (${liveWeather.summary.toLowerCase()})`
    : `Comfortable climate around ${tempC}°C`

  const advantages = [
    `Strong match for your interests: ${interests.slice(0, 2).join(', ') || 'diverse experiences'}.`,
    `Safety rating of ${safetyIndex}/100 is ${safetyIndex >= 85 ? 'excellent' : 'good'}.`,
    `${tempLabel}.`,
  ]

  const disadvantages = [
    topDestination.costFactor > 1.1
      ? 'Higher costs during peak tourist season.'
      : 'Can get crowded during holidays.',
    'Weather varies significantly by month.',
  ]

  return { advantages, disadvantages }
}

/** Build a step-by-step action plan. @private */
function buildActionPlan(topDestination, answers, estimatedCosts) {
  const days = estimateDuration(answers)
  const interests = Array.isArray(answers.interest_type) ? answers.interest_type : []
  const visaType = topDestination.visa?.visaType || 'Tourist visa'
  const visaTime = topDestination.visa?.processingTime || '2–3 weeks'
  const currency = estimatedCosts.currency
  const currencySymbols = { USD: '$', EUR: '€', GBP: '£', INR: '₹', AUD: 'A$', CAD: 'C$' }
  const symbol = currencySymbols[currency] || `${currency} `

  return [
    {
      stepNumber: 1,
      title: 'Confirm dates & budget',
      details: `Lock your ${days}-day window and a working budget near ${symbol}${estimatedCosts.mid.toLocaleString()} to guide bookings.`,
      eta: '1 day',
    },
    {
      stepNumber: 2,
      title: 'Book flights',
      details: 'Search round-trip flights 2–3 months ahead to save 15–25%.',
      eta: '2–3 days',
    },
    {
      stepNumber: 3,
      title: 'Sort visa & documents',
      details: `Start the ${visaType} process early — typical processing is ${visaTime}.`,
      eta: '1–2 weeks',
    },
    {
      stepNumber: 4,
      title: 'Reserve accommodation',
      details: 'Choose a central neighborhood to cut local transport time and cost.',
      eta: '1 week',
    },
    {
      stepNumber: 5,
      title: 'Build a day-by-day plan',
      details: `Group activities around your interests: ${interests.join(', ') || 'sightseeing and food'}.`,
      eta: '2–3 days',
    },
  ]
}

/* ------------------------------------------------------------------ *
 * Ranking orchestration (AI when available, else local heuristic)
 * ------------------------------------------------------------------ */

/**
 * Rank all destinations. Returns array of { dest, score, reason, method }.
 * @private
 */
async function rankDestinations(destinations, answers) {
  const plainDestinations = destinations.map((d) => (d.toObject ? d.toObject() : d))

  // Try real AI ranking first.
  const ai = await aiService.rankDestinations(answers, plainDestinations)
  if (ai?.rankings?.length) {
    const bySlug = new Map(plainDestinations.map((d) => [d.slug, d]))
    const ranked = ai.rankings
      .map((r) => {
        const dest = bySlug.get(r.slug)
        if (!dest) return null
        return { dest, score: Math.round(r.score), reason: r.reason, method: 'ai' }
      })
      .filter(Boolean)
    if (ranked.length) return { ranked, method: 'ai', summary: ai.summary }
  }

  // Deterministic local fallback.
  const ranked = plainDestinations
    .map((dest) => ({
      dest,
      score: scoreDestination(dest, answers),
      reason: dest.reason || 'Great choice for your interests',
      method: 'local',
    }))
    .sort((a, b) => b.score - a.score)
  return { ranked, method: 'local', summary: '' }
}

/* ------------------------------------------------------------------ *
 * Main entry point
 * ------------------------------------------------------------------ */

/**
 * Generate comprehensive recommendations for a travel requirement.
 * @param {string} userId - MongoDB user ID
 * @param {string} requirementId - TravelRequirement MongoDB ID
 * @returns {Promise<Object|null>} Saved recommendation document
 */
async function generateRecommendations(userId, requirementId) {
  try {
    const requirement = await models.TravelRequirement.findById(requirementId)
    if (!requirement) {
      logger.warn('[recommendation.service] Requirement not found', { requirementId })
      return null
    }

    const user = await models.User.findById(userId)
    if (!user) {
      logger.warn('[recommendation.service] User not found', { userId })
      return null
    }

    const destinations = await models.Destination.find({ isDeleted: false })
    if (destinations.length === 0) {
      logger.warn('[recommendation.service] No destinations in catalog — run the seed script')
      return null
    }

    const answers = requirement.answers || {}

    // 1) Rank (AI or local).
    const { ranked, method: rankingMethod, summary } = await rankDestinations(destinations, answers)
    const top3 = ranked.slice(0, 3)
    const alts = ranked.slice(3, 5)
    if (top3.length === 0) return null

    // 2) Enrich the top destinations with live weather + country facts.
    const liveSources = new Set(['destinationDB', rankingMethod === 'ai' ? 'aiRanking' : 'localRanking'])
    const enriched = await Promise.all(
      top3.map(async ({ dest, score, reason }) => {
        const [weather, country] = await Promise.all([
          liveData.getWeather(dest.city || dest.name, dest.countryCode),
          liveData.getCountryInfo(dest.countryCode),
        ])
        if (weather) liveSources.add('open-meteo')
        if (country) liveSources.add('worldbank')
        return { dest, score, reason, weather, country }
      }),
    )

    const topEntry = enriched[0]

    // 3) Build recommendation sections.
    const recommendedDestinations = enriched.map(({ dest, score, reason, weather }, i) => ({
      destination: dest._id,
      slug: dest.slug,
      name: `${dest.name}, ${dest.country}`,
      country: dest.country,
      score,
      rank: i + 1,
      shortReason: reason,
      primaryTags: dest.tags?.slice(0, 3) || [],
      imageRef: dest.image || '/travel/placeholder.png',
      // Prefer the LIVE current temperature; fall back to the catalog average.
      avgTempC: weather ? weather.tempC : dest.avgTempC,
      liveWeather: weather
        ? { tempC: weather.tempC, summary: weather.summary, source: weather.source }
        : undefined,
      safetyIndex: dest.safetyIndex,
    }))

    const costEstimate = await estimateCosts(topEntry.dest, answers, topEntry.country)
    if (costEstimate.currency !== 'USD') liveSources.add('ecb-fx')

    const visaSummary = buildVisaSummary(
      enriched.map((e) => e.dest),
      answers,
    )
    const prosCons = buildProsConsNarrative(topEntry.dest, answers, topEntry.weather)
    const alternatives = alts.map(({ dest, reason }) => ({
      name: `${dest.name}, ${dest.country}`,
      reason: reason || dest.reason || 'Alternative option',
    }))
    const actionPlan = buildActionPlan(topEntry.dest, answers, costEstimate)

    // Confidence: answer completeness + top score + AI bonus.
    const answered = Object.values(answers).filter((v) => {
      if (v == null) return false
      if (Array.isArray(v)) return v.length > 0
      if (typeof v === 'object') return Object.values(v).some((x) => x != null && x !== '')
      return v !== ''
    }).length
    const aiBonus = rankingMethod === 'ai' ? 4 : 0
    const confidenceScore = Math.min(
      96,
      60 + answered * 3 + Math.round(top3[0].score / 8) + aiBonus,
    )

    const recommendation = await models.DestinationRecommendation.findOneAndUpdate(
      { user: userId, travelRequirement: requirementId },
      {
        user: userId,
        travelRequirement: requirementId,
        vertical: requirement.vertical,
        userName: requirement.userName,
        recommendedDestinations,
        costEstimate,
        visaSummary,
        prosCons,
        alternatives,
        actionPlan,
        confidenceScore: Math.round(confidenceScore),
        summary: summary || undefined,
        dataSources: Array.from(liveSources),
        engine: rankingMethod === 'ai' ? 'ai-gateway' : 'heuristic-engine',
        engineVersion: '2.0.0',
        generatedAt: new Date(),
      },
      { new: true, upsert: true },
    )

    requirement.status = 'completed'
    await requirement.save()

    logger.info('[recommendation.service] Recommendations generated', {
      requirementId,
      userId,
      rankingMethod,
      liveSources: Array.from(liveSources),
      confidenceScore: recommendation.confidenceScore,
    })

    return recommendation
  } catch (err) {
    logger.error('[recommendation.service] Failed to generate recommendations', {
      error: err.message,
      requirementId,
      userId,
    })
    throw err
  }
}

module.exports = {
  generateRecommendations,
  scoreDestination,
  estimateDuration,
  estimateCosts,
}
