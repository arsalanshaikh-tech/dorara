import type {
  Answers,
  BudgetAnswer,
  DatesAnswer,
  Recommendation,
  RecommendedDestination,
} from './types'

// -----------------------------------------------------------------------------
// MOCK recommendation engine.
// This produces a realistic, deterministic-ish recommendation object purely on
// the frontend. It is intentionally structured to match the eventual backend
// contract (POST /api/v1/recommendations) so real APIs + an LLM can replace
// `generateRecommendation` later with zero UI changes.
// -----------------------------------------------------------------------------

type DestinationSeed = {
  id: string
  name: string
  country: string
  tags: string[] // interest tags it satisfies
  weather: string[] // weather profiles it matches
  avgTempC: number
  safetyIndex: number // 0-100
  costFactor: number // relative daily cost multiplier
  image: string
  reason: string
  visaType: string
  processingTime: string
  officialLink: string
}

const DESTINATIONS: DestinationSeed[] = [
  {
    id: 'tokyo',
    name: 'Tokyo',
    country: 'Japan',
    tags: ['Culture & history', 'Food & nightlife', 'Adventure'],
    weather: ['Cool & mild', 'Warm & sunny'],
    avgTempC: 16,
    safetyIndex: 96,
    costFactor: 1.25,
    image: '/travel/tokyo.png',
    reason: 'World-class food, exceptional safety, and effortless public transport.',
    visaType: 'Tourist eVisa / visa on arrival',
    processingTime: '0–15 days',
    officialLink: 'https://www.mofa.go.jp/j_info/visit/visa/',
  },
  {
    id: 'lisbon',
    name: 'Lisbon',
    country: 'Portugal',
    tags: ['Culture & history', 'Food & nightlife', 'Wellness'],
    weather: ['Warm & sunny', 'Cool & mild'],
    avgTempC: 21,
    safetyIndex: 88,
    costFactor: 0.85,
    image: '/travel/lisbon.png',
    reason: 'Sunny, affordable, and rich in history with a relaxed coastal pace.',
    visaType: 'Schengen tourist visa',
    processingTime: '10–15 days',
    officialLink: 'https://vistos.mne.gov.pt/en/',
  },
  {
    id: 'bali',
    name: 'Bali',
    country: 'Indonesia',
    tags: ['Nature & outdoors', 'Wellness', 'Adventure'],
    weather: ['Warm & sunny'],
    avgTempC: 28,
    safetyIndex: 78,
    costFactor: 0.6,
    image: '/travel/bali.png',
    reason: 'Tropical nature, wellness retreats, and superb value for money.',
    visaType: 'Visa on arrival',
    processingTime: '0–3 days',
    officialLink: 'https://molina.imigrasi.go.id/',
  },
  {
    id: 'queenstown',
    name: 'Queenstown',
    country: 'New Zealand',
    tags: ['Adventure', 'Nature & outdoors'],
    weather: ['Cool & mild', 'Cold & snowy'],
    avgTempC: 11,
    safetyIndex: 93,
    costFactor: 1.15,
    image: '/travel/queenstown.png',
    reason: 'The adventure capital — bungee, hiking, and dramatic alpine scenery.',
    visaType: 'NZeTA',
    processingTime: '0–3 days',
    officialLink: 'https://www.immigration.govt.nz/',
  },
  {
    id: 'reykjavik',
    name: 'Reykjavik',
    country: 'Iceland',
    tags: ['Nature & outdoors', 'Adventure', 'Wellness'],
    weather: ['Cold & snowy', 'Cool & mild'],
    avgTempC: 5,
    safetyIndex: 97,
    costFactor: 1.35,
    image: '/travel/reykjavik.png',
    reason: 'Northern lights, geothermal spas, and some of the safest streets on earth.',
    visaType: 'Schengen tourist visa',
    processingTime: '10–15 days',
    officialLink: 'https://www.government.is/',
  },
  {
    id: 'dubai',
    name: 'Dubai',
    country: 'UAE',
    tags: ['Luxury', 'Food & nightlife', 'Adventure'],
    weather: ['Warm & sunny'],
    avgTempC: 33,
    safetyIndex: 90,
    costFactor: 1.4,
    image: '/travel/dubai.png',
    reason: 'Ultra-modern luxury, desert adventure, and a global dining scene.',
    visaType: 'Tourist eVisa',
    processingTime: '3–5 days',
    officialLink: 'https://www.gdrfad.gov.ae/',
  },
  {
    id: 'barcelona',
    name: 'Barcelona',
    country: 'Spain',
    tags: ['Culture & history', 'Food & nightlife', 'Nature & outdoors'],
    weather: ['Warm & sunny', 'Cool & mild'],
    avgTempC: 20,
    safetyIndex: 82,
    costFactor: 0.95,
    image: '/travel/barcelona.png',
    reason: 'Beaches, Gaudí architecture, and legendary food all in one city.',
    visaType: 'Schengen tourist visa',
    processingTime: '10–15 days',
    officialLink: 'https://www.exteriores.gob.es/',
  },
  {
    id: 'chiang-mai',
    name: 'Chiang Mai',
    country: 'Thailand',
    tags: ['Wellness', 'Culture & history', 'Nature & outdoors', 'Food & nightlife'],
    weather: ['Warm & sunny'],
    avgTempC: 27,
    safetyIndex: 80,
    costFactor: 0.5,
    image: '/travel/chiang-mai.png',
    reason: 'Temples, mountains, and incredible street food at unbeatable prices.',
    visaType: 'Visa exemption / on arrival',
    processingTime: '0–3 days',
    officialLink: 'https://www.thaievisa.go.th/',
  },
]

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  INR: '₹',
  EUR: '€',
  GBP: '£',
  AUD: 'A$',
  CAD: 'C$',
}

export function currencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency] ?? `${currency} `
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? (value as string[]) : []
}

function scoreDestination(seed: DestinationSeed, answers: Answers): number {
  let score = 55

  const interests = asStringArray(answers.interest_type)
  const matchedInterests = seed.tags.filter((t) => interests.includes(t)).length
  score += matchedInterests * 9

  const weather = asStringArray(answers.weather)
  if (weather.includes('No preference') || weather.length === 0) {
    score += 4
  } else if (seed.weather.some((w) => weather.includes(w))) {
    score += 8
  }

  const safetyImportance =
    typeof answers.safety_importance === 'number' ? answers.safety_importance : 3
  // Reward safe destinations more when safety matters.
  score += Math.round(((seed.safetyIndex - 80) / 20) * safetyImportance * 2)

  const budget = answers.budget as BudgetAnswer | undefined
  if (budget?.max) {
    // Rough heuristic: lower cost factor is friendlier to tighter budgets.
    const budgetGenerosity = Math.min(budget.max / 3000, 2)
    if (seed.costFactor <= budgetGenerosity) score += 6
    else score -= 6
  }

  return Math.max(40, Math.min(99, Math.round(score)))
}

function durationDays(answers: Answers): number {
  const dates = answers.dates as DatesAnswer | undefined
  if (dates?.durationDays) return dates.durationDays
  if (dates?.start && dates?.end) {
    const ms = new Date(dates.end).getTime() - new Date(dates.start).getTime()
    const days = Math.round(ms / (1000 * 60 * 60 * 24))
    if (days > 0) return days
  }
  return 7
}

function partyMultiplier(party: string | undefined): number {
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

export function generateRecommendation(answers: Answers, userName: string | null): Recommendation {
  const ranked = [...DESTINATIONS]
    .map((seed) => ({ seed, score: scoreDestination(seed, answers) }))
    .sort((a, b) => b.score - a.score)

  const top = ranked.slice(0, 3)
  const alts = ranked.slice(3, 5)

  const interests = asStringArray(answers.interest_type)

  const recommendedDestinations: RecommendedDestination[] = top.map(({ seed, score }) => ({
    id: seed.id,
    name: `${seed.name}, ${seed.country}`,
    country: seed.country,
    score,
    shortReason: seed.reason,
    primaryTags: seed.tags.filter((t) => interests.includes(t)).slice(0, 3).length
      ? seed.tags.filter((t) => interests.includes(t)).slice(0, 3)
      : seed.tags.slice(0, 2),
    imageRef: seed.image,
    avgTempC: seed.avgTempC,
    safetyIndex: seed.safetyIndex,
  }))

  // Cost estimate scaled by the top destination, duration, and party size.
  const budget = answers.budget as BudgetAnswer | undefined
  const currency = budget?.currency || 'USD'
  const days = durationDays(answers)
  const people = partyMultiplier(answers.party as string | undefined)
  const baseDaily = 90 * (top[0]?.seed.costFactor ?? 1)
  const flights = 550 * top[0].seed.costFactor
  const mid = Math.round((flights + baseDaily * days) * people)
  const low = Math.round(mid * 0.72)
  const high = Math.round(mid * 1.55)

  const visaChoice = (answers.visa_requirements as string) || 'Not sure'
  const visaRequiredLabel =
    visaChoice === 'I have a passport and visa-ready' ? 'Likely ready' : 'Depends on nationality'

  const visaSummary = top.map(({ seed }) => ({
    country: seed.country,
    visaRequired: visaRequiredLabel,
    visaType: seed.visaType,
    processingTime: seed.processingTime,
    officialLink: seed.officialLink,
  }))

  const topSeed = top[0].seed
  const advantages = [
    `Strong match for your interests: ${(interests.slice(0, 2).join(', ') || 'a well-rounded trip')}.`,
    `High safety index (${topSeed.safetyIndex}/100).`,
    `Comfortable average temperature around ${topSeed.avgTempC}°C.`,
  ]
  const disadvantages = [
    topSeed.costFactor > 1.1
      ? 'Higher accommodation and dining costs during peak season.'
      : 'Popular spots can get busy on weekends.',
    'Prices vary significantly by season — booking early helps.',
  ]

  const alternatives = alts.map(({ seed }) => ({
    name: `${seed.name}, ${seed.country}`,
    reason: seed.reason,
  }))

  const symbol = currencySymbol(currency)
  const actionPlan = [
    {
      stepNumber: 1,
      title: 'Confirm dates & budget',
      details: `Lock your ${days}-day window and a working budget near ${symbol}${mid.toLocaleString()} to guide bookings.`,
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
      details: `Start the ${topSeed.visaType} process early — typical processing is ${topSeed.processingTime}.`,
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

  // Confidence reflects how much of the questionnaire was answered.
  const answered = Object.values(answers).filter((v) => {
    if (v == null) return false
    if (Array.isArray(v)) return v.length > 0
    if (typeof v === 'object') return Object.values(v).some((x) => x != null && x !== '')
    return v !== ''
  }).length
  const confidenceScore = Math.min(96, 60 + answered * 3 + top[0].score / 8)

  return {
    userName,
    recommendedDestinations,
    costEstimate: {
      currency,
      low,
      mid,
      high,
      notes: `Estimate for ${days} days, ${((answers.party as string) || 'Solo').toLowerCase()}. Includes flights, stay, and daily spend.`,
    },
    visaSummary,
    prosCons: { advantages, disadvantages },
    alternatives,
    actionPlan,
    dataSources: ['costOfLivingAPI', 'visaAPI', 'weatherAPI', 'safetyIndexAPI'],
    confidenceScore: Math.round(confidenceScore),
  }
}
