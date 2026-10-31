// Dumps the FRONTEND preview plans (lib/travel/trip-planner-service.ts) for the parity
// cases, so tests/budgetParity.test.js can compare them with the backend's numbers.
// Run from the repo root:  tsx backend/tests/fixtures/dumpFrontendPlans.mts
import * as svcNs from '../../../lib/travel/trip-planner-service'
const svc: any = (svcNs as any).default ?? svcNs
const buildTripPlan = svc.buildTripPlan
import { PARITY_CASES } from './parityCases.mjs'

const out = PARITY_CASES.map((c: any) => {
  const plan = buildTripPlan({ destination: c.destination, answers: c.answers }, c.adjustments ?? {})
  return { name: c.name, plan }
})
process.stdout.write(JSON.stringify(out))
