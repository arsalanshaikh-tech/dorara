'use strict'

const { getProviderStatus } = require('../config/providers')

const READY_STATES = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' }

/**
 * Builds the GET /health payload. Always reports HTTP 200 (so uptime pingers
 * and Render's health check don't flap on a brief DB blip) but `status` becomes
 * "degraded" when the database is not connected. Provider flags are booleans
 * only — never keys.
 *
 * @param {{ connection?: { readyState?: number } }} mongoose
 */
function buildHealth(mongoose, { uptime = process.uptime(), now = new Date() } = {}) {
  const db = READY_STATES[mongoose?.connection?.readyState] || 'unknown'
  return {
    status: db === 'connected' ? 'ok' : 'degraded',
    uptime,
    timestamp: now.toISOString(),
    db,
    providers: getProviderStatus(),
  }
}

module.exports = { buildHealth }
