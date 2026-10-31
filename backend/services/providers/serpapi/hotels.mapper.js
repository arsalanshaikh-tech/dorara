'use strict'

const { z } = require('zod')

/**
 * Maps a SerpApi Google Hotels response to the frontend AccommodationOption contract.
 *
 * Rules (honesty):
 *  - a property is returned only if the response has a numeric nightly rate > 0;
 *  - rating / amenities / thumbnail / link are used ONLY when present in the response;
 *  - facilities are never invented, cancellation is never populated (SerpApi's
 *    search results do not carry it), bookingUrl is only the property's own website
 *    link supplied by the response (https, and never a Google ad-click redirect);
 *  - location is the destination we searched for (we do not invent a neighbourhood);
 *  - everything mapped is dataSource "live".
 *
 * Prices are mapped for ONE room (the search uses 1-2 adults); applyRooms()
 * scales the stay total to the number of rooms the party needs.
 */

const rateSchema = z.object({ extracted_lowest: z.number().positive() })

const propertySchema = z.object({
  name: z.string().min(1),
  type: z.string().optional(),
  hotel_class: z.string().optional(),
  link: z.string().optional(),
  property_token: z.string().optional(),
  rate_per_night: rateSchema,
  total_rate: z.object({ extracted_lowest: z.number().positive().optional() }).optional(),
  overall_rating: z.number().min(0).max(5).optional(),
  amenities: z.array(z.unknown()).optional(),
  images: z.array(z.object({ thumbnail: z.string().optional() })).optional(),
  thumbnail: z.string().optional(),
})

function safePropertyLink(link) {
  if (typeof link !== 'string') return undefined
  try {
    const u = new URL(link)
    if (u.protocol !== 'https:') return undefined
    // Sponsored results carry a Google ad-click redirect: not the property's own site.
    if (/(^|\.)google\./.test(u.hostname) && /\/aclk/.test(u.pathname)) return undefined
    return u.toString()
  } catch {
    return undefined
  }
}

function safeImage(url) {
  return typeof url === 'string' && url.startsWith('https://') ? url : undefined
}

function typeLabel(p) {
  if (p.hotel_class) return p.hotel_class.replace(/^./, (c) => c.toUpperCase())
  if (p.type) return p.type.replace(/^./, (c) => c.toUpperCase())
  return 'Stay'
}

/** Evenly spread picks across the price-sorted list so tiers are represented. */
function spreadPick(sorted, max) {
  if (sorted.length <= max) return sorted
  const out = []
  for (let i = 0; i < max; i++) out.push(sorted[Math.round((i * (sorted.length - 1)) / (max - 1))])
  return [...new Set(out)]
}

/**
 * @param {any} json SerpApi response
 * @param {{nights:number, placeName:string, maxOptions?:number}} ctx
 * @returns {{options: Array<object>}} options priced for ONE room
 */
function mapHotelResults(json, { nights, placeName, maxOptions = 5 }) {
  const out = []
  const seen = new Set()
  for (const item of json?.properties ?? []) {
    const r = propertySchema.safeParse(item)
    if (!r.success) continue
    const p = r.data
    const nameKey = p.name.trim().toLowerCase()
    if (seen.has(nameKey)) continue
    seen.add(nameKey)

    const pricePerNight = Math.round(p.rate_per_night.extracted_lowest)
    const providerTotal = p.total_rate?.extracted_lowest
    const facilities = [
      ...new Set(
        (p.amenities ?? []).filter((a) => typeof a === 'string' && a.trim()).map((a) => a.trim()),
      ),
    ].slice(0, 6)

    out.push({
      id: `stay-live-${p.property_token ?? out.length + 1}`,
      name: p.name.trim(),
      type: typeLabel(p),
      location: placeName,
      rating: p.overall_rating !== undefined ? Math.round(p.overall_rating * 10) / 10 : undefined,
      facilities,
      pricePerNight,
      // Provider's total for the stay when given, else nightly x nights (1 room).
      totalPrice: providerTotal ? Math.round(providerTotal) : pricePerNight * Math.max(nights, 0),
      nights,
      rooms: 1,
      cancellation: undefined,
      bookingUrl: safePropertyLink(p.link),
      imageUrl: safeImage(p.images?.[0]?.thumbnail ?? p.thumbnail),
      dataSource: 'live',
    })
  }

  const sorted = out.sort((a, b) => a.pricePerNight - b.pricePerNight)
  return { options: spreadPick(sorted, maxOptions) }
}

/** Scale one-room options to the number of rooms (a pure function). */
function applyRooms(options, rooms) {
  return options.map((o) => ({ ...o, rooms, totalPrice: o.totalPrice * rooms }))
}

module.exports = { mapHotelResults, applyRooms, safePropertyLink, spreadPick }
