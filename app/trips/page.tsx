import { TravelHeader } from '@/components/travel/travel-header'
import { TripsClient } from '@/components/trips/trips-client'

export const metadata = {
  title: 'My trips — Dorara',
  description: 'Trip plans you saved to your Dorara account.',
}

export default function TripsPage() {
  return (
    <div className="min-h-screen bg-background">
      <TravelHeader />
      <TripsClient />
    </div>
  )
}
