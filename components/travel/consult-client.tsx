'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { Plane, Sparkles } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { QuestionnaireEngine } from '@/components/travel/questionnaire-engine'
import { AssistantChatPanel } from '@/components/travel/assistant-chat-panel'
import { useConsultStore } from '@/lib/travel/store'
import { generateRecommendation } from '@/lib/travel/mock-engine'
import type { Answers } from '@/lib/travel/types'

export function ConsultClient() {
  const router = useRouter()
  const { userName, setUserName, setRecommendation } = useConsultStore()
  const [generating, setGenerating] = useState(false)

  const handleComplete = (answers: Answers) => {
    setGenerating(true)
    // Simulate an async recommendation request. Swap for a real
    // POST /api/v1/recommendations call later — the shape is identical.
    const rec = generateRecommendation(answers, userName.trim() || null)
    setTimeout(() => {
      setRecommendation(rec)
      router.push('/results')
    }, 1400)
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-14">
      {/* Intro */}
      <div className="flex flex-col gap-4">
        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
          <Plane className="size-4" />
          Travel Planner
        </span>
        <div className="max-w-2xl">
          <h1 className="text-balance font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Let&apos;s plan a trip that fits you
          </h1>
          <p className="mt-3 text-pretty text-lg leading-relaxed text-muted-foreground">
            Answer a few friendly questions and Dorara will recommend
            destinations, estimate costs, and map out your next steps.
          </p>
        </div>
        <div className="max-w-sm">
          <label
            htmlFor="traveller-name"
            className="mb-1.5 block text-sm font-medium text-foreground"
          >
            Your name{' '}
            <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <Input
            id="traveller-name"
            placeholder="e.g. Arsalan"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
          />
        </div>
      </div>

      {/* Two-column layout */}
      <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <QuestionnaireEngine onComplete={handleComplete} />
        <div className="lg:sticky lg:top-24 lg:h-[calc(100vh-8rem)]">
          <AssistantChatPanel />
        </div>
      </div>

      {/* Generating overlay */}
      <AnimatePresence>
        {generating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-navy/70 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              className="flex flex-col items-center gap-4 rounded-2xl bg-card px-10 py-8 text-center shadow-xl"
            >
              <span className="inline-flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Sparkles className="size-7" />
              </span>
              <div>
                <p className="font-display text-lg font-semibold text-foreground">
                  Building your travel plan
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Analyzing destinations, costs, and visas...
                </p>
              </div>
              <Spinner className="size-5 text-primary" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
