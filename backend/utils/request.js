'use strict'

/**
 * Helpers to extract request metadata (IP, user agent, a coarse device label)
 * used for session records, refresh-token provenance and search-history logging.
 */

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for']
  if (forwarded) return String(forwarded).split(',')[0].trim()
  return req.ip || req.socket?.remoteAddress || ''
}

function getUserAgent(req) {
  return req.headers['user-agent'] || ''
}

/** Best-effort human-readable device label, e.g. "Chrome on macOS". */
function getDeviceLabel(userAgent = '') {
  const ua = userAgent.toLowerCase()

  let browser = 'Unknown browser'
  if (ua.includes('edg/')) browser = 'Edge'
  else if (ua.includes('chrome') && !ua.includes('chromium')) browser = 'Chrome'
  else if (ua.includes('firefox')) browser = 'Firefox'
  else if (ua.includes('safari') && !ua.includes('chrome')) browser = 'Safari'

  let os = 'Unknown OS'
  if (ua.includes('windows')) os = 'Windows'
  else if (ua.includes('mac os') || ua.includes('macintosh')) os = 'macOS'
  else if (ua.includes('android')) os = 'Android'
  else if (ua.includes('iphone') || ua.includes('ipad')) os = 'iOS'
  else if (ua.includes('linux')) os = 'Linux'

  return `${browser} on ${os}`
}

function getRequestContext(req) {
  const userAgent = getUserAgent(req)
  return {
    ip: getClientIp(req),
    userAgent,
    device: getDeviceLabel(userAgent),
  }
}

module.exports = { getClientIp, getUserAgent, getDeviceLabel, getRequestContext }
