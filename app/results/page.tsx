import { TravelHeader } from '@/components/travel/travel-header'
import { ResultsClient } from '@/components/travel/results-client'

export const metadata = {
  title: 'Your Travel Plan — Dorara',
  description:
    'AI-guided travel recommendations with cost estimates, visa summaries, and a step-by-step action plan.',
}

export default function ResultsPage() {
  return (
    <div className="min-h-screen bg-background">
      <TravelHeader />
      <ResultsClient />
    </div>
  )
}
