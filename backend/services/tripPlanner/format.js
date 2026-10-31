'use strict'

/**
 * Small formatting helpers shared by the trip-planner services.
 * Mirrors lib/travel/trip-planner-format.ts (money symbols follow
 * lib/travel/mock-engine.ts so the planner formats money like the rest of the app).
 */

const CURRENCY_SYMBOLS = { USD: '$', INR: '₹', EUR: '€', GBP: '£', AUD: 'A$', CAD: 'C$' }

function currencySymbol(currency) {
  return CURRENCY_SYMBOLS[currency] ?? `${currency} `
}

/** "$1,234" / "-₹500" — deterministic en-US grouping. */
function formatMoney(amount, currency) {
  const rounded = Math.round(amount)
  const abs = Math.abs(rounded).toLocaleString('en-US')
  return `${rounded < 0 ? '-' : ''}${currencySymbol(currency)}${abs}`
}

function pluralize(count, singular, plural) {
  return `${count} ${count === 1 ? singular : (plural ?? `${singular}s`)}`
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function parseIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const d = new Date(`${value}T00:00:00Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

/** "Fri 12 Mar" for day N (0-based) of a trip starting on `start`, else undefined. */
function formatDayLabel(start, dayIndex) {
  const d = parseIsoDate(start)
  if (!d) return undefined
  const day = new Date(d.getTime() + dayIndex * 86_400_000)
  return `${WEEKDAYS[day.getUTCDay()]} ${day.getUTCDate()} ${MONTHS[day.getUTCMonth()]}`
}

/** Add whole days to an ISO date string (UTC-safe). Returns null for bad input. */
function addDaysIso(isoDate, days) {
  const d = parseIsoDate(isoDate)
  if (!d) return null
  return new Date(d.getTime() + days * 86_400_000).toISOString().slice(0, 10)
}

function joinTitles(titles) {
  if (titles.length <= 1) return titles[0] ?? ''
  return `${titles[0]} and ${titles[1]}`
}

module.exports = {
  currencySymbol,
  formatMoney,
  pluralize,
  parseIsoDate,
  formatDayLabel,
  addDaysIso,
  joinTitles,
}
