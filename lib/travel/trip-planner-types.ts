// Frontend-only types for the Personalized Trip Planner (phase 1).
//
// Everything in a `TripPlan` is DEMO data produced by
// `lib/travel/trip-planner-service.ts`. Nothing here comes from a live flight,
// hotel, or AI service.
//
// -----------------------------------------------------------------------------
// FUTURE BACKEND CONTRACT (phase 2)
// -----------------------------------------------------------------------------
// The service layer is the only integration point. To go live, replace the body
// of `loadTripPlan` / `adjustTripPlan` with calls like:
//
//   POST /api/v1/trip-plans
//     request : TripPlanRequest            (defined below)
//     response: TripPlan                   (defined below, `meta.isDemo: false`)
//
//   POST /api/v1/trip-plans/adjust
//     request : { destinationId: string; requirements: TripRequirements;
//                 adjustments: TripAdjustments }
//     response: TripPlan
//
// UI components only read `TripPlan`, so they should not need to change as long
// as the backend returns this shape. Live providers should set
// `AccommodationOption.bookingUrl` / `FlightOption.bookingUrl` and
// `meta.isDemo = false`; the UI hides "Demo Data" labels only when `isDemo` is
// false for that section.
// -----------------------------------------------------------------------------

import type { Answers, RecommendedDestination } from './types'

// --- Inputs -------------------------------------------------------------------

/** What the planner needs: the chosen destination + the saved questionnaire. */
export type TripPlanInput = {
  destination: RecommendedDestination
  answers: Answers
}

/** Preview-only overrides applied by the "What if?" controls. */
export type TripAdjustments = {
  /** Replacement total budget, in the user's currency. */
  budget?: number | null
  /** Replacement trip length in days. */
  durationDays?: number | null
}

/** Requirements normalised from the saved questionnaire answers. */
export type TripRequirements = {
  destinationPreference: string | null
  budget: {
    min: number | null
    /** Total budget used for feasibility (the questionnaire's max, else min). */
    amount: number | null
    currency: string | null
  }
  durationDays: number | null
  dates: { start: string | null; end: string | null }
  /** Raw party label, e.g. "Couple". */
  partyLabel: string | null
  /** Exact count only when the label implies one (Solo = 1, Couple = 2). */
  travelerCount: number | null
  ageGroup: string | null
  weather: string[]
  interests: string[]
  safetyImportance: number | null
  visaStatus: string | null
  foodLanguage: string | null
  notes: string | null
  /** The current questionnaire does not collect this yet. */
  departureLocation: string | null
}

/** Body a future backend request would send. */
export type TripPlanRequest = {
  destinationId: string
  destinationName: string
  requirements: TripRequirements
  adjustments?: TripAdjustments
}

// --- Plan output --------------------------------------------------------------

/** Where each section of a server-built plan came from. */
export type SectionStatus = {
  itinerary: 'ok' | 'fallback' | 'failed'
  stays: 'ok' | 'demo' | 'failed'
  flights: 'ok' | 'demo' | 'failed'
}

/** 'live' only when the provider response contained a real price. */
export type DataSource = 'live' | 'demo'

export type PlanMeta = {
  /** True when ANY section is demo/fallback (never one flag for mixed data). */
  isDemo: boolean
  source: 'frontend-demo' | 'backend' | 'server'
  disclaimer: string
  generatedAt: string
  // --- Optional, set by the server (older/mock plans simply omit them) ---
  requestId?: string
  sectionStatus?: SectionStatus
  itinerarySource?: 'ai' | 'fallback'
  fitSource?: 'ai' | 'fallback'
  /** Human-readable notes, e.g. why a section is demo. */
  warnings?: string[]
  /** Per budget category: 'live' | 'demo' | 'estimate' | 'none'. */
  categorySources?: Record<string, string>
  estimatedCategories?: string[]
  savedPlanId?: string
}

export type PlanEffective = {
  durationDays: number
  nights: number
  travelers: number
  travelersAssumed: boolean
  durationAssumed: boolean
  /** True when the saved duration exceeded what the preview itinerary shows. */
  durationCapped: boolean
  budget: number | null
  currency: string
  /** True when no usable currency was saved and USD was used for estimates. */
  currencyAssumed: boolean
  /** Demo exchange-rate note, shown next to converted estimates. */
  rateNote: string | null
}

export type ActivityItem = {
  id: string
  time: string
  title: string
  description: string
  /** Per person, user's currency. Undefined = no cost estimate. */
  estimatedCost?: number
  bookAheadNote?: string
  /** Only interests the user actually selected. */
  matchedInterests: string[]
}

export type ItineraryDay = {
  day: number
  title: string
  theme: string
  dateLabel?: string
  activities: ActivityItem[]
}

export type AccommodationOption = {
  id: string
  name: string
  type: string
  location: string
  /** Demo rating from the fixture. */
  rating?: number
  facilities: string[]
  /** Per room, per night, user's currency. */
  pricePerNight: number
  /** Per-night price x nights x rooms. */
  totalPrice: number
  nights: number
  rooms: number
  /** Only present when the fixture/provider includes it. */
  cancellation?: string
  /** Never fabricated: only a link the provider returned. Undefined in the demo. */
  bookingUrl?: string
  /** Optional: absent on mock plans (treated as 'demo'). */
  dataSource?: DataSource
  /** Provider thumbnail (https) when the search response had one. */
  imageUrl?: string
}

export type FlightOption = {
  id: string
  airline: string
  originLabel: string
  destinationAirport: string
  departureTime: string
  arrivalTime: string
  /** e.g. "+1 day". */
  arrivalNote?: string
  durationLabel: string
  stops: number
  /** Round trip, per traveler, user's currency. */
  pricePerTraveler: number
  totalPrice: number
  travelers: number
  /** Never fabricated: for live results this is the Google Flights search link the response gave. */
  bookingUrl?: string
  /** Optional: absent on mock plans (treated as 'demo'). */
  dataSource?: DataSource
}

export type BudgetLine = {
  key:
    | 'flights'
    | 'accommodation'
    | 'food'
    | 'activities'
    | 'transport'
    | 'misc'
  label: string
  amount: number
  detail: string
}

export type BudgetBreakdown = {
  currency: string
  lines: BudgetLine[]
  /** Always the exact sum of `lines`. */
  total: number
  basisNote: string
  /** Which demo options the flights / accommodation lines are based on. */
  basis: { flightId?: string; accommodationId?: string }
}

export type FeasibilityStatus = 'within' | 'close' | 'above' | 'unknown'

export type CostSuggestion = {
  id: string
  title: string
  detail: string
  /** Estimated saving in the user's currency, when it can be computed. */
  saving?: number
}

export type BudgetFeasibility = {
  status: FeasibilityStatus
  label: string
  message: string
  budget: number | null
  total: number
  /** budget - total. Positive = remaining, negative = over. Null without budget. */
  difference: number | null
  /** total / budget, null without budget. */
  ratio: number | null
  suggestions: CostSuggestion[]
}

export type FitReason = {
  id: string
  text: string
}

export type TripFit = {
  matches: FitReason[]
  considerations: FitReason[]
}

export type AdjustmentLimits = {
  original: { budget: number | null; durationDays: number }
  budgetRange: { min: number; max: number; step: number } | null
  durationOptions: number[]
}

export type TripPlan = {
  meta: PlanMeta
  destination: {
    id: string
    name: string
    country: string
    imageRef: string
    /** Optional Pexels hero image (attribution required). */
    heroImage?: {
      provider: 'pexels'
      url: string
      photographer: string
      photographerUrl?: string
      sourceUrl?: string
    }
  }
  requirements: TripRequirements
  effective: PlanEffective
  itinerary: ItineraryDay[]
  accommodations: AccommodationOption[]
  flights: FlightOption[]
  budget: BudgetBreakdown
  feasibility: BudgetFeasibility
  fit: TripFit
  limits: AdjustmentLimits
}

export class TripPlannerError extends Error {
  readonly code: 'INVALID_INPUT' | 'LOAD_FAILED'

  constructor(code: 'INVALID_INPUT' | 'LOAD_FAILED', message: string) {
    super(message)
    this.name = 'TripPlannerError'
    this.code = code
  }
}
