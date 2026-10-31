import { FlaskConical, Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// Small, consistent label used on every piece of mock data in the planner.
export function DemoBadge({
  children = 'Demo Data',
  className,
}: {
  children?: React.ReactNode
  className?: string
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'h-5 gap-1 border-coral/50 bg-coral/10 font-semibold text-foreground',
        className,
      )}
    >
      <FlaskConical className="text-coral" aria-hidden="true" />
      {children}
    </Badge>
  )
}

/**
 * Label for an item that came from a real provider search. Deliberately NOT worded as
 * "available", "verified" or "bookable": a search result is a price snapshot, nothing more.
 */
export function LiveBadge({
  children = 'Live search result',
  className,
}: {
  children?: React.ReactNode
  className?: string
}) {
  return (
    <Badge
      variant="outline"
      className={cn('h-5 gap-1 border-primary/40 bg-primary/10 font-semibold text-foreground', className)}
    >
      <Search className="text-primary" aria-hidden="true" />
      {children}
    </Badge>
  )
}

/** Items without a dataSource (mock plans / older payloads) are demo data. */
export const isLiveItem = (item: { dataSource?: 'live' | 'demo' }): boolean => item.dataSource === 'live'

/** Only https links are ever rendered (the backend only forwards provider-supplied URLs). */
export const safeHref = (url?: string): string | undefined =>
  typeof url === 'string' && url.startsWith('https://') ? url : undefined
