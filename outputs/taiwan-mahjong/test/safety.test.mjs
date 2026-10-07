import test from 'node:test';
import assert from 'node:assert/strict';
import { ordinaryRonSafety } from '../dist/safety.js';
import { publicPool } from '../dist/analysis.js';
import { KINDS } from '../dist/tiles.js';
import { isWinningHand } from '../dist/hand.js';
import { getObservation } from '../dist/engine.js';
import { fixture, kinds } from './fixtures.mjs';

const pool = (entries = {}) => ({ source: 'public', counts: KINDS.map(k => entries[k] ?? 0) });

test('安全證明拒絕非公開牌池、未知牌種及非法容量', () => {
  for (const bad of [null, { ...pool(), source: 'exact' }, { source: 'public', counts: [] },
    { source: 'public', counts: Array(34) }, pool({ '1m': NaN }), pool({ '1m': 5 }), pool({ '1m': -1 }), pool({ '1m': .5 })]) {
    assert.throws(() => ordinaryRonSafety(bad, '1m'), /INVALID_PUBLIC_SAFETY_INPUT/);
  }
  for (const k of ['f1', '0m', '1m#0']) assert.throws(() => ordinaryRonSafety(pool(), k));
});

test('兩張公開加自己一張的字牌仍可放單吊，第四張字牌才有容量證明', () => {
  assert.deepEqual(ordinaryRonSafety(pool({ '1z': 1 }), '1z').possibleUses, [{ type: 'pair', needs: ['1z'] }]);
  assert.equal(isWinningHand(kinds('123m456m123p456p123s11z')), true);
  assert.equal(ordinaryRonSafety(pool(), '1z').provenSafe, true);
});

test('四見數牌仍可完成順子，所有合法順子均須排除；不跨花色', () => {
  assert.equal(ordinaryRonSafety(pool({ '1m': 1, '2m': 1 }), '3m').provenSafe, false);
  assert.equal(ordinaryRonSafety(pool({ '2m': 1, '4m': 1 }), '3m').provenSafe, false);
  assert.equal(ordinaryRonSafety(pool({ '4m': 1, '5m': 1 }), '3m').provenSafe, false);
  assert.equal(ordinaryRonSafety(pool({ '7m': 1, '8m': 1 }), '9m').provenSafe, false);
  assert.equal(ordinaryRonSafety(pool({ '8m': 1, '1p': 1 }), '9m').provenSafe, true);
});

test('完整五面子一對見證交叉核對每種牌的局部未知容量，不修改輸入', () => {
  // Independently enumerate possible 2/3-tile completed groups via the real hand solver.
  // Four unrelated honour triplets (and a spare honour pair for a 3-tile group) fill E17.
  for (const candidate of KINDS) {
    const relevant = candidate.endsWith('z') ? [candidate] : KINDS.filter(k => k[1] === candidate[1] && Math.abs(+k[0] - +candidate[0]) <= 2);
    const fillers = KINDS.filter(k => k.endsWith('z') && k !== candidate).slice(0, 5);
    const four = fillers.slice(0, 4).flatMap(k => [k, k, k]);
    const five = [...four, fillers[4], fillers[4], fillers[4]];
    for (let code = 0; code < 3 ** relevant.length; code++) {
      let n = code; const entries = {};
      relevant.forEach(k => { entries[k] = n % 3; n = Math.floor(n / 3); });
      const p = pool({ ...entries, ...Object.fromEntries(fillers.map(k => [k, 3])) }), before = structuredClone(p);
      let witness = false;
      for (const a of relevant) {
        if (!entries[a]) continue;
        if (isWinningHand([...five, a, candidate])) witness = true;
        for (const b of relevant) {
          if (entries[b] < (a === b ? 2 : 1)) continue;
          if (isWinningHand([...four, fillers[4], fillers[4], a, b, candidate])) witness = true;
        }
      }
      assert.equal(ordinaryRonSafety(p, candidate).provenSafe, !witness, `${candidate} ${code}`);
      assert.deepEqual(p, before);
    }
  }
});

test('只用遮罩觀察的公開牌池；未知牌減少不能推翻已證安全', () => {
  const g = fixture({ hands: { 0: '123m456m123p456p123s11z' } });
  const o = getObservation(g, 0), p = publicPool(o);
  assert.equal('wall' in o, false);
  for (const k of KINDS) {
    const a = ordinaryRonSafety(p, k);
    if (a.provenSafe) assert.equal(ordinaryRonSafety({ source: 'public', counts: p.counts.map(n => Math.max(0, n - 1)) }, k).provenSafe, true);
  }
  const safe = pool({ '2m': 1, '4m': 0, '5m': 1 });
  assert.equal(ordinaryRonSafety(safe, '3m').provenSafe, true);
  assert.equal(ordinaryRonSafety(pool({ '2m': 0, '5m': 1 }), '3m').provenSafe, true);
});
