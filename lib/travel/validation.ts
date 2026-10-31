import type {
  AnswerValue,
  BudgetAnswer,
  DatesAnswer,
  Question,
} from './types'

// Frontend validation matching the spec's rules. Returns an error string, or
// null when the answer is valid.
export function validateAnswer(
  question: Question,
  value: AnswerValue,
): string | null {
  const v = question.validation
  if (!v) return null

  switch (question.type) {
    case 'range_currency': {
      const budget = value as BudgetAnswer | null
      if (v.required && (!budget || budget.max == null)) {
        return 'Please enter your budget (example: 1,200 USD).'
      }
      if (budget?.max != null) {
        if (Number.isNaN(budget.max)) return 'Budget must be a number.'
        if (v.minValue && budget.max < v.minValue)
          return `Budget must be at least ${v.minValue}.`
        if (v.maxValue && budget.max > v.maxValue)
          return `Budget looks too high — max is ${v.maxValue.toLocaleString()}.`
        if (budget.min != null && budget.min > budget.max)
          return 'Minimum budget cannot exceed the maximum.'
      }
      if (budget && !budget.currency) return 'Please choose a currency.'
      return null
    }

    case 'date_range': {
      const dates = value as DatesAnswer | null
      if (dates?.start && dates?.end) {
        if (new Date(dates.end) <= new Date(dates.start))
          return 'End date must be after the start date.'
      }
      if (dates?.durationDays != null) {
        if (dates.durationDays < 1 || dates.durationDays > 365)
          return 'Duration must be between 1 and 365 days.'
      }
      return null
    }

    case 'multi_choice': {
      const arr = Array.isArray(value) ? value : []
      if (v.required && arr.length === 0)
        return 'Please select at least one option.'
      if (v.minSelected && arr.length < v.minSelected)
        return `Please select at least ${v.minSelected}.`
      return null
    }

    case 'scale': {
      if (v.required && typeof value !== 'number')
        return 'Please choose a value.'
      return null
    }

    case 'airport_autocomplete':
    case 'long_text': {
      const str = typeof value === 'string' ? value : ''
      if (v.maxLength && str.length > v.maxLength)
        return `Please keep it under ${v.maxLength} characters.`
      return null
    }

    default: {
      // Text / choice fields.
      if (v.required) {
        const str = typeof value === 'string' ? value.trim() : ''
        if (!str) return 'This field is required.'
      }
      return null
    }
  }
}
