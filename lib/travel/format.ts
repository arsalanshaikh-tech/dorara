import { currencySymbol } from './mock-engine'
import type {
  AnswerValue,
  BudgetAnswer,
  DatesAnswer,
  Question,
} from './types'

// Human-readable rendering of a stored answer, used in the summary panel and
// the assistant chat confirmations.
export function formatAnswer(question: Question, value: AnswerValue): string {
  if (value == null || value === '') return 'Not provided'

  switch (question.type) {
    case 'range_currency': {
      const b = value as BudgetAnswer
      if (b.max == null && b.min == null) return 'Not provided'
      const sym = currencySymbol(b.currency)
      if (b.min != null && b.max != null)
        return `${sym}${b.min.toLocaleString()} – ${sym}${b.max.toLocaleString()}`
      if (b.max != null) return `Up to ${sym}${b.max.toLocaleString()}`
      return `From ${sym}${(b.min as number).toLocaleString()}`
    }

    case 'date_range': {
      const d = value as DatesAnswer
      if (d.start && d.end) return `${d.start} → ${d.end}`
      if (d.durationDays) return `${d.durationDays} days`
      return 'Flexible'
    }

    case 'multi_choice': {
      const arr = Array.isArray(value) ? value : []
      return arr.length ? arr.join(', ') : 'Not provided'
    }

    case 'scale': {
      const scale = question.scale
      return scale
        ? `${value} / ${scale.max}`
        : String(value)
    }

    default:
      return String(value)
  }
}
