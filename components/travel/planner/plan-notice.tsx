'use client'

import { useSyncExternalStore } from 'react'
import { FlaskConical, Info, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { getApiWaking, subscribeApiStatus } from '@/lib/api/client'
import type { PlanMeta } from '@/lib/travel/trip-planner-types'

/** "Waking up the server…" — shown while a request is slow (Render free tier cold start). */
export function WakingNotice() {
  const waking = useSyncExternalStore(subscribeApiStatus, getApiWaking, () => false)
  if (!waking) return null
  return (
    <div
      role="status"
      aria-live="polite"
      className="mt-6 flex items-start gap-3 rounded-2xl border border-primary/30 bg-primary/5 px-5 py-3 text-sm leading-relaxed text-foreground"
    >
      <Loader2 className="mt-0.5 size-5 shrink-0 animate-spin text-primary" aria-hidden="true" />
      <p>
        <strong className="font-semibold">Waking up the server…</strong> This can take up to a
        minute on the first request. Your plan will appear as soon as it’s ready.
      </p>
    </div>
  )
}

/**
 * The data-honesty banner at the top of the planner. Its wording follows what the plan really
 * contains (per-section status from the server) — it never claims "live" for demo data and never
 * claims "demo" for a live search result.
 */
export function PlanNotice({ meta, signedIn = false }: { meta?: PlanMeta; signedIn?: boolean }) {
  const mock = !meta || meta.source === 'frontend-demo'
  const status = meta?.sectionStatus

  let badge = 'Demo preview'
  let body: React.ReactNode =
    'Sample data is shown until your plan is ready. Prices are estimates, nothing here is live availability, and nothing can be booked.'

  if (meta && mock) {
    body = (
      <>
        This version uses sample data. Itinerary, stays, flights, and prices are{' '}
        <strong className="font-semibold">estimated demo content</strong> — not live availability,
        and nothing can be booked here.
      </>
    )
  } else if (meta && !mock) {
    const liveParts = [status?.flights === 'ok' ? 'flights' : null, status?.stays === 'ok' ? 'stays' : null].filter(Boolean)
    const demoParts = [
      status?.flights !== 'ok' ? 'flights' : null,
      status?.stays !== 'ok' ? 'stays' : null,
      status?.itinerary !== 'ok' ? 'itinerary' : null,
    ].filter(Boolean)
    badge = meta.isDemo ? (liveParts.length ? 'Live + demo data' : 'Demo data & estimates') : 'Live search prices'
    body = (
      <>
        {liveParts.length ? (
          <>
            <strong className="font-semibold">{liveParts.join(' and ')}</strong> use prices from a live
            search made when this plan was generated; they can change.{' '}
          </>
        ) : null}
        {demoParts.length ? (
          <>
            <strong className="font-semibold">{demoParts.join(', ')}</strong>{' '}
            {demoParts.length === 1 ? 'is' : 'are'} demo or template content.{' '}
          </>
        ) : null}
        Food, transport, activities and miscellaneous are always estimates. Nothing can be booked
        here.
      </>
    )
  }

  const warnings = meta?.warnings ?? []

  return (
    <div role="note" className="flex flex-col gap-2 rounded-2xl border border-coral/40 bg-coral/10 px-5 py-3">
      <div className="flex items-start gap-3">
        <FlaskConical className="mt-0.5 size-5 shrink-0 text-coral" aria-hidden="true" />
        <p className="text-sm leading-relaxed text-foreground">
          <Badge className="mr-2 bg-coral text-coral-foreground">{badge}</Badge>
          {body}
        </p>
      </div>
      {meta && meta.source !== 'frontend-demo' ? (
        <p className="ml-8 text-xs leading-snug text-muted-foreground">
          {meta.savedPlanId ? (
            <>Saved to your account. <a href="/trips" className="font-medium underline underline-offset-2">View My trips</a></>
          ) : signedIn ? (
            'This plan could not be saved to your account.'
          ) : (
            <>Plans are saved only when you’re signed in. <a href="/login" className="font-medium underline underline-offset-2">Sign in</a> to keep this one.</>
          )}
        </p>
      ) : null}
      {warnings.length > 0 ? (
        <ul className="ml-8 flex flex-col gap-1 text-xs leading-snug text-muted-foreground">
          {warnings.map((w) => (
            <li key={w} className="flex items-start gap-1.5">
              <Info className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
              <span>{w}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
