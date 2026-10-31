/**
 * Browser API client for the Dorara backend.
 *
 * - Calls RELATIVE urls (`/api/v1/...`). `next.config.mjs` rewrites them to the backend
 *   (server-side `BACKEND_URL`), so cookies are first-party and Safari-safe. Set
 *   `NEXT_PUBLIC_API_BASE_URL` only to bypass the proxy (the backend then needs CORS + cookies
 *   configured for cross-site use). There is no hard-coded host anywhere.
 * - Unwraps the backend envelope `{ success, data, meta }` and normalizes every failure into
 *   `ApiClientError { message, code, status }` (codes match the backend's ERROR_CODES, plus
 *   NETWORK / TIMEOUT for transport problems).
 * - On a 401 it refreshes the session ONCE (`POST /auth/refresh`) and retries the request.
 * - Render's free tier sleeps: if a request is still pending after a few seconds, `waking`
 *   becomes true so the UI can say "Waking up the server…" (see `subscribeApiStatus`).
 */

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? '/api/v1'
/** Dev/testing only. Production builds must never set this. */
export const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS === 'true'

/** Long enough for AI + provider calls and a cold start; under Vercel's 120s rewrite cutoff. */
const DEFAULT_TIMEOUT_MS = 100_000
const SLOW_AFTER_MS = 5_000

export class ApiClientError extends Error {
  readonly code: string
  readonly status: number
  readonly details?: unknown
  constructor(message: string, code: string, status: number, details?: unknown) {
    super(message)
    this.name = 'ApiClientError'
    this.code = code
    this.status = status
    this.details = details
  }
}

// ----- "server is waking up" status (tiny external store) -----
type Listener = () => void
const listeners = new Set<Listener>()
let waking = false
let inFlightSlow = 0

function setWaking(next: boolean) {
  if (waking === next) return
  waking = next
  listeners.forEach((l) => l())
}

export function subscribeApiStatus(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
export const getApiWaking = (): boolean => waking

// ----- helpers -----
type RequestOptions = {
  body?: unknown
  signal?: AbortSignal
  timeoutMs?: number
  /** Internal: set when this call is the post-refresh retry. */
  _retried?: boolean
  /** Do not try the refresh-and-retry dance (auth endpoints themselves). */
  noRefresh?: boolean
}

export type ApiResult<T> = { data: T; meta?: Record<string, unknown> }

let refreshInFlight: Promise<boolean> | null = null

async function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
      .then((r) => r.ok)
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null
      })
  }
  return refreshInFlight
}

function abortError(): Error {
  const e = new Error('Aborted')
  e.name = 'AbortError'
  return e
}

export async function apiRequest<T = unknown>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  options: RequestOptions = {},
): Promise<ApiResult<T>> {
  const { body, signal, timeoutMs = DEFAULT_TIMEOUT_MS } = options
  if (signal?.aborted) throw abortError()

  const controller = new AbortController()
  let timedOut = false
  const timeout = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)
  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort, { once: true })

  let slowCounted = false
  const slowTimer = setTimeout(() => {
    slowCounted = true
    inFlightSlow += 1
    setWaking(true)
  }, SLOW_AFTER_MS)

  try {
    let res: Response
    try {
      res = await fetch(`${API_BASE}${path}`, {
        method,
        credentials: 'include',
        headers: body === undefined ? { Accept: 'application/json' } : { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      })
    } catch (err) {
      if (timedOut) throw new ApiClientError('The server took too long to respond. Please try again.', 'TIMEOUT', 0)
      if (signal?.aborted || (err instanceof Error && err.name === 'AbortError')) throw abortError()
      throw new ApiClientError('We couldn’t reach the server. Check your connection and try again.', 'NETWORK', 0)
    }

    if (res.status === 401 && !options._retried && !options.noRefresh && !path.startsWith('/auth/')) {
      if (await refreshSession()) {
        return apiRequest<T>(method, path, { ...options, _retried: true })
      }
    }

    if (res.status === 204) return { data: undefined as T }

    let json: unknown = null
    try {
      json = await res.json()
    } catch {
      /* non-JSON body */
    }
    const env = (json && typeof json === 'object' ? json : {}) as {
      success?: boolean
      data?: T
      meta?: Record<string, unknown>
      error?: { code?: string; message?: string; details?: unknown }
    }

    if (!res.ok || env.success === false) {
      const code = env.error?.code ?? (res.status === 429 ? 'RATE_LIMITED' : res.status >= 500 ? 'SERVER_ERROR' : 'REQUEST_FAILED')
      const message = env.error?.message ?? (res.status >= 500 ? 'The server had a problem. Please try again.' : 'The request could not be completed.')
      throw new ApiClientError(message, code, res.status, env.error?.details)
    }
    return { data: env.data as T, meta: env.meta }
  } finally {
    clearTimeout(timeout)
    clearTimeout(slowTimer)
    signal?.removeEventListener('abort', onAbort)
    if (slowCounted) {
      inFlightSlow -= 1
      if (inFlightSlow <= 0) {
        inFlightSlow = 0
        setWaking(false)
      }
    }
  }
}

/** Fire-and-forget request that wakes a sleeping backend (no cookies, result ignored). */
export function prewarmServer(): void {
  if (typeof window === 'undefined' || USE_MOCKS) return
  fetch('/api/health', { method: 'GET', cache: 'no-store' }).catch(() => {})
}
