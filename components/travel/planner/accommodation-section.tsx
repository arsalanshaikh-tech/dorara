import { BedDouble, ExternalLink, MapPin, Star } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatMoney, pluralize } from '@/lib/travel/trip-planner-format'
import type { AccommodationOption, TripPlan } from '@/lib/travel/trip-planner-types'
import { DemoBadge, LiveBadge, isLiveItem, safeHref } from './demo-badge'
import { SectionEmptyState } from './planner-states'

function StayCard({
  stay,
  currency,
  usedInBudget,
}: {
  stay: AccommodationOption
  currency: string
  usedInBudget: boolean
}) {
  const live = isLiveItem(stay)
  const image = live ? safeHref(stay.imageUrl) : undefined
  const href = live ? safeHref(stay.bookingUrl) : undefined
  return (
    <li className="overflow-hidden rounded-xl border border-border/70 bg-card sm:flex">
      {image ? (
        // Provider thumbnail from the search response (never a stock photo).
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt={`Photo of ${stay.name}`}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="h-36 w-full object-cover sm:h-auto sm:w-40 sm:shrink-0"
        />
      ) : (
        // Placeholder only — no photo was provided for this option.
        <div
          className="flex h-28 items-center justify-center bg-gradient-to-br from-secondary to-accent sm:h-auto sm:w-40 sm:shrink-0"
          role="img"
          aria-label="Placeholder image — no property photo available"
        >
          <div className="flex flex-col items-center gap-1 text-muted-foreground">
            <BedDouble className="size-7" aria-hidden="true" />
            <span className="text-[10px] font-medium uppercase tracking-wide">
              Placeholder image
            </span>
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-3 p-4 md:flex-row md:justify-between md:gap-5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {live ? <LiveBadge /> : <DemoBadge>Demo Data</DemoBadge>}
            {usedInBudget ? (
              <Badge variant="secondary" className="font-medium">
                Used in budget estimate
              </Badge>
            ) : null}
          </div>
          <h3 className="mt-2 font-display text-base font-semibold text-foreground">
            {stay.name}
          </h3>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
            {stay.location}
          </p>
          {stay.rating !== undefined ? (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Star className="size-3.5 shrink-0 text-coral" aria-hidden="true" />
              <span className="font-medium text-foreground">{stay.rating.toFixed(1)}</span>
              <span className="text-xs">{live ? 'rating from search' : 'demo rating'}</span>
            </p>
          ) : null}
          <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Facilities">
            {stay.facilities.map((f) => (
              <li key={f}>
                <Badge variant="secondary" className="font-medium">
                  {f}
                </Badge>
              </li>
            ))}
          </ul>
          {stay.cancellation ? (
            <p className="mt-3 text-xs leading-snug text-muted-foreground">
              {stay.cancellation}
            </p>
          ) : null}
        </div>

        <div className="shrink-0 rounded-lg bg-secondary/60 p-3 md:w-48 md:self-start">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-coral">
            {live ? 'Search result price' : 'Estimated price'}
          </p>
          <p className="mt-1 font-display text-lg font-bold text-foreground">
            {formatMoney(stay.pricePerNight, currency)}
            <span className="text-xs font-normal text-muted-foreground"> / night</span>
          </p>
          {stay.nights > 0 ? (
            <p className="mt-1 text-xs leading-snug text-muted-foreground">
              ≈ {formatMoney(stay.totalPrice, currency)} total ·{' '}
              {pluralize(stay.nights, 'night')} × {pluralize(stay.rooms, 'room')}
            </p>
          ) : (
            <p className="mt-1 text-xs leading-snug text-muted-foreground">
              No overnight stay in a 1-day trip.
            </p>
          )}
          {live ? (
            <p className="mt-1 text-xs leading-snug text-muted-foreground">
              Snapshot from when this plan was made — it can change. Availability not checked.
            </p>
          ) : null}
          {href ? (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 rounded text-xs font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Property website
              <ExternalLink className="size-3" aria-hidden="true" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          ) : null}
        </div>
      </div>
    </li>
  )
}

export function AccommodationSection({ plan }: { plan: TripPlan }) {
  const stays = plan.accommodations
  const anyLive = stays.some(isLiveItem)
  const anyDemo = stays.some((x) => !isLiveItem(x))
  return (
    <Card id="stays" className="scroll-mt-32 border-border/70 shadow-sm">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 font-display text-xl">
          <BedDouble className="size-5 text-primary" aria-hidden="true" />
          <h2>Accommodation options</h2>
          {anyLive ? <LiveBadge /> : null}
          {anyDemo || stays.length === 0 ? <DemoBadge>Demo Data</DemoBadge> : null}
        </CardTitle>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {anyLive ? (
            <>
              Prices are <strong className="font-semibold text-foreground">search results</strong>{' '}
              for one room per night, captured when this plan was generated. Availability and
              cancellation terms have not been checked — confirm them on the property’s own site.
            </>
          ) : (
            <>
              Sample stays with <strong className="font-semibold text-foreground">estimated</strong>{' '}
              prices. These are not real listings, and no availability has been checked.
            </>
          )}
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {stays.length === 0 ? (
          <SectionEmptyState
            title="No accommodation options available"
            description="There are no stays to show for this trip right now. Try again later or change your trip details."
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {stays.map((stay) => (
              <StayCard
                key={stay.id}
                stay={stay}
                currency={plan.budget.currency}
                usedInBudget={plan.budget.basis.accommodationId === stay.id}
              />
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">
          {anyLive
            ? 'Nothing here is booked or held. Property links, when shown, go to the property’s own website.'
            : 'Booking links aren’t available for demo data.'}
        </p>
      </CardContent>
    </Card>
  )
}
