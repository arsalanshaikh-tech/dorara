'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Answers, AnswerValue, Recommendation } from './types'

type ConsultState = {
  userName: string
  answers: Answers
  currentStep: number
  recommendation: Recommendation | null
  /** Destination chosen via "Plan My Trip". Only the id is stored. */
  selectedDestinationId: string | null
  setUserName: (name: string) => void
  setAnswer: (id: string, value: AnswerValue) => void
  setStep: (step: number) => void
  setRecommendation: (rec: Recommendation | null) => void
  selectDestination: (id: string | null) => void
  reset: () => void
}

// Client-side draft persistence so users can resume the questionnaire and
// revisit their generated recommendation. This is a frontend-only draft cache,
// not a substitute for a real backend.
export const useConsultStore = create<ConsultState>()(
  persist(
    (set) => ({
      userName: '',
      answers: {},
      currentStep: 0,
      recommendation: null,
      selectedDestinationId: null,
      setUserName: (name) => set({ userName: name }),
      setAnswer: (id, value) =>
        set((state) => ({ answers: { ...state.answers, [id]: value } })),
      setStep: (step) => set({ currentStep: step }),
      // A new recommendation invalidates any earlier destination choice.
      setRecommendation: (rec) =>
        set({ recommendation: rec, selectedDestinationId: null }),
      selectDestination: (id) => set({ selectedDestinationId: id }),
      reset: () =>
        set({
          answers: {},
          currentStep: 0,
          recommendation: null,
          selectedDestinationId: null,
        }),
    }),
    { name: 'dorara-travel-consult' },
  ),
)
