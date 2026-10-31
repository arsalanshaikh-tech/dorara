'use client'

import { useState } from 'react'
import { Clock, ListChecks } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import type { ActionStep } from '@/lib/travel/types'

export function ItineraryStepper({ steps }: { steps: ActionStep[] }) {
  const [done, setDone] = useState<Record<number, boolean>>({})
  const completed = Object.values(done).filter(Boolean).length

  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center justify-between font-display text-lg">
          <span className="flex items-center gap-2">
            <ListChecks className="size-5 text-primary" />
            Your action plan
          </span>
          <span className="text-sm font-normal text-muted-foreground">
            {completed}/{steps.length} done
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="flex flex-col">
          {steps.map((step, i) => {
            const isDone = done[step.stepNumber]
            const isLast = i === steps.length - 1
            return (
              <li key={step.stepNumber} className="flex gap-4">
                {/* Timeline rail */}
                <div className="flex flex-col items-center">
                  <span
                    className={cn(
                      'flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors',
                      isDone
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-muted-foreground',
                    )}
                  >
                    {step.stepNumber}
                  </span>
                  {!isLast ? (
                    <span className="my-1 w-px flex-1 bg-border" />
                  ) : null}
                </div>

                <div className={cn('flex-1 pb-6', isLast && 'pb-0')}>
                  <label className="flex cursor-pointer items-start gap-3">
                    <Checkbox
                      checked={isDone}
                      onCheckedChange={(v) =>
                        setDone((prev) => ({
                          ...prev,
                          [step.stepNumber]: Boolean(v),
                        }))
                      }
                      className="mt-0.5"
                    />
                    <span className="flex flex-col gap-1">
                      <span
                        className={cn(
                          'font-medium text-foreground',
                          isDone && 'text-muted-foreground line-through',
                        )}
                      >
                        {step.title}
                      </span>
                      <span className="text-sm leading-relaxed text-muted-foreground">
                        {step.details}
                      </span>
                      <span className="mt-0.5 inline-flex w-fit items-center gap-1.5 text-xs font-medium text-primary">
                        <Clock className="size-3.5" />
                        {step.eta}
                      </span>
                    </span>
                  </label>
                </div>
              </li>
            )
          })}
        </ol>
      </CardContent>
    </Card>
  )
}
