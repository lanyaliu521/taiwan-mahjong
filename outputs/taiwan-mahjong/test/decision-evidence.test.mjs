import test from 'node:test';
import assert from 'node:assert/strict';
import { decisionEvidence, EVIDENCE_VERSION } from '../dist/decision-evidence.js';
import { getObservation, assertState, createGame } from '../dist/engine.js';
import { fixture, discard, step, WIN } from './fixtures.mjs';
const RULES = 'TW16-CLASSIC-v1';
const evidence = o => decisionEvidence(o, RULES);

test('L1B 版本與獨立手算：五副露東南均S0/K3/N119，並列且E17不冒充摸牌比例', () => {
  const s = fixture({ hands: { 0: '12z' }, melds: { 0:
    ['123m', '456m', '123p', '456p', '789s'].map(tiles => ({ kind: 'chi', tiles })) } });
  const o = getObservation(s, 0), r = evidence(o);
  assert.equal(r.schemaVersion, 1);
  assert.equal(r.rulesVersion, RULES);
  assert.equal(r.analyzerVersion, EVIDENCE_VERSION);
  assert.equal(r.current.improving, null);
  assert.equal(r.current.publicImprovingRatio, null);
  assert.equal(r.current.improvementStatus, 'notApplicable');
  assert.deepEqual(r.discardPreference.kinds, ['1z', '2z']);
  assert.equal(r.overallStrategy.status, 'unknown');
  for (const c of r.candidates) {
    assert.equal(c.efficiency.shanten, 0);
    assert.equal(c.efficiency.improving, 3);
    assert.equal(c.efficiency.publicPoolTotal, 119);
    assert.equal(c.efficiency.publicImprovingRatio, 3 / 119);
  }
  const reversed = structuredClone(o); reversed.legalActions.reverse();
  assert.deepEqual(evidence(reversed), r);
  assert.equal(new Set(r.candidates.map(c => c.id)).size, r.candidates.length);
});

test('L1B 兩種吃法保留完整Intent，條件後捨遵守禁捨，PASS未評估而非零風險', () => {
  const state = discard(fixture({ hands: { 0: '2m', 1: '1345m67m123p456p789s1z' } }), 0, '2m');
  const o = getObservation(state, 1);
  const r = evidence(o), claims = r.candidates.filter(c => c.intent.type === 'CHI');
  assert.equal(r.candidates.length, o.legalActions.length);
  assert.equal(claims.length, 2);
  for (const c of claims) {
    assert.ok(o.legalActions.some(a => a.type === 'CHI' && a.windowId === c.intent.windowId
      && [...a.ownTiles].sort().join() === c.intent.ownTiles.join()));
    step(state, 1, c.intent); // Canonicalized payload is accepted by the engine, not only by our formatter.
    const own = c.intent.ownTiles.map(t => t.slice(0, 2));
    const banned = own.includes('1m') ? ['2m'] : ['2m', '5m'];
    assert.ok(c.postClaim.discards.length > 0);
    assert.ok(c.postClaim.discards.every(d => !banned.includes(d.kind)));
    assert.equal(c.safety, null);
    assert.equal(c.postClaim.level, 'E3');
  }
  const pass = r.candidates.find(c => c.intent.type === 'PASS');
  assert.equal(pass.efficiency, null); assert.equal(pass.safety, null);
  assert.ok(pass.unknownReason);
  const reversed = structuredClone(o);
  reversed.legalActions.reverse();
  reversed.legalActions.forEach(a => a.ownTiles?.reverse());
  assert.deepEqual(evidence(reversed), r);
});

test('L1B 對莊安全不能包裝為全桌安全；未知沒有危險率或唯一策略答案', () => {
  const o = getObservation(fixture({ dealer: 1, streak: 2,
    hands: { 0: '3333m123p456p789s11z23s', 1: '1m' },
    melds: { 1: ['111p', '222p', '333p', '444s', '555s'].map(tiles => ({ tiles })) },
  }), 0);
  const r = evidence(o), c = r.candidates.find(c => c.intent.tileId?.startsWith('3m'));
  assert.equal(c.efficiency.shanten, 0); assert.equal(c.efficiency.improving, 5);
  assert.deepEqual(c.safety.opponents.map(p => p.status), ['proven', 'unknown', 'unknown']);
  const safe = r.candidates.find(c => c.intent.tileId?.startsWith('1p'));
  assert.equal(safe.efficiency.shanten, 1);
  assert.ok(safe.safety.opponents.every(p => p.status === 'proven'));
  assert.equal(r.overallStrategy.status, 'unknown');
  assert.ok(c.safety.opponents.every(p => !('probability' in p) && !('riskScore' in p)));
  assert.equal(r.candidates.filter(c => c.intent.tileId?.startsWith('3m')).length, 4, 'all four legal physical intents remain mapped');
});

test('L1B 不讀不可見牌、額外欄位與事後結算；輸出不分享輸入參照', () => {
  const a = fixture({ hands: { 0: '789m789p123s456s11z234z', 1: '123m456m123p456p789s4z' } });
  const b = structuredClone(a), held = b.players[1].concealed.findIndex(t => t.startsWith('4z'));
  const wall = b.wall.order.findIndex((t, i) => i >= b.wall.head && t.startsWith('5z'));
  assert.ok(held >= 0 && wall >= 0);
  const dealt = b.wall.order.indexOf(b.players[1].concealed[held]);
  b.players[1].concealed[held] = b.wall.order[wall];
  [b.wall.order[dealt], b.wall.order[wall]] = [b.wall.order[wall], b.wall.order[dealt]];
  assertState(b);
  assert.deepEqual(evidence(getObservation(a, 0)), evidence(getObservation(b, 0)));
  const o = getObservation(a, 0), before = structuredClone(o), expected = evidence(o);
  assert.deepEqual(o, before);
  o.settlement = { privateFuture: 'do not copy' };
  o.extraSecret = 'do not copy';
  o.legalActions.forEach(a => { a.extraSecret = 'do not copy'; });
  const r = evidence(o);
  assert.deepEqual(r, expected);
  r.candidates[0].intent.type = 'PASS';
  assert.notEqual(o.legalActions[0].type, 'PASS');
});

test('L1B 合法胡牌獨立於牌效，無法分析階段不虛造數值', () => {
  const r = evidence(getObservation(fixture({ hands: { 0: WIN } }), 0));
  assert.equal(r.canWin, true);
  assert.ok(r.candidates.some(c => c.intent.type === 'WIN' && c.efficiency === null));
  const setup = evidence(getObservation(createGame({ seed: 1 }), 0));
  assert.equal(setup.status, 'unavailable'); assert.equal(setup.current, null);
  assert.deepEqual(setup.candidates, []);
});

test('L1B 錯桌規、完整狀態、揭露暗槓與錯牌權均拒絕', () => {
  const s = fixture(), o = getObservation(s, 0);
  assert.throws(() => decisionEvidence(o, 'OTHER'), /UNSUPPORTED_EVIDENCE_RULES/);
  assert.throws(() => evidence(s), /UNMASKED_EVIDENCE_INPUT/);
  const exposed = structuredClone(o); exposed.players[1].melds = [{ kind: 'concealedKong', tiles: ['1m#0'] }];
  assert.throws(() => evidence(exposed), /UNMASKED_EVIDENCE_INPUT/);
  o.legalActions.push({ type: 'DISCARD', tileId: s.players[1].concealed[0] });
  assert.throws(() => evidence(o), /INVALID_DISCARD_OWNER/);
});

test('L1B 碰牌可比較後捨；三種槓保留合法映射但不假造收益', () => {
  const claimed = discard(fixture({ turn: 3, hands: { 3: '1m', 1: '111m123p456p789s11z23s' } }), 3, '1m');
  const cases = [
    [claimed, 1, 'PON'], [claimed, 1, 'KAN_OPEN'],
    [fixture({ hands: { 0: '1111z123m456m123p456p2z' } }), 0, 'KAN_CLOSED'],
    [fixture({ hands: { 0: '1m123p456p789s11z23s' }, melds: { 0: [{ tiles: '111m' }] } }), 0, 'KAN_ADDED'],
  ];
  for (const [state, seat, type] of cases) {
    const r = evidence(getObservation(state, seat)), c = r.candidates.find(c => c.intent.type === type);
    assert.ok(c, type);
    step(state, seat, c.intent);
    if (type === 'PON') {
      assert.ok(c.postClaim.discards.length);
      assert.ok(c.postClaim.discards.every(d => d.kind !== '1m'));
    } else {
      assert.equal(c.efficiency, null);
      assert.equal(c.safety, null);
      assert.ok(c.unknownReason);
    }
  }
});
