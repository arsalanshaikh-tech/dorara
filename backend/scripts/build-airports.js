#!/usr/bin/env node
'use strict'

/**
 * Builds backend/data/airports.json from the OurAirports open dataset.
 *
 *   node scripts/build-airports.js                 # downloads airports.csv
 *   node scripts/build-airports.js ./airports.csv  # or use a local copy
 *
 * Keeps only airports with an IATA code AND scheduled_service = "yes", and writes
 * a compact, ranked list: { iata, name, city, country, lat, lon }. Larger airports
 * come first, so "London" resolves to LHR before a small field. Run it once and
 * commit the result; the shipped file is a small hand-verified seed until you do.
 *
 * Source: https://davidmegginson.github.io/ourairports-data/airports.csv (public domain).
 */

const fs = require('fs')
const path = require('path')

const CSV_URL = 'https://davidmegginson.github.io/ourairports-data/airports.csv'
const OUT = path.join(__dirname, '..', 'data', 'airports.json')
const TYPE_RANK = { large_airport: 0, medium_airport: 1, small_airport: 2 }

/** Small RFC 4180 CSV parser (quoted fields, escaped quotes, CRLF). */
function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else inQuotes = false
      } else field += c
    } else if (c === '"') inQuotes = true
    else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      field = ''
      if (row.length > 1 || row[0] !== '') rows.push(row)
      row = []
    } else field += c
  }
  if (field !== '' || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

/** @returns {Array<{iata:string,name:string,city:string,country:string,lat:number|null,lon:number|null}>} */
function transform(csvText) {
  const [header, ...rows] = parseCsv(csvText)
  const col = Object.fromEntries(header.map((h, i) => [h, i]))
  for (const need of ['type', 'name', 'latitude_deg', 'longitude_deg', 'iso_country', 'municipality', 'scheduled_service', 'iata_code']) {
    if (!(need in col)) throw new Error(`airports.csv is missing the "${need}" column`)
  }

  const picked = []
  for (const r of rows) {
    const iata = (r[col.iata_code] || '').trim().toUpperCase()
    if (!/^[A-Z]{3}$/.test(iata)) continue
    if (r[col.scheduled_service] !== 'yes') continue
    const rank = TYPE_RANK[r[col.type]]
    if (rank === undefined) continue // heliports, closed, seaplane bases...
    const lat = Number.parseFloat(r[col.latitude_deg])
    const lon = Number.parseFloat(r[col.longitude_deg])
    picked.push({
      rank,
      a: {
        iata,
        name: (r[col.name] || '').trim(),
        city: (r[col.municipality] || '').trim(),
        country: (r[col.iso_country] || '').trim(),
        lat: Number.isFinite(lat) ? Math.round(lat * 1000) / 1000 : null,
        lon: Number.isFinite(lon) ? Math.round(lon * 1000) / 1000 : null,
      },
    })
  }

  picked.sort((x, y) => x.rank - y.rank || x.a.name.localeCompare(y.a.name))
  const seen = new Set()
  const out = []
  for (const { a } of picked) {
    if (seen.has(a.iata)) continue
    seen.add(a.iata)
    out.push(a)
  }
  return out
}

async function main() {
  const local = process.argv[2]
  let csv
  if (local) {
    csv = fs.readFileSync(local, 'utf8')
  } else {
    console.log(`Downloading ${CSV_URL} ...`)
    const res = await fetch(CSV_URL)
    if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`)
    csv = await res.text()
  }
  const airports = transform(csv)
  if (airports.length < 500) throw new Error(`Only ${airports.length} airports found; refusing to overwrite the data file.`)
  fs.writeFileSync(OUT, `${JSON.stringify(airports)}\n`)
  console.log(`Wrote ${airports.length} airports to ${path.relative(process.cwd(), OUT)}`)
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message)
    process.exit(1)
  })
}

module.exports = { parseCsv, transform }
