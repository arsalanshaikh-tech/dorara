// Shared types for the Travel vertical — questionnaire schema, normalized
// answers, and the structured recommendation object returned by the (mocked)
// recommendation engine. These mirror the backend contract so real APIs can be
// wired in later without changing the UI.

export type QuestionType =
  | 'single_choice_or_text'
  | 'range_currency'
  | 'date_range'
  | 'single_choice'
  | 'multi_choice'
  | 'scale'
  | 'multi_text'
  | 'long_text'
  | 'airport_autocomplete'

export type QuestionValidation = {
  required?: boolean
  minValue?: number
  maxValue?: number
  minSelected?: number
  maxLength?: number
}

export type Question = {
  id: string
  type: QuestionType
  label: string
  help?: string
  options?: string[]
  fields?: string[]
  scale?: { minLabel: string; maxLabel: string; min: number; max: number }
  validation?: QuestionValidation
}

export type Questionnaire = {
  vertical: string
  title: string
  description: string
  steps: Question[]
  submitLabel: string
}

// --- Normalized answer payload -------------------------------------------------

export type BudgetAnswer = {
  min: number | null
  max: number | null
  currency: string
}

export type DatesAnswer = {
  start: string | null
  end: string | null
  durationDays: number | null
}

export type AnswerValue =
  | string
  | string[]
  | number
  | BudgetAnswer
  | DatesAnswer
  | null

export type Answers = Record<string, AnswerValue>

// --- Structured recommendation object -----------------------------------------

export type RecommendedDestination = {
  id: string
  name: string
  country: string
  score: number
  shortReason: string
  primaryTags: string[]
  imageRef: string
  avgTempC: number
  safetyIndex: number // 0-100
}

export type CostEstimate = {
  currency: string
  low: number
  mid: number
  high: number
  notes: string
}

export type VisaSummaryItem = {
  country: string
  visaRequired: string
  visaType: string
  processingTime: string
  officialLink: string
}

export type ProsCons = {
  advantages: string[]
  disadvantages: string[]
}

export type Alternative = {
  name: string
  reason: string
}

export type ActionStep = {
  stepNumber: number
  title: string
  details: string
  eta: string
}

export type Recommendation = {
  userName: string | null
  recommendedDestinations: RecommendedDestination[]
  costEstimate: CostEstimate
  visaSummary: VisaSummaryItem[]
  prosCons: ProsCons
  alternatives: Alternative[]
  actionPlan: ActionStep[]
  dataSources: string[]
  confidenceScore: number
}
