'use strict'

/**
 * Minimal SerpApi HTTP client (no SDK dependency — Node's built-in fetch).
 *
 * - Per-call timeout (AbortController).
 * - One retry with backoff for TRANSIENT failures only (timeout, network error, 5xx).
 *   429 and API-level errors (bad key, out of searches) are never retried.
 * - The API key goes in the query string (SerpApi's design) but is NEVER logged or
 *   included in an error message/URL.
 * - "No results" is not an error: it is returned as { empty: true } because SerpApi
 *   still counts such a search against the quota.
 */

const BASE_URL = 'https://serpapi.com/search.json'

class SerpApiError extends Error {
  /**
   * @param {'timeout'|'network'|'http'|'api'|'rate_limit'|'auth'} kind
   */
  constructor(kind, message, { status, transient = false } = {}) {
    super(message)
    this.name = 'SerpApiError'
    this.kind = kind
    this.status = status
    this.transient = transient
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Strip the key (and any api_key=... fragment) from text before it can reach a log or error. */
function redact(text, apiKey) {
  let out = String(text ?? '').replace(/api_key=[^&\s"']+/gi, 'api_key=[redacted]')
  if (apiKey) out = out.split(apiKey).join('[redacted]')
  return out
}

/** Text SerpApi uses when a valid search simply has no results. */
const EMPTY_PATTERNS = [/hasn't returned any results/i, /no results for/i, /returned no results/i]

function classifyApiError(message) {
  const m = String(message || '')
  if (EMPTY_PATTERNS.some((re) => re.test(m))) return 'empty'
  if (/invalid api key|api key is missing|run out of searches|plan.*(limit|exhaust)/i.test(m)) return 'auth'
  if (/rate limit|too many/i.test(m)) return 'rate_limit'
  return 'api'
}

/**
 * @param {object} opts
 * @param {string} opts.apiKey
 * @param {typeof fetch} [opts.fetchImpl]
 * @param {number} [opts.timeoutMs]
 * @param {number} [opts.retryDelayMs]
 */
function createSerpApiClient({ apiKey, fetchImpl = globalThis.fetch, timeoutMs = 10000, retryDelayMs = 600 }) {
  async function attempt(params) {
    const url = new URL(BASE_URL)
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v))
    }
    url.searchParams.set('api_key', apiKey)
    url.searchParams.set('output', 'json')

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    let res
    try {
      res = await fetchImpl(url, { signal: controller.signal, headers: { Accept: 'application/json' } })
    } catch (err) {
      if (err && err.name === 'AbortError') {
        throw new SerpApiError('timeout', 'SerpApi request timed out', { transient: true })
      }
      throw new SerpApiError('network', 'SerpApi request failed', { transient: true })
    } finally {
      clearTimeout(timer)
    }

    let body = null
    try {
      body = await res.json()
    } catch {
      /* non-JSON body */
    }

    if (res.status === 429) throw new SerpApiError('rate_limit', 'SerpApi rate limit reached', { status: 429 })
    if (res.status === 401 || res.status === 403) {
      throw new SerpApiError('auth', 'SerpApi rejected the credentials', { status: res.status })
    }
    if (body && typeof body.error === 'string') {
      const kind = classifyApiError(body.error)
      if (kind === 'empty') return { empty: true, json: body }
      throw new SerpApiError(kind, `SerpApi error: ${redact(body.error, apiKey).slice(0, 120)}`, { status: res.status })
    }
    if (res.status >= 500) {
      throw new SerpApiError('http', `SerpApi HTTP ${res.status}`, { status: res.status, transient: true })
    }
    if (!res.ok || !body) {
      throw new SerpApiError('http', `SerpApi HTTP ${res.status}`, { status: res.status })
    }
    return { empty: false, json: body }
  }

  /** @returns {Promise<{empty:boolean,json:any}>} */
  async function search(params) {
    try {
      return await attempt(params)
    } catch (err) {
      if (err instanceof SerpApiError && err.transient) {
        await sleep(retryDelayMs)
        return attempt(params) // single retry
      }
      throw err
    }
  }

  return { search }
}

module.exports = { createSerpApiClient, SerpApiError, classifyApiError, BASE_URL }
