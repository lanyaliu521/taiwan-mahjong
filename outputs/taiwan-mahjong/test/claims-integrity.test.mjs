import test from 'node:test';
import assert from 'node:assert/strict';
import { restore, serialize, legalActions } from '../dist/engine.js';
import { fixture, discard, run, resolve, W02 } from './fixtures.mjs';

test('較高順位胡牌阻擋已回答PASS的碰，不因回應先後設過碰', () => {
  const start = () => discard(fixture({ hands: { 0: '5m', 1: '55m', 2: W02 } }), 0, '5m');
  let early = run(start(), 1, 'PASS');
  assert.deepEqual(early.players[1].restrictions.passedPon, []);
  early = restore(serialize(early));
  early = run(run(early, 2, 'WIN'), 'engine', 'RESOLVE');
  const late = run(run(start(), 2, 'WIN'), 'engine', 'RESOLVE');
  assert.deepEqual(early.players[1].restrictions, late.players[1].restrictions);
  assert.deepEqual(early.settlement, late.settlement);
});

test('較遠胡被攔不設過水，較近自願讓胡才設過水', () => {
  const start = () => discard(fixture({ hands: { 0: '2m', 1: W02, 3: W02 } }), 0, '2m');
  let s = run(start(), 3, 'PASS');
  s = resolve(s, { 1: 'WIN' });
  assert.equal(s.players[3].restrictions.passedWin, false);
  s = run(start(), 3, 'WIN');
  s = resolve(s, { 1: 'PASS' });
  assert.equal(s.players[1].restrictions.passedWin, true);
  assert.equal(s.settlement.winner, 3);
});

test('存檔不可用已回答WIN掩蓋偽造胡牌候選', () => {
  const s = discard(fixture({ hands: { 0: '5m', 1: '55m' } }), 0, '5m');
  assert.equal(legalActions(s, 1).some(a => a.type === 'WIN'), false);
  const fake = { type: 'WIN', source: 'ron', windowId: s.pending.windowId };
  s.pending.options[1].push(fake);
  s.pending.responses[1] = fake;
  assert.throws(() => restore(JSON.stringify(s)), /CORRUPT_CLAIM_OPTIONS/);
});

test('存檔不可刪掉或在PASS後修改合法候選', () => {
  const s = discard(fixture({ hands: { 0: '2m', 1: W02 } }), 0, '2m');
  const missing = structuredClone(s);
  delete missing.pending.options[1];
  assert.throws(() => restore(JSON.stringify(missing)), /CORRUPT_CLAIM_OPTIONS/);
  const passed = run(s, 1, 'PASS');
  assert.deepEqual(restore(serialize(passed)), passed);
  passed.pending.options[1] = passed.pending.options[1].filter(a => a.type !== 'WIN');
  assert.throws(() => restore(JSON.stringify(passed)));
});
