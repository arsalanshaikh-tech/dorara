'use client'

import {
  Bookmark,
  BookmarkCheck,
  MapPin,
  Route,
  ShieldCheck,
  Thermometer,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { RecommendedDestination } from '@/lib/travel/types'

type Props = {
  destination: RecommendedDestination
  rank: number
  saved: boolean
  onToggleSave: (id: string) => void
  /** When provided, shows a "Plan My Trip" action for this destination. */
  onPlanTrip?: (id: string) => void
}

export function RecommendationCard({
  destination,
  rank,
  saved,
  onToggleSave,
  onPlanTrip,
}: Props) {
  return (
    <Card className="group overflow-hidden border-border/70 p-0 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
      <div className="relative aspect-[16/10] overflow-hidden">
        <img
          src={destination.imageRef || '/placeholder.svg'}
          alt={destination.name}
          className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-navy/70 via-navy/10 to-transparent" />
        {rank === 1 ? (
          <Badge className="absolute left-3 top-3 bg-coral text-coral-foreground">
            Top match
          </Badge>
        ) : (
          <Badge
            variant="secondary"
            className="absolute left-3 top-3 bg-background/85 text-foreground"
          >
            {`#${rank}`}
          </Badge>
        )}
        <div className="absolute right-3 top-3 flex size-12 flex-col items-center justify-center rounded-full bg-background/90 shadow-sm">
          <span className="font-display text-sm font-bold leading-none text-primary">
            {destination.score}
          </span>
          <span className="text-[9px] font-medium uppercase text-muted-foreground">
            match
          </span>
        </div>
        <div className="absolute inset-x-3 bottom-3 flex items-center gap-1.5 text-navy-foreground">
          <MapPin className="size-4 shrink-0" />
          <h3 className="truncate font-display text-lg font-semibold">
            {destination.name}
          </h3>
        </div>
      </div>

      <CardContent className="flex flex-col gap-4 p-5">
        <p className="text-sm leading-relaxed text-muted-foreground">
          {destination.shortReason}
        </p>

        <div className="flex flex-wrap gap-1.5">
          {destination.primaryTags.map((tag) => (
            <Badge key={tag} variant="secondary" className="font-medium">
              {tag}
            </Badge>
          ))}
        </div>

        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="size-4 text-primary" />
            Safety {destination.safetyIndex}/100
          </span>
          <span className="flex items-center gap-1.5">
            <Thermometer className="size-4 text-coral" />
            {destination.avgTempC}°C avg
          </span>
        </div>

        <div className="mt-1 flex items-center gap-3">
          <Button
            className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => onToggleSave(destination.id)}
          >
            View details
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-pressed={saved}
            aria-label={saved ? 'Remove from saved' : 'Save destination'}
            onClick={() => onToggleSave(destination.id)}
            className={cn(saved && 'border-coral/40 text-coral')}
          >
            {saved ? (
              <BookmarkCheck className="size-4" />
            ) : (
              <Bookmark className="size-4" />
            )}
          </Button>
        </div>

        {onPlanTrip ? (
          <Button
            variant="outline"
            className="w-full border-coral/40 text-coral hover:bg-coral/10 hover:text-coral"
            aria-label={`Plan my trip to ${destination.name}`}
            onClick={() => onPlanTrip(destination.id)}
          >
            <Route data-icon="inline-start" />
            Plan My Trip
          </Button>
        ) : null}
      </CardContent>
    </Card>
  )
}
