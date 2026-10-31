import { TravelHeader } from '@/components/travel/travel-header'
import { TripPlannerClient } from '@/components/travel/planner/trip-planner-client'

export const metadata = {
  title: 'Trip Planner — Dorara',
  description:
    'A personalized trip plan with itinerary, stays, flights, and budget estimates built from your travel answers.',
}

export default async function TripPlannerPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string | string[] }>
}) {
  const { saved } = await searchParams
  // Only a well-formed id is ever passed on (the server also validates ownership).
  const savedId = typeof saved === 'string' && /^[a-f\d]{24}$/i.test(saved) ? saved : undefined
  return (
    <div className="min-h-screen bg-background">
      <TravelHeader />
      <TripPlannerClient savedId={savedId} />
    </div>
  )
}
