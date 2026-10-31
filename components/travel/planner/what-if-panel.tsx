'use client'

import { RotateCcw, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { Spinner } from '@/components/ui/spinner'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { formatMoney } from '@/lib/travel/trip-planner-format'
import type { AdjustmentLimits } from '@/lib/travel/trip-planner-types'
import { DemoBadge } from './demo-badge'

export type WhatIfValues = {
  /** null = use the original saved budget. */
  budget: number | null
  /** null = use the original saved duration. */
  durationDays: number | null
}

export function WhatIfPanel({
  limits,
  currency,
  values,
  onChange,
  onReset,
  isAdjusting,
  error,
}: {
  limits: AdjustmentLimits
  currency: string
  values: WhatIfValues
  onChange: (next: WhatIfValues) => void
  onReset: () => void
  isAdjusting: boolean
  error: string | null
}) {
  const { budgetRange, original, durationOptions } = limits
  const budgetValue = values.budget ?? original.budget
  const durationValue = values.durationDays ?? original.durationDays
  const isAdjusted = values.budget !== null || values.durationDays !== null

  return (
    <Card id="what-if" className="scroll-mt-32 border-border/70 shadow-sm">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 font-display text-lg">
          <SlidersHorizontal className="size-5 text-primary" aria-hidden="true" />
          <h2>What if?</h2>
          <DemoBadge>Estimates</DemoBadge>
        </CardTitle>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          Try a different budget or trip length. The plan is recalculated with the same
          estimate rules and doesn’t change your saved answers.
        </p>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        {/* Budget */}
        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm font-medium text-foreground">Trip budget</span>
            <span className="font-display text-base font-bold text-foreground">
              {budgetValue !== null ? formatMoney(budgetValue, currency) : '—'}
            </span>
          </div>
          {budgetRange && budgetValue !== null ? (
            <>
              <Slider
                min={budgetRange.min}
                max={budgetRange.max}
                step={budgetRange.step}
                value={[Math.min(Math.max(budgetValue, budgetRange.min), budgetRange.max)]}
                onValueChange={(v) => {
                  const next = Array.isArray(v) ? v[0] : (v as number)
                  onChange({
                    ...values,
                    budget: next === original.budget ? null : next,
                  })
                }}
                aria-label="Adjust trip budget"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{formatMoney(budgetRange.min, currency)}</span>
                <span>
                  Original{' '}
                  {original.budget !== null ? formatMoney(original.budget, currency) : ''}
                </span>
                <span>{formatMoney(budgetRange.max, currency)}</span>
              </div>
            </>
          ) : (
            <p className="rounded-lg border border-dashed border-border bg-secondary/40 px-3 py-3 text-xs leading-relaxed text-muted-foreground">
              Budget adjustments are disabled — this needs a saved budget with a
              supported currency. Update your answers to enable them.
            </p>
          )}
        </div>

        {/* Duration */}
        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <span id="whatif-duration-label" className="text-sm font-medium text-foreground">
              Trip length
            </span>
            <span className="font-display text-base font-bold text-foreground">
              {durationValue} {durationValue === 1 ? 'day' : 'days'}
            </span>
          </div>
          <ToggleGroup
            value={[String(durationValue)]}
            onValueChange={(v: string[]) => {
              const picked = Number(v[0])
              if (!Number.isFinite(picked)) return
              onChange({
                ...values,
                durationDays: picked === original.durationDays ? null : picked,
              })
            }}
            variant="outline"
            className="flex-wrap"
            aria-labelledby="whatif-duration-label"
          >
            {durationOptions.map((d) => (
              <ToggleGroupItem
                key={d}
                value={String(d)}
                aria-label={`${d} ${d === 1 ? 'day' : 'days'}`}
              >
                {d}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <p className="text-xs text-muted-foreground">
            Original: {original.durationDays}{' '}
            {original.durationDays === 1 ? 'day' : 'days'}. Changing it rebuilds the
            itinerary and updates stay, flight, food, transport, and activity
            estimates (a new flight or stay search may be needed).
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-xs text-muted-foreground" role="status" aria-live="polite">
            {isAdjusting ? (
              <>
                <Spinner className="size-3.5 text-primary" />
                Updating plan…
              </>
            ) : isAdjusted ? (
              'Adjustments applied (estimates).'
            ) : (
              'Showing your original details.'
            )}
          </p>
          {isAdjusted ? (
            <Button variant="outline" onClick={onReset}>
              <RotateCcw data-icon="inline-start" />
              Reset to original
            </Button>
          ) : null}
        </div>

        {error ? (
          <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
