'use strict'

/**
 * Test helper: assemble a backend plan from DEMO providers only (no network, no DB),
 * using the same building blocks the Stage C orchestrator will use.
 */
const path = require('path')
const root = path.join(__dirname, '..', '..')
const { normalizeRequirements, resolveParams, resolveShape } = require(path.join(root, 'services/tripPlanner/requirements'))
const { generateFallbackItinerary } = require(path.join(root, 'services/tripPlanner/itinerary.fallback'))
const { buildDemoStays } = require(path.join(root, 'services/providers/demo/demoStays'))
const { buildDemoFlights } = require(path.join(root, 'services/providers/demo/demoFlights'))
const { buildPlanCore } = require(path.join(root, 'services/tripPlanner/planCore'))

function buildDemoPlan(input, adjustments = {}) {
  const req = normalizeRequirements(input.answers)
  const p = resolveParams(input, req)
  const shape = resolveShape(req, p, adjustments)
  const itinerary = generateFallbackItinerary(p, shape.days)
  const nights = Math.max(shape.days - 1, 0)
  const accommodations = buildDemoStays(p, nights)
  const flights = buildDemoFlights(p)
  const core = buildPlanCore({
    req, p, shape, itinerary, accommodations, flights,
    itineraryFor: (d) => generateFallbackItinerary(p, d),
  })
  return { req, p, shape, itinerary, accommodations, flights, ...core }
}

module.exports = { buildDemoPlan }
