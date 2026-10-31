'use strict'

/**
 * PARITY: the backend budget engine must produce the same NUMBERS as the frontend
 * preview (lib/travel/trip-planner-service.ts) for identical inputs. Wording is
 * allowed to differ (the backend is honest about live vs demo sources); numbers,
 * ids, statuses and ordering are not.
 *
 * Needs `tsx` (a repo devDependency or global) to execute the frontend TypeScript;
 * the test is skipped when it is not available.
 */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const path = require('path')
const os = require('os')
const { spawnSync } = require('child_process')
process.env.LOG_DIR = path.join(os.tmpdir(), 'dorara-test-logs')

const { buildDemoPlan } = require('./helpers/buildDemoPlan')

const repoRoot = path.join(__dirname, '..', '..')
const script = path.join(__dirname, 'fixtures', 'dumpFrontendPlans.mts')

function dumpFrontend() {
  const bins = [path.join(repoRoot, 'node_modules', '.bin', 'tsx'), 'tsx']
  for (const bin of bins) {
    const r = spawnSync(bin, [script], { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    if (r.status === 0 && r.stdout) return JSON.parse(r.stdout)
  }
  return null
}

const frontend = dumpFrontend()

test('parity: frontend preview plans could be generated (tsx available)', { skip: !frontend && 'tsx not available' }, async () => {
  const { PARITY_CASES } = await import('./fixtures/parityCases.mjs')
  assert.equal(frontend.length, PARITY_CASES.length)

  PARITY_CASES.forEach((c, i) => {
    const f = frontend[i].plan
    const b = buildDemoPlan({ destination: c.destination, answers: c.answers }, c.adjustments ?? {})
    const label = c.name

    // JSON round-trip: the frontend dump drops `undefined` keys, so compare like for like.
    assert.deepEqual(JSON.parse(JSON.stringify(b.itinerary)), f.itinerary, `${label}: itinerary`)
    const stay = (a) => [a.id.split('-').pop(), a.pricePerNight, a.totalPrice, a.nights, a.rooms, a.rating]
    assert.deepEqual(b.accommodations.map(stay), f.accommodations.map(stay), `${label}: stays`)
    const fl = (a) => [a.pricePerTraveler, a.totalPrice, a.travelers, a.durationLabel, a.departureTime, a.arrivalTime, a.arrivalNote, a.stops]
    assert.deepEqual(b.flights.map(fl), f.flights.map(fl), `${label}: flights`)
    assert.deepEqual(b.breakdown.lines.map((l) => [l.key, l.label, l.amount]), f.budget.lines.map((l) => [l.key, l.label, l.amount]), `${label}: budget lines`)
    assert.equal(b.breakdown.total, f.budget.total, `${label}: total`)
    const fe = (x) => [x.status, x.label, x.budget, x.total, x.difference, x.ratio]
    assert.deepEqual(fe(b.feasibility), fe(f.feasibility), `${label}: feasibility`)
    assert.deepEqual(b.feasibility.suggestions.map((s) => [s.id, s.saving]), f.feasibility.suggestions.map((s) => [s.id, s.saving]), `${label}: suggestions`)
    assert.deepEqual(b.limits, f.limits, `${label}: limits`)
    const { rateNote: _a, ...be } = b.effective
    const { rateNote: _b, ...fe2 } = f.effective
    assert.deepEqual(be, fe2, `${label}: effective`)
  })
})
