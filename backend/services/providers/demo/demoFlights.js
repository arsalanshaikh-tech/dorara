'use strict'

const { FLIGHT_TEMPLATES } = require('../../tripPlanner/fixtures')
const { moneyFromUsd } = require('../../tripPlanner/itinerary.fallback')

/**
 * Server-side DEMO flights: obviously generic airlines ("Demo Air"), illustrative
 * durations and prices. dataSource "demo", never a bookingUrl.
 */
function clock(totalMinutes) {
  const dayOffset = Math.floor(totalMinutes / 1440)
  const m = ((totalMinutes % 1440) + 1440) % 1440
  const hh = String(Math.floor(m / 60)).padStart(2, '0')
  const mm = String(m % 60).padStart(2, '0')
  return { time: `${hh}:${mm}`, dayOffset }
}

/** "7h 05m" — same format the frontend uses. */
function durationLabel(minutes) {
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`
}

/** @returns {Array<object>} FlightOption[] (frontend contract + dataSource) */
function buildDemoFlights(p) {
  return FLIGHT_TEMPLATES.map((t) => {
    const durationMin = Math.round(p.fixture.flightHours * t.durationFactor * 60)
    const [dh, dm] = t.departure.split(':').map(Number)
    const arrival = clock(dh * 60 + dm + durationMin)
    const pricePerTraveler = moneyFromUsd(p.fixture.flightBaseUsd * t.priceFactor, p.rate)
    return {
      id: `flight-${p.fixture.id}-${t.id}`,
      airline: t.airline,
      originLabel: p.req.departureLocation ?? 'Your departure city (not set)',
      destinationAirport: p.fixture.airport,
      departureTime: t.departure,
      arrivalTime: arrival.time,
      arrivalNote: arrival.dayOffset > 0 ? `+${arrival.dayOffset} day` : undefined,
      durationLabel: durationLabel(durationMin),
      stops: t.stops,
      pricePerTraveler,
      totalPrice: pricePerTraveler * p.travelers,
      travelers: p.travelers,
      dataSource: 'demo',
    }
  })
}

module.exports = { buildDemoFlights, durationLabel, clock }
