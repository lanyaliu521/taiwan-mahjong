import test from 'node:test';
import assert from 'node:assert/strict';
import { discardRiskEvidence } from '../dist/risk-evidence.js';
import { getObservation, assertState } from '../dist/engine.js';
import { publicPool } from '../dist/analysis.js';
import { ordinaryRonSafety } from '../dist/safety.js';
import { fixture } from './fixtures.mjs';

const fiveGroups = () => fixture({ dealer: 1, streak: 2,
  hands: { 0: '3333m123p456p789s11z23s', 1: '1m' },
  melds: { 1: ['111p', '222p', '333p', '444s', '555s'].map(tiles => ({ tiles })) },
});

test('對五副露家排除順子，但不可將單家安全當全桌安全', () => {
  const o = getObservation(fiveGroups(), 0), before = structuredClone(o);
  const report = discardRiskEvidence(o), c = report.candidates.find(c => c.kind === '3m');
  assert.equal(c.opponents.find(p => p.seat === 1).provenSafe, true);
  assert.equal(c.opponents.find(p => p.seat === 2).provenSafe, false);
  assert.equal(c.provenSafeAgainstAll, false);
  assert.equal(report.candidates.filter(c => c.kind === '3m').length, 1, '同種四張不多算四票');
  assert.equal(c.opponents.find(p => p.seat === 1).minimumRonPayment, 80);
  assert.equal(c.opponents.find(p => p.seat === 2).minimumRonPayment, 30);
  assert.deepEqual(o, before);
});

test('交換看不到的暗手與牆牌，公開證據與合法捨牌結果不變', () => {
  const a = fiveGroups(), b = structuredClone(a);
  const index = b.wall.order.findIndex((t, i) => i >= b.wall.head && i <= b.wall.tail && !t.startsWith('f'));
  const dealtIndex = b.wall.order.indexOf(b.players[2].concealed[0]);
  b.players[2].concealed[0] = b.wall.order[index];
  [b.wall.order[dealtIndex], b.wall.order[index]] = [b.wall.order[index], b.wall.order[dealtIndex]];
  assertState(b);
  assert.deepEqual(discardRiskEvidence(getObservation(a, 0)), discardRiskEvidence(getObservation(b, 0)));
});

test('暗槓只計已宣告面子，不能從遮罩補扣牌種', () => {
  const g = fixture({ melds: { 1: [{ kind: 'concealedKong', tiles: '1111m' }] } });
  const o = getObservation(g, 0);
  assert.equal('tiles' in o.players[1].melds[0], false);
  const p = publicPool(o), report = discardRiskEvidence(o);
  for (const c of report.candidates) assert.deepEqual(c.opponents.find(p => p.seat === 1).possibleUses, ordinaryRonSafety(p, c.kind).possibleUses);
});

test('持有安全庫存不等於當前合法可捨；證據不添加引擎候選', () => {
  const o = getObservation(fixture({ hands: { 0: '4444z123m456m123p23s55z' } }), 0);
  // A narrowed legal candidate set models the decision boundary; it does not change game rules.
  o.legalActions = o.legalActions.filter(a => a.type !== 'DISCARD' || !a.tileId.startsWith('4z'));
  const r = discardRiskEvidence(o);
  assert.ok(r.heldSafeKinds.includes('4z'));
  assert.ok(!r.currentlyDiscardableSafeKinds.includes('4z'));
  assert.ok(!r.candidates.some(c => c.kind === '4z'));
  o.legalActions = [];
  assert.deepEqual(discardRiskEvidence(o).candidates, []);
});

test('錯誤牌權拒絕；莊家自己放槍對每家均有相同莊連付款底線', () => {
  const g = fixture({ dealer: 0, streak: 1 }), o = getObservation(g, 0);
  assert.ok(discardRiskEvidence(o).candidates.every(c => c.opponents.every(p => p.minimumRonPayment === 60)));
  o.legalActions.push({ type: 'DISCARD', tileId: g.players[1].concealed[0] });
  assert.throws(() => discardRiskEvidence(o), /INVALID_DISCARD_OWNER/);
});
