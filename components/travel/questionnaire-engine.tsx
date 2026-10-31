'use client'

import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Check, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent } from '@/components/ui/card'
import { QuestionField } from '@/components/travel/question-field'
import { travelQuestionnaire } from '@/lib/travel/questionnaire'
import { validateAnswer } from '@/lib/travel/validation'
import { useConsultStore } from '@/lib/travel/store'
import { formatAnswer } from '@/lib/travel/format'
import type { Answers } from '@/lib/travel/types'

type Props = {
  onComplete: (answers: Answers) => void
}

const steps = travelQuestionnaire.steps
const totalStops = steps.length + 1 // + summary

export function QuestionnaireEngine({ onComplete }: Props) {
  const { answers, currentStep, setAnswer, setStep } = useConsultStore()
  const [error, setError] = useState<string | null>(null)
  const [direction, setDirection] = useState(1)

  const isSummary = currentStep >= steps.length
  const question = steps[currentStep]
  const progress = Math.round((currentStep / totalStops) * 100)

  const summaryRows = useMemo(
    () =>
      steps.map((s) => ({
        id: s.id,
        label: s.label,
        value: formatAnswer(s, answers[s.id]),
      })),
    [answers],
  )

  const goNext = () => {
    if (!isSummary && question) {
      const err = validateAnswer(question, answers[question.id])
      if (err) {
        setError(err)
        return
      }
    }
    setError(null)
    setDirection(1)
    setStep(Math.min(currentStep + 1, steps.length))
  }

  const goBack = () => {
    setError(null)
    setDirection(-1)
    setStep(Math.max(currentStep - 1, 0))
  }

  const handleSubmit = () => {
    // Validate all required steps before completing.
    for (let i = 0; i < steps.length; i++) {
      const err = validateAnswer(steps[i], answers[steps[i].id])
      if (err) {
        setError(err)
        setStep(i)
        return
      }
    }
    onComplete(answers)
  }

  return (
    <Card className="overflow-hidden border-border/70 shadow-sm">
      <div className="border-b border-border/70 bg-secondary/40 px-6 py-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-foreground">
            {isSummary
              ? 'Review your answers'
              : `Question ${currentStep + 1} of ${steps.length}`}
          </span>
          <span className="text-muted-foreground">{progress}% complete</span>
        </div>
        <Progress value={progress} className="mt-3 h-1.5" />
      </div>

      <CardContent className="p-6">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentStep}
            custom={direction}
            initial={{ opacity: 0, x: direction * 32 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -32 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            {isSummary ? (
              <div className="flex flex-col gap-4">
                <div>
                  <h3 className="font-display text-xl font-semibold text-foreground">
                    Almost there
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Confirm your details, then generate your personalized plan.
                  </p>
                </div>
                <dl className="divide-y divide-border/70 rounded-xl border border-border/70">
                  {summaryRows.map((row) => (
                    <div
                      key={row.id}
                      className="flex items-start justify-between gap-4 px-4 py-3"
                    >
                      <dt className="text-sm text-muted-foreground">
                        {row.label}
                      </dt>
                      <dd className="max-w-[60%] text-right text-sm font-medium text-foreground">
                        {row.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : (
              <QuestionField
                question={question}
                value={answers[question.id] ?? null}
                error={error ?? undefined}
                onChange={(v) => {
                  setAnswer(question.id, v)
                  if (error) setError(null)
                }}
              />
            )}
          </motion.div>
        </AnimatePresence>

        <div className="mt-8 flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            onClick={goBack}
            disabled={currentStep === 0}
            className="text-muted-foreground"
          >
            <ArrowLeft data-icon="inline-start" />
            Back
          </Button>

          {isSummary ? (
            <Button
              onClick={handleSubmit}
              className="bg-coral text-coral-foreground hover:bg-coral/90"
            >
              <Sparkles data-icon="inline-start" />
              {travelQuestionnaire.submitLabel}
            </Button>
          ) : (
            <Button
              onClick={goNext}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {currentStep === steps.length - 1 ? 'Review' : 'Next'}
              {currentStep === steps.length - 1 ? (
                <Check data-icon="inline-end" />
              ) : (
                <ArrowRight data-icon="inline-end" />
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
