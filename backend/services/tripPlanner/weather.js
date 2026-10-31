'use strict'

/**
 * Real forecast note for "Things to consider" (Open-Meteo, free, no key).
 * Only used when the trip starts within the forecast window (<= 14 days) AND the
 * destination airport has coordinates; otherwise returns null — we never guess the
 * weather. All numbers in the sentence come straight from the API response.
 */
const FORECAST_DAYS = 14

async function getForecastNote({ lat, lon, start, days, now = () => new Date(), fetchImpl = globalThis.fetch, timeoutMs = 4000 }) {
  if (typeof lat !== 'number' || typeof lon !== 'number' || !start || !/^\d{4}-\d{2}-\d{2}$/.test(start)) return null
  const today = new Date(now().toISOString().slice(0, 10)).getTime()
  const startMs = new Date(`${start}T00:00:00Z`).getTime()
  const offset = Math.round((startMs - today) / 86_400_000)
  if (!(offset >= 0 && offset <= FORECAST_DAYS - 1)) return null

  const lastDay = Math.min(offset + Math.max(days, 1) - 1, FORECAST_DAYS - 1)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=${FORECAST_DAYS}`
    const res = await fetchImpl(url, { signal: controller.signal })
    if (!res.ok) return null
    const daily = (await res.json())?.daily
    const slice = (arr) => (Array.isArray(arr) ? arr.slice(offset, lastDay + 1).filter((n) => typeof n === 'number') : [])
    const hi = slice(daily?.temperature_2m_max)
    const lo = slice(daily?.temperature_2m_min)
    const rain = slice(daily?.precipitation_probability_max)
    if (!hi.length || !lo.length) return null
    const covered = hi.length
    const rainText = rain.length ? `, with up to ${Math.round(Math.max(...rain))}% chance of rain` : ''
    return `Forecast for the first ${covered} day${covered === 1 ? '' : 's'} of your trip: highs around ${Math.round(Math.min(...hi))}–${Math.round(Math.max(...hi))}°C and lows around ${Math.round(Math.min(...lo))}–${Math.round(Math.max(...lo))}°C${rainText} (Open-Meteo). Forecasts change, so re-check before you travel.`
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

module.exports = { getForecastNote, FORECAST_DAYS }
