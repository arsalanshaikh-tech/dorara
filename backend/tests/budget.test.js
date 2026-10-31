'use strict'

const { test } = require('node:test')
const assert = require('node:assert/strict')
const path = require('path')
const os = require('os')
process.env.LOG_DIR = path.join(os.tmpdir(), 'dorara-test-logs')

const root = path.join(__dirname, '..')
const { buildDemoPlan } = require('./helpers/buildDemoPlan')
const { calculateFeasibility, middleByPrice, buildLimits } = require(path.join(root, 'services/tripPlanner/budget.service'))

const dest = { id: 'lisbon', name: 'Lisbon, Portugal', country: 'Portugal', avgTempC: 20, safetyIndex: 90 }
const answers = (o = {}) => ({
  budget: { min: 1, max: 3000, currency: 'EUR' },
  dates: { start: '2027-03-10', end: null, durationDays: 6 },
  party: 'Couple',
  interest_type: ['Food & nightlife'],
  ...o,
})

test('budget: lines are rounded integers and total is EXACTLY their sum (many shapes)', () => {
  for (const days of [1, 2, 3, 6, 10, 21]) {
    for (const party of ['Solo', 'Couple', 'Family (kids)', null]) {
      const plan = buildDemoPlan({ destination: dest, answers: answers({ party, dates: { start: null, end: null, durationDays: days } }) })
      const sum = plan.breakdown.lines.reduce((s, l) => s + l.amount, 0)
      assert.equal(plan.breakdown.total, sum, `days=${days} party=${party}`)
      for (const l of plan.breakdown.lines) assert.ok(Number.isInteger(l.amount), `${l.key} integer`)
    }
  }
})

test('budget: six categories in fixed order', () => {
  const plan = buildDemoPlan({ destination: dest, answers: answers() })
  assert.deepEqual(plan.breakdown.lines.map((l) => l.key), ['flights', 'accommodation', 'food', 'activities', 'transport', 'misc'])
})

test('feasibility thresholds: within / close (>=90%) / above (>100%) / equal is close', () => {
  const f = (budget, total) =>
    calculateFeasibility({ budget, total, currency: 'USD', budgetAmountSaved: budget, suggestionsFn: () => [{ id: 's' }] })
  assert.equal(f(1000, 899).status, 'within')
  assert.equal(f(1000, 900).status, 'close')
  assert.equal(f(1000, 1000).status, 'close')
  assert.equal(f(1000, 1001).status, 'above')
  assert.equal(f(1000, 1001).difference, -1)
  assert.equal(f(1000, 500).difference, 500)
  assert.deepEqual(f(1000, 500).suggestions, [], 'no suggestions when comfortably within')
  assert.ok(f(1000, 1200).suggestions.length > 0, 'suggestions when above')
})

test('feasibility: missing budget is neutral (unknown) with no invented numbers', () => {
  const r = calculateFeasibility({ budget: null, total: 1234, currency: 'USD', budgetAmountSaved: null, suggestionsFn: () => [] })
  assert.equal(r.status, 'unknown')
  assert.equal(r.budget, null)
  assert.equal(r.difference, null)
  assert.equal(r.ratio, null)
  assert.match(r.message, /No budget was saved/)
})

test('feasibility: unsupported currency never compares against a wrong-currency budget', () => {
  const plan = buildDemoPlan({ destination: dest, answers: answers({ budget: { min: 1, max: 500000, currency: 'JPY' } }) })
  assert.equal(plan.feasibility.status, 'unknown')
  assert.equal(plan.effective.currencyAssumed, true)
  assert.equal(plan.effective.budget, null)
})

test('suggestions: only when above/close; numbers come from the plan; sorted by saving', () => {
  const over = buildDemoPlan({ destination: dest, answers: answers({ budget: { min: 1, max: 900, currency: 'EUR' } }) })
  assert.equal(over.feasibility.status, 'above')
  assert.ok(over.feasibility.suggestions.length >= 2)
  const savings = over.feasibility.suggestions.map((s) => s.saving ?? 0)
  assert.deepEqual(savings, [...savings].sort((a, b) => b - a))
  const rich = buildDemoPlan({ destination: dest, answers: answers({ budget: { min: 1, max: 90000, currency: 'EUR' } }) })
  assert.equal(rich.feasibility.status, 'within')
  assert.deepEqual(rich.feasibility.suggestions, [])
})

test('shorten-trip suggestion is computed by really re-estimating shorter trips', () => {
  const over = buildDemoPlan({ destination: dest, answers: answers({ budget: { min: 1, max: 1600, currency: 'EUR' } }) })
  const s = over.feasibility.suggestions.find((x) => x.id === 'shorten-trip')
  assert.ok(s)
  const m = s.detail.match(/(\d+)-day version is estimated at €(\d[\d,]*\d)/)
  if (m) {
    const days = Number(m[1])
    const shorter = buildDemoPlan({ destination: dest, answers: answers({ budget: { min: 1, max: 1600, currency: 'EUR' } }) }, { durationDays: days })
    assert.equal(`€${shorter.breakdown.total.toLocaleString('en-US')}`, `€${m[2]}`)
    assert.ok(shorter.breakdown.total <= 1600)
  }
})

test('duration adjustment changes days, nights, stay total and overall total', () => {
  const a = buildDemoPlan({ destination: dest, answers: answers() })
  const b = buildDemoPlan({ destination: dest, answers: answers() }, { durationDays: 10 })
  assert.equal(a.itinerary.length, 6)
  assert.equal(b.itinerary.length, 10)
  assert.equal(b.effective.nights, 9)
  assert.ok(b.breakdown.total > a.breakdown.total)
  assert.ok(b.breakdown.lines[1].amount > a.breakdown.lines[1].amount)
})

test('budget adjustment changes feasibility but not the estimate', () => {
  const a = buildDemoPlan({ destination: dest, answers: answers() })
  const b = buildDemoPlan({ destination: dest, answers: answers() }, { budget: 500 })
  assert.equal(a.breakdown.total, b.breakdown.total)
  assert.equal(b.feasibility.status, 'above')
})

test('middleByPrice is stable and handles empty lists', () => {
  assert.equal(middleByPrice([], (x) => x), undefined)
  assert.equal(middleByPrice([5, 1, 3], (x) => x), 3)
  assert.equal(middleByPrice([4, 1, 3, 2], (x) => x), 2)
})

test('limits: budget range is 50%-150% on a nice step; duration options stay within 1..21', () => {
  const p = { currencyAssumed: false, req: { budget: { amount: 3000 } } }
  const l = buildLimits(p, 2, 21)
  assert.deepEqual(l.budgetRange, { min: 1500, max: 4500, step: 100 })
  assert.deepEqual(l.durationOptions, [1, 2, 3, 4, 5])
  assert.equal(buildLimits({ currencyAssumed: true, req: { budget: { amount: 3000 } } }, 7, 21).budgetRange, null)
})
