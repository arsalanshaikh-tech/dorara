'use strict'

const { test } = require('node:test')
const assert = require('node:assert/strict')
const path = require('path')
const os = require('os')
process.env.LOG_DIR = path.join(os.tmpdir(), 'dorara-test-logs')
const { sanitizeText, containsForbidden } = require(path.join(__dirname, '..', 'services/tripPlanner/sanitizer'))

test('sanitizer: removes sentences with money amounts in many formats', () => {
  for (const t of [
    'A tasting menu for $120 per person.',
    'Entry is €15.50 at the gate.',
    'Tickets cost 25 USD each.',
    'It runs about 1,200 baht for the day.',
    'Budget ₹5,000 for the tour.',
    'Pay 40-60 euros for the class.',
    'USD 45 gets you in.',
  ]) {
    const r = sanitizeText(`${t} Enjoy the views.`)
    assert.equal(r.text, 'Enjoy the views.', t)
    assert.ok(r.removed.length > 0, t)
    assert.equal(containsForbidden(r.text), false)
  }
})

test('sanitizer: strips URLs and bare domains', () => {
  const r = sanitizeText('Browse the stalls. Book via www.tickets.example.com or https://x.test/a?b=1 today.')
  assert.ok(!/www\.|https?:|\.com/.test(r.text), r.text)
  assert.match(r.text, /Browse the stalls/)
})

test('sanitizer: drops availability / real-time / visa / booking-pressure claims', () => {
  for (const t of [
    'Tickets are currently available online.',
    'The museum is sold out this week.',
    'Check the live prices before you go.',
    'Book now to secure your spot.',
    'No visa is required for most visitors.',
    'Entry requirements are simple.',
    'Guaranteed availability for groups.',
  ]) {
    assert.equal(sanitizeText(`${t} Wear comfortable shoes.`).text, 'Wear comfortable shoes.', t)
  }
})

test('sanitizer: clean text passes through unchanged', () => {
  const t = 'Wander the old town and stop for a coffee by the river.'
  assert.deepEqual(sanitizeText(t), { text: t, removed: [] })
})

test('sanitizer: non-strings and fully-removed text give empty string', () => {
  assert.equal(sanitizeText(undefined).text, '')
  assert.equal(sanitizeText(42).text, '')
  assert.equal(sanitizeText('Costs $50.').text, '')
})

test('sanitizer: does not mangle ordinary numbers (days, times, ratings)', () => {
  const t = 'Spend 3 days exploring and head out at 9:30 AM on a 2-hour walk.'
  assert.equal(sanitizeText(t).text, t)
})
