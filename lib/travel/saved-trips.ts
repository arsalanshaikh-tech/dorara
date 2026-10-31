// Saved trip plans (signed-in users only) — thin client over
//   GET    /api/v1/trip-planner/plans?page&limit      -> summaries (no plan body)
//   GET    /api/v1/trip-planner/plans/:id             -> full saved plan + input snapshots
//   PATCH  /api/v1/trip-planner/plans/:id             -> { title?, favorite? }
//   DELETE /api/v1/trip-planner/plans/:id
// The server enforces ownership (404 for plans that are not yours).

import { apiRequest } from '@/lib/api/client'
import type { TripPlan } from './trip-planner-types'
import type { Answers, RecommendedDestination } from './types'

export type SavedTripSummary = {
  id: string
  title: string
  favorite: boolean
  destinationName: string
  destinationCountry: string
  durationDays: number | null
  currency: string
  estimatedTotal: number | null
  feasibility: 'within' | 'close' | 'above' | 'unknown'
  isDemo: boolean
  createdAt: string
}

export type SavedTrip = SavedTripSummary & {
  plan: TripPlan
  requirementsSnapshot: Answers
  destinationSnapshot: RecommendedDestination
}

export type SavedTripsPage = {
  items: SavedTripSummary[]
  page: number
  totalPages: number
  total: number
}

export async function listSavedTrips(page = 1, signal?: AbortSignal): Promise<SavedTripsPage> {
  const { data, meta } = await apiRequest<SavedTripSummary[]>('GET', `/trip-planner/plans?page=${page}&limit=12`, { signal })
  const m = (meta ?? {}) as { page?: number; totalPages?: number; total?: number }
  return { items: Array.isArray(data) ? data : [], page: m.page ?? page, totalPages: m.totalPages ?? 1, total: m.total ?? 0 }
}

export async function getSavedTrip(id: string, signal?: AbortSignal): Promise<SavedTrip> {
  const { data } = await apiRequest<SavedTrip>('GET', `/trip-planner/plans/${encodeURIComponent(id)}`, { signal })
  // The stored copy is the plan as generated; tag it with its saved id so What-if is recorded on it.
  return { ...data, plan: { ...data.plan, meta: { ...data.plan.meta, savedPlanId: data.id } } }
}

export async function updateSavedTrip(id: string, patch: { title?: string; favorite?: boolean }): Promise<SavedTripSummary> {
  const { data } = await apiRequest<SavedTripSummary>('PATCH', `/trip-planner/plans/${encodeURIComponent(id)}`, { body: patch })
  return data
}

export async function deleteSavedTrip(id: string): Promise<void> {
  await apiRequest('DELETE', `/trip-planner/plans/${encodeURIComponent(id)}`)
}
