'use strict'

/**
 * Centralized environment configuration for the Dorara backend.
 *
 * Every `process.env` lookup lives here so the rest of the codebase never
 * touches the environment directly. This keeps configuration testable and makes
 * missing/invalid values fail fast and loudly at boot instead of at request time.
 */

require('dotenv').config()

/** Read a required variable, or throw if it is missing (with optional fallback). */
function required(name, fallback) {
  const value = process.env[name] ?? fallback
  if (value === undefined || value === null || value === '') {
    throw new Error(`[dorara-backend] Missing required environment variable: ${name}`)
  }
  return value
}

/** Read an optional string variable. */
function optional(name, fallback = '') {
  const value = process.env[name]
  return value === undefined || value === null || value === '' ? fallback : value
}

/** Read an integer variable with a default. */
function int(name, fallback) {
  const raw = process.env[name]
  const parsed = Number.parseInt(raw ?? '', 10)
  return Number.isNaN(parsed) ? fallback : parsed
}

/** Read a non-negative integer variable with a default (negative/NaN -> fallback). */
function nonNegInt(name, fallback) {
  const parsed = Number.parseInt(process.env[name] ?? '', 10)
  return Number.isNaN(parsed) || parsed < 0 ? fallback : parsed
}

/** Read a float variable clamped to [min, max], with a default. */
function ratio(name, fallback, min = 0.1, max = 1) {
  const parsed = Number.parseFloat(process.env[name] ?? '')
  if (Number.isNaN(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
}

/** Read a boolean variable ("true"/"1"/"yes") with a default. */
function bool(name, fallback = false) {
  const raw = process.env[name]
  if (raw === undefined) return fallback
  return ['true', '1', 'yes', 'on'].includes(String(raw).toLowerCase())
}

/** Read a comma-separated list into a trimmed array. */
function list(name, fallback = []) {
  const raw = process.env[name]
  if (!raw) return fallback
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

const NODE_ENV = optional('NODE_ENV', 'development')
const isProd = NODE_ENV === 'production'

const env = {
  NODE_ENV,
  isProd,
  isDev: NODE_ENV === 'development',
  isTest: NODE_ENV === 'test',

  // ----- HTTP server -----
  PORT: int('PORT', 5000),
  API_PREFIX: optional('API_PREFIX', '/api/v1'),
  // Public URL of this API (used to build absolute upload URLs).
  API_URL: optional('API_URL', `http://localhost:${int('PORT', 5000)}`),
  // Public URL of the Next.js frontend (used to build verify/reset links + CORS).
  CLIENT_URL: optional('CLIENT_URL', 'http://localhost:3000'),
  // Additional allowed CORS origins (comma-separated).
  CORS_ORIGINS: list('CORS_ORIGINS', []),
  TRUST_PROXY: bool('TRUST_PROXY', isProd),

  // ----- Database -----
  // No localhost fallback in production: a missing URI must fail fast at boot.
  MONGODB_URI: required('MONGODB_URI', isProd ? undefined : 'mongodb://127.0.0.1:27017/dorara'),
  DB_NAME: optional('DB_NAME', 'dorara'),

  // ----- JWT / auth -----
  JWT_ACCESS_SECRET: required('JWT_ACCESS_SECRET', isProd ? undefined : 'dev_access_secret_change_me'),
  JWT_REFRESH_SECRET: required('JWT_REFRESH_SECRET', isProd ? undefined : 'dev_refresh_secret_change_me'),
  // Access token is short-lived; refresh token drives long sessions.
  JWT_ACCESS_EXPIRES_IN: optional('JWT_ACCESS_EXPIRES_IN', '15m'),
  JWT_REFRESH_EXPIRES_IN: optional('JWT_REFRESH_EXPIRES_IN', '30d'),
  JWT_ISSUER: optional('JWT_ISSUER', 'dorara'),
  JWT_AUDIENCE: optional('JWT_AUDIENCE', 'dorara-app'),

  // Cookie config for the httpOnly access/refresh cookies.
  COOKIE_DOMAIN: optional('COOKIE_DOMAIN', ''),
  COOKIE_SECURE: bool('COOKIE_SECURE', isProd),
  // "lax" for same-site dev, "none" for cross-site prod (requires secure).
  COOKIE_SAMESITE: optional('COOKIE_SAMESITE', isProd ? 'none' : 'lax'),

  BCRYPT_SALT_ROUNDS: int('BCRYPT_SALT_ROUNDS', 12),
  MAX_LOGIN_ATTEMPTS: int('MAX_LOGIN_ATTEMPTS', 5),
  ACCOUNT_LOCK_MINUTES: int('ACCOUNT_LOCK_MINUTES', 15),

  REFRESH_TOKEN_TTL_DAYS: int('REFRESH_TOKEN_TTL_DAYS', 30),
  // Shorter refresh lifetime when "remember me" is off.
  SESSION_SHORT_TTL_DAYS: int('SESSION_SHORT_TTL_DAYS', 1),
  EMAIL_VERIFICATION_TTL_HOURS: int('EMAIL_VERIFICATION_TTL_HOURS', 24),
  PASSWORD_RESET_TTL_MINUTES: int('PASSWORD_RESET_TTL_MINUTES', 60),

  // ----- OTP -----
  OTP_LENGTH: int('OTP_LENGTH', 6),
  OTP_TTL_MINUTES: int('OTP_TTL_MINUTES', 10),
  OTP_MAX_RETRIES: int('OTP_MAX_RETRIES', 5),

  // ----- Rate limiting -----
  RATE_LIMIT_WINDOW_MINUTES: int('RATE_LIMIT_WINDOW_MINUTES', 15),
  RATE_LIMIT_MAX: int('RATE_LIMIT_MAX', 300),
  AUTH_RATE_LIMIT_MAX: int('AUTH_RATE_LIMIT_MAX', 20),

  // ----- Uploads -----
  UPLOAD_DIR: optional('UPLOAD_DIR', 'uploads'),
  MAX_UPLOAD_MB: int('MAX_UPLOAD_MB', 8),
  // Storage driver: "cloudinary" when configured, otherwise "local".
  CLOUDINARY_URL: optional('CLOUDINARY_URL', ''),
  CLOUDINARY_CLOUD_NAME: optional('CLOUDINARY_CLOUD_NAME', ''),
  CLOUDINARY_API_KEY: optional('CLOUDINARY_API_KEY', ''),
  CLOUDINARY_API_SECRET: optional('CLOUDINARY_API_SECRET', ''),

  // ----- Email (Nodemailer SMTP) -----
  SMTP_HOST: optional('SMTP_HOST', ''),
  SMTP_PORT: int('SMTP_PORT', 587),
  SMTP_SECURE: bool('SMTP_SECURE', false),
  SMTP_USER: optional('SMTP_USER', ''),
  SMTP_PASS: optional('SMTP_PASS', ''),
  EMAIL_FROM: optional('EMAIL_FROM', 'Dorara <no-reply@dorara.ai>'),

  // ----- AI provider (recommendation ranking / reasoning) -----
  // Uses the Vercel AI SDK through the AI Gateway. Set AI_GATEWAY_API_KEY to a
  // Vercel AI Gateway key and pick any supported model string (e.g.
  // "openai/gpt-4o-mini", "anthropic/claude-3-5-haiku"). When no key is set the
  // engine transparently falls back to deterministic local scoring.
  AI_GATEWAY_API_KEY: optional('AI_GATEWAY_API_KEY', ''),
  AI_MODEL: optional('AI_MODEL', 'openai/gpt-4o-mini'),
  // Legacy single-provider keys are still honored by the gateway if present.
  OPENAI_API_KEY: optional('OPENAI_API_KEY', ''),

  // ----- Live data providers (real, keyless by default) -----
  // Weather: Open-Meteo — free, no API key required.
  OPEN_METEO_GEOCODE_URL: optional('OPEN_METEO_GEOCODE_URL', 'https://geocoding-api.open-meteo.com/v1/search'),
  OPEN_METEO_FORECAST_URL: optional('OPEN_METEO_FORECAST_URL', 'https://api.open-meteo.com/v1/forecast'),
  // Country facts: World Bank Open Data — free, no API key required.
  WORLD_BANK_URL: optional('WORLD_BANK_URL', 'https://api.worldbank.org/v2'),
  // Currency: Frankfurter (European Central Bank data) — free, no API key required.
  FRANKFURTER_URL: optional('FRANKFURTER_URL', 'https://api.frankfurter.app'),

  // ----- Trip planner: live travel data (all optional) -----
  // SerpApi (Google Flights + Google Hotels engines). Without a key the trip
  // planner serves clearly labelled demo flights/stays.
  SERPAPI_API_KEY: optional('SERPAPI_API_KEY', ''),
  // Free plan = 250 searches/month and 50/hour. Live calls stop at
  // SERPAPI_QUOTA_STOP_RATIO of the monthly limit; hourly/daily caps keep one
  // busy period from spending the month's allowance.
  SERPAPI_MONTHLY_LIMIT: nonNegInt('SERPAPI_MONTHLY_LIMIT', 250),
  SERPAPI_HOURLY_LIMIT: nonNegInt('SERPAPI_HOURLY_LIMIT', 40),
  SERPAPI_DAILY_LIMIT: nonNegInt('SERPAPI_DAILY_LIMIT', 8),
  SERPAPI_QUOTA_STOP_RATIO: ratio('SERPAPI_QUOTA_STOP_RATIO', 0.8),
  // Per-caller daily caps on LIVE searches (cache hits never count).
  LIVE_SEARCH_GUEST_DAILY: nonNegInt('LIVE_SEARCH_GUEST_DAILY', 3),
  LIVE_SEARCH_USER_DAILY: nonNegInt('LIVE_SEARCH_USER_DAILY', 10),
  FLIGHTS_CACHE_TTL_HOURS: nonNegInt('FLIGHTS_CACHE_TTL_HOURS', 6),
  HOTELS_CACHE_TTL_HOURS: nonNegInt('HOTELS_CACHE_TTL_HOURS', 12),
  // Pexels: destination hero images only (attribution required). Optional.
  PEXELS_API_KEY: optional('PEXELS_API_KEY', ''),
  // Per-call timeout for provider HTTP calls, AI call timeout, and the overall
  // deadline for POST /trip-planner/generate (all in ms).
  PROVIDER_TIMEOUT_MS: nonNegInt('PROVIDER_TIMEOUT_MS', 10000),
  TRIP_AI_TIMEOUT_MS: nonNegInt('TRIP_AI_TIMEOUT_MS', 25000),
  TRIP_GENERATE_DEADLINE_MS: nonNegInt('TRIP_GENERATE_DEADLINE_MS', 28000),
  // Request-rate limits for the trip planner endpoints (per hour).
  TRIP_RATE_LIMIT_GUEST_PER_HOUR: nonNegInt('TRIP_RATE_LIMIT_GUEST_PER_HOUR', 10),
  TRIP_RATE_LIMIT_USER_PER_HOUR: nonNegInt('TRIP_RATE_LIMIT_USER_PER_HOUR', 40),

  // ----- External call resilience -----
  HTTP_TIMEOUT_MS: int('HTTP_TIMEOUT_MS', 8000),
  HTTP_MAX_RETRIES: int('HTTP_MAX_RETRIES', 2),
  CACHE_TTL_SECONDS: int('CACHE_TTL_SECONDS', 600),

  // ----- Logging -----
  LOG_LEVEL: optional('LOG_LEVEL', isProd ? 'info' : 'debug'),
  LOG_DIR: optional('LOG_DIR', 'logs'),
}

/** Convenience feature flags derived from whether keys are present. */
env.features = {
  email: Boolean(env.SMTP_HOST && env.SMTP_USER),
  cloudinary: Boolean(
    env.CLOUDINARY_URL || (env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET),
  ),
  // Real AI is available when a Gateway (or OpenAI) key is present.
  ai: Boolean(env.AI_GATEWAY_API_KEY || env.OPENAI_API_KEY),
  // All live-data providers below are keyless and always available.
  weather: true, // Open-Meteo — no key required
  countries: true, // REST Countries — no key required
  currency: true, // Frankfurter (ECB) — no key required
  // Live flights + stays (SerpApi). Without a key, labelled demo data is served.
  serpapi: Boolean(env.SERPAPI_API_KEY),
  // Destination hero images (Pexels). Without a key, no image is shown.
  pexels: Boolean(env.PEXELS_API_KEY),
}

module.exports = env
