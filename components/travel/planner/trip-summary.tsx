import {
  CalendarDays,
  CircleAlert,
  CircleCheck,
  Clock,
  Info,
  MapPin,
  Plane,
  TriangleAlert,
  Users,
  Wallet,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { formatDateRange, formatMoney } from '@/lib/travel/trip-planner-format'
import type { FeasibilityStatus, TripPlan } from '@/lib/travel/trip-planner-types'

export const STATUS_STYLES: Record<
  FeasibilityStatus,
  { text: string; bg: string; bar: string; icon: typeof CircleCheck }
> = {
  within: {
    text: 'text-emerald-700',
    bg: 'bg-emerald-500/10 border-emerald-500/30',
    bar: 'bg-emerald-500',
    icon: CircleCheck,
  },
  close: {
    text: 'text-amber-700',
    bg: 'bg-amber-500/10 border-amber-500/30',
    bar: 'bg-amber-500',
    icon: CircleAlert,
  },
  above: {
    text: 'text-destructive',
    bg: 'bg-destructive/10 border-destructive/30',
    bar: 'bg-destructive',
    icon: TriangleAlert,
  },
  unknown: {
    text: 'text-muted-foreground',
    bg: 'bg-secondary border-border',
    bar: 'bg-muted-foreground/40',
    icon: Info,
  },
}

function Item({
  icon: Icon,
  label,
  value,
  note,
}: {
  icon: typeof MapPin
  label: string
  value: string | null
  note?: string
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </dt>
        <dd
          className={cn(
            'mt-0.5 break-words text-sm font-semibold text-foreground',
            value === null && 'font-normal italic text-muted-foreground',
          )}
        >
          {value ?? 'Not provided'}
        </dd>
        {note ? (
          <dd className="mt-0.5 text-xs leading-snug text-muted-foreground">
            {note}
          </dd>
        ) : null}
      </div>
    </div>
  )
}

export function TripSummary({
  plan,
  adjusted,
}: {
  plan: TripPlan
  adjusted: { budget: boolean; duration: boolean }
}) {
  const { requirements: req, effective: eff, destination, feasibility } = plan

  const dates = formatDateRange(req.dates.start, req.dates.end)

  const travelers = req.partyLabel
    ? `${req.partyLabel} · ${eff.travelers} ${eff.travelers === 1 ? 'traveler' : 'travelers'}`
    : null
  const travelersNote = eff.travelersAssumed
    ? req.partyLabel
      ? 'Group size assumed for estimates'
      : 'Assumed 1 traveler for estimates'
    : undefined

  let budgetValue: string | null = null
  let budgetNote: string | undefined
  if (eff.budget !== null) {
    budgetValue = `${formatMoney(eff.budget, eff.currency)} · ${eff.currency}`
    if (adjusted.budget) budgetNote = 'Adjusted in What if?'
  } else if (req.budget.amount !== null) {
    budgetValue = req.budget.amount.toLocaleString()
    budgetNote = req.budget.currency
      ? `Currency “${req.budget.currency}” isn’t supported for estimates`
      : 'No currency saved'
  }

  const durationNotes: string[] = []
  if (eff.durationAssumed) durationNotes.push('No length saved — 7 days assumed')
  if (eff.durationCapped) durationNotes.push('Plan covers the first 21 days')
  if (adjusted.duration) durationNotes.push('Adjusted in What if?')

  const status = STATUS_STYLES[feasibility.status]
  const StatusIcon = status.icon

  return (
    <Card className="overflow-hidden border-border/70 p-0 shadow-sm">
      <div className="relative h-28 overflow-hidden sm:h-36">
        <img
          src={destination.imageRef || '/placeholder.svg'}
          alt=""
          aria-hidden="true"
          className="size-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-navy/75 via-navy/20 to-transparent" />
        <div className="absolute inset-x-4 bottom-3 flex flex-wrap items-center gap-2">
          <Badge className="bg-coral text-coral-foreground">
            {plan.meta.source === 'frontend-demo'
              ? 'Sample plan · Demo preview'
              : plan.meta.isDemo
                ? 'Includes demo data & estimates'
                : 'Live search prices · estimates'}
          </Badge>
          <Badge variant="secondary" className="bg-background/85 text-foreground">
            <MapPin aria-hidden="true" />
            {destination.name}
          </Badge>
        </div>
      </div>

      <CardContent className="flex flex-col gap-6 p-5 sm:p-6">
        <h2 className="sr-only">Trip summary</h2>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
          <Item icon={MapPin} label="Destination" value={destination.name} />
          <Item icon={Plane} label="Departing from" value={req.departureLocation} />
          <Item icon={CalendarDays} label="Travel dates" value={dates} note={dates ? undefined : 'Dates or preferred month not provided'} />
          <Item icon={Users} label="Travelers" value={travelers} note={travelersNote} />
          <Item
            icon={Clock}
            label="Duration"
            value={`${eff.durationDays} ${eff.durationDays === 1 ? 'day' : 'days'}`}
            note={durationNotes.join(' · ') || undefined}
          />
          <Item icon={Wallet} label="Budget" value={budgetValue} note={budgetNote} />
        </dl>

        {/* Always-visible budget status with a jump link. */}
        <div
          className={cn(
            'flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3',
            status.bg,
          )}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <StatusIcon className={cn('size-5 shrink-0', status.text)} aria-hidden="true" />
            <div className="min-w-0">
              <p className={cn('font-display text-sm font-semibold', status.text)}>
                {feasibility.label}
              </p>
              <p className="text-xs leading-snug text-muted-foreground">
                Estimated total {formatMoney(plan.budget.total, plan.budget.currency)}{' '}
                <span className="font-medium">(estimate)</span>
              </p>
            </div>
          </div>
          <a
            href="#budget"
            className="rounded-md text-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            See budget details
          </a>
        </div>

        {req.interests.length > 0 || req.weather.length > 0 ? (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Saved preferences used
            </p>
            <ul className="flex flex-wrap gap-1.5">
              {[...req.interests, ...req.weather].map((tag) => (
                <li key={tag}>
                  <Badge variant="secondary" className="font-medium">
                    {tag}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
