'use client'

import { Wallet } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { currencySymbol } from '@/lib/travel/mock-engine'
import type { CostEstimate } from '@/lib/travel/types'

export function CostEstimator({ estimate }: { estimate: CostEstimate }) {
  const sym = currencySymbol(estimate.currency)
  const bands = [
    { label: 'Budget', value: estimate.low, tone: 'text-emerald-600' },
    { label: 'Typical', value: estimate.mid, tone: 'text-primary' },
    { label: 'Comfort', value: estimate.high, tone: 'text-coral' },
  ]
  const max = estimate.high || 1

  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display text-lg">
          <Wallet className="size-5 text-primary" />
          Estimated cost
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-3">
          {bands.map((band) => (
            <div
              key={band.label}
              className="flex flex-col gap-1 rounded-xl border border-border/70 bg-secondary/40 p-3"
            >
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {band.label}
              </span>
              <span className={`font-display text-lg font-bold ${band.tone}`}>
                {sym}
                {band.value.toLocaleString()}
              </span>
            </div>
          ))}
        </div>

        {/* Range bar */}
        <div className="relative h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="absolute inset-y-0 rounded-full bg-gradient-to-r from-emerald-400 via-primary to-coral"
            style={{
              left: `${(estimate.low / max) * 100}%`,
              right: 0,
            }}
          />
        </div>

        <p className="text-xs leading-relaxed text-muted-foreground">
          {estimate.notes}
        </p>
      </CardContent>
    </Card>
  )
}
