import { Compass } from 'lucide-react'
import { TravelHeader } from '@/components/travel/travel-header'
import { ConsultClient } from '@/components/travel/consult-client'
import { ButtonLink } from '@/components/auth/button-link'
import { categories } from '@/lib/site-data'

export const metadata = {
  title: 'Travel Planner — Dorara',
  description:
    'Answer a few questions and get AI-guided travel destinations, cost estimates, visa info, and a step-by-step plan.',
}

type SearchParams = Promise<{ vertical?: string }>

export default async function ConsultPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { vertical } = await searchParams

  return (
    <div className="min-h-screen bg-background">
      <TravelHeader />
      {vertical === 'travel' ? (
        <ConsultClient />
      ) : (
        <ComingSoon vertical={vertical} />
      )}
    </div>
  )
}

function ComingSoon({ vertical }: { vertical?: string }) {
  const match = categories.find((c) => c.key === vertical)
  const title = match?.title ?? 'This category'

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-6 px-4 py-24 text-center">
      <span className="inline-flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Compass className="size-7" />
      </span>
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
          {title} is coming soon
        </h1>
        <p className="mt-3 text-pretty text-lg leading-relaxed text-muted-foreground">
          The Travel planner is ready to explore today. More categories are on
          the way — check back shortly.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <ButtonLink href="/consult?vertical=travel" className="w-auto px-5">
          Try the Travel planner
        </ButtonLink>
        <ButtonLink href="/" variant="outline" className="w-auto px-5">
          Back to home
        </ButtonLink>
      </div>
    </div>
  )
}
