'use strict'

const { calculateBudgetBreakdown, buildFeasibility, buildLimits } = require('./budget.service')
const { MAX_PLANNED_DAYS } = require('./requirements')

/**
 * Pure assembly of the numeric core of a TripPlan (budget, feasibility, limits,
 * effective parameters) from an itinerary + stay/flight options, whatever their
 * source (live or demo). No I/O. The trip-planner orchestrator (Stage C) calls
 * this after the AI / provider sections have resolved.
 *
 * @param {object} a
 * @param {{destination:object}} a.input
 * @param {object} a.req       normalized requirements
 * @param {object} a.p         resolved params
 * @param {{days:number,durationAssumed:boolean,durationCapped:boolean,budget:number|null,baseDays:number}} a.shape
 * @param {Array} a.itinerary
 * @param {Array} a.accommodations
 * @param {Array} a.flights
 * @param {(days:number)=>Array} a.itineraryFor  itinerary for a different length (shorten-trip idea)
 */
function buildPlanCore({ req, p, shape, itinerary, accommodations, flights, itineraryFor }) {
  const ctx = { p, days: shape.days, itinerary, accommodations, flights, itineraryFor }
  const { breakdown, categorySources } = calculateBudgetBreakdown(ctx)
  const feasibility = buildFeasibility({ ...ctx, breakdown }, shape.budget)
  const limits = buildLimits(p, shape.baseDays, MAX_PLANNED_DAYS)

  const effective = {
    durationDays: shape.days,
    nights: Math.max(shape.days - 1, 0),
    travelers: p.travelers,
    travelersAssumed: p.travelersAssumed,
    durationAssumed: shape.durationAssumed,
    durationCapped: shape.durationCapped,
    budget: shape.budget,
    currency: p.currency,
    currencyAssumed: p.currencyAssumed,
    rateNote:
      p.currency !== 'USD' && !p.currencyAssumed
        ? `Approximate conversion of about ${p.rate} ${p.currency} per USD for estimates — not a live rate.`
        : null,
  }

  return { breakdown, categorySources, feasibility, limits, effective }
}

module.exports = { buildPlanCore }
