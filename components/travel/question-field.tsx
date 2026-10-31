'use client'

import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { AirportAutocomplete } from '@/components/travel/airport-autocomplete'
import { Slider } from '@/components/ui/slider'
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/components/ui/toggle-group'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
} from '@/components/ui/field'
import type {
  AnswerValue,
  BudgetAnswer,
  DatesAnswer,
  Question,
} from '@/lib/travel/types'

const CURRENCIES = ['USD', 'INR', 'EUR', 'GBP', 'AUD', 'CAD']

type Props = {
  question: Question
  value: AnswerValue
  error?: string
  onChange: (value: AnswerValue) => void
}

export function QuestionField({ question, value, error, onChange }: Props) {
  const invalid = Boolean(error)

  return (
    <Field data-invalid={invalid || undefined}>
      <FieldContent>
        <FieldLabel className="font-display text-lg font-semibold text-foreground">
          {question.label}
          {question.validation?.required ? (
            <span className="text-coral" aria-hidden="true">
              {' *'}
            </span>
          ) : null}
        </FieldLabel>
        {question.help ? (
          <FieldDescription>{question.help}</FieldDescription>
        ) : null}
      </FieldContent>

      <div className="mt-1 w-full">
        <QuestionControl
          question={question}
          value={value}
          onChange={onChange}
          invalid={invalid}
        />
      </div>

      <FieldError>{error}</FieldError>
    </Field>
  )
}

function QuestionControl({
  question,
  value,
  onChange,
  invalid,
}: {
  question: Question
  value: AnswerValue
  onChange: (value: AnswerValue) => void
  invalid: boolean
}) {
  switch (question.type) {
    case 'single_choice_or_text': {
      const current = typeof value === 'string' ? value : ''
      const isPreset = question.options?.includes(current)
      return (
        <div className="flex flex-col gap-3">
          <ToggleGroup
            value={isPreset ? [current] : []}
            onValueChange={(v: string[]) => onChange(v[0] ?? '')}
            variant="outline"
            className="flex-wrap"
            aria-label={question.label}
          >
            {question.options?.map((opt) => (
              <ToggleGroupItem key={opt} value={opt}>
                {opt}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <Input
            placeholder="Or type a specific place, e.g. Tokyo, Japan"
            value={isPreset ? '' : current}
            aria-invalid={invalid}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      )
    }

    case 'range_currency': {
      const budget = (value as BudgetAnswer) ?? {
        min: null,
        max: null,
        currency: 'USD',
      }
      const setBudget = (patch: Partial<BudgetAnswer>) =>
        onChange({ ...budget, ...patch })
      return (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              placeholder="Min (optional)"
              aria-label="Minimum budget"
              value={budget.min ?? ''}
              onChange={(e) =>
                setBudget({
                  min: e.target.value === '' ? null : Number(e.target.value),
                })
              }
            />
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              placeholder="Max total budget"
              aria-label="Maximum budget"
              aria-invalid={invalid}
              value={budget.max ?? ''}
              onChange={(e) =>
                setBudget({
                  max: e.target.value === '' ? null : Number(e.target.value),
                })
              }
            />
          </div>
          <ToggleGroup
            value={[budget.currency]}
            onValueChange={(v: string[]) =>
              setBudget({ currency: v[0] ?? budget.currency })
            }
            variant="outline"
            size="sm"
            className="flex-wrap"
            aria-label="Currency"
          >
            {CURRENCIES.map((c) => (
              <ToggleGroupItem key={c} value={c}>
                {c}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      )
    }

    case 'date_range': {
      const dates = (value as DatesAnswer) ?? {
        start: null,
        end: null,
        durationDays: null,
      }
      const setDates = (patch: Partial<DatesAnswer>) =>
        onChange({ ...dates, ...patch })
      return (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                Start date
              </span>
              <Input
                type="date"
                aria-label="Start date"
                value={dates.start ?? ''}
                onChange={(e) =>
                  setDates({ start: e.target.value || null })
                }
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                End date
              </span>
              <Input
                type="date"
                aria-label="End date"
                value={dates.end ?? ''}
                onChange={(e) => setDates({ end: e.target.value || null })}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              or approx. duration
            </span>
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              max={365}
              placeholder="days"
              aria-label="Duration in days"
              className="w-28"
              value={dates.durationDays ?? ''}
              onChange={(e) =>
                setDates({
                  durationDays:
                    e.target.value === '' ? null : Number(e.target.value),
                })
              }
            />
          </div>
        </div>
      )
    }

    case 'single_choice': {
      const current = typeof value === 'string' ? value : ''
      return (
        <ToggleGroup
          value={current ? [current] : []}
          onValueChange={(v: string[]) => onChange(v[0] ?? '')}
          variant="outline"
          className="flex-wrap"
          aria-label={question.label}
        >
          {question.options?.map((opt) => (
            <ToggleGroupItem key={opt} value={opt}>
              {opt}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      )
    }

    case 'multi_choice': {
      const current = Array.isArray(value) ? (value as string[]) : []
      return (
        <ToggleGroup
          toggleMultiple
          value={current}
          onValueChange={(v: string[]) => onChange(v)}
          variant="outline"
          className="flex-wrap"
          aria-label={question.label}
        >
          {question.options?.map((opt) => (
            <ToggleGroupItem key={opt} value={opt}>
              {opt}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      )
    }

    case 'scale': {
      const scale = question.scale ?? {
        min: 1,
        max: 5,
        minLabel: 'Low',
        maxLabel: 'High',
      }
      const current = typeof value === 'number' ? value : 3
      return (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>{scale.minLabel}</span>
            <span
              className="rounded-full bg-primary/10 px-2.5 py-0.5 text-sm font-semibold text-primary"
              aria-live="polite"
            >
              {current} / {scale.max}
            </span>
            <span>{scale.maxLabel}</span>
          </div>
          <Slider
            min={scale.min}
            max={scale.max}
            step={1}
            value={[current]}
            onValueChange={(v) =>
              onChange(Array.isArray(v) ? v[0] : (v as number))
            }
            aria-label={question.label}
          />
        </div>
      )
    }

    case 'multi_text': {
      const current = typeof value === 'string' ? value : ''
      return (
        <Input
          placeholder="e.g. Vegetarian; prefer English-speaking"
          value={current}
          onChange={(e) => onChange(e.target.value)}
        />
      )
    }

    case 'airport_autocomplete': {
      return (
        <AirportAutocomplete
          value={typeof value === 'string' ? value : ''}
          onChange={onChange}
        />
      )
    }

    case 'long_text': {
      const current = typeof value === 'string' ? value : ''
      const maxLength = question.validation?.maxLength
      return (
        <div className="flex flex-col gap-1.5">
          <Textarea
            rows={4}
            maxLength={maxLength}
            placeholder="Share anything that would help tailor your trip..."
            value={current}
            onChange={(e) => onChange(e.target.value)}
          />
          {maxLength ? (
            <span className="self-end text-xs text-muted-foreground">
              {current.length} / {maxLength}
            </span>
          ) : null}
        </div>
      )
    }

    default:
      return null
  }
}
