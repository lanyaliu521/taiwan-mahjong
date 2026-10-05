import test from 'node:test';
import assert from 'node:assert/strict';
import { coachAnalysis } from '../dist/coach.js';
import { createGame, getObservation, legalActions } from '../dist/engine.js';
import { kindOf } from '../dist/tiles.js';
import { fixture, discard, W02 } from './fixtures.mjs';

test('發牌初始化與真人沒有合法動作時不分析', () => {
  const initial = getObservation(createGame({ dealer: 0, seed: 9 }), 0);
  assert.equal(initial.phase, 'setup');
  assert.equal(coachAnalysis(initial), null);

  const waiting = getObservation(fixture({ phase: 'awaitDraw', turn: 0, hands: { 0: W02 } }), 0);
  assert.deepEqual(waiting.legalActions, []);
  assert.equal(coachAnalysis(waiting), null);
});

test('真人摸牌後只比較引擎合法棄牌種類，且不修改觀察資料', () => {
  const state = fixture({ hands: { 0: [...W02, '7z'] } });
  const o = getObservation(state, 0), before = structuredClone(o);
  const result = coachAnalysis(o);
  assert.ok(result);
  assert.deepEqual(result.discards.map(x => x.kind).sort(), [...new Set(o.legalActions.filter(a => a.type === 'DISCARD').map(a => kindOf(a.tileId)))].sort());
  assert.deepEqual(o, before);
});

test('134遇2保留引擎提供的兩種吃法及各自合法棄牌', () => {
  const state = discard(fixture({ hands: { 0: '2m', 1: '1345m 67m 123p 456p 789s 1z' } }), 0, '2m');
  const o = getObservation(state, 1), before = structuredClone(o), result = coachAnalysis(o);
  assert.ok(result);
  assert.equal(result.claims.length, 2);
  assert.deepEqual(result.claims.map(c => c.intent.ownTiles.map(kindOf).sort()), [['1m', '3m'], ['3m', '4m']]);
  assert.ok(result.claims.every(c => c.discards.length > 0));
  assert.deepEqual(o, before);
});

test('碰牌比較沿用引擎合法選項', () => {
  const state = discard(fixture({ hands: { 0: '2m', 1: '22m 134m 567m 123p 456s 1z' } }), 0, '2m');
  const o = getObservation(state, 1);
  assert.ok(o.legalActions.some(a => a.type === 'PON'));
  const result = coachAnalysis(o);
  assert.ok(result);
  assert.deepEqual(result.claims.map(c => c.intent), o.legalActions.filter(a => a.type === 'PON' || a.type === 'CHI'));
});

test('過水令合法胡牌為假，且不改動資料', () => {
  const state = discard(fixture({ hands: { 0: '2m', 1: W02 }, restrictions: { 1: { passedWin: true } } }), 0, '2m');
  const o = getObservation(state, 1), before = structuredClone(o), result = coachAnalysis(o);
  assert.ok(result);
  assert.equal(result.canWin, false);
  assert.deepEqual(o, before);
});

test('已聽牌但公開聽口耗盡仍保留0張；當下合法胡牌資格獨立判定', () => {
  const dead = discard(fixture({ turn: 1, hands: { 0: '111m 222m 333p 444p 555s 1z', 1: '5s' }, restrictions: { 1: { lastDiscard: '1z' }, 2: { lastDiscard: '1z' }, 3: { lastDiscard: '1z' } } }), 1, '5s');
  const result = coachAnalysis(getObservation(dead, 0));
  assert.equal(result.current.shanten, 0);
  assert.equal(result.current.improving, 0);
  assert.deepEqual(result.current.effectiveTiles, [{ kind: '1z', count: 0 }]);
  assert.equal(result.canWin, false);

  const live = discard(fixture({ turn: 1, hands: { 0: '111m 222m 333p 444p 555s 1z', 1: '1z' }, restrictions: { 2: { lastDiscard: '1z' }, 3: { lastDiscard: '1z' } } }), 1, '1z');
  const win = coachAnalysis(getObservation(live, 0));
  assert.equal(win.current.improving, 0);
  assert.equal(win.canWin, true, '公開未知牌剩0不會取消當下合法胡牌');
});

test('合法回應只有PASS時仍顯示目前牌型', () => {
  const state = discard(fixture({ hands: { 0: '2m', 1: W02 } }), 0, '2m');
  const o = getObservation(state, 1);
  o.legalActions = o.legalActions.filter(a => a.type === 'PASS');
  assert.ok(o.legalActions.length);
  const result = coachAnalysis(o);
  assert.ok(result);
  assert.deepEqual(result.claims, []);
});

test('即使張數齊全，初始補花與補牌階段仍不生成提示', () => {
  const o = getObservation(fixture({ hands: { 0: [...W02, '7z'] } }), 0);
  for (const phase of ['setup', 'initialFlowers', 'awaitReplacement', 'handResult', 'matchResult']) {
    assert.equal(coachAnalysis({ ...o, phase }), null);
  }
});
