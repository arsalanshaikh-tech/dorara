'use client'

import { useEffect, useMemo, useRef } from 'react'
import { motion } from 'framer-motion'
import { Compass } from 'lucide-react'
import { travelQuestionnaire } from '@/lib/travel/questionnaire'
import { useConsultStore } from '@/lib/travel/store'
import { formatAnswer } from '@/lib/travel/format'

const steps = travelQuestionnaire.steps

// Short, friendly next-action prompt per question — mirrors the assistant
// persona from the system prompt (one question at a time, ends with a clear
// next action).
const PROMPTS: Record<string, string> = {
  destination_preference:
    'Where would you like to go — or should I suggest places for you? Pick an option or type a specific place.',
  budget:
    'What is your total budget? Include flights, stay, and daily spend. Example: 1,200 USD or 90,000 INR.',
  dates: 'How long is the trip? Share dates or an approximate number of days.',
  party: 'Who is travelling with you? Choose the option that fits best.',
  age_group: 'Which age group are you in? This helps me tune the pace.',
  weather: 'What weather do you enjoy most? Select all that apply.',
  interest_type:
    'What excites you on a trip? Pick everything that applies — at least one.',
  safety_importance:
    'How much should safety influence your recommendations? Slide from Low to Critical.',
  visa_requirements: 'Where do you stand on visas right now?',
  food_language:
    'Any food or language preferences I should keep in mind? Optional.',
  extra_notes: 'Anything else I should know before I plan? Optional.',
}

type ChatMessage = {
  id: string
  role: 'assistant' | 'user'
  text: string
}

export function AssistantChatPanel() {
  const { userName, answers, currentStep } = useConsultStore()
  const scrollRef = useRef<HTMLDivElement>(null)

  const greetingName = userName?.trim() || 'traveller'

  const messages = useMemo<ChatMessage[]>(() => {
    const list: ChatMessage[] = [
      {
        id: 'greeting',
        role: 'assistant',
        text: `Hi ${greetingName}, excited to plan your next trip! I'll ask a few quick questions, then build a personalized plan with destinations, costs, and next steps.`,
      },
    ]

    // Replay answered steps as a confirm + question exchange.
    const upTo = Math.min(currentStep, steps.length)
    for (let i = 0; i < upTo; i++) {
      const step = steps[i]
      const answer = answers[step.id]
      const formatted = formatAnswer(step, answer)
      list.push({ id: `q-${step.id}`, role: 'assistant', text: PROMPTS[step.id] })
      if (formatted && formatted !== 'Not provided') {
        list.push({ id: `a-${step.id}`, role: 'user', text: formatted })
      }
    }

    if (currentStep < steps.length) {
      const step = steps[currentStep]
      list.push({
        id: `current-${step.id}`,
        role: 'assistant',
        text: PROMPTS[step.id],
      })
    } else {
      list.push({
        id: 'summary',
        role: 'assistant',
        text: "That's everything I need. Review your answers, then tap Find best destinations and I'll put your plan together.",
      })
    }

    return list
  }, [answers, currentStep, greetingName])

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages.length])

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
      <div className="flex items-center gap-3 border-b border-border/70 bg-navy px-5 py-4 text-navy-foreground">
        <span className="inline-flex size-10 items-center justify-center rounded-full bg-primary/20 text-primary">
          <Compass className="size-5" />
        </span>
        <div className="leading-tight">
          <p className="font-display text-sm font-semibold">
            Dorara Travel Consultant
          </p>
          <p className="text-xs text-navy-foreground/60">
            Warm, data-driven trip guidance
          </p>
        </div>
        <span className="ml-auto flex items-center gap-1.5 text-xs text-navy-foreground/70">
          <span className="size-2 rounded-full bg-emerald-400" />
          Online
        </span>
      </div>

      <div
        ref={scrollRef}
        className="flex flex-1 flex-col gap-3 overflow-y-auto p-5"
      >
        {messages.map((m, i) => (
          <motion.div
            key={`${m.id}-${i}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className={
              m.role === 'assistant'
                ? 'max-w-[85%] self-start rounded-2xl rounded-tl-sm bg-secondary px-4 py-2.5 text-sm leading-relaxed text-foreground'
                : 'max-w-[85%] self-end rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-sm leading-relaxed text-primary-foreground'
            }
          >
            {m.text}
          </motion.div>
        ))}
      </div>
    </div>
  )
}
