'use strict'

/**
 * Centralized environment configuration for the Dorara database layer.
 *
 * Keeping every environment lookup in one place means the rest of the codebase
 * never touches `process.env` directly — this makes the layer easy to test and
 * safe to reuse across the future Dorara modules (Education, Healthcare, Jobs,
 * Business) without duplicating configuration logic.
 */

function required(name, fallback) {
  const value = process.env[name] ?? fallback
  if (value === undefined || value === null || value === '') {
    throw new Error(`[dorara-db] Missing required environment variable: ${name}`)
  }
  return value
}

const env = {
  // Connection string, e.g. mongodb+srv://user:pass@cluster/dorara
  // No localhost fallback in production: a missing URI must fail fast at boot.
  MONGODB_URI: required(
    'MONGODB_URI',
    process.env.NODE_ENV === 'production' ? undefined : 'mongodb://127.0.0.1:27017/dorara',
  ),

  // Logical database name — allows one cluster to host multiple environments.
  DB_NAME: process.env.DB_NAME || 'dorara',

  // Bcrypt work factor. 12 is a sensible production default.
  BCRYPT_SALT_ROUNDS: Number.parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10),

  // Account-lockout policy used by the User model.
  MAX_LOGIN_ATTEMPTS: Number.parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5', 10),
  ACCOUNT_LOCK_MINUTES: Number.parseInt(process.env.ACCOUNT_LOCK_MINUTES || '15', 10),

  // Token lifetimes (used to drive the TTL indexes on token collections).
  REFRESH_TOKEN_TTL_DAYS: Number.parseInt(process.env.REFRESH_TOKEN_TTL_DAYS || '30', 10),
  SESSION_TTL_DAYS: Number.parseInt(process.env.SESSION_TTL_DAYS || '30', 10),
  EMAIL_VERIFICATION_TTL_HOURS: Number.parseInt(process.env.EMAIL_VERIFICATION_TTL_HOURS || '24', 10),
  PASSWORD_RESET_TTL_MINUTES: Number.parseInt(process.env.PASSWORD_RESET_TTL_MINUTES || '60', 10),

  NODE_ENV: process.env.NODE_ENV || 'development',
}

module.exports = env
