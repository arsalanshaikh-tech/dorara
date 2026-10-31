// Shared by the parity test and the frontend dump script.
const dest = (id, name, country) => ({
  id, name, country, score: 90, shortReason: 'x', primaryTags: [], imageRef: 'x', avgTempC: 22, safetyIndex: 90,
})
const D = {
  tokyo: dest('tokyo', 'Tokyo, Japan', 'Japan'),
  lisbon: dest('lisbon', 'Lisbon, Portugal', 'Portugal'),
  bali: dest('bali', 'Bali, Indonesia', 'Indonesia'),
  reykjavik: dest('reykjavik', 'Reykjavik, Iceland', 'Iceland'),
  unknown: dest('tbilisi', 'Tbilisi, Georgia', 'Georgia'),
}
const ans = (o = {}) => ({
  budget: { min: 1000, max: 3000, currency: 'USD' },
  dates: { start: '2027-03-10', end: '2027-03-16', durationDays: 6 },
  party: 'Couple',
  interest_type: ['Food & nightlife', 'Culture & history'],
  weather: ['Warm & sunny'],
  safety_importance: 4,
  ...o,
})

export const PARITY_CASES = [
  { name: 'tokyo couple USD', destination: D.tokyo, answers: ans() },
  { name: 'lisbon couple EUR close budget', destination: D.lisbon, answers: ans({ budget: { min: 1, max: 2100, currency: 'EUR' } }) },
  { name: 'bali INR above budget', destination: D.bali, answers: ans({ budget: { min: 1, max: 90000, currency: 'INR' } }) },
  { name: 'reykjavik family assumed 4', destination: D.reykjavik, answers: ans({ party: 'Family (kids)', budget: { min: 1, max: 9000, currency: 'GBP' } }) },
  { name: 'unknown destination generic fixture', destination: D.unknown, answers: ans({ party: 'Solo' }) },
  { name: 'no budget', destination: D.lisbon, answers: ans({ budget: null }) },
  { name: 'unsupported currency', destination: D.lisbon, answers: ans({ budget: { min: 1, max: 4000, currency: 'JPY' } }) },
  { name: 'no duration -> 7 default', destination: D.bali, answers: ans({ dates: { start: null, end: null, durationDays: null } }) },
  { name: '1 day trip', destination: D.tokyo, answers: ans({ dates: { start: '2027-03-10', end: null, durationDays: 1 } }) },
  { name: '30 days capped', destination: D.lisbon, answers: ans({ dates: { start: null, end: null, durationDays: 30 } }) },
  { name: 'no interests', destination: D.tokyo, answers: ans({ interest_type: [] }) },
  { name: 'adjust budget low', destination: D.tokyo, answers: ans(), adjustments: { budget: 1200 } },
  { name: 'adjust duration 10', destination: D.lisbon, answers: ans(), adjustments: { durationDays: 10 } },
  { name: 'adjust both', destination: D.bali, answers: ans(), adjustments: { budget: 2000, durationDays: 4 } },
]
