// Offline constructed examples, not game strategy or a win-rate experiment.
import assert from 'node:assert/strict';
import { createAnalyzer, bestDiscards } from '../dist/analysis.js';
import { ordinaryRonSafety } from '../dist/safety.js';
import { KINDS } from '../dist/tiles.js';
import { kinds } from '../test/fixtures.mjs';
const cases = [
  ['same-step', '123m456m123p23s67p55z4z9s'],
  ['acceptance-cost', '123m456m123p23s677p55z4z'],
  ['ready-exit', '123m456m123p456p23s55z4z'],
];
const results = cases.map(([name, text]) => {
  const hand = kinds(text), counts = KINDS.map(k => 4 - hand.filter(t => t === k).length);
  // Three other Norths are publicly visible; own fourth North is proved safe for ordinary ron.
  counts[KINDS.indexOf('4z')] = 0;
  const p = { source: 'public', counts }, analyzer = createAnalyzer(p);
  const choices = analyzer.discards(hand, [], hand, false), best = bestDiscards(choices);
  const nextDrawDifferences = [];
  if (name === 'same-step') for (let i = 0; i < KINDS.length; i++) {
    if (!counts[i]) continue;
    const nextCounts = [...counts]; nextCounts[i]--;
    const outcomes = ['4z', '9s'].map(discard => {
      const rest = [...hand]; rest.splice(rest.indexOf(discard), 1); rest.push(KINDS[i]);
      const next = createAnalyzer({ source: 'public', counts: nextCounts });
      const q = bestDiscards(next.discards(rest, [], rest, false))[0].analysis;
      return { discard, shanten: q.shanten, K: q.improving };
    });
    if (outcomes[0].shanten !== outcomes[1].shanten || outcomes[0].K !== outcomes[1].K) nextDrawDifferences.push({ draw: KINDS[i], outcomes });
  }
  return { name, hand: text, north: ordinaryRonSafety(p, '4z'), best: best.map(c => c.kind), nextDrawDifferences,
    choices: choices.map(c => ({ discard: c.kind, shanten: c.analysis.shanten, K: c.analysis.improving, N: c.analysis.total,
      reserveNorth: c.kind !== '4z', effective: c.analysis.effectiveTiles.filter(t => t.count).map(t => `${t.kind}:${t.count}`) })) };
});
for (const [row, discard, shanten, K] of [[0, '4z', 1, 16], [0, '9s', 1, 16], [1, '4z', 1, 20], [1, '7p', 1, 16], [2, '4z', 0, 8]]) {
  const found = results[row].choices.find(c => c.discard === discard);
  assert.equal(found.shanten, shanten); assert.equal(found.K, K); assert.equal(results[row].north.provenSafe, true);
}
console.log(JSON.stringify({ assumption: 'Constructed public pool; K/N is not wall probability. No opponent policy or deception experiment.', results }, null, 2));
