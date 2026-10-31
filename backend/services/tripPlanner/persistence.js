'use strict'

/** Saved-plan persistence used by the orchestrator (signed-in users only). */
function getModels() {
  return require('../../config/database').models
}

async function savePlan({ userId, input, plan }) {
  const doc = await getModels().TripPlan.create({
    user: userId,
    title: `${plan.destination.name} · ${plan.effective.durationDays} ${plan.effective.durationDays === 1 ? 'day' : 'days'}`,
    requirementsSnapshot: input.answers,
    destinationSnapshot: input.destination,
    plan,
    destinationName: plan.destination.name,
    destinationCountry: plan.destination.country ?? '',
    durationDays: plan.effective.durationDays,
    currency: plan.effective.currency,
    estimatedTotal: plan.budget.total,
    feasibility: plan.feasibility.status,
    isDemo: plan.meta.isDemo,
    itinerarySource: plan.meta.itinerarySource,
  })
  return { id: doc.id }
}

/** Append a What-if to the history of a plan the user owns. Returns true when recorded. */
async function recordAdjustment({ userId, planId, adjustments, plan }) {
  const summary = [
    adjustments.budget ? `budget ${adjustments.budget}` : null,
    adjustments.durationDays ? `${adjustments.durationDays} days` : null,
  ]
    .filter(Boolean)
    .join(', ')
  const updated = await getModels().TripPlan.findOneAndUpdate(
    { _id: planId, user: userId },
    { $push: { adjustments: { adjustments, summary: `${summary} → ${plan.feasibility.status}` } }, $inc: { version: 1 } },
    { new: true },
  )
  return Boolean(updated)
}

module.exports = { savePlan, recordAdjustment }
