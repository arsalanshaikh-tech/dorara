'use strict'

/**
 * Live-data service.
 *
 * Fetches REAL, live information from free public APIs that require NO API key,
 * so the platform works the moment it is deployed with zero extra configuration:
 *
 *   - Weather   -> Open-Meteo         (https://open-meteo.com)
 *   - Country   -> REST Countries     (https://restcountries.com)
 *   - Currency  -> Frankfurter / ECB  (https://frankfurter.app)
 *
 * Every call is wrapped with a timeout, a small retry, and an in-memory TTL
 * cache so we stay fast and resilient. If a provider is ever unreachable the
 * caller receives `null` and the recommendation engine degrades gracefully to
 * the values stored on the destination record.
 */

const env = require('../config/env')
const logger = require('../utils/logger')

/* ------------------------------------------------------------------ *
 * Tiny in-memory TTL cache (per-process). Keeps us well within the
 * free rate limits of the public APIs and makes repeat lookups instant.
 * ------------------------------------------------------------------ */
const cache = new Map()

function cacheGet(key) {
  const hit = cache.get(key)
  if (!hit) return undefined
  if (Date.now() > hit.expiresAt) {
    cache.delete(key)
    return undefined
  }
  return hit.value
}

function cacheSet(key, value, ttlSeconds = env.CACHE_TTL_SECONDS) {
  cache.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 })
}

/**
 * fetch JSON with an AbortController timeout and a bounded retry.
 * @private
 */
async function fetchJson(url, { retries = env.HTTP_MAX_RETRIES } = {}) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), env.HTTP_TIMEOUT_MS)
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'application/json', 'User-Agent': 'dorara-backend' },
      })
      clearTimeout(timer)
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
      return await res.json()
    } catch (err) {
      clearTimeout(timer)
      if (attempt === retries) {
        logger.warn('[livedata.service] request failed', { url, error: err.message })
        return null
      }
      // brief backoff before retrying
      await new Promise((r) => setTimeout(r, 250 * (attempt + 1)))
    }
  }
  return null
}

/* ------------------------------------------------------------------ *
 * Weather — Open-Meteo (keyless)
 * ------------------------------------------------------------------ */

// Open-Meteo WMO weather codes -> human summary.
const WEATHER_CODES = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  71: 'Slight snow',
  73: 'Moderate snow',
  75: 'Heavy snow',
  80: 'Rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with hail',
  99: 'Thunderstorm with heavy hail',
}

/**
 * Get live current weather for a city.
 * @param {string} city - City name (e.g. "Tokyo")
 * @param {string} [countryCode] - ISO alpha-2 to disambiguate the city
 * @returns {Promise<{tempC:number,summary:string,windKph:number,humidity:number,source:string}|null>}
 */
async function getWeather(city, countryCode = '') {
  if (!city) return null
  const cacheKey = `weather:${city}:${countryCode}`
  const cached = cacheGet(cacheKey)
  if (cached !== undefined) return cached

  // 1) Geocode the city -> lat/lon (keyless).
  const geoUrl =
    `${env.OPEN_METEO_GEOCODE_URL}?name=${encodeURIComponent(city)}` +
    `&count=1&language=en&format=json${countryCode ? `&countryCode=${countryCode}` : ''}`
  const geo = await fetchJson(geoUrl)
  const place = geo?.results?.[0]
  if (!place) {
    cacheSet(cacheKey, null, 120)
    return null
  }

  // 2) Current conditions forecast (keyless).
  const wxUrl =
    `${env.OPEN_METEO_FORECAST_URL}?latitude=${place.latitude}&longitude=${place.longitude}` +
    `&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m`
  const wx = await fetchJson(wxUrl)
  const current = wx?.current
  if (!current) {
    cacheSet(cacheKey, null, 120)
    return null
  }

  const result = {
    tempC: Math.round(current.temperature_2m),
    summary: WEATHER_CODES[current.weather_code] || 'Unknown',
    windKph: Math.round((current.wind_speed_10m || 0) * 1) ,
    humidity: current.relative_humidity_2m ?? null,
    latitude: place.latitude,
    longitude: place.longitude,
    source: 'open-meteo',
  }
  cacheSet(cacheKey, result)
  return result
}

/* ------------------------------------------------------------------ *
 * Country facts — World Bank Open Data (keyless)
 * ------------------------------------------------------------------ */

// ISO alpha-2 -> local currency code. Currency codes are stable ISO-4217
// constants (not volatile data), used to convert cost estimates into the
// destination's local currency alongside the traveller's own currency.
const COUNTRY_CURRENCY = {
  JP: 'JPY', PT: 'EUR', ID: 'IDR', NZ: 'NZD', IS: 'ISK', AE: 'AED',
  ES: 'EUR', TH: 'THB', US: 'USD', GB: 'GBP', FR: 'EUR', DE: 'EUR',
  IT: 'EUR', IN: 'INR', AU: 'AUD', CA: 'CAD', SG: 'SGD', CH: 'CHF',
  MX: 'MXN', BR: 'BRL', ZA: 'ZAR', TR: 'TRY', GR: 'EUR', NL: 'EUR',
}

/**
 * Get live country facts by ISO alpha-2 code from the World Bank.
 * The income level is a genuine economic signal we feed into cost estimates.
 * @param {string} countryCode - ISO alpha-2 (e.g. "JP")
 * @returns {Promise<{name:string,region:string,capital:string,incomeLevel:string,currencyCode:string,latitude:number,longitude:number,source:string}|null>}
 */
async function getCountryInfo(countryCode) {
  if (!countryCode) return null
  const cacheKey = `country:${countryCode}`
  const cached = cacheGet(cacheKey)
  if (cached !== undefined) return cached

  const url = `${env.WORLD_BANK_URL}/country/${encodeURIComponent(countryCode)}?format=json`
  const data = await fetchJson(url)
  const entry = Array.isArray(data) && Array.isArray(data[1]) ? data[1][0] : null
  if (!entry) {
    cacheSet(cacheKey, null, 300)
    return null
  }

  const result = {
    name: entry.name || '',
    region: entry.region?.value || '',
    capital: entry.capitalCity || '',
    incomeLevel: entry.incomeLevel?.value || '',
    currencyCode: COUNTRY_CURRENCY[String(countryCode).toUpperCase()] || '',
    latitude: entry.latitude ? Number(entry.latitude) : null,
    longitude: entry.longitude ? Number(entry.longitude) : null,
    source: 'worldbank',
  }
  // Country facts change rarely — cache for a day.
  cacheSet(cacheKey, result, 86400)
  return result
}

/* ------------------------------------------------------------------ *
 * Currency conversion — Frankfurter / ECB (keyless)
 * ------------------------------------------------------------------ */

/**
 * Get the live exchange rate between two ISO currency codes.
 * @param {string} from - e.g. "USD"
 * @param {string} to - e.g. "EUR"
 * @returns {Promise<number|null>} rate (1 `from` = rate `to`)
 */
async function getExchangeRate(from, to) {
  if (!from || !to) return null
  if (from === to) return 1
  const cacheKey = `fx:${from}:${to}`
  const cached = cacheGet(cacheKey)
  if (cached !== undefined) return cached

  const url = `${env.FRANKFURTER_URL}/latest?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
  const data = await fetchJson(url)
  const rate = data?.rates?.[to]
  if (typeof rate !== 'number') {
    cacheSet(cacheKey, null, 300)
    return null
  }
  // FX rates refresh daily from the ECB — cache for an hour.
  cacheSet(cacheKey, rate, 3600)
  return rate
}

/**
 * Convert an amount between currencies using live ECB rates.
 * Returns the original amount unchanged if the rate is unavailable.
 * @returns {Promise<{amount:number,rate:number,converted:boolean}>}
 */
async function convertCurrency(amount, from, to) {
  const rate = await getExchangeRate(from, to)
  if (rate == null) return { amount, rate: 1, converted: false }
  return { amount: Math.round(amount * rate), rate, converted: true }
}

module.exports = {
  getWeather,
  getCountryInfo,
  getExchangeRate,
  convertCurrency,
  // exported for tests
  _cache: cache,
}
