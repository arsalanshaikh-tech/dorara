import Link from 'next/link'
import { Compass, RefreshCw, TriangleAlert } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

type LinkAction = { label: string; href: string }

export function PlannerEmptyState({
  title,
  description,
  primary,
  children,
}: {
  title: string
  description: string
  primary: LinkAction
  children?: React.ReactNode
}) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-6 px-4 py-24 text-center">
      <span className="inline-flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Compass className="size-7" aria-hidden="true" />
      </span>
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
          {title}
        </h1>
        <p className="mt-3 text-pretty text-lg leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      {children}
      <Link
        href={primary.href}
        className={cn(
          buttonVariants({ size: 'lg' }),
          'bg-primary text-primary-foreground hover:bg-primary/90',
        )}
      >
        {primary.label}
      </Link>
    </div>
  )
}

export function PlannerErrorState({
  message,
  onRetry,
  backHref,
}: {
  message: string
  onRetry: () => void
  backHref: string
}) {
  return (
    <Card
      role="alert"
      className="border-destructive/30 shadow-sm"
    >
      <CardContent className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center">
        <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <TriangleAlert className="size-5" aria-hidden="true" />
        </span>
        <div className="flex-1">
          <h2 className="font-display text-lg font-semibold text-foreground">
            We couldn’t load your trip plan
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {message}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={onRetry} size="lg">
            <RefreshCw data-icon="inline-start" />
            Try again
          </Button>
          <Link
            href={backHref}
            className={cn(buttonVariants({ variant: 'outline', size: 'lg' }))}
          >
            Back to recommendations
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}

export function SectionEmptyState({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-secondary/40 px-5 py-8 text-center">
      <p className="font-medium text-foreground">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  )
}

function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader>
        <Skeleton className="h-6 w-48" />
        <Skeleton className="mt-1 h-4 w-72 max-w-full" />
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </CardContent>
    </Card>
  )
}

// Skeletons for the plan-dependent sections while the plan loads.
export function PlannerSkeleton() {
  return (
    <div
      className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">Loading your trip plan…</span>
      <div className="flex flex-col gap-6 lg:col-span-2">
        <CardSkeleton rows={4} />
        <CardSkeleton rows={3} />
        <CardSkeleton rows={3} />
      </div>
      <div className="flex flex-col gap-6">
        <CardSkeleton rows={2} />
        <CardSkeleton rows={4} />
      </div>
    </div>
  )
}
