'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Compass, FlaskConical, Pencil, Star, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiClientError } from '@/lib/api/client'
import { cn } from '@/lib/utils'
import { formatMoney, pluralize } from '@/lib/travel/trip-planner-format'
import {
  deleteSavedTrip,
  listSavedTrips,
  updateSavedTrip,
  type SavedTripSummary,
} from '@/lib/travel/saved-trips'
import { WakingNotice } from '@/components/travel/planner/plan-notice'

const CONSULT_HREF = '/consult?vertical=travel'

const FEASIBILITY: Record<SavedTripSummary['feasibility'], string> = {
  within: 'Within budget',
  close: 'Close to budget',
  above: 'Above budget',
  unknown: 'Budget not compared',
}

type Load =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'error'; message: string }
  | { status: 'ready' }

export function TripsClient() {
  const [load, setLoad] = useState<Load>({ status: 'loading' })
  const [items, setItems] = useState<SavedTripSummary[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loadingMore, setLoadingMore] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [confirming, setConfirming] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setLoad({ status: 'loading' })
    listSavedTrips(1, controller.signal)
      .then((res) => {
        setItems(res.items)
        setPage(res.page)
        setTotalPages(res.totalPages)
        setLoad({ status: 'ready' })
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
        if (err instanceof ApiClientError && (err.status === 401 || err.code === 'UNAUTHENTICATED')) {
          setLoad({ status: 'signed-out' })
          return
        }
        setLoad({ status: 'error', message: err instanceof ApiClientError ? err.message : 'We couldn’t load your trips.' })
      })
    return () => controller.abort()
  }, [attempt])

  const loadMore = useCallback(async () => {
    setLoadingMore(true)
    try {
      const res = await listSavedTrips(page + 1)
      setItems((prev) => [...prev, ...res.items.filter((n) => !prev.some((p) => p.id === n.id))])
      setPage(res.page)
      setTotalPages(res.totalPages)
    } catch {
      setActionError('We couldn’t load more trips.')
    } finally {
      setLoadingMore(false)
    }
  }, [page])

  async function toggleFavorite(trip: SavedTripSummary) {
    setActionError(null)
    try {
      const updated = await updateSavedTrip(trip.id, { favorite: !trip.favorite })
      setItems((prev) => prev.map((t) => (t.id === trip.id ? { ...t, favorite: updated.favorite } : t)))
    } catch {
      setActionError('We couldn’t update that trip.')
    }
  }

  async function saveTitle(trip: SavedTripSummary) {
    const title = draft.trim()
    if (!title || title === trip.title) {
      setEditing(null)
      return
    }
    setActionError(null)
    try {
      const updated = await updateSavedTrip(trip.id, { title })
      setItems((prev) => prev.map((t) => (t.id === trip.id ? { ...t, title: updated.title } : t)))
      setEditing(null)
    } catch {
      setActionError('We couldn’t rename that trip.')
    }
  }

  async function remove(trip: SavedTripSummary) {
    setActionError(null)
    try {
      await deleteSavedTrip(trip.id)
      setItems((prev) => prev.filter((t) => t.id !== trip.id))
      setConfirming(null)
    } catch {
      setActionError('We couldn’t delete that trip.')
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:py-14">
      <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">My trips</h1>
      <p className="mt-3 max-w-2xl text-lg leading-relaxed text-muted-foreground">
        Trip plans saved to your account. Prices in a saved plan are a snapshot from when it was
        made — open one to review it or try What if? changes.
      </p>

      {load.status === 'loading' ? (
        <div className="mt-8 flex flex-col gap-4" aria-busy="true">
          <WakingNotice />
          <span className="sr-only">Loading your trips…</span>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
      ) : null}

      {load.status === 'signed-out' ? (
        <Card className="mt-8 border-border/70">
          <CardContent className="flex flex-col items-start gap-4 p-6">
            <h2 className="font-display text-lg font-semibold">Sign in to see your saved trips</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              You can plan trips without an account. Plans are saved to My trips only when you’re
              signed in.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link href="/login" className={cn(buttonVariants({ size: 'lg' }))}>Sign in</Link>
              <Link href="/signup" className={cn(buttonVariants({ variant: 'outline', size: 'lg' }))}>Create an account</Link>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {load.status === 'error' ? (
        <Card className="mt-8 border-destructive/30" role="alert">
          <CardContent className="flex flex-col items-start gap-3 p-6">
            <h2 className="font-display text-lg font-semibold">We couldn’t load your trips</h2>
            <p className="text-sm text-muted-foreground">{load.message}</p>
            <Button onClick={() => setAttempt((n) => n + 1)}>Try again</Button>
          </CardContent>
        </Card>
      ) : null}

      {load.status === 'ready' && items.length === 0 ? (
        <Card className="mt-8 border-border/70">
          <CardContent className="flex flex-col items-start gap-4 p-6">
            <h2 className="font-display text-lg font-semibold">No saved trips yet</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Get destination recommendations, choose “Plan My Trip”, and your plan will be saved here
              automatically while you’re signed in.
            </p>
            <Link href={CONSULT_HREF} className={cn(buttonVariants({ size: 'lg' }))}>
              <Compass data-icon="inline-start" />
              Start planning
            </Link>
          </CardContent>
        </Card>
      ) : null}

      {actionError ? (
        <p role="alert" className="mt-4 text-sm text-destructive">{actionError}</p>
      ) : null}

      {load.status === 'ready' && items.length > 0 ? (
        <ul className="mt-8 flex flex-col gap-4">
          {items.map((trip) => (
            <li key={trip.id}>
              <Card className="border-border/70 shadow-sm">
                <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    {editing === trip.id ? (
                      <form
                        className="flex items-center gap-2"
                        onSubmit={(e) => {
                          e.preventDefault()
                          void saveTitle(trip)
                        }}
                      >
                        <Input
                          autoFocus
                          aria-label="Trip name"
                          value={draft}
                          maxLength={120}
                          onChange={(e) => setDraft(e.target.value)}
                        />
                        <Button type="submit" size="sm">Save</Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                      </form>
                    ) : (
                      <h2 className="truncate font-display text-lg font-semibold text-foreground">{trip.title}</h2>
                    )}
                    <p className="mt-1 text-sm text-muted-foreground">
                      {trip.destinationName}
                      {trip.durationDays ? ` · ${pluralize(trip.durationDays, 'day')}` : ''}
                      {trip.estimatedTotal !== null && trip.currency
                        ? ` · estimated ${formatMoney(trip.estimatedTotal, trip.currency)}`
                        : ''}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Badge variant="secondary" className="font-medium">{FEASIBILITY[trip.feasibility]}</Badge>
                      {trip.isDemo ? (
                        <Badge variant="outline" className="h-5 gap-1 border-coral/50 bg-coral/10 font-semibold text-foreground">
                          <FlaskConical className="text-coral" aria-hidden="true" />
                          Includes demo data
                        </Badge>
                      ) : null}
                      <span className="text-xs text-muted-foreground">
                        Saved {new Date(trip.createdAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/trip-planner?saved=${trip.id}`} className={cn(buttonVariants({ size: 'sm' }))}>
                      Open<span className="sr-only"> {trip.title}</span>
                    </Link>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-pressed={trip.favorite}
                      aria-label={trip.favorite ? `Remove ${trip.title} from favorites` : `Add ${trip.title} to favorites`}
                      onClick={() => void toggleFavorite(trip)}
                    >
                      <Star className={cn(trip.favorite && 'fill-coral text-coral')} aria-hidden="true" />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Rename ${trip.title}`}
                      onClick={() => {
                        setEditing(trip.id)
                        setDraft(trip.title)
                      }}
                    >
                      <Pencil aria-hidden="true" />
                    </Button>
                    {confirming === trip.id ? (
                      <span className="flex items-center gap-1" role="group" aria-label={`Confirm deleting ${trip.title}`}>
                        <Button size="sm" variant="destructive" onClick={() => void remove(trip)}>Delete</Button>
                        <Button size="sm" variant="ghost" onClick={() => setConfirming(null)}>Keep</Button>
                      </span>
                    ) : (
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Delete ${trip.title}`}
                        onClick={() => setConfirming(trip.id)}
                      >
                        <Trash2 aria-hidden="true" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      ) : null}

      {load.status === 'ready' && page < totalPages ? (
        <div className="mt-6 flex justify-center">
          <Button variant="outline" onClick={() => void loadMore()} disabled={loadingMore}>
            {loadingMore ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
