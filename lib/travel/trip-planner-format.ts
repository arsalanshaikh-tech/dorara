import { currencySymbol } from './mock-engine'

// Reuses the app's existing currency-symbol behaviour (see mock-engine.ts) so
// the planner formats money the same way as the rest of the travel vertical.
export function formatMoney(amount: number, currency: string): string {
  const sym = currencySymbol(currency)
  const rounded = Math.round(amount)
  const abs = Math.abs(rounded).toLocaleString()
  return `${rounded < 0 ? '-' : ''}${sym}${abs}`
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

function parseIsoDate(value: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const d = new Date(`${value}T00:00:00Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

/** "12 Mar 2027" — timezone-safe, deterministic. */
export function formatIsoDate(value: string | null): string | null {
  const d = parseIsoDate(value)
  if (!d) return null
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

/** Human label for the saved dates, or null when none were provided. */
export function formatDateRange(
  start: string | null,
  end: string | null,
): string | null {
  const s = formatIsoDate(start)
  const e = formatIsoDate(end)
  if (s && e) return `${s} → ${e}`
  if (s) return `From ${s}`
  if (e) return `Until ${e}`
  return null
}

/** Label for day N of a trip that starts on `start` (e.g. "Fri 12 Mar"). */
export function formatDayLabel(start: string | null, dayIndex: number): string | undefined {
  const d = parseIsoDate(start)
  if (!d) return undefined
  const day = new Date(d.getTime() + dayIndex * 86_400_000)
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day.getUTCDay()]
  return `${weekday} ${day.getUTCDate()} ${MONTHS[day.getUTCMonth()]}`
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return `${count} ${count === 1 ? singular : (plural ?? `${singular}s`)}`
}
