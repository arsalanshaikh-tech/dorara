'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowLeft, FlaskConical, Route } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useConsultStore } from '@/lib/travel/store'
import { useAuthStore } from '@/lib/store/auth-store'
import { adjustTripPlan, loadTripPlan } from '@/lib/travel/trip-planner-service'
import {
  TripPlannerError,
  type TripAdjustments,
  type TripPlan,
  type TripPlanInput,
} from '@/lib/travel/trip-planner-types'
import type { Answers, RecommendedDestination } from '@/lib/travel/types'
import type { PlanMeta } from '@/lib/travel/trip-planner-types'
import { rememberPlan } from '@/lib/travel/trip-planner-api'
import { getSavedTrip, type SavedTrip } from '@/lib/travel/saved-trips'
import { ApiClientError } from '@/lib/api/client'
import { AccommodationSection } from './accommodation-section'
import { BudgetSection } from './budget-section'
import { FitSection } from './fit-section'
import { FlightsSection } from './flights-section'
import { ItinerarySection } from './itinerary-section'
import {
  PlannerEmptyState,
  PlannerErrorState,
  PlannerSkeleton,
} from './planner-states'
import { HeroImage } from './hero-image'
import { PlanNotice, WakingNotice } from './plan-notice'
import { TripSummary } from './trip-summary'
import { WhatIfPanel, type WhatIfValues } from './what-if-panel'

const RESULTS_HREF = '/results'
const CONSULT_HREF = '/consult?vertical=travel'

const SECTIONS = [
  { id: 'itinerary', label: 'Itinerary' },
  { id: 'stays', label: 'Stays' },
  { id: 'flights', label: 'Flights' },
  { id: 'budget', label: 'Budget' },
  { id: 'fit', label: 'Why it fits' },
  { id: 'what-if', label: 'What if?' },
]

// The persisted travel store hydrates on the client only. Rendering nothing
// plan-specific until mounted keeps server and client markup identical.
function useHasMounted(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )
}

function isDestination(value: unknown): value is RecommendedDestination {
  if (typeof value !== 'object' || value === null) return false
  const d = value as Record<string, unknown>
  return typeof d.id === 'string' && typeof d.name === 'string'
}

function SectionNav() {
  return (
    <nav
      aria-label="Trip planner sections"
      className="sticky top-16 z-30 -mx-4 border-b border-border/70 bg-background/85 px-4 backdrop-blur-md sm:-mx-6 sm:px-6"
    >
      <ul className="flex gap-1 overflow-x-auto py-2">
        {SECTIONS.map((s) => (
          <li key={s.id} className="shrink-0">
            <a
              href={`#${s.id}`}
              className="inline-flex h-8 items-center rounded-lg px-3 text-sm font-medium text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function PlannerHeader({ destinationName, meta }: { destinationName: string; meta?: PlanMeta }) {
  const signedIn = useAuthStore((s) => s.isAuthenticated)
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
            <Route className="size-4" aria-hidden="true" />
            Trip planner
          </span>
          <h1 className="mt-4 text-balance font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Your trip to {destinationName}
          </h1>
          <p className="mt-3 text-pretty text-lg leading-relaxed text-muted-foreground">
            A personalized plan built from the answers you already shared.
          </p>
        </div>
        <Link
          href={RESULTS_HREF}
          className={cn(buttonVariants({ variant: 'outline', size: 'lg' }))}
        >
          <ArrowLeft data-icon="inline-start" />
          Back to recommendations
        </Link>
      </div>

      <PlanNotice meta={meta} signedIn={signedIn} />
    </div>
  )
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; plan: TripPlan }

function isAbort(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError'
}

function PlannerContent({
  destination,
  answers,
  onRetry,
  initialPlan,
}: {
  destination: RecommendedDestination
  answers: Answers
  onRetry: () => void
  /** A plan opened from My trips: shown immediately instead of generating a new one. */
  initialPlan?: TripPlan
}) {
  const input: TripPlanInput = useMemo(
    () => ({ destination, answers }),
    [destination, answers],
  )

  const [state, setState] = useState<LoadState>(
    initialPlan ? { status: 'ready', plan: initialPlan } : { status: 'loading' },
  )
  const [values, setValues] = useState<WhatIfValues>({ budget: null, durationDays: null })
  const [isAdjusting, setIsAdjusting] = useState(false)
  const [adjustError, setAdjustError] = useState<string | null>(null)
  const adjustAbort = useRef<AbortController | null>(null)

  // Initial load. Remounting this component (via `key`) restarts it, which is
  // how "Try again" works.
  useEffect(() => {
    if (initialPlan) {
      rememberPlan(input, initialPlan)
      return
    }
    const controller = new AbortController()
    loadTripPlan(input, { signal: controller.signal })
      .then((plan) => setState({ status: 'ready', plan }))
      .catch((err: unknown) => {
        if (isAbort(err)) return
        setState({
          status: 'error',
          message:
            err instanceof TripPlannerError
              ? err.message
              : 'Something went wrong while building the sample plan.',
        })
      })
    return () => controller.abort()
  }, [input, initialPlan])

  useEffect(() => () => adjustAbort.current?.abort(), [])

  const applyAdjustments = useCallback(
    (next: WhatIfValues) => {
      setValues(next)
      setAdjustError(null)
      setIsAdjusting(true)
      adjustAbort.current?.abort()
      const controller = new AbortController()
      adjustAbort.current = controller

      const adjustments: TripAdjustments = {
        budget: next.budget,
        durationDays: next.durationDays,
      }
      adjustTripPlan(input, adjustments, { signal: controller.signal })
        .then((plan) => {
          // Keep the previous plan on screen until the new one is ready.
          setState({ status: 'ready', plan })
          setIsAdjusting(false)
        })
        .catch((err: unknown) => {
          if (isAbort(err)) return
          setIsAdjusting(false)
          setAdjustError(
            'We couldn’t apply that change, so the previous preview is still shown.',
          )
        })
    },
    [input],
  )

  const plan = state.status === 'ready' ? state.plan : null

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-14">
      <PlannerHeader destinationName={destination.name} meta={plan?.meta} />

      {state.status === 'error' ? (
        <div className="mt-8">
          <PlannerErrorState
            message={state.message}
            onRetry={onRetry}
            backHref={RESULTS_HREF}
          />
        </div>
      ) : null}

      {state.status === 'loading' ? (
        <>
          <WakingNotice />
          <PlannerSkeleton />
        </>
      ) : null}

      {plan ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mt-8 flex flex-col gap-6"
          aria-busy={isAdjusting}
        >
          {plan.destination.heroImage ? (
            <HeroImage hero={plan.destination.heroImage} name={plan.destination.name} />
          ) : null}
          <TripSummary
            plan={plan}
            adjusted={{
              budget: values.budget !== null,
              duration: values.durationDays !== null,
            }}
          />
          <SectionNav />

          <div
            className={cn(
              'grid grid-cols-1 gap-6 transition-opacity lg:grid-cols-3',
              isAdjusting && 'opacity-70',
            )}
          >
            <div className="flex flex-col gap-6 lg:col-span-2">
              <ItinerarySection plan={plan} />
              <AccommodationSection plan={plan} />
              <FlightsSection plan={plan} />
              <FitSection plan={plan} />
            </div>
            <div className="flex flex-col gap-6">
              <BudgetSection plan={plan} />
              <WhatIfPanel
                limits={plan.limits}
                currency={plan.budget.currency}
                values={values}
                onChange={applyAdjustments}
                onReset={() => applyAdjustments({ budget: null, durationDays: null })}
                isAdjusting={isAdjusting}
                error={adjustError}
              />
            </div>
          </div>
        </motion.div>
      ) : null}
    </div>
  )
}

function LivePlanner() {
  const mounted = useHasMounted()
  const recommendation = useConsultStore((s) => s.recommendation)
  const answers = useConsultStore((s) => s.answers)
  const selectedId = useConsultStore((s) => s.selectedDestinationId)
  const selectDestination = useConsultStore((s) => s.selectDestination)
  const [attempt, setAttempt] = useState(0)

  const destinations = useMemo<RecommendedDestination[]>(() => {
    const list = recommendation?.recommendedDestinations
    return Array.isArray(list) ? list.filter(isDestination) : []
  }, [recommendation])

  const destination = useMemo(
    () => destinations.find((d) => d.id === selectedId) ?? null,
    [destinations, selectedId],
  )

  // Before the client store is available, show a neutral loading shell rather
  // than flashing an empty state.
  if (!mounted) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-14">
        <PlannerSkeleton />
      </div>
    )
  }

  if (destinations.length === 0) {
    return (
      <PlannerEmptyState
        title="No recommendations yet"
        description="Trip plans are built from your travel answers. Answer a few quick questions first and Dorara will recommend destinations you can plan a trip for."
        primary={{ label: 'Start the Travel planner', href: CONSULT_HREF }}
      />
    )
  }

  if (!destination) {
    return (
      <PlannerEmptyState
        title="Choose a destination to plan"
        description="Pick one of your recommended destinations and use “Plan My Trip” — or choose one below."
        primary={{ label: 'Back to recommendations', href: RESULTS_HREF }}
      >
        <ul className="flex flex-wrap justify-center gap-2">
          {destinations.map((d) => (
            <li key={d.id}>
              <button
                type="button"
                onClick={() => selectDestination(d.id)}
                className={cn(buttonVariants({ variant: 'outline', size: 'lg' }))}
              >
                Plan {d.name}
              </button>
            </li>
          ))}
        </ul>
      </PlannerEmptyState>
    )
  }

  return (
    <PlannerContent
      key={`${destination.id}-${attempt}`}
      destination={destination}
      answers={answers}
      onRetry={() => setAttempt((n) => n + 1)}
    />
  )
}

/** Opens a plan saved to the signed-in user's account (from My trips). */
function SavedPlanner({ id }: { id: string }) {
  const [state, setState] = useState<
    { status: 'loading' } | { status: 'ready'; trip: SavedTrip } | { status: 'error'; message: string }
  >({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setState({ status: 'loading' })
    getSavedTrip(id, controller.signal)
      .then((trip) => setState({ status: 'ready', trip }))
      .catch((err: unknown) => {
        if (isAbort(err)) return
        setState({
          status: 'error',
          message:
            err instanceof ApiClientError && (err.status === 404 || err.status === 401)
              ? 'That saved trip couldn’t be found. It may have been deleted, or you may need to sign in.'
              : 'We couldn’t load that saved trip.',
        })
      })
    return () => controller.abort()
  }, [id, attempt])

  if (state.status === 'loading') {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-14">
        <WakingNotice />
        <PlannerSkeleton />
      </div>
    )
  }
  if (state.status === 'error') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <PlannerErrorState message={state.message} onRetry={() => setAttempt((n) => n + 1)} backHref="/trips" />
      </div>
    )
  }
  const { trip } = state
  return (
    <PlannerContent
      key={trip.id}
      destination={trip.destinationSnapshot}
      answers={trip.requirementsSnapshot}
      initialPlan={trip.plan}
      onRetry={() => setAttempt((n) => n + 1)}
    />
  )
}

export function TripPlannerClient({ savedId }: { savedId?: string }) {
  return savedId ? <SavedPlanner id={savedId} /> : <LivePlanner />
}
