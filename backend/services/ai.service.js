'use strict'

const { generateObject } = require('ai')
const { z } = require('zod')
const env = require('../config/env')
const logger = require('../utils/logger')

/**
 * AI service.
 *
 * Uses the Vercel AI SDK through the AI Gateway to perform REAL LLM-based
 * ranking and reasoning over the destination catalog. A single model string
 * (env.AI_MODEL, e.g. "openai/gpt-4o-mini") is routed by the Gateway, so no
 * provider SDKs are required.
 *
 * Availability is key-gated: if no AI_GATEWAY_API_KEY (or OPENAI_API_KEY) is
 * configured, `isEnabled()` returns false and the recommendation engine uses
 * its deterministic local scoring instead. This keeps the app fully functional
 * with zero configuration while allowing a one-variable upgrade to real AI.
 */

/** Whether a real AI provider is configured. */
function isEnabled() {
  return Boolean(env.AI_GATEWAY_API_KEY || env.OPENAI_API_KEY)
}

// Schema the model must return: a ranked list with scores + reasoning.
const rankingSchema = z.object({
  rankings: z
    .array(
      z.object({
        slug: z.string().describe('The exact slug of the destination being ranked'),
        score: z.number().min(0).max(100).describe('Match score 0-100 for this traveller'),
        reason: z.string().describe('One concise sentence on why it fits this traveller'),
      }),
    )
    .describe('Destinations ordered best-first'),
  summary: z.string().describe('A short, friendly overview of the overall recommendation'),
})

/**
 * Rank destinations for a traveller using a real LLM.
 *
 * @param {Object} answers - The traveller's questionnaire answers
 * @param {Array<Object>} destinations - Candidate destinations (plain objects)
 * @returns {Promise<{rankings:Array<{slug:string,score:number,reason:string}>,summary:string}|null>}
 *          Structured ranking, or null if AI is disabled/unavailable.
 */
async function rankDestinations(answers, destinations) {
  if (!isEnabled()) return null
  if (!Array.isArray(destinations) || destinations.length === 0) return null

  // Compact catalog so the prompt stays small and cheap.
  const catalog = destinations.map((d) => ({
    slug: d.slug,
    name: `${d.name}, ${d.country}`,
    tags: d.tags,
    weather: d.weather,
    avgTempC: d.avgTempC,
    safetyIndex: d.safetyIndex,
    costFactor: d.costFactor,
  }))

  const prompt = [
    'You are a travel recommendation engine. Rank the candidate destinations for this traveller.',
    'Only use destinations from the provided catalog and return their exact "slug" values.',
    'Weigh interests, weather preference, safety importance, budget, party type and any notes.',
    '',
    `Traveller answers:\n${JSON.stringify(answers, null, 2)}`,
    '',
    `Destination catalog:\n${JSON.stringify(catalog, null, 2)}`,
  ].join('\n')

  try {
    const { object } = await generateObject({
      model: env.AI_MODEL,
      schema: rankingSchema,
      prompt,
    })

    // Keep only rankings whose slug exists in the catalog.
    const validSlugs = new Set(catalog.map((c) => c.slug))
    object.rankings = object.rankings.filter((r) => validSlugs.has(r.slug))
    if (object.rankings.length === 0) return null

    logger.info('[ai.service] AI ranking generated', {
      model: env.AI_MODEL,
      ranked: object.rankings.length,
    })
    return object
  } catch (err) {
    logger.error('[ai.service] AI ranking failed; falling back to local scoring', {
      error: err.message,
    })
    return null
  }
}

module.exports = {
  isEnabled,
  rankDestinations,
}
