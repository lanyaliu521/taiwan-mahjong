import test from 'node:test';
import assert from 'node:assert/strict';
import { createAnalyzer, exactPool, bestDiscards } from '../dist/analysis.js';
import { getObservation, legalActions, assertState } from '../dist/engine.js';
import { discardRiskEvidence } from '../dist/risk-evidence.js';
import { fixture, discard, resolve, run } from './fixtures.mjs';

test('L1A-01 五副露雙字牌：16種小牌池手算K，並列保留，零活口仍是結構聽牌', () => {
  const s = fixture({ hands: { 0: '12z' }, melds: { 0:
    ['123m', '456m', '123p', '456p', '789s'].map(tiles => ({ kind: 'chi', tiles })) } });
  // Independent oracle: five completed groups leave only a pair. No AI/hand solver as answer key.
  // This bounded exact pool is an analyzer unit input, not a complete four-player table.
  for (let east = 0; east <= 3; east++) for (let south = 0; south <= 3; south++) {
    const pool = exactPool([
      ...Array.from({ length: east }, (_, i) => `1z#${i + 1}`),
      ...Array.from({ length: south }, (_, i) => `2z#${i + 1}`),
    ]);
    const choices = createAnalyzer(pool).discards(['1z', '2z'], s.players[0].melds, ['1z', '2z'], false);
    for (const c of choices) {
      const expected = c.kind === '1z' ? south : east;
      assert.equal(c.analysis.shanten, 0);
      assert.equal(c.analysis.improving, expected);
      assert.equal(c.analysis.total, east + south);
      assert.equal(c.analysis.probability, east + south ? expected / (east + south) : null);
      assert.deepEqual(c.analysis.effectiveTiles, [{ kind: c.kind === '1z' ? '2z' : '1z', count: expected }]);
    }
    const expected = east === south ? ['1z', '2z'] : south > east ? ['1z'] : ['2z'];
    assert.deepEqual(bestDiscards(choices).map(c => c.kind), expected);
    assert.deepEqual(bestDiscards([...choices].reverse()).map(c => c.kind).sort(), expected,
      'acceptable set is independent of candidate arrival order; UI ordering is a separate L1-B concern');
  }
});

test('L1A-02 公開資訊相同而實際可胡不同：未知不是必放槍，分析不能偷看答案', () => {
  const a = fixture({ hands: { 0: '789m789p123s456s11z234z', 1: '123m456m123p456p789s4z' } });
  const b = structuredClone(a);
  const heldIndex = b.players[1].concealed.findIndex(t => t.startsWith('4z'));
  const wallIndex = b.wall.order.findIndex((t, i) => i >= b.wall.head && i <= b.wall.tail && t.startsWith('5z'));
  assert.ok(heldIndex >= 0 && wallIndex >= 0);
  const dealtIndex = b.wall.order.indexOf(b.players[1].concealed[heldIndex]);
  b.players[1].concealed[heldIndex] = b.wall.order[wallIndex];
  [b.wall.order[dealtIndex], b.wall.order[wallIndex]] = [b.wall.order[wallIndex], b.wall.order[dealtIndex]];
  assertState(b);
  const oa = getObservation(a, 0), ob = getObservation(b, 0);
  assert.deepEqual(oa, ob);
  const evidence = discardRiskEvidence(oa);
  assert.deepEqual(evidence, discardRiskEvidence(ob));
  assert.equal(evidence.candidates.find(c => c.kind === '4z').opponents.find(p => p.seat === 1).provenSafe, false);
  // Hidden truth is used ONLY by this test to witness two compatible worlds, never by evidence.
  assert.ok(legalActions(discard(a, 0, '4z'), 1).some(a => a.type === 'WIN'));
  assert.ok(!legalActions(discard(b, 0, '4z'), 1).some(a => a.type === 'WIN'));
});

test('L1A-03 全桌普通放槍安全仍可能讓莊自摸或流局續莊', () => {
  for (const outcome of ['dealerDraw', 'exhaustion']) {
    let s = fixture({ dealer: 1, streak: 2,
      hands: { 0: '4444z789m789p123s456s1z', 1: '123m456m123p456p789s1z' },
      ...(outcome === 'dealerDraw' ? { head: '1z' } : { available: 0 }),
    });
    const evidence = discardRiskEvidence(getObservation(s, 0));
    assert.equal(evidence.candidates.find(c => c.kind === '4z').provenSafeAgainstAll, true);
    s = discard(s, 0, '4z');
    for (const seat of [1, 2, 3]) assert.ok(!legalActions(s, seat).some(a => a.type === 'WIN'));
    s = resolve(s);
    if (outcome === 'dealerDraw') {
      s = run(s, 'engine', 'DRAW');
      s = run(s, 1, 'WIN');
      assert.equal(s.settlement.winner, 1);
      assert.equal(s.settlement.source, 'selfDraw');
    } else {
      assert.equal(s.settlement.source, 'draw');
      assert.deepEqual(s.settlement.delta, [0, 0, 0, 0]);
    }
    s = run(s, 'engine', 'NEXT_HAND');
    assert.equal(s.dealer, 1);
    assert.equal(s.streak, 3);
  }
});
