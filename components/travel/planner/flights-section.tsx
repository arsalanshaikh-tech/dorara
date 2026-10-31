import { ExternalLink, Plane, PlaneLanding, PlaneTakeoff } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatMoney, pluralize } from '@/lib/travel/trip-planner-format'
import type { FlightOption, TripPlan } from '@/lib/travel/trip-planner-types'
import { DemoBadge, LiveBadge, isLiveItem, safeHref } from './demo-badge'
import { SectionEmptyState } from './planner-states'

function stopsLabel(stops: number): string {
  return stops === 0 ? 'Nonstop' : pluralize(stops, 'stop')
}

function FlightCard({
  flight,
  currency,
  usedInBudget,
}: {
  flight: FlightOption
  currency: string
  usedInBudget: boolean
}) {
  const live = isLiveItem(flight)
  const href = live ? safeHref(flight.bookingUrl) : undefined
  return (
    <li className="rounded-xl border border-border/70 bg-card p-4">
      <div className="flex flex-wrap items-center gap-1.5">
        {live ? <LiveBadge /> : <DemoBadge>Demo Data</DemoBadge>}
        <Badge variant="secondary" className="font-medium">
          {stopsLabel(flight.stops)}
        </Badge>
        {usedInBudget ? (
          <Badge variant="secondary" className="font-medium">
            Used in budget estimate
          </Badge>
        ) : null}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto] md:items-center">
        <div className="min-w-0">
          <p className="font-display text-base font-semibold text-foreground">
            {flight.airline}
          </p>
          <div className="mt-3 flex items-center gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <PlaneTakeoff className="size-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{flight.originLabel}</span>
              </p>
              <p className="font-display text-lg font-bold text-foreground">
                {flight.departureTime}
              </p>
            </div>
            <div className="flex min-w-16 flex-1 flex-col items-center text-xs text-muted-foreground">
              <span>{flight.durationLabel}</span>
              <span className="my-1 flex w-full items-center gap-1" aria-hidden="true">
                <span className="h-px flex-1 bg-border" />
                <Plane className="size-3.5 text-primary" />
                <span className="h-px flex-1 bg-border" />
              </span>
              <span>{stopsLabel(flight.stops)}</span>
            </div>
            <div className="min-w-0 text-right">
              <p className="flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
                <PlaneLanding className="size-3.5 shrink-0" aria-hidden="true" />
                {flight.destinationAirport}
              </p>
              <p className="font-display text-lg font-bold text-foreground">
                {flight.arrivalTime}
                {flight.arrivalNote ? (
                  <span className="ml-1 text-xs font-medium text-muted-foreground">
                    {flight.arrivalNote}
                  </span>
                ) : null}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-secondary/60 p-3 md:w-52">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-coral">
            {live ? 'Search result price' : 'Estimated price'}
          </p>
          <p className="mt-1 font-display text-lg font-bold text-foreground">
            {formatMoney(flight.pricePerTraveler, currency)}
            <span className="text-xs font-normal text-muted-foreground">
              {' '}
              / traveler, round trip
            </span>
          </p>
          <p className="mt-1 text-xs leading-snug text-muted-foreground">
            ≈ {formatMoney(flight.totalPrice, currency)} for{' '}
            {pluralize(flight.travelers, 'traveler')}
          </p>
          {live ? (
            <p className="mt-1 text-xs leading-snug text-muted-foreground">
              Snapshot from when this plan was made — it can change. Not a booking.
            </p>
          ) : null}
          {href ? (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 rounded text-xs font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Search on Google Flights
              <ExternalLink className="size-3" aria-hidden="true" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          ) : null}
        </div>
      </div>
    </li>
  )
}

export function FlightsSection({ plan }: { plan: TripPlan }) {
  const flights = plan.flights
  const anyLive = flights.some(isLiveItem)
  const anyDemo = flights.some((x) => !isLiveItem(x))
  return (
    <Card id="flights" className="scroll-mt-32 border-border/70 shadow-sm">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 font-display text-xl">
          <Plane className="size-5 text-primary" aria-hidden="true" />
          <h2>Flight options</h2>
          {anyLive ? <LiveBadge /> : null}
          {anyDemo || flights.length === 0 ? <DemoBadge>Demo Data</DemoBadge> : null}
        </CardTitle>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {anyLive ? (
            <>
              Prices are <strong className="font-semibold text-foreground">search results</strong>{' '}
              (round trip, per traveler, scaled to your party) captured when this plan was
              generated. Times shown are for the outbound flight. Fares change and seat
              availability has not been checked.
            </>
          ) : (
            <>
              Sample flights with <strong className="font-semibold text-foreground">estimated</strong>{' '}
              prices, times, and durations. Airlines shown are fictional placeholders; no
              real schedule, fare, or seat availability has been checked.
            </>
          )}
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {flights.length === 0 ? (
          <SectionEmptyState
            title="No flight options available"
            description="There are no flight options for this trip right now. Try again later or change your trip details."
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {flights.map((f) => (
              <FlightCard
                key={f.id}
                flight={f}
                currency={plan.budget.currency}
                usedInBudget={plan.budget.basis.flightId === f.id}
              />
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">
          {anyLive
            ? 'Nothing here is booked or held. Check the airline or a booking site for the final fare and availability.'
            : 'Booking links aren’t available for demo data. Times are illustrative and ignore time zones.'}
        </p>
      </CardContent>
    </Card>
  )
}
