import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { chooseAction } from '../dist/ai.js';
import { createGame, getObservation, legalActions } from '../dist/engine.js';
import { winningTiles } from '../dist/hand.js';
import { kindOf } from '../dist/tiles.js';
import { fixture, discard, step, W02, WIN } from './fixtures.mjs';

const decide = (state, seat = 0, seed = 1) => {
  const observation = getObservation(state, seat);
  return chooseAction(observation, observation.legalActions, seed);
};
const freeze = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};

test('AI 同觀察同種子可重播、只選合法動作、不修改輸入、不讀全域亂數', () => {
  const observation = freeze(getObservation(fixture({ hands: { 0: [...W02, '7z'] } }), 0));
  const originalRandom = Math.random;
  Math.random = () => { throw new Error('AI must not use global randomness'); };
  try {
    const a = chooseAction(observation, observation.legalActions, 123);
    const b = chooseAction(observation, observation.legalActions, 123);
    assert.deepEqual(a, b);
    assert.ok(observation.legalActions.includes(a.intent));
    assert.ok(a.randomState > 0 && a.randomState <= 0xffffffff);
    assert.notEqual(a.randomState, 123);
  } finally { Math.random = originalRandom; }
});

test('AI 邊界拒絕無動作或壞種子，忽略不在觀察合法清單的偽造胡牌', () => {
  const o = getObservation(fixture(), 0);
  for (const seed of [0, -1, 1.5, NaN, Infinity, 0x100000000]) assert.throws(() => chooseAction(o, o.legalActions, seed), /INVALID_AI_RANDOM_STATE/);
  assert.throws(() => chooseAction(o, [], 1), /NO_LEGAL_AI_ACTION/);
  const forged = { type: 'WIN', source: 'selfDraw' };
  const result = chooseAction(o, [...o.legalActions, forged], 1);
  assert.notEqual(result.intent, forged);
  assert.ok(o.legalActions.includes(result.intent));
});

test('AI 合法胡牌必選，包含自摸、放槍及搶槓', () => {
  assert.equal(decide(fixture({ hands: { 0: WIN } })).intent.type, 'WIN');
  const ron = discard(fixture({ hands: { 0: '2m', 1: W02 } }), 0, '2m');
  assert.equal(decide(ron, 1).intent.source, 'ron');
  let kong = fixture({ hands: { 0: '2m', 1: W02 }, melds: { 0: [{ tiles: '222m' }] } });
  kong = step(kong, 0, legalActions(kong, 0).find(a => a.type === 'KAN_ADDED'));
  assert.equal(decide(kong, 1).intent.source, 'robKong');
});

test('AI 以五面子一對將判斷，保留第五組兩面並打出孤張', () => {
  const result = decide(fixture({ hands: { 0: [...W02, '7z'] } }));
  assert.equal(kindOf(result.intent.tileId), '7z');
  assert.equal(result.reason, '聽牌；依公開資訊估計有效進張 8 張');
});

test('AI 副露算一組，五副露後保留尚有三張的單騎', () => {
  const state = fixture({ hands: { 0: '12z' }, melds: { 0: ['123m', '456m', '123p', '456p', '789s'].map(tiles => ({ kind: 'chi', tiles })) } });
  const o = getObservation(state, 0);
  o.players[1].discardHistory.push(...[1, 2, 3].map(n => ({ tileId: `1z#${n}`, eventSeq: 100 + n, claimedBy: null })));
  const result = chooseAction(o, o.legalActions, 1);
  assert.equal(kindOf(result.intent.tileId), '1z');
  assert.equal(result.reason, '聽牌；依公開資訊估計有效進張 3 張');
});

test('AI 公開牌重複引用只扣一次，暗槓遮罩不需牌種', () => {
  const state = fixture({ hands: { 0: [...W02, '7z'] } });
  const o = getObservation(state, 0);
  o.players[1].melds.push({ meldId: 'hidden', kind: 'concealedKong', count: 4 });
  o.players[2].melds.push({ meldId: 'public', kind: 'pon', tiles: ['2m#0', '2m#1', '2m#2'], fromSeat: 3, sourceEvent: 100 });
  o.players[3].discardHistory.push({ tileId: '2m#0', eventSeq: 100, claimedBy: 2 });
  const result = chooseAction(o, o.legalActions, 1);
  assert.equal(kindOf(result.intent.tileId), '7z');
  assert.equal(result.reason, '聽牌；依公開資訊估計有效進張 5 張');
});

test('AI 吃碰先比較合法捨牌後效率，改善才叫牌', () => {
  for (const [offered, hand, expected] of [
    ['2m', '34m 67m 123p 456p 789s 11z 7z', 'CHI'],
    ['5m', '55m 67m 123p 456p 789s 11z 7z', 'PON'],
    ['1z', '13m 789m 234p 345s 789s 11z', 'PASS'],
  ]) {
    const state = discard(fixture({ hands: { 0: offered, 1: hand } }), 0, offered);
    assert.equal(decide(state, 1).intent.type, expected);
  }
});

test('AI 選保留效率的暗槓／加槓，拒絕拆掉第五面子的暗槓', () => {
  assert.equal(decide(fixture({ hands: { 0: '5555m 123p 456p 789p 123s 1z' } })).intent.type, 'KAN_CLOSED');
  assert.equal(decide(fixture({ hands: { 0: '5m 123p 456p 789p 123s 1z' }, melds: { 0: [{ tiles: '555m' }] } })).intent.type, 'KAN_ADDED');
  const result = decide(fixture({ hands: { 0: '1111m 23m 123p 456p 789s 12z' } }));
  assert.equal(result.intent.type, 'DISCARD');
  assert.ok(['1z', '2z'].includes(kindOf(result.intent.tileId)));
});

test('AI 四張同牌不能拆成需第五張的假聽牌', () => {
  const state = fixture({ hands: { 0: '1111z 222z 333z 444z 55z 6z' } });
  const o = getObservation(state, 0), only = o.legalActions.filter(a => a.type === 'DISCARD' && kindOf(a.tileId) === '6z');
  const result = chooseAction(o, only, 1);
  assert.match(result.reason, /^1 向聽/);
});

test('AI 100 次實際開局決策耗時合理，且每次交回引擎合法動作', t => {
  const observations = [];
  for (let seed = 1; seed <= 20; seed++) {
    let state = createGame({ seed, dealer: 0, matchId: `ai-speed-${seed}` });
    while (state.phase === 'setup' || state.phase === 'initialFlowers') state = step(state, 'engine', legalActions(state, 'engine')[0]);
    if (state.phase === 'awaitDiscard') observations.push(getObservation(state, 0));
  }
  let measured = 0;
  for (let n = 0; n < 100; n++) {
    const o = observations[n % observations.length], start = performance.now();
    const result = chooseAction(o, o.legalActions, n + 1);
    measured += performance.now() - start;
    assert.ok(o.legalActions.includes(result.intent));
    if (result.intent.type === 'DISCARD' && result.reason.startsWith('聽牌')) {
      const hand = o.self.concealed.filter(id => id !== result.intent.tileId).map(kindOf);
      assert.ok(winningTiles(hand, o.self.melds).length > 0, '不可將四面子或缺將誤當聽牌');
    }
  }
  t.diagnostic(`100 次策略決策 ${measured.toFixed(1)}ms；平均 ${(measured / 100).toFixed(2)}ms`);
  assert.ok(measured < 5000, `策略阻塞過長：${measured.toFixed(0)}ms / 100 次`);
});
