'use strict'

const { ACCOMMODATION_TIERS } = require('../../tripPlanner/fixtures')
const { moneyFromUsd } = require('../../tripPlanner/itinerary.fallback')

/**
 * Server-side DEMO accommodation. Deterministic, scaled by destination cost
 * factor, currency, nights and rooms. Every item carries dataSource "demo", has
 * an obviously generic name, and NEVER has a bookingUrl, image or cancellation
 * text — none of that is real here, so none of it is shown.
 */
const DEMO_LABELS = { budget: 'Budget Guesthouse', mid: 'Central Hotel', comfort: 'Grand Hotel' }

/** @returns {Array<object>} AccommodationOption[] (frontend contract + dataSource) */
function buildDemoStays(p, nights) {
  return ACCOMMODATION_TIERS.map((tier, i) => {
    const area = p.fixture.areas[i] ?? p.placeName
    const pricePerNight = moneyFromUsd(tier.baseUsd * p.fixture.costFactor, p.rate)
    return {
      id: `stay-${p.fixture.id}-${tier.id}`,
      name: `Demo Stay – ${DEMO_LABELS[tier.id] ?? tier.type}`,
      type: tier.type,
      location: `${area}, ${p.placeName}`,
      rating: tier.rating,
      facilities: [...tier.facilities],
      pricePerNight,
      totalPrice: pricePerNight * nights * p.rooms,
      nights,
      rooms: p.rooms,
      dataSource: 'demo',
    }
  })
}

module.exports = { buildDemoStays }
