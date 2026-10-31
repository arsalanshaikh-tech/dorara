'use strict'

const { daySchema, fitSchema } = require('./aiSchemas')
const { sanitizeText } = require('./sanitizer')
const { formatDayLabel } = require('./format')
const { ACTIVITY_LEVEL_USD } = require('./budget.service')
const { moneyFromUsd, TIME_SLOTS } = require('./itinerary.fallback')

/**
 * Semantic validation + sanitising of AI output, independent for the itinerary and
 * the fit section so a problem in one never discards the other.
 */

const BOOK_NOTE = 'Advance booking recommended — popular slots can sell out.'

/** Pull a JSON object out of model text (code fences, leading/trailing prose). */
function extractJson(text) {
  if (typeof text !== 'string') return null
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced ? fenced[1] : text
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start === -1 || end <= start) return null
  try {
    return JSON.parse(candidate.slice(start, end + 1))
  } catch {
    return null
  }
}

/** Normalise "09:30", "9:30am", "Morning" … to "9:30 AM"; null when unusable. */
function normalizeTime(raw) {
  if (typeof raw !== 'string') return null
  const t = raw.trim().toLowerCase()
  const m = t.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/)
  if (m) {
    let h = Number(m[1])
    const min = m[2] ?? '00'
    const mer = m[3]
    if (mer) {
      if (h < 1 || h > 12) return null
    } else {
      if (h > 23) return null
      const pm = h >= 12
      h = h % 12 === 0 ? 12 : h % 12
      return `${h}:${min} ${pm ? 'PM' : 'AM'}`
    }
    return `${h}:${min} ${mer.toUpperCase()}`
  }
  if (t.startsWith('morning')) return TIME_SLOTS.morning
  if (t.startsWith('afternoon')) return TIME_SLOTS.afternoon
  if (t.startsWith('evening') || t.startsWith('night')) return TIME_SLOTS.evening
  return null
}

const DEFAULT_SLOTS = [TIME_SLOTS.morning, TIME_SLOTS.afternoon, TIME_SLOTS.evening, '9:00 PM', '11:00 AM', '4:30 PM']

/**
 * Validate and convert the model's days into ItineraryDay[].
 * @returns {{ok:true, days:Array, sanitized:number} | {ok:false, errors:string[]}}
 */
function validateItinerary(rawDays, { expectedDays, p, req }) {
  const errors = []
  if (!Array.isArray(rawDays)) return { ok: false, errors: ['days is not an array'] }
  if (rawDays.length !== expectedDays) {
    return { ok: false, errors: [`expected exactly ${expectedDays} days but got ${rawDays.length}`] }
  }

  const userInterests = new Map(req.interests.map((i) => [i.toLowerCase(), i]))
  const out = []
  let sanitized = 0

  for (let i = 0; i < rawDays.length; i++) {
    const r = daySchema.safeParse(rawDays[i])
    if (!r.success) {
      errors.push(`day ${i + 1} has an invalid shape`)
      continue
    }
    const d = r.data
    if (d.day !== i + 1) errors.push(`day numbers must run 1..${expectedDays} in order (got ${d.day} at position ${i + 1})`)

    // Pacing: arrival/departure days lighter, ordinary days at most 5.
    const edge = expectedDays > 1 && (i === 0 || i === expectedDays - 1)
    const max = edge ? 3 : 5
    if (d.activities.length > max) errors.push(`day ${i + 1} has ${d.activities.length} activities (max ${max})`)

    const title = sanitizeText(d.title)
    const theme = sanitizeText(d.theme)
    if (!title.text || !theme.text) {
      errors.push(`day ${i + 1} title/theme was empty after removing claims`)
      continue
    }

    const activities = []
    d.activities.forEach((a, idx) => {
      const t = sanitizeText(a.title)
      const desc = sanitizeText(a.description)
      sanitized += t.removed.length + desc.removed.length
      if (!t.text) return
      const matched = (a.interests ?? [])
        .map((x) => userInterests.get(String(x).toLowerCase()))
        .filter(Boolean)
      const level = a.estimatedCostLevel
      activities.push({
        id: `d${d.day}-ai-${idx + 1}`,
        time: normalizeTime(a.time) ?? DEFAULT_SLOTS[idx] ?? TIME_SLOTS.afternoon,
        title: t.text,
        description: desc.text || `A ${theme.text.toLowerCase()} stop in ${p.placeName}.`,
        estimatedCost:
          level === undefined
            ? undefined
            : moneyFromUsd(ACTIVITY_LEVEL_USD[level] * p.fixture.costFactor, p.rate),
        bookAheadNote: a.bookingRequired ? BOOK_NOTE : undefined,
        matchedInterests: [...new Set(matched)],
      })
    })

    if (activities.length === 0) {
      errors.push(`day ${i + 1} has no usable activities`)
      continue
    }

    out.push({
      day: d.day,
      title: title.text,
      theme: theme.text,
      dateLabel: formatDayLabel(req.dates.start, i),
      activities,
    })
  }

  if (errors.length) return { ok: false, errors }
  return { ok: true, days: out, sanitized }
}

/** Which model-citable questionnaire answers exist, and the words a match must echo. */
function citableRefs(req) {
  const refs = {}
  if (req.interests.length) refs.interest_type = req.interests
  const weather = req.weather.filter((w) => w !== 'No preference')
  if (weather.length) refs.weather = weather
  if (req.partyLabel) refs.party = [req.partyLabel]
  if (req.safetyImportance !== null) refs.safety_importance = [String(req.safetyImportance)]
  if (req.ageGroup) refs.age_group = [req.ageGroup]
  if (req.destinationPreference) refs.destination_preference = [req.destinationPreference]
  return refs
}

/**
 * Validate the model's fit section. A match is kept only if its `ref` names a real
 * answer the user gave AND its text echoes that answer's value; texts that cite
 * specific day numbers are dropped (they could contradict a fallback itinerary).
 * @returns {{ok:true, fit:{matches:Array,considerations:Array}} | {ok:false, errors:string[]}}
 */
function validateFit(rawFit, { req }) {
  const r = fitSchema.safeParse(rawFit)
  if (!r.success) return { ok: false, errors: ['fit has an invalid shape'] }

  const refs = citableRefs(req)
  const matches = []
  for (const m of r.data.matches) {
    const terms = refs[m.ref]
    if (!terms) continue // cites an answer the user did not give
    const { text } = sanitizeText(m.text)
    if (!text || /\bday\s*\d/i.test(text)) continue
    const lower = text.toLowerCase()
    if (!terms.some((t) => lower.includes(String(t).toLowerCase()))) continue
    matches.push({ id: `ai-match-${matches.length + 1}`, ref: m.ref, text })
  }

  const considerations = []
  for (const c of r.data.considerations) {
    const { text } = sanitizeText(c)
    if (!text || /\bday\s*\d/i.test(text)) continue
    considerations.push({ id: `ai-note-${considerations.length + 1}`, text })
  }

  if (Object.keys(refs).length > 0 && matches.length === 0) {
    return { ok: false, errors: ['no match point cited a real questionnaire answer'] }
  }
  return { ok: true, fit: { matches, considerations } }
}

/**
 * Combine a valid AI fit with the deterministic fit: keep the AI wording for the
 * answers it covered, and ALWAYS keep the computed budget match and every honest
 * deterministic consideration (data sources, assumptions, departure, visa…).
 */
function assembleFit(aiFit, fallbackFit, req) {
  if (!aiFit) return { fit: fallbackFit, fitSource: 'fallback' }

  const aiText = aiFit.matches.map((m) => m.text.toLowerCase())
  const aiRefs = new Set(aiFit.matches.map((m) => m.ref))
  const covered = (m) => {
    if (m.id === 'budget') return false // numbers are always ours
    if (m.id === 'weather') return aiRefs.has('weather')
    if (m.id === 'safety') return aiRefs.has('safety_importance')
    if (m.id.startsWith('interest-')) {
      const label = m.id.slice('interest-'.length).toLowerCase()
      return aiText.some((t) => t.includes(label))
    }
    return false
  }

  const matches = [
    ...aiFit.matches.map(({ id, text }) => ({ id, text })),
    ...fallbackFit.matches.filter((m) => !covered(m)),
  ]
  const seen = new Set(fallbackFit.considerations.map((c) => c.text.toLowerCase()))
  const extra = aiFit.considerations.filter((c) => !seen.has(c.text.toLowerCase())).slice(0, 3)
  const considerations = [...extra, ...fallbackFit.considerations]
  return { fit: { matches, considerations }, fitSource: 'ai' }
}

module.exports = { extractJson, normalizeTime, validateItinerary, validateFit, assembleFit, citableRefs, BOOK_NOTE }
