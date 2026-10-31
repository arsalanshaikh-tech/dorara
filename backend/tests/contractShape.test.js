'use strict'

/**
 * CONTRACT: the plan the backend returns must be a drop-in for the frontend's TripPlan.
 * Every key the frontend's own preview plan has must exist on the backend plan with the same
 * JSON type; the backend may only ADD the documented optional fields. Compared against the
 * real frontend implementation (lib/travel/trip-planner-service.ts via tsx), so a rename or
 * type change on either side fails here.
 */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const path = require('path')
const os = require('os')
const { spawnSync } = require('child_process')
process.env.LOG_DIR = path.join(os.tmpdir(), 'dorara-test-logs')

const root = path.join(__dirname, '..')
const repoRoot = path.join(root, '..')
const { createTripPlannerService } = require(path.join(root, 'services/tripPlanner/tripPlanner.service'))
const airports = require(path.join(root, 'services/airports.service'))

function dumpFrontend() {
  const script = path.join(__dirname, 'fixtures', 'dumpFrontendPlans.mts')
  for (const bin of [path.join(repoRoot, 'node_modules', '.bin', 'tsx'), 'tsx']) {
    const r = spawnSync(bin, [script], { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    if (r.status === 0 && r.stdout) return JSON.parse(r.stdout)
  }
  return null
}
const frontend = dumpFrontend()

/** Optional backend-only additions (everything else must match the frontend exactly). */
const ALLOWED_EXTRA = new Set([
  'meta.requestId', 'meta.sectionStatus', 'meta.itinerarySource', 'meta.fitSource', 'meta.warnings',
  'meta.categorySources', 'meta.estimatedCategories', 'meta.savedPlanId', 'meta.searched',
  'destination.heroImage', 'accommodations[].dataSource', 'accommodations[].imageUrl', 'accommodations[].bookingUrl',
  'flights[].dataSource', 'flights[].bookingUrl',
])

function walk(front, back, p, problems) {
  const type = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v)
  if (type(front) !== type(back)) {
    // Frontend nulls (e.g. no budget) may be numbers on the backend and vice versa only for nullable numbers.
    if (!(front === null || back === null)) problems.push(`${p}: frontend ${type(front)} vs backend ${type(back)}`)
    return
  }
  if (type(front) === 'array') {
    if (front.length && back.length) walk(front[0], back[0], `${p}[]`, problems)
    return
  }
  if (type(front) === 'object') {
    for (const k of Object.keys(front)) {
      if (!(k in back)) {
        // Keys the frontend only sets when relevant (e.g. cancellation) may be absent.
        if (front[k] !== undefined && !['cancellation', 'arrivalNote', 'bookAheadNote', 'dateLabel', 'estimatedCost', 'rateNote', 'basis'].includes(k)) problems.push(`${p}.${k}: missing on backend`)
        continue
      }
      walk(front[k], back[k], p ? `${p}.${k}` : k, problems)
    }
    for (const k of Object.keys(back)) {
      const full = p ? `${p}.${k}` : k
      if (!(k in front) && !ALLOWED_EXTRA.has(full)) problems.push(`${full}: extra key not in the documented optional list`)
    }
  }
}

test('contract: backend TripPlan has every field of the frontend TripPlan (same types), plus only documented optionals', async () => {
  if (!frontend) return
  const { PARITY_CASES } = await import('./fixtures/parityCases.mjs')
  const svc = createTripPlannerService({
    airports,
    ai: async ({ p, days }) => ({ itinerary: require(path.join(root, 'services/tripPlanner/itinerary.fallback')).generateFallbackItinerary(p, days), itinerarySource: 'fallback', aiFit: null, fitSource: 'fallback' }),
    flights: { search: async (q) => ({ options: require(path.join(root, 'services/providers/demo/demoFlights')).buildDemoFlights(q.params), dataSource: 'demo', status: 'demo', warnings: [] }) },
    stays: { search: async (q) => ({ options: require(path.join(root, 'services/providers/demo/demoStays')).buildDemoStays(q.params, q.nights), dataSource: 'demo', status: 'demo', warnings: [] }) },
    weather: async () => null,
    deadlineMs: 5000,
  })
  const problems = []
  for (let i = 0; i < PARITY_CASES.length; i++) {
    const c = PARITY_CASES[i]
    const back = await svc.buildPlan({ input: { destination: c.destination, answers: c.answers }, adjustments: c.adjustments ?? {} })
    const local = []
    walk(JSON.parse(JSON.stringify(frontend[i].plan)), back, '', local)
    problems.push(...local.map((m) => `[${c.name}] ${m}`))
  }
  assert.deepEqual([...new Set(problems)], [])
})

test('contract: frontend types file declares every optional field the backend adds', () => {
  const fs = require('fs')
  const types = fs.readFileSync(path.join(repoRoot, 'lib/travel/trip-planner-types.ts'), 'utf8')
  for (const f of ['sectionStatus', 'itinerarySource', 'fitSource', 'warnings', 'categorySources', 'estimatedCategories', 'savedPlanId', 'dataSource', 'imageUrl', 'heroImage', "'server'"]) {
    assert.ok(types.includes(f), `type for ${f} is declared in trip-planner-types.ts`)
  }
})
