import {
  BedDouble,
  Bus,
  Coins,
  Lightbulb,
  Plane,
  Ticket,
  Utensils,
  Wallet,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { formatMoney } from '@/lib/travel/trip-planner-format'
import type { BudgetLine, TripPlan } from '@/lib/travel/trip-planner-types'
import { DemoBadge } from './demo-badge'
import { STATUS_STYLES } from './trip-summary'

const LINE_ICONS: Record<BudgetLine['key'], typeof Plane> = {
  flights: Plane,
  accommodation: BedDouble,
  food: Utensils,
  activities: Ticket,
  transport: Bus,
  misc: Coins,
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-xl border border-border/70 bg-secondary/40 p-3">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className={cn('break-words font-display text-base font-bold text-foreground', tone)}>
        {value}
      </dd>
    </div>
  )
}

export function BudgetSection({ plan }: { plan: TripPlan }) {
  const { feasibility: f, budget, effective } = plan
  const status = STATUS_STYLES[f.status]
  const StatusIcon = status.icon
  const money = (n: number) => formatMoney(n, budget.currency)

  const fillPct =
    f.ratio === null ? 0 : Math.max(4, Math.min(100, Math.round(f.ratio * 100)))
  const remaining = f.difference

  return (
    <section id="budget" aria-labelledby="budget-heading" className="scroll-mt-32 flex flex-col gap-6">
      {/* Feasibility */}
      <Card className="border-border/70 shadow-sm">
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2 font-display text-lg">
            <Wallet className="size-5 text-primary" aria-hidden="true" />
            <h2 id="budget-heading">Budget feasibility</h2>
            <DemoBadge>Estimated</DemoBadge>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div
            className={cn('flex items-start gap-3 rounded-xl border p-4', status.bg)}
            role="status"
          >
            <StatusIcon className={cn('mt-0.5 size-5 shrink-0', status.text)} aria-hidden="true" />
            <div className="min-w-0">
              <p className={cn('font-display text-base font-semibold', status.text)}>
                {f.label}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {f.message}
              </p>
            </div>
          </div>

          <dl className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            <Stat
              label="Your budget"
              value={f.budget !== null ? money(f.budget) : 'Not available'}
            />
            <Stat label="Estimated cost" value={money(f.total)} />
            <Stat
              label={remaining !== null && remaining < 0 ? 'Over budget by' : 'Remaining'}
              value={remaining === null ? '—' : money(Math.abs(remaining))}
              tone={
                remaining === null
                  ? undefined
                  : remaining < 0
                    ? 'text-destructive'
                    : 'text-emerald-700'
              }
            />
          </dl>

          {f.ratio !== null ? (
            <div>
              <div
                className="h-2 overflow-hidden rounded-full bg-muted"
                role="img"
                aria-label={`Estimated cost is ${Math.round(f.ratio * 100)} percent of your budget`}
              >
                <div
                  className={cn('h-full rounded-full transition-all', status.bar)}
                  style={{ width: `${fillPct}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {Math.round(f.ratio * 100)}% of your budget (estimate)
              </p>
            </div>
          ) : null}

          {f.suggestions.length > 0 ? (
            <div className="rounded-xl border border-border/70 p-4">
              <h3 className="flex items-center gap-2 font-display text-sm font-semibold text-foreground">
                <Lightbulb className="size-4 text-coral" aria-hidden="true" />
                {f.status === 'above'
                  ? 'Ways to bring the estimate down'
                  : 'Ways to add some breathing room'}
              </h3>
              <ul className="mt-3 flex flex-col gap-3">
                {f.suggestions.map((s) => (
                  <li key={s.id} className="text-sm leading-relaxed">
                    <p className="font-medium text-foreground">{s.title}</p>
                    <p className="text-muted-foreground">{s.detail}</p>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs leading-snug text-muted-foreground">
                Suggestions based on the estimates above — not live availability.
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Breakdown */}
      <Card className="border-border/70 shadow-sm">
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2 font-display text-lg">
            <Coins className="size-5 text-primary" aria-hidden="true" />
            <h2>Budget breakdown</h2>
            <DemoBadge>Estimated</DemoBadge>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {effective.currencyAssumed ? (
            <p className="rounded-lg border border-border bg-secondary/60 px-3 py-2 text-xs leading-snug text-muted-foreground">
              {plan.requirements.budget.currency
                ? `Your currency (${plan.requirements.budget.currency}) isn’t supported for estimates, so amounts are shown in USD.`
                : 'No currency was saved, so estimates are shown in USD.'}
            </p>
          ) : null}

          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">
              Estimated trip cost by category, in {budget.currency}
            </caption>
            <thead className="sr-only">
              <tr>
                <th scope="col">Category</th>
                <th scope="col">Estimated amount</th>
              </tr>
            </thead>
            <tbody>
              {budget.lines.map((line) => {
                const Icon = LINE_ICONS[line.key]
                return (
                  <tr key={line.key} className="border-b border-border/60 align-top last:border-0">
                    <th scope="row" className="py-3 pr-3 text-left font-normal">
                      <span className="flex items-start gap-2.5">
                        <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                        <span className="min-w-0">
                          <span className="block font-medium text-foreground">{line.label}</span>
                          <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                            {line.detail}
                          </span>
                        </span>
                      </span>
                    </th>
                    <td className="whitespace-nowrap py-3 text-right font-medium text-foreground">
                      {money(line.amount)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border">
                <th scope="row" className="pt-3 pr-3 text-left font-display text-base font-semibold text-foreground">
                  Total estimated cost
                </th>
                <td className="whitespace-nowrap pt-3 text-right font-display text-lg font-bold text-foreground">
                  {money(budget.total)}
                </td>
              </tr>
            </tfoot>
          </table>

          <p className="text-xs leading-snug text-muted-foreground">
            {budget.basisNote} Amounts are estimates in {budget.currency}
            {effective.rateNote ? ` — ${effective.rateNote}` : '.'} The planner’s
            estimate model can differ from the one on your results page.
          </p>
        </CardContent>
      </Card>
    </section>
  )
}
