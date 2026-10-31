'use strict'

const { formatDayLabel } = require('./format')

/**
 * Deterministic fallback itinerary (itinerarySource = "fallback").
 *
 * Port of generateItinerary() from lib/travel/trip-planner-service.ts. Built only
 * from the destination's template activities and the user's selected interests —
 * no AI, no prices claimed beyond the labelled per-person cost estimates from the
 * fixture rules table.
 */

const TIME_SLOTS = { morning: '9:30 AM', afternoon: '2:00 PM', evening: '7:30 PM' }

const moneyFromUsd = (usd, rate) => Math.round(usd * rate)

function toActivity(t, day, time, interests, rate) {
  return {
    id: `d${day}-${t.id}`,
    time,
    title: t.title,
    description: t.description,
    estimatedCost: moneyFromUsd(t.costUsd, rate),
    bookAheadNote: t.bookAhead,
    matchedInterests: t.interests.filter((i) => interests.includes(i)),
  }
}

/** @returns {Array<import('./types').ItineraryDay>} */
function generateFallbackItinerary(p, days) {
  const { fixture, placeName, req, rate } = p
  const interests = req.interests
  const start = req.dates.start
  const used = new Set()
  const result = []

  const unused = (slot) => fixture.highlights.filter((t) => t.slot === slot && !used.has(t.id))
  const matches = (t, i) => t.interests.includes(i)
  const matchesAny = (t) => interests.some((i) => t.interests.includes(i))

  const pickDay = (theme, count) => {
    const picked = []
    const take = (list) => {
      for (const t of list) {
        if (picked.length >= count) return
        if (!used.has(t.id)) {
          used.add(t.id)
          picked.push(t)
        }
      }
    }
    if (theme) take(unused('day').filter((t) => matches(t, theme)))
    if (interests.length) take(unused('day').filter(matchesAny))
    take(unused('day'))
    return picked
  }

  const pickEvening = (theme) => {
    const pool = unused('evening')
    const found =
      (theme ? pool.find((t) => matches(t, theme)) : undefined) ??
      (interests.length ? pool.find(matchesAny) : pool[0])
    if (found) used.add(found.id)
    return found
  }

  const openDay = (day) => [
    {
      id: `d${day}-open-morning`,
      time: TIME_SLOTS.morning,
      title: `Free morning in ${placeName}`,
      description: 'Nothing scheduled. Revisit a favourite spot, browse a local market, or sleep in.',
      estimatedCost: 0,
      matchedInterests: [],
    },
    {
      id: `d${day}-open-afternoon`,
      time: TIME_SLOTS.afternoon,
      title: 'Café stop & neighbourhood wander',
      description: 'A relaxed, unplanned afternoon to soak up local life.',
      estimatedCost: 0,
      matchedInterests: [],
    },
  ]

  for (let day = 1; day <= days; day++) {
    const dateLabel = formatDayLabel(start, day - 1)
    const isArrival = day === 1 && days > 1
    const isDeparture = day === days && days > 1

    if (isArrival) {
      result.push({
        day,
        title: `Arrive in ${placeName}`,
        theme: 'Arrival',
        dateLabel,
        activities: [
          {
            id: `d${day}-arrive`,
            time: '3:00 PM',
            title: 'Arrive & check in',
            description: 'Settle in, drop your bags, and get your bearings. Times depend on your actual flight.',
            matchedInterests: [],
          },
          {
            id: `d${day}-first-evening`,
            time: TIME_SLOTS.evening,
            title: 'Easy first evening',
            description: 'A short walk around your neighbourhood and a relaxed dinner nearby.',
            matchedInterests: [],
          },
        ],
      })
      continue
    }

    if (isDeparture) {
      result.push({
        day,
        title: 'Departure day',
        theme: 'Departure',
        dateLabel,
        activities: [
          {
            id: `d${day}-depart`,
            time: '10:00 AM',
            title: 'Slow morning & departure',
            description: 'A café stop or last-minute shopping before heading to the airport.',
            matchedInterests: [],
          },
        ],
      })
      continue
    }

    const middleIndex = days > 1 ? day - 2 : 0
    const theme = interests.length ? interests[middleIndex % interests.length] : null
    const dayPicks = pickDay(theme, 2)
    const eveningPick = pickEvening(theme)

    const activities = []
    dayPicks.forEach((t, i) => {
      activities.push(toActivity(t, day, i === 0 ? TIME_SLOTS.morning : TIME_SLOTS.afternoon, interests, rate))
    })
    // Keep days realistic: at most 2 daytime activities + 1 evening.
    if (eveningPick && (theme !== null || middleIndex % 2 === 1)) {
      activities.push(toActivity(eveningPick, day, TIME_SLOTS.evening, interests, rate))
    } else if (eveningPick) {
      used.delete(eveningPick.id)
    }

    if (activities.length === 0) {
      result.push({ day, title: 'Open day', theme: 'Flexible time', dateLabel, activities: openDay(day) })
      continue
    }

    const countFor = (i) => activities.filter((x) => x.matchedInterests.includes(i)).length
    let dayTheme = 'Local highlights'
    let best = 0
    for (const i of interests) {
      const n = countFor(i)
      if (n > best || (n === best && n > 0 && i === theme)) {
        best = n
        dayTheme = i
      }
    }

    const first = dayPicks[0]
    result.push({
      day,
      title: first ? first.title : `Evening in ${placeName}`,
      theme: dayTheme,
      dateLabel,
      activities,
    })
  }

  return result
}

module.exports = { generateFallbackItinerary, TIME_SLOTS, moneyFromUsd }
