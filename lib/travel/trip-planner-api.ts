// Real implementation behind `loadTripPlan` / `adjustTripPlan` (see trip-planner-service.ts).
//
// Backend contract (matches backend/validators/tripPlanner.schemas.js):
//   POST /api/v1/trip-planner/generate  { input: { destination, answers } }
//        -> { success, data: TripPlan, meta: { requestId } }
//   POST /api/v1/trip-planner/adjust    { input, adjustments: { budget?, durationDays? }, planId? }
//        -> { success, data: TripPlan }
// Errors: { success: false, error: { code, message, details? } } (422 VALIDATION_ERROR, 429 RATE_LIMITED, ...).
//
// The backend always returns a complete plan: a failing section (AI / flights / stays) falls back
// to labelled demo content and is described in `plan.meta.sectionStatus` / `plan.meta.warnings`.

import { ApiClientError, apiRequest } from '@/lib/api/client'
import {
  TripPlannerError,
  type TripAdjustments,
  type TripPlan,
  type TripPlanInput,
} from './trip-planner-types'

type CallOptions = { signal?: AbortSignal }

// Remember the id of the plan saved for the current input so a What-if can be recorded in its
// history (signed-in users only; the server verifies ownership).
let lastSaved: { key: string; planId: string } | null = null

function inputKey(input: TripPlanInput): string {
  return `${input.destination.id}|${JSON.stringify(input.answers)}`
}

function remember(input: TripPlanInput, plan: TripPlan) {
  const id = plan.meta.savedPlanId
  if (id) lastSaved = { key: inputKey(input), planId: id }
}

function toPlannerError(err: unknown, fallback: string): Error {
  if (err instanceof Error && err.name === 'AbortError') return err
  if (err instanceof ApiClientError) {
    if (err.status === 422) return new TripPlannerError('INVALID_INPUT', err.message)
    return new TripPlannerError('LOAD_FAILED', err.message || fallback)
  }
  return new TripPlannerError('LOAD_FAILED', fallback)
}

export async function loadTripPlanApi(input: TripPlanInput, options: CallOptions = {}): Promise<TripPlan> {
  try {
    const { data } = await apiRequest<TripPlan>('POST', '/trip-planner/generate', {
      body: { input },
      signal: options.signal,
    })
    remember(input, data)
    return data
  } catch (err) {
    throw toPlannerError(err, 'We couldn’t build your trip plan right now.')
  }
}

export async function adjustTripPlanApi(
  input: TripPlanInput,
  adjustments: TripAdjustments,
  options: CallOptions = {},
): Promise<TripPlan> {
  const clean: { budget?: number; durationDays?: number } = {}
  if (typeof adjustments.budget === 'number' && adjustments.budget > 0) clean.budget = adjustments.budget
  if (typeof adjustments.durationDays === 'number' && adjustments.durationDays >= 1) {
    clean.durationDays = Math.round(adjustments.durationDays)
  }
  const planId = lastSaved && lastSaved.key === inputKey(input) ? lastSaved.planId : undefined
  try {
    const { data } = await apiRequest<TripPlan>('POST', '/trip-planner/adjust', {
      body: { input, adjustments: clean, ...(planId ? { planId } : {}) },
      signal: options.signal,
    })
    remember(input, data)
    return data
  } catch (err) {
    throw toPlannerError(err, 'We couldn’t apply that change right now.')
  }
}

/** Register a plan opened from My trips so later What-if changes are recorded on it. */
export function rememberPlan(input: TripPlanInput, plan: TripPlan): void {
  remember(input, plan)
}
