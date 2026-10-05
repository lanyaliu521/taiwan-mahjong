import test from 'node:test';
import assert from 'node:assert/strict';
import { restore } from '../dist/engine.js';
import { settlePayments } from '../dist/scoring.js';
import { fixture, run, discard, resolve, W02 } from './fixtures.mjs';

const restored = state => restore(JSON.stringify(state));
const winHand = () => run(fixture({ hands: { 0: '123m 456m 234p 345s 789s 11z' }, streak: 2 }), 0, 'WIN');
const ronHand = () => resolve(discard(fixture({ hands: { 0: '2m', 1: W02 } }), 0, '2m'), { 1: 'WIN' });
const robKongHand = () => resolve(run(fixture({ hands: { 0: '5m', 1: W02 }, melds: { 0: [{ tiles: '555m' }] } }), 0, 'KAN_ADDED'), { 1: 'WIN' });
const sevenFlowers = () => run(fixture({ phase: 'awaitDraw', turn: 1, head: 'f8', flowers: { 0: 'f1 f2 f3 f4 f5 f6 f7' } }), 'engine', 'DRAW');
const eightFlowers = () => run(run(fixture({ phase: 'awaitDraw', head: 'f8', tail: '5m', flowers: { 0: 'f1 f2 f3 f4 f5 f6 f7' } }), 'engine', 'DRAW'), 'engine', 'REPLACE');
const finalMatch = () => {
  const hand = run(fixture({ turn: 2, dealer: 0, dealerAdvances: 15, streak: 2, hands: { 2: '123m 456m 234p 345s 789s 11z' } }), 2, 'WIN');
  return run(hand, 'engine', 'NEXT_HAND');
};
const finalRon = () => {
  const hand = resolve(discard(fixture({ turn: 2, dealer: 0, dealerAdvances: 15, streak: 2, hands: { 2: '2m', 3: W02 } }), 2, '2m'), { 3: 'WIN' });
  return run(hand, 'engine', 'NEXT_HAND');
};
const sevenFlowersAwayFromDealer = () => run(fixture({ phase: 'awaitDraw', turn: 1, head: 'f8', flowers: { 2: 'f1 f2 f3 f4 f5 f6 f7' } }), 'engine', 'DRAW');
const syncScores = s => { s.scores = [...s.settlement.delta]; };

test('合法自摸、放槍、搶槓、七花、八花及終局存檔均可還原', () => {
  const cases = [winHand(), ronHand(), robKongHand(), sevenFlowers(), eightFlowers(), finalMatch(), finalRon(), sevenFlowersAwayFromDealer()];
  for (const state of cases) {
    assert.ok(['handResult', 'matchResult'].includes(state.phase));
    assert.deepEqual(restored(state), state);
  }
  assert.equal(cases[0].settlement.source, 'selfDraw');
  assert.equal(cases[1].settlement.source, 'ron');
  assert.equal(cases[2].settlement.source, 'robKong');
  assert.equal(cases[3].settlement.source, 'sevenFlowers');
  assert.equal(cases[4].settlement.source, 'eightFlowers');
  assert.equal(cases[5].phase, 'matchResult');
  assert.equal(cases[5].streak, 0);
  assert.equal(cases[6].settlement.source, 'ron');
  assert.equal(cases[7].settlement.source, 'sevenFlowers');
  assert.equal(cases[7].settlement.delta[0], 0);
});

test('付款差額與總分同步竄改仍拒絕還原', () => {
  const bad = structuredClone(winHand());
  const winner = bad.settlement.winner, payer = bad.settlement.delta.findIndex((n, i) => i !== winner && n < 0);
  bad.settlement.delta[payer]--; bad.settlement.delta[winner]++;
  syncScores(bad);
  assert.equal(bad.settlement.delta.reduce((a, b) => a + b, 0), 0);
  assert.throws(() => restored(bad));
});

test('一般胡牌不得刪除五面子一對的拆法證據；花牌特殊胡仍可沒有一般胡形', () => {
  for (const state of [winHand(), ronHand(), robKongHand()]) {
    state.settlement.score.decomposition = null;
    assert.throws(() => restored(state), /decomposition.required/);
  }
  for (const state of [sevenFlowers(), eightFlowers()]) assert.deepEqual(restored(state), state);
});

test('放槍結算改由非放槍者付款仍拒絕還原', () => {
  const bad = structuredClone(ronHand()), winner = bad.settlement.winner;
  const payer = bad.players.findIndex(p => p.discardHistory.at(-1)?.claimedBy === winner);
  const other = [0, 1, 2, 3].find(seat => seat !== winner && seat !== payer);
  const amount = -bad.settlement.delta[payer];
  bad.settlement.delta[payer] = 0; bad.settlement.delta[other] = -amount;
  syncScores(bad);
  assert.throws(() => restored(bad));
});

test('放槍存檔的來源牌必須仍是該來源座位最後一張被胡捨牌', () => {
  const bad = structuredClone(ronHand());
  bad.turn = 2;
  bad.settlement.delta = settlePayments(bad.settlement.winner, [2], bad.settlement.score.tai, bad.dealer, bad.streak);
  syncScores(bad);
  assert.throws(() => restored(bad));
});

test('搶槓結算要求來源仍有同種碰牌', () => {
  const bad = structuredClone(robKongHand());
  bad.turn = 2;
  bad.settlement.delta = settlePayments(bad.settlement.winner, [2], bad.settlement.score.tai, bad.dealer, bad.streak);
  syncScores(bad);
  assert.throws(() => restored(bad));
});

test('末局連莊加台不可挪給另一位付款者', () => {
  const bad = structuredClone(finalMatch()), oldDealer = (bad.dealer + 3) % 4, winner = bad.settlement.winner;
  const other = [0, 1, 2, 3].find(seat => seat !== oldDealer && seat !== winner);
  [bad.settlement.delta[oldDealer], bad.settlement.delta[other]] = [bad.settlement.delta[other], bad.settlement.delta[oldDealer]];
  syncScores(bad);
  assert.throws(() => restored(bad));
});

test('末局莊家付款加台必須為奇數，合法末局閒家放槍及不涉莊七花可還原', () => {
  const bad = structuredClone(finalMatch()), oldDealer = (bad.dealer + 3) % 4, winner = bad.settlement.winner;
  bad.settlement.delta[oldDealer] -= 10; bad.settlement.delta[winner] += 10;
  syncScores(bad);
  assert.throws(() => restored(bad));
  assert.deepEqual(restored(finalRon()), finalRon());
  assert.deepEqual(restored(sevenFlowersAwayFromDealer()), sevenFlowersAwayFromDealer());
});

test('拒絕未知結算來源、末局流局／舊莊胡牌與未歸零連莊', () => {
  const source = structuredClone(winHand()); source.settlement.source = 'unknown';
  assert.throws(() => restored(source));

  const terminal = finalMatch(), oldDealer = (terminal.dealer + 3) % 4;
  const streak = structuredClone(terminal); streak.streak = 1;
  assert.throws(() => restored(streak));

  const dealerWin = structuredClone(terminal);
  dealerWin.settlement.winner = oldDealer;
  dealerWin.settlement.score.decomposition = null;
  dealerWin.settlement.delta = settlePayments(oldDealer, [0, 1, 2, 3].filter(s => s !== oldDealer), dealerWin.settlement.score.tai, oldDealer, 2);
  syncScores(dealerWin);
  assert.throws(() => restored(dealerWin));

  const draw = structuredClone(terminal);
  draw.settlement.winner = null; draw.settlement.source = 'draw'; draw.settlement.score = null;
  draw.settlement.externalTile = null; draw.settlement.delta = [0, 0, 0, 0]; draw.scores = [0, 0, 0, 0];
  assert.throws(() => restored(draw));
});
