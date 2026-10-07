import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './fixtures.mjs';
import { getObservation } from '../dist/engine.js';
import { compareDiscardPreferences as compare } from '../dist/strategy-comparison.js';

const observation = (dealer = 1) => getObservation(fixture({ dealer, streak: 2,
  hands: { 0: '3333m123p456p789s11z23s', 1: '1m' },
  melds: { 1: ['111p', '222p', '333p', '444s', '555s'].map(tiles => ({ tiles })) },
}), 0);
const attack = { maxShantenLoss: 0, dealerExposureWeight: 0, otherExposureWeight: 0 };
const fold = { maxShantenLoss: 1, dealerExposureWeight: 1, otherExposureWeight: 1 };
const stopDealer = { maxShantenLoss: 0, dealerExposureWeight: 3, otherExposureWeight: 1 };

test('同題比較：維持進聽與全面退守的代價；只增加莊權重不保證不同選擇', () => {
  const o = observation(), before = structuredClone(o);
  assert.deepEqual(compare(o, attack).best, ['3m']);
  assert.deepEqual(compare(o, fold).best, ['1p']);
  assert.deepEqual(compare(o, stopDealer).best, ['3m']);
  assert.deepEqual(compare(o, { ...stopDealer, maxShantenLoss: 1 }).best, ['1p']);
  assert.deepEqual(o, before);
});

test('未知風險有權重，但不能將未知說成必定放槍；自己當莊沒有敵對莊家加權', () => {
  const penalty = dealer => compare(observation(dealer), stopDealer).candidates.find(c => c.kind === '3m').exposurePenalty;
  assert.equal(penalty(1), 2); // Only the dealer is proven safe.
  assert.equal(penalty(2), 4); // Unknown dealer + one unknown nondealer.
  assert.equal(penalty(0), 2); // Self dealer is not an opponent.
});

test('合法胡優先於所有捨牌偏好；沒有捨牌候選時不發明動作', () => {
  const win = getObservation(fixture({ hands: { 0: '123m456m789m123p456p11z' } }), 0);
  assert.ok(win.legalActions.some(a => a.type === 'WIN'));
  assert.equal(compare(win, stopDealer).priority, 'win');
  assert.deepEqual(compare(win, stopDealer).best, []);
  const o = observation(); o.legalActions = [];
  assert.equal(compare(o, stopDealer).priority, 'none');
});

test('偏好不能越過引擎禁捨，也不因相同實體牌重複增加候選票數', () => {
  const o = observation();
  assert.equal(compare(o, attack).candidates.filter(c => c.kind === '3m').length, 1);
  o.legalActions = o.legalActions.filter(a => a.type !== 'DISCARD' || !a.tileId.startsWith('3m'));
  assert.ok(!compare(o, stopDealer).candidates.some(c => c.kind === '3m'));
});

test('拒絕不合法的代價上限與權重', () => {
  for (const n of [NaN, Infinity, -1, 101]) assert.throws(() => compare(observation(), { ...attack, dealerExposureWeight: n }), /INVALID_STRATEGY/);
  for (const n of [-1, 0.5, 6]) assert.throws(() => compare(observation(), { ...attack, maxShantenLoss: n }), /INVALID_STRATEGY/);
});
