'use strict'

/**
 * Honesty sanitizer — enforces "AI never produces prices, availability, booking
 * links, visa rules or real-time facts" IN CODE (the prompt asks too, but this is
 * what guarantees it).
 *
 * sanitizeText() returns cleaned text plus the list of things it removed. Whole
 * sentences containing availability / real-time / visa claims are dropped, URLs
 * and money amounts are stripped. If nothing meaningful survives, text is ''.
 */

const CURRENCY_WORDS =
  'usd|eur|gbp|inr|aud|cad|jpy|cny|rs|rupees?|dollars?|euros?|pounds?|yen|baht|bucks'
const SYMBOLS = '[$€£¥₹฿]|A\\$|C\\$|US\\$|Rs\\.?'

const URL_RE = /\b(?:https?:\/\/|www\.)[^\s)>\]]+/gi
const BARE_DOMAIN_RE = /\b[a-z0-9-]+\.(?:com|net|org|io|co|travel|app|info|biz)(?:\/[^\s)>\]]*)?\b/gi
// "$120", "€ 1,200.50", "USD 120", "120 USD", "120 dollars", "from 50-70 euros"
const MONEY_RES = [
  new RegExp(`(?:${SYMBOLS})\\s?\\d[\\d,.]*(?:\\s?[-–]\\s?(?:${SYMBOLS})?\\s?\\d[\\d,.]*)?(?:\\s?[kK])?`, 'g'),
  new RegExp(`\\b(?:${CURRENCY_WORDS})\\s?\\d[\\d,.]*(?:\\s?[-–]\\s?\\d[\\d,.]*)?`, 'gi'),
  new RegExp(`\\b\\d[\\d,.]*(?:\\s?[-–]\\s?\\d[\\d,.]*)?\\s?(?:${CURRENCY_WORDS})\\b`, 'gi'),
]

// Sentences making these kinds of claims are removed entirely.
const FORBIDDEN_SENTENCE_RES = [
  /\b(?:currently|presently|right now|at the moment|as of (?:today|now))\b/i,
  /\b(?:available now|in stock|sold out|fully booked|tickets? (?:are|is) (?:still )?available|rooms? (?:are|is) available|seats? (?:are|is) available|last[- ]minute (?:deal|availability))\b/i,
  /\b(?:live|current|today'?s|real[- ]time) (?:price|prices|fare|fares|rate|rates|availability|weather|conditions|wait times?|queue|queues)\b/i,
  /\b(?:cheapest|lowest) (?:price|fare|rate)\b/i,
  /\b(?:book|reserve) (?:now|today)\b/i,
  /\b(?:guaranteed|confirmed) (?:price|booking|availability|seat|room|spot)\b/i,
  /\bvisa(?:[- ]free| on arrival| required| not required| exempt)\b/i,
  /\b(?:no|need a|require[sd]?|requires a) visa\b/i,
  /\b(?:entry requirements?|immigration rules?|border (?:rules|restrictions))\b/i,
  /\b(?:per person|per night|per ticket|entry fee|admission fee|ticket price|costs?|priced at)\b[^.!?]*\d/i,
  /\b(?:price|cost|fee|fare)s?\s*(?:is|are|of|:)\s*\S*\d/i,
]

const hasMoney = (s) => MONEY_RES.some((re) => new RegExp(re.source, re.flags.replace('g', '')).test(s))

/**
 * @param {string} input
 * @returns {{text:string, removed:string[]}}
 */
function sanitizeText(input) {
  const removed = []
  if (typeof input !== 'string') return { text: '', removed }

  let text = input.replace(/\s+/g, ' ').trim()

  for (const re of [URL_RE, BARE_DOMAIN_RE]) {
    text = text.replace(re, (m) => {
      removed.push(`url:${m}`)
      return ''
    })
  }

  // Split into sentences (keep the terminator) and drop forbidden-claim sentences.
  // A '.' inside a number (15.50) is not a sentence end: only split before whitespace/end.
  const sentences = text.match(/(?:[^.!?]|[.!?](?!\s|$))+[.!?]*/g) ?? []
  const kept = []
  for (const s of sentences) {
    if (FORBIDDEN_SENTENCE_RES.some((re) => re.test(s)) || hasMoney(s)) {
      // Drop the whole sentence: patching out just the number leaves broken prose.
      removed.push(`claim:${s.trim().slice(0, 60)}`)
      continue
    }
    kept.push(s)
  }
  text = kept.join('').trim()

  for (const re of MONEY_RES) {
    text = text.replace(re, (m) => {
      removed.push(`amount:${m.trim()}`)
      return ''
    })
  }

  // Tidy leftovers from removals: doubled spaces, dangling punctuation, empty brackets.
  text = text
    .replace(/\(\s*\)/g, '')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/([,;:])\s*([.!?])/g, '$2')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s,;:.\-–]+/, '')
    .trim()

  // A fragment too short to carry meaning is dropped.
  if (text.replace(/[^\p{L}\p{N}]/gu, '').length < 3) return { text: '', removed }
  return { text, removed }
}

/** True when text still contains something the sanitizer is meant to prevent. */
function containsForbidden(text) {
  const t = String(text ?? '')
  if (/\b(?:https?:\/\/|www\.)/i.test(t)) return true
  if (hasMoney(t)) return true
  return FORBIDDEN_SENTENCE_RES.some((re) => re.test(t))
}

module.exports = { sanitizeText, containsForbidden }
