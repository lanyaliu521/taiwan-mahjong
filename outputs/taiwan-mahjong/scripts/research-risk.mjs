import assert from 'node:assert/strict';
import { fixture } from '../test/fixtures.mjs';
import { getObservation } from '../dist/engine.js';
import { analyzeObservation } from '../dist/analysis.js';
import { discardRiskEvidence } from '../dist/risk-evidence.js';

// Offline fixture truth builds the table; only the masked own observation enters either analyzer.
const state = fixture({ dealer: 1, streak: 2,
  hands: { 0: '3333m123p456p789s11z23s', 1: '1m' },
  melds: { 1: ['111p', '222p', '333p', '444s', '555s'].map(tiles => ({ tiles })) },
});
const o = getObservation(state, 0), shape = analyzeObservation(o, false), evidence = discardRiskEvidence(o);
const rows = evidence.candidates.map(c => {
  const q = shape.discards.find(d => d.kind === c.kind).analysis;
  return { kind: c.kind, shanten: q.shanten, K: q.improving, safeAgainst: c.opponents.filter(p => p.provenSafe).map(p => p.seat),
    allSafe: c.provenSafeAgainstAll, opponents: c.opponents };
});
assert.equal(rows.find(r => r.kind === '3m').allSafe, false);
assert.deepEqual(rows.find(r => r.kind === '3m').safeAgainst, [1]);
assert.ok(rows.find(r => r.kind === '1p').allSafe);
assert.equal(rows.find(r => r.kind === '3m').shanten, 0);
assert.equal(rows.find(r => r.kind === '3m').K, 5);
assert.equal(rows.find(r => r.kind === '1p').shanten, 1);
assert.equal(rows.find(r => r.kind === '1p').K, 12);
console.log(JSON.stringify({ caveat: 'Constructed case; unknown is not dangerous, route counts are not probabilities, payment floors are not expected loss.',
  bestEfficiency: shape.best.map(d => d.kind), heldSafeKinds: evidence.heldSafeKinds, rows }, null, 2));
