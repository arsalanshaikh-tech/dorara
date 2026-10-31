import { Check, Info, Sparkles } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { FitReason, TripPlan } from '@/lib/travel/trip-planner-types'

function ReasonList({
  items,
  icon: Icon,
  iconClass,
  label,
}: {
  items: FitReason[]
  icon: typeof Check
  iconClass: string
  label: string
}) {
  return (
    <ul className="flex flex-col gap-3" aria-label={label}>
      {items.map((r) => (
        <li key={r.id} className="flex items-start gap-2.5 text-sm leading-relaxed">
          <Icon className={`mt-0.5 size-4 shrink-0 ${iconClass}`} aria-hidden="true" />
          <span className="text-foreground/90">{r.text}</span>
        </li>
      ))}
    </ul>
  )
}

export function FitSection({ plan }: { plan: TripPlan }) {
  const { matches, considerations } = plan.fit
  return (
    <Card id="fit" className="scroll-mt-32 border-border/70 shadow-sm">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 font-display text-xl">
          <Sparkles className="size-5 text-primary" aria-hidden="true" />
          <h2>Why this trip fits you</h2>
        </CardTitle>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Based only on the answers you already gave Dorara — nothing is assumed
          about preferences you didn’t select.
        </p>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-3">
          <h3 className="font-display text-base font-semibold text-foreground">
            Why it matches your preferences
          </h3>
          {matches.length > 0 ? (
            <ReasonList
              items={matches}
              icon={Check}
              iconClass="text-emerald-600"
              label="Reasons this trip matches your preferences"
            />
          ) : (
            <p className="rounded-lg border border-dashed border-border bg-secondary/40 px-4 py-5 text-sm leading-relaxed text-muted-foreground">
              Not enough saved preferences to explain the match yet. Answer more
              questions and the reasons will appear here.
            </p>
          )}
        </div>
        <div className="flex flex-col gap-3">
          <h3 className="font-display text-base font-semibold text-foreground">
            Things to consider
          </h3>
          <ReasonList
            items={considerations}
            icon={Info}
            iconClass="text-coral"
            label="Practical things to consider"
          />
        </div>
      </CardContent>
    </Card>
  )
}
