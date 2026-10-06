import test from 'node:test';
import assert from 'node:assert/strict';
import { discardFeedback, meldFeedback } from '../dist/feedback.js';
import { getObservation } from '../dist/engine.js';
import { kindOf } from '../dist/tiles.js';
import { fixture, discard, step, resolve } from './fixtures.mjs';

const ready = () => fixture({ hands: { 0: '123m 456m 123p 456p 789s 1z 7z' } });
const tile = (o, kind) => o.self.concealed.find(id => kindOf(id) === kind);

test('有活等待的聽牌回饋只讀真人觀察且不重複獎勵', () => {
  const o = getObservation(ready(), 0), before = structuredClone(o);
  const first = discardFeedback(o, tile(o, '7z'), null);
  assert.equal(first.feedback.kind, 'ready');
  assert.match(first.feedback.detail, /公開有效牌.*合法按鈕/);
  assert.equal(discardFeedback(o, tile(o, '7z'), first.progress).feedback, null);
  assert.deepEqual(o, before);
});
test('不讚揚錯過合法胡牌', () => {
  const o = getObservation(fixture({ hands: { 0: '123m 456m 123p 456p 789s 11z' } }), 0);
  assert.ok(o.legalActions.some(a => a.type === 'WIN'));
  assert.equal(discardFeedback(o, tile(o, '1z'), null).feedback, null);
});
test('有效張耗盡不慶祝為活聽口', () => {
  const o = getObservation(fixture({ hands: { 0: '123m 456m 123p 456p 789s 1z 7z' }, melds: { 1: [{ tiles: '111z' }] } }), 0);
  assert.equal(discardFeedback(o, tile(o, '7z'), null).feedback, null);
});
test('非法牌ID沒有回饋且不修改進度', () => {
  const o = getObservation(ready(), 0), progress = { handId: o.handId, closest: 3, praised: false };
  assert.deepEqual(discardFeedback(o, '7z#99', progress), { progress, feedback: null });
});
test('新局不沿用上局里程碑', () => {
  const o = getObservation(ready(), 0);
  assert.equal(discardFeedback(o, tile(o, '7z'), { handId: o.handId + 1, closest: 0, praised: true }).feedback.kind, 'ready');
});
test('叫牌回應先不慶祝，仲裁確實取得後才提示', () => {
  const waiting = discard(fixture({ turn: 3, hands: { 3: '2m', 0: '1345m 67m 123p 456p 789s 1z' } }), 3, '2m');
  const before = getObservation(waiting, 0);
  const pending = step(waiting, 0, before.legalActions.find(a => a.type === 'CHI'));
  assert.equal(meldFeedback(before, getObservation(pending, 0)), null);
  const acquired = resolve(pending);
  assert.equal(meldFeedback(before, getObservation(acquired, 0)).title, '吃牌成立');
});
test('被他家胡攔下的吃牌不提示成立', () => {
  const waiting = discard(fixture({ turn: 3, hands: { 3: '2m', 0: '134m', 1: '111p 222p 333s 444s 13m 55z' } }), 3, '2m');
  const before = getObservation(waiting, 0);
  const pending = step(waiting, 0, before.legalActions.find(a => a.type === 'CHI'));
  const ended = resolve(pending, { 1: 'WIN' });
  assert.equal(ended.settlement.winner, 1);
  assert.equal(meldFeedback(before, getObservation(ended, 0)), null);
});
