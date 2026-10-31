'use strict'

const { makeCacheKey } = require('./providers/providerCache.service')

/**
 * Pexels hero image for a destination (optional; needs PEXELS_API_KEY).
 * Used ONLY for destination hero images — never for hotels. The result carries the
 * photographer + Pexels links so the UI can show the attribution Pexels requires.
 * Cached for 30 days. Any failure (or no key) returns null: the UI shows nothing.
 */
const SEARCH_URL = 'https://api.pexels.com/v1/search'
const TTL_SECONDS = 30 * 24 * 3600

const https = (u) => {
  try {
    return new URL(u).protocol === 'https:' ? u : undefined
  } catch {
    return undefined
  }
}

function createPexelsService({ apiKey, cache, fetchImpl = globalThis.fetch, timeoutMs = 3000 }) {
  async function getHeroImage({ placeName, country }) {
    if (!apiKey || !placeName) return null
    const query = [placeName, country].filter(Boolean).join(' ')
    const key = makeCacheKey('pexels', { query })
    const hit = await cache.get(key)
    if (hit?.payload?.image) return hit.payload.image
    if (hit?.payload?.none) return null

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const url = `${SEARCH_URL}?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`
      const res = await fetchImpl(url, { headers: { Authorization: apiKey }, signal: controller.signal })
      if (!res.ok) return null
      const photo = (await res.json())?.photos?.[0]
      const src = https(photo?.src?.large2x ?? photo?.src?.large)
      if (!photo || !src) {
        await cache.set(key, { provider: 'pexels', kind: 'image', payload: { none: true }, dataSource: 'live', ttlSeconds: 24 * 3600 })
        return null
      }
      const image = {
        provider: 'pexels',
        url: src,
        photographer: String(photo.photographer ?? '').slice(0, 80),
        photographerUrl: https(photo.photographer_url),
        sourceUrl: https(photo.url),
      }
      await cache.set(key, { provider: 'pexels', kind: 'image', payload: { image }, dataSource: 'live', ttlSeconds: TTL_SECONDS })
      return image
    } catch {
      return null
    } finally {
      clearTimeout(timer)
    }
  }
  return { getHeroImage, isAvailable: () => Boolean(apiKey) }
}

module.exports = { createPexelsService }
