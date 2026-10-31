'use strict'

const env = require('../config/env')
const logger = require('./logger')

/**
 * Resilient HTTP client wrapper around the global `fetch` (Node 18+).
 *
 * Features required by the spec for calling external live-data / AI providers:
 *   • per-request timeout (AbortController)
 *   • bounded retries with exponential backoff (only for transient failures)
 *   • a simple per-host circuit breaker so a failing provider fails fast
 *     instead of hammering it and slowing every request.
 *
 * External APIs are only ever called through this client (never directly from
 * controllers), keeping resilience policy in one place.
 */

const BREAKER_THRESHOLD = 5 // consecutive failures before opening
const BREAKER_COOLDOWN_MS = 30_000 // stay open this long before a trial request
const breakers = new Map() // host -> { failures, openedAt }

function hostOf(url) {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

function breakerState(host) {
  const b = breakers.get(host)
  if (!b) return { open: false }
  if (b.openedAt && Date.now() - b.openedAt < BREAKER_COOLDOWN_MS) return { open: true }
  return { open: false }
}

function recordSuccess(host) {
  breakers.delete(host)
}

function recordFailure(host) {
  const b = breakers.get(host) || { failures: 0, openedAt: null }
  b.failures += 1
  if (b.failures >= BREAKER_THRESHOLD) b.openedAt = Date.now()
  breakers.set(host, b)
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Perform a JSON request with timeout, retries and circuit breaking.
 * Returns parsed JSON on success; throws on non-2xx or exhausted retries.
 */
async function requestJson(url, options = {}) {
  const {
    method = 'GET',
    headers = {},
    body,
    timeout = env.HTTP_TIMEOUT_MS,
    retries = env.HTTP_MAX_RETRIES,
    retryOn = [408, 429, 500, 502, 503, 504],
  } = options

  const host = hostOf(url)
  if (breakerState(host).open) {
    throw new Error(`Circuit open for ${host} — skipping request`)
  }

  let attempt = 0
  let lastError

  while (attempt <= retries) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json', ...headers } : headers,
        body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
        signal: controller.signal,
      })
      clearTimeout(timer)

      if (!res.ok) {
        if (retryOn.includes(res.status) && attempt < retries) {
          attempt += 1
          await sleep(2 ** attempt * 150)
          continue
        }
        recordFailure(host)
        const text = await res.text().catch(() => '')
        throw new Error(`Request to ${host} failed with ${res.status}: ${text.slice(0, 200)}`)
      }

      recordSuccess(host)
      const contentType = res.headers.get('content-type') || ''
      return contentType.includes('application/json') ? res.json() : res.text()
    } catch (err) {
      clearTimeout(timer)
      lastError = err
      const transient = err.name === 'AbortError' || err.code === 'ECONNRESET'
      if (transient && attempt < retries) {
        attempt += 1
        logger.warn(`[http] retry ${attempt}/${retries} for ${host}: ${err.message}`)
        await sleep(2 ** attempt * 150)
        continue
      }
      recordFailure(host)
      break
    }
  }

  throw lastError || new Error(`Request to ${host} failed`)
}

module.exports = { requestJson }
