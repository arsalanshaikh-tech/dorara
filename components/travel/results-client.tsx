'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowLeft, Compass, Gauge, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { prewarmServer } from '@/lib/api/client'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/components/ui/toggle-group'
import { RecommendationCard } from '@/components/travel/recommendation-card'
import { CostEstimator } from '@/components/travel/cost-estimator'
import { VisaWidget } from '@/components/travel/visa-widget'
import { ItineraryStepper } from '@/components/travel/itinerary-stepper'
import { InsightsPanel } from '@/components/travel/insights-panel'
import { useConsultStore } from '@/lib/travel/store'

type SortKey = 'match' | 'safety' | 'temp'

export function ResultsClient() {
  const router = useRouter()
  const { recommendation, userName, reset, selectDestination } =
    useConsultStore()
  const [sort, setSort] = useState<SortKey>('match')
  const [saved, setSaved] = useState<Record<string, boolean>>({})

  // Wake a sleeping free-tier backend while the user browses recommendations.
  useEffect(() => {
    prewarmServer()
  }, [])

  const sortedDestinations = useMemo(() => {
    if (!recommendation) return []
    const list = [...recommendation.recommendedDestinations]
    switch (sort) {
      case 'safety':
        return list.sort((a, b) => b.safetyIndex - a.safetyIndex)
      case 'temp':
        return list.sort((a, b) => b.avgTempC - a.avgTempC)
      default:
        return list.sort((a, b) => b.score - a.score)
    }
  }, [recommendation, sort])

  if (!recommendation) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-6 px-4 py-24 text-center">
        <span className="inline-flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Compass className="size-7" />
        </span>
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
            No recommendations yet
          </h1>
          <p className="mt-3 text-pretty text-lg leading-relaxed text-muted-foreground">
            Answer a few quick questions and Dorara will build your personalized
            travel plan.
          </p>
        </div>
        <Button
          asChild
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Link href="/consult?vertical=travel">Start the Travel planner</Link>
        </Button>
      </div>
    )
  }

  const toggleSave = (id: string) =>
    setSaved((prev) => ({ ...prev, [id]: !prev[id] }))

  const handlePlanTrip = (id: string) => {
    selectDestination(id)
    router.push('/trip-planner')
  }

  const handleStartOver = () => {
    reset()
    router.push('/consult?vertical=travel')
  }

  const greetingName = userName?.trim()

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-14">
      {/* Header */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
              <Compass className="size-4" />
              Your travel plan
            </span>
            <h1 className="mt-4 text-balance font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {greetingName ? `${greetingName}, here` : 'Here'} are your top
              destinations
            </h1>
            <p className="mt-3 text-pretty text-lg leading-relaxed text-muted-foreground">
              Ranked to match your budget, interests, and how much safety
              matters to you.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleStartOver}>
              <RotateCcw data-icon="inline-start" />
              Start over
            </Button>
            <Button
              asChild
              variant="ghost"
              className="text-muted-foreground"
            >
              <Link href="/consult?vertical=travel">
                <ArrowLeft data-icon="inline-start" />
                Edit answers
              </Link>
            </Button>
          </div>
        </div>

        {/* Data source + sort bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border/70 bg-secondary/40 px-5 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">
              Data sources:
            </span>
            {recommendation.dataSources.map((src) => (
              <Badge key={src} variant="secondary" className="font-medium">
                {src}
              </Badge>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">
              Sort by
            </span>
            <ToggleGroup
              value={[sort]}
              onValueChange={(v: string[]) =>
                setSort((v[0] as SortKey) ?? 'match')
              }
              variant="outline"
              size="sm"
            >
              <ToggleGroupItem value="match">Best match</ToggleGroupItem>
              <ToggleGroupItem value="safety">Safety</ToggleGroupItem>
              <ToggleGroupItem value="temp">Warmth</ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>
      </div>

      {/* Destination cards */}
      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {sortedDestinations.map((dest, i) => (
          <motion.div
            key={dest.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.08 }}
          >
            <RecommendationCard
              destination={dest}
              rank={i + 1}
              saved={Boolean(saved[dest.id])}
              onToggleSave={toggleSave}
              onPlanTrip={handlePlanTrip}
            />
          </motion.div>
        ))}
      </div>

      {/* Details grid */}
      <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <InsightsPanel
            prosCons={recommendation.prosCons}
            alternatives={recommendation.alternatives}
          />
          <ItineraryStepper steps={recommendation.actionPlan} />
        </div>
        <div className="flex flex-col gap-6">
          <Card className="border-border/70 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-lg">
                <Gauge className="size-5 text-primary" />
                Confidence
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-baseline gap-2">
                <span className="font-display text-3xl font-bold text-foreground">
                  {recommendation.confidenceScore}
                </span>
                <span className="text-sm text-muted-foreground">/ 100</span>
              </div>
              <Progress value={recommendation.confidenceScore} className="h-2" />
              <p className="text-xs leading-relaxed text-muted-foreground">
                Based on how much detail you shared. Answer more questions for an
                even sharper match.
              </p>
            </CardContent>
          </Card>
          <CostEstimator estimate={recommendation.costEstimate} />
          <VisaWidget items={recommendation.visaSummary} />
        </div>
      </div>
    </div>
  )
}
