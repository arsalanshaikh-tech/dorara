import type { TripPlan } from '@/lib/travel/trip-planner-types'

/** Optional destination hero photo with the attribution Pexels requires. */
export function HeroImage({ hero, name }: { hero: NonNullable<TripPlan['destination']['heroImage']>; name: string }) {
  if (!hero.url.startsWith('https://')) return null
  return (
    <figure className="overflow-hidden rounded-2xl border border-border/70">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={hero.url} alt={`${name}`} loading="lazy" referrerPolicy="no-referrer" className="h-48 w-full object-cover sm:h-64" />
      <figcaption className="bg-card px-4 py-2 text-xs text-muted-foreground">
        Photo by{' '}
        {hero.photographerUrl?.startsWith('https://') ? (
          <a href={hero.photographerUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
            {hero.photographer || 'photographer'}
          </a>
        ) : (
          hero.photographer || 'photographer'
        )}{' '}
        on{' '}
        <a href={hero.sourceUrl?.startsWith('https://') ? hero.sourceUrl : 'https://www.pexels.com'} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
          Pexels
        </a>
      </figcaption>
    </figure>
  )
}
