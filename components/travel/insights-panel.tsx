'use client'

import { Lightbulb, Minus, Plus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Alternative, ProsCons } from '@/lib/travel/types'

export function InsightsPanel({
  prosCons,
  alternatives,
}: {
  prosCons: ProsCons
  alternatives: Alternative[]
}) {
  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display text-lg">
          <Lightbulb className="size-5 text-primary" />
          Why this fits
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-emerald-600">
              Advantages
            </span>
            <ul className="flex flex-col gap-2">
              {prosCons.advantages.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-foreground">
                  <Plus className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-coral">
              Trade-offs
            </span>
            <ul className="flex flex-col gap-2">
              {prosCons.disadvantages.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-foreground">
                  <Minus className="mt-0.5 size-4 shrink-0 text-coral" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {alternatives.length ? (
          <div className="flex flex-col gap-2 rounded-xl border border-border/70 bg-secondary/40 p-4">
            <span className="text-sm font-semibold text-foreground">
              Alternatives worth a look
            </span>
            <ul className="flex flex-col gap-2">
              {alternatives.map((alt) => (
                <li key={alt.name} className="text-sm">
                  <span className="font-medium text-foreground">
                    {alt.name}
                  </span>
                  <span className="text-muted-foreground">
                    {' — '}
                    {alt.reason}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
