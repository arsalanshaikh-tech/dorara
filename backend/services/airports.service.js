'use strict'

/**
 * Airport lookup over the bundled static dataset (data/airports.json) — no
 * quota-limited API. Used for (a) departure-city autocomplete, and (b) resolving
 * free-text origins / destination cities to IATA codes before any live flight
 * search. A wrong code is worse than a missing one, so resolution only returns an
 * airport when the match is unambiguous; otherwise it returns null and the
 * caller falls back to labelled demo flights.
 *
 * Replace the shipped seed with the full OurAirports-derived list:
 *   node scripts/build-airports.js
 */

const fallbackData = require('../data/airports.json')

// Common alternative names for cities that are in the dataset under another name.
const CITY_ALIASES = {
  'new delhi': 'delhi',
  bangalore: 'bengaluru',
  bombay: 'mumbai',
  calcutta: 'kolkata',
  madras: 'chennai',
  cochin: 'kochi',
  saigon: 'ho chi minh city',
  peking: 'beijing',
  'new york city': 'new york',
}

const strip = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

/** Build lookup indexes over a dataset (exported for tests with custom data). */
function createAirportIndex(data) {
  const list = data.map((a, rank) => ({
    ...a,
    rank,
    _city: strip(a.city),
    _name: strip(a.name),
    _iata: a.iata.toLowerCase(),
  }))
  const byIata = new Map(list.map((a) => [a.iata, a]))

  const publicShape = (a) => ({ iata: a.iata, name: a.name, city: a.city, country: a.country, lat: a.lat ?? null, lon: a.lon ?? null })

  /** Autocomplete: ranked by exact code, city prefix, name/city substring, dataset order. */
  function search(query, limit = 8) {
    const q = strip(query)
    if (q.length < 2) return []
    const scored = []
    for (const a of list) {
      let score = 0
      if (a._iata === q) score = 100
      else if (a._city === q) score = 90
      else if (a._city.startsWith(q)) score = 70
      else if (a._name.startsWith(q)) score = 60
      else if (a._city.includes(q) || a._name.includes(q)) score = 40
      else if (q.length >= 3 && a._iata.startsWith(q)) score = 30
      if (score > 0) scored.push({ a, score })
    }
    return scored
      .sort((x, y) => y.score - x.score || x.a.rank - y.a.rank)
      .slice(0, limit)
      .map((s) => publicShape(s.a))
  }

  /**
   * Resolve free text ("Nagpur", "Delhi, India", "Mumbai (BOM)", "LHR") to ONE airport.
   * @returns {{iata:string,name:string,city:string,country:string}|null}
   */
  function resolve(text) {
    if (typeof text !== 'string' || !text.trim()) return null

    // 1) An explicit, valid IATA code: "(BOM)" or a bare "LHR".
    const codes = text.match(/\b[A-Z]{3}\b/g) ?? []
    for (const c of codes) {
      const hit = byIata.get(c)
      if (hit) return publicShape(hit)
    }

    const segments = text
      .split(/[,/(–-]/)
      .map(strip)
      .filter(Boolean)
      .map((seg) => CITY_ALIASES[seg] ?? seg)

    // 2) Exact city match on any comma-separated segment; first (largest) airport wins.
    for (const seg of segments) {
      const hits = list.filter((a) => a._city === seg)
      if (hits.length) return publicShape(hits[0])
    }

    // 3) City prefix / airport-name match, accepted only if all hits are ONE city.
    for (const seg of segments) {
      if (seg.length < 4) continue
      const hits = list.filter((a) => a._city.startsWith(seg) || a._name.includes(seg))
      const cities = new Set(hits.map((a) => a._city))
      if (hits.length && cities.size === 1) return publicShape(hits[0])
    }
    return null
  }

  return { search, resolve, get: (iata) => (byIata.get(String(iata).toUpperCase()) ? publicShape(byIata.get(String(iata).toUpperCase())) : null), size: list.length }
}

const defaultIndex = createAirportIndex(fallbackData)

/**
 * Destination airport: the fixture's airport when it is a known code, else the
 * destination's city name resolved against the dataset.
 */
function resolveDestinationAirport(index, { placeName, fixtureAirport, hasFixture }) {
  if (hasFixture && fixtureAirport) {
    const hit = index.get(fixtureAirport)
    if (hit) return hit
  }
  return index.resolve(placeName)
}

module.exports = {
  ...defaultIndex,
  createAirportIndex,
  resolveDestinationAirport,
  defaultIndex,
  strip,
}
