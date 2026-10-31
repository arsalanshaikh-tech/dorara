'use client'

import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { CalendarDays, ChevronDown, Info } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { formatMoney } from '@/lib/travel/trip-planner-format'
import type { ItineraryDay, TripPlan } from '@/lib/travel/trip-planner-types'
import { DemoBadge } from './demo-badge'
import { SectionEmptyState } from './planner-states'

function DayCard({
  day,
  open,
  onToggle,
  currency,
  reduceMotion,
}: {
  day: ItineraryDay
  open: boolean
  onToggle: () => void
  currency: string
  reduceMotion: boolean
}) {
  const panelId = `itinerary-day-${day.day}`
  const perPerson = day.activities.reduce((s, a) => s + (a.estimatedCost ?? 0), 0)

  return (
    <li className="rounded-xl border border-border/70 bg-card">
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left outline-none transition-colors hover:bg-secondary/50 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <span
            className={cn(
              'flex size-10 shrink-0 flex-col items-center justify-center rounded-full text-[10px] font-semibold uppercase leading-none',
              open ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground',
            )}
            aria-hidden="true"
          >
            Day
            <span className="mt-0.5 font-display text-sm">{day.day}</span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-display text-base font-semibold text-foreground">
              <span className="sr-only">{`Day ${day.day}: `}</span>
              {day.title}
            </span>
            <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <Badge variant="secondary" className="font-medium">
                {day.theme}
              </Badge>
              {day.dateLabel ? <span>{day.dateLabel}</span> : null}
              <span>
                {day.activities.length}{' '}
                {day.activities.length === 1 ? 'activity' : 'activities'}
              </span>
              {perPerson > 0 ? (
                <span>≈ {formatMoney(perPerson, currency)} pp (est.)</span>
              ) : null}
            </span>
          </span>
          <ChevronDown
            className={cn(
              'size-5 shrink-0 text-muted-foreground transition-transform',
              open && 'rotate-180',
            )}
            aria-hidden="true"
          />
        </button>
      </h3>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="panel"
            id={panelId}
            initial={reduceMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.25 }}
            className="overflow-hidden"
          >
            <ol className="flex flex-col gap-4 border-t border-border/70 px-4 py-4">
              {day.activities.map((act) => (
                <li key={act.id} className="flex gap-3">
                  <span className="w-16 shrink-0 pt-0.5 text-xs font-semibold text-primary sm:w-20 sm:text-sm">
                    {act.time}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground">{act.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {act.description}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      {act.estimatedCost !== undefined ? (
                        <span className="text-xs font-medium text-foreground">
                          {act.estimatedCost === 0
                            ? 'Free'
                            : `≈ ${formatMoney(act.estimatedCost, currency)} per person`}
                          {act.estimatedCost > 0 ? (
                            <span className="ml-1 font-normal text-muted-foreground">
                              (estimated)
                            </span>
                          ) : null}
                        </span>
                      ) : null}
                      {act.matchedInterests.map((i) => (
                        <Badge key={i} variant="outline" className="font-medium">
                          {i}
                        </Badge>
                      ))}
                    </div>
                    {act.bookAheadNote ? (
                      <p className="mt-2 flex items-start gap-1.5 text-xs leading-snug text-muted-foreground">
                        <Info className="mt-px size-3.5 shrink-0 text-coral" aria-hidden="true" />
                        {act.bookAheadNote}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </li>
  )
}

export function ItinerarySection({ plan }: { plan: TripPlan }) {
  const reduceMotion = useReducedMotion() ?? false
  const [open, setOpen] = useState<Set<number>>(() => new Set([1]))
  const days = plan.itinerary
  const allOpen = days.length > 0 && days.every((d) => open.has(d.day))

  const toggle = (n: number) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(n)) next.delete(n)
      else next.add(n)
      return next
    })

  const interests = plan.requirements.interests

  return (
    <Card id="itinerary" className="scroll-mt-32 border-border/70 shadow-sm">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex flex-wrap items-center gap-2 font-display text-xl">
              <CalendarDays className="size-5 text-primary" aria-hidden="true" />
              <h2>Personalized itinerary</h2>
              <Badge className="bg-coral text-coral-foreground">
                {plan.meta.itinerarySource === 'ai' ? 'AI-generated itinerary' : 'Sample Itinerary'}
              </Badge>
            </CardTitle>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              A {days.length}-day {plan.meta.itinerarySource === 'ai' ? 'AI-generated' : 'template'} itinerary
              {interests.length > 0
                ? ` tailored to your selected interests: ${interests.join(', ')}.`
                : '.'}{' '}
              {plan.meta.itinerarySource === 'ai'
                ? 'Written by AI from your answers — check opening hours and details yourself. Cost figures are estimates from a fixed rules table, not quotes.'
                : 'Activities and costs are illustrative sample content, not a confirmed schedule.'}
            </p>
          </div>
          {days.length > 1 ? (
            <Button
              variant="outline"
              onClick={() =>
                setOpen(allOpen ? new Set() : new Set(days.map((d) => d.day)))
              }
            >
              {allOpen ? 'Collapse all' : 'Expand all'}
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {days.length === 0 ? (
          <SectionEmptyState
            title="No itinerary available"
            description="We couldn’t build sample days for this trip. Try adjusting the duration in the What if? panel."
          />
        ) : (
          <ol className="flex flex-col gap-3">
            {days.map((day) => (
              <DayCard
                key={day.day}
                day={day}
                open={open.has(day.day)}
                onToggle={() => toggle(day.day)}
                currency={plan.budget.currency}
                reduceMotion={reduceMotion}
              />
            ))}
          </ol>
        )}
        {plan.effective.durationCapped ? (
          <p className="text-xs text-muted-foreground">
            Your saved trip is longer than the planner supports, so only the first{' '}
            {days.length} days are shown.
          </p>
        ) : null}
        <div className="flex items-center gap-2 pt-1">
          <DemoBadge>{plan.meta.itinerarySource === 'ai' ? 'AI-generated · estimates' : 'Demo content'}</DemoBadge>
          <span className="text-xs text-muted-foreground">
            Per-person (pp) activity prices are estimates.
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
