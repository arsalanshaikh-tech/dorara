'use strict'

const { test } = require('node:test')
const assert = require('node:assert/strict')
const path = require('path')
const os = require('os')
process.env.LOG_DIR = path.join(os.tmpdir(), 'dorara-test-logs')
const root = path.join(__dirname, '..')
const airports = require(path.join(root, 'services/airports.service'))
const { transform, parseCsv } = require(path.join(root, 'scripts/build-airports'))
const { DESTINATION_FIXTURES } = require(path.join(root, 'services/tripPlanner/fixtures'))

test('airports seed: unique 3-letter codes, required fields', () => {
  const data = require(path.join(root, 'data/airports.json'))
  const seen = new Set()
  for (const a of data) {
    assert.match(a.iata, /^[A-Z]{3}$/)
    assert.ok(!seen.has(a.iata), `duplicate ${a.iata}`)
    seen.add(a.iata)
    assert.ok(a.name && a.city && a.country, a.iata)
  }
  assert.ok(data.length >= 100)
})

test('airports seed covers every demo destination fixture airport', () => {
  for (const f of Object.values(DESTINATION_FIXTURES)) assert.ok(airports.get(f.airport), `${f.id} -> ${f.airport}`)
})

test('airports: spot-check well-known codes', () => {
  const known = { LHR: 'London', CDG: 'Paris', JFK: 'New York', DEL: 'Delhi', NAG: 'Nagpur', DXB: 'Dubai', SIN: 'Singapore', NRT: 'Tokyo', SYD: 'Sydney', LIS: 'Lisbon', BOM: 'Mumbai', DPS: 'Denpasar', KEF: 'Reykjavik', ZQN: 'Queenstown', CNX: 'Chiang Mai' }
  for (const [code, city] of Object.entries(known)) assert.equal(airports.get(code).city, city, code)
})

test('airports.resolve: free text, codes, aliases; ambiguous or unknown -> null', () => {
  assert.equal(airports.resolve('Nagpur').iata, 'NAG')
  assert.equal(airports.resolve('Delhi, India').iata, 'DEL')
  assert.equal(airports.resolve('New Delhi').iata, 'DEL')
  assert.equal(airports.resolve('Mumbai (BOM)').iata, 'BOM')
  assert.equal(airports.resolve('lisbon').iata, 'LIS')
  assert.equal(airports.resolve('  LHR ').iata, 'LHR')
  assert.equal(airports.resolve('Springfield'), null)
  assert.equal(airports.resolve(''), null)
  assert.equal(airports.resolve(null), null)
  assert.equal(airports.resolve('ZZZ'), null, 'unknown code must not resolve')
})

test('airports.resolve: a wrong code is never produced for unknown words', () => {
  for (const t of ['my house', 'somewhere warm', 'NOPE']) assert.equal(airports.resolve(t), null, t)
})

test('airports.search: ranks exact/prefix matches, ignores short queries, accepts free text', () => {
  assert.equal(airports.search('l')[0], undefined)
  assert.equal(airports.search('lisb')[0].iata, 'LIS')
  assert.ok(airports.search('tokyo').map((a) => a.iata).includes('HND'))
  assert.equal(airports.search('LHR')[0].iata, 'LHR')
  assert.deepEqual(airports.search('zzzzqq'), [])
  assert.ok(airports.search('london', 3).length <= 3)
})

test('resolveDestinationAirport: fixture airport first, else city name, else null', () => {
  const idx = airports.defaultIndex
  assert.equal(airports.resolveDestinationAirport(idx, { placeName: 'Lisbon', fixtureAirport: 'LIS', hasFixture: true }).iata, 'LIS')
  assert.equal(airports.resolveDestinationAirport(idx, { placeName: 'Paris', fixtureAirport: '—', hasFixture: false }).iata, 'CDG')
  assert.equal(airports.resolveDestinationAirport(idx, { placeName: 'Tbilisi', fixtureAirport: '—', hasFixture: false }), null)
})

test('build-airports transform: keeps IATA + scheduled_service=yes, ranks by size, handles quotes', () => {
  const csv = [
    'id,ident,type,name,latitude_deg,longitude_deg,elevation_ft,continent,iso_country,iso_region,municipality,scheduled_service,gps_code,iata_code',
    '1,AAAA,small_airport,"Small, Field",10.1234,20.5678,0,EU,GB,GB-ENG,Smallville,yes,AAAA,SML',
    '2,BBBB,large_airport,"Big ""Hub"" Airport",51.47,-0.4543,83,EU,GB,GB-ENG,London,yes,BBBB,BIG',
    '3,CCCC,medium_airport,No Service,1,1,0,EU,GB,GB-ENG,Nowhere,no,CCCC,NOS',
    '4,DDDD,heliport,Heli,1,1,0,EU,GB,GB-ENG,Heliton,yes,DDDD,HEL',
    '5,EEEE,medium_airport,No Code,1,1,0,EU,GB,GB-ENG,Codeless,yes,EEEE,',
    '6,FFFF,medium_airport,Bad Code,1,1,0,EU,GB,GB-ENG,Badcode,yes,FFFF,AB',
    '7,GGGG,medium_airport,Dup,1,1,0,EU,GB,GB-ENG,Dupe,yes,GGGG,BIG',
  ].join('\r\n')
  const out = transform(csv)
  assert.deepEqual(out.map((a) => a.iata), ['BIG', 'SML'])
  assert.equal(out[0].name, 'Big "Hub" Airport')
  assert.equal(out[1].name, 'Small, Field')
  assert.deepEqual(Object.keys(out[0]), ['iata', 'name', 'city', 'country', 'lat', 'lon'])
  assert.equal(out[1].lat, 10.123)
})

test('build-airports transform: missing columns fail loudly', () => {
  assert.throws(() => transform('a,b\n1,2'), /missing/)
  assert.deepEqual(parseCsv('a,b\n"x,1",2'), [['a', 'b'], ['x,1', '2']])
})
