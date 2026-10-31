'use strict'

const env = require('./env')

/**
 * Which optional providers are configured. Booleans only — keys are never
 * returned or logged. Used by GET /health and the startup report.
 */
function getProviderStatus() {
  return {
    ai: env.features.ai,
    flights: env.features.serpapi,
    stays: env.features.serpapi,
    images: env.features.pexels,
    email: env.features.email,
    weather: env.features.weather,
    currency: env.features.currency,
  }
}

/** Log a clear, secret-free startup summary (plus config warnings). */
function logProviderStatus(logger) {
  const p = getProviderStatus()

  if (!p.ai) {
    logger.warn(
      '[config] AI provider not configured (AI_GATEWAY_API_KEY) — trip itineraries use the deterministic fallback.',
    )
  }
  if (!p.flights) {
    logger.warn(
      '[config] SERPAPI_API_KEY not set — flights and stays use clearly labelled demo data.',
    )
  }
  if (!p.images) {
    logger.info('[config] PEXELS_API_KEY not set — destination hero images are disabled.')
  }
  if (!p.email) {
    logger.info('[config] SMTP not configured — emails are skipped (sign-in does not require email verification).')
  }
  if (env.isProd && env.CLIENT_URL.includes('localhost')) {
    logger.warn(
      '[config] CLIENT_URL still points at localhost in production — set it to your deployed frontend URL.',
    )
  }
  if (env.isProd && env.COOKIE_SAMESITE === 'none') {
    logger.warn(
      '[config] COOKIE_SAMESITE=none (cross-site cookies). If the frontend proxies /api/v1/* through a Vercel rewrite, set COOKIE_SAMESITE=lax.',
    )
  }

  logger.info('[config] providers', p)
}

module.exports = { getProviderStatus, logProviderStatus }
