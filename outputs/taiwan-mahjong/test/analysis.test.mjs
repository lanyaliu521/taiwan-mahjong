import test from 'node:test';
import assert from 'node:assert/strict';
import { createAnalyzer, exactPool, publicPool, analyzeObservation, bestDiscards } from '../dist/analysis.js';
import { isWinningHand, winningTiles } from '../dist/hand.js';
import { createGame, getObservation, legalActions, assertState } from '../dist/engine.js';
import { chooseAction } from '../dist/ai.js';
import { DECK, KINDS, kindOf, isFlower } from '../dist/tiles.js';
import { kinds, fixture, discard, step, W02, WIN } from './fixtures.mjs';

function sample(text, declarations = []) {
  const free = new Set(DECK.filter(t => !isFlower(t)));
  const take = k => { const t = [...free].find(t => kindOf(t) === k); assert.ok(t); free.delete(t); return t; };
  const melds = declarations.map((d, i) => {
    const [tiles, kind = 'pon'] = Array.isArray(d) ? d : [d];
    return { meldId: `m${i}`, kind, tiles: kinds(tiles).map(take), fromSeat: kind === 'concealedKong' ? null : 1, sourceEvent: i + 1 };
  });
  const concealed = kinds(text); concealed.forEach(take);
  return { concealed, melds, pool: exactPool([...free]) };
}
const run = s => createAnalyzer(s.pool).analyze(s.concealed, s.melds);

function verifyExample(s, a) {
  const e = a.example;
  const used = [...e.completed.slice(s.melds.length).flat(), ...e.partials.flat(), ...e.pair, ...e.singles].sort();
  assert.deepEqual(used, [...s.concealed].sort(), 'each concealed tile is allocated exactly once');
  assert.ok(e.completed.every(g => g.length === 3));
  assert.ok(e.partials.every(g => g.length === 2));
  assert.ok(e.pair.length === 0 || e.pair.length === 2);
  const target = [...e.target.groups.flat(), e.target.pair, e.target.pair];
  assert.equal(target.length + s.melds.length * 3, 17);
  assert.ok(isWinningHand(target, s.melds), 'closest target must obey the actual hand validator');
  const have = new Map(KINDS.map(k => [k, s.concealed.filter(t => t === k).length]));
  const missing = KINDS.reduce((n, k) => n + Math.max(0, target.filter(t => t === k).length - have.get(k)), 0);
  assert.equal(missing - 1, a.shanten, 'example witnesses the reported distance');
}

test('台灣五面子一對E17完成；四面子兩面搭加將E16的聽口吻合', () => {
  const complete = sample(WIN), a = run(complete);
  assert.equal(a.shanten, -1); assert.equal(a.effective, 17); verifyExample(complete, a);
  const waiting = sample(W02), b = run(waiting);
  assert.equal(b.shanten, 0); assert.equal(b.improving, 8);
  assert.deepEqual(b.effectiveTiles.map(t => t.kind), ['2m', '5m']);
  assert.deepEqual(b.effectiveTiles.map(t => t.kind), winningTiles(waiting.concealed, waiting.melds));
  verifyExample(waiting, b);
});

test('副露111萬＋第四張單騎不能期待第五張；結構距離須提高', () => {
  const s = sample('1m', ['111m', '222m', '333m', '444m', '555m']), a = run(s);
  assert.equal(a.shanten, 1); assert.deepEqual(winningTiles(s.concealed, s.melds), []);
  assert.ok(!a.effectiveTiles.some(t => ['1m', '2m', '3m', '4m', '5m'].includes(t.kind)));
  assert.equal(a.improving, 116); verifyExample(s, a);
});

test('四副露＋暗刻及被副露耗盡的單騎，排除假0向聽', () => {
  const s = sample('222z 1m', ['111m', '333p', '444p', '555p']), a = run(s);
  assert.equal(a.shanten, 1); assert.deepEqual(winningTiles(s.concealed, s.melds), []);
  verifyExample(s, a);
});

test('五副露有正常單騎仍為聽牌；暗槓按四張容量及一個面子', () => {
  const s = sample('1z', [['1111m', 'concealedKong'], '222p', '333p', '444p', '555p']), a = run(s);
  assert.equal(a.effective, 16); assert.equal(a.shanten, 0);
  assert.deepEqual(a.effectiveTiles, [{ kind: '1z', count: 3 }]); verifyExample(s, a);
});

test('四張字牌不能當刻子加將；非零距離保留可行成胡目標', () => {
  const s = sample('1111z 222z 333z 444z 55z 6z'), a = run(s);
  assert.equal(a.shanten, 1); verifyExample(s, a);
});

test('捨牌按合法牌種去重、不同距離及並列最佳，不把E17當捨出後', () => {
  const s = sample([...W02, '7z']), analyzer = createAnalyzer(s.pool);
  const d = analyzer.discards(s.concealed, s.melds, [...s.concealed, '7z']);
  assert.equal(d.filter(t => t.kind === '7z').length, 1);
  assert.equal(d.find(t => t.kind === '7z').analysis.shanten, 0);
  assert.ok(d.some(t => t.analysis.shanten > 0));
  assert.deepEqual(bestDiscards(d).map(t => t.kind), ['7z']);
  const five = sample('12z', [['123m', 'chi'], ['456m', 'chi'], ['123p', 'chi'], ['456p', 'chi'], ['789s', 'chi']]);
  const tied = createAnalyzer(five.pool).discards(five.concealed, five.melds, five.concealed);
  assert.deepEqual(bestDiscards(tied).map(t => t.kind).sort(), ['1z', '2z']);
  assert.throws(() => analyzer.discards(s.concealed, s.melds, ['9z']), /INVALID_DISCARD/);
});

test('精確牌池比例可手算；耗盡聽口仍保留結構距離，空池不除零', () => {
  const s = sample(W02);
  const tiles = ['2m#0', '5m#0', '5m#1', '7z#0'];
  const a = createAnalyzer(exactPool(tiles)).analyze(s.concealed);
  assert.equal(a.improving, 3); assert.equal(a.total, 4); assert.equal(a.probability, .75);
  const b = createAnalyzer(exactPool(['7z#0'])).analyze(s.concealed);
  assert.equal(b.shanten, 0); assert.equal(b.improving, 0); assert.equal(b.probability, 0);
  assert.deepEqual(b.effectiveTiles, [{ kind: '2m', count: 0 }, { kind: '5m', count: 0 }]);
  const c = createAnalyzer(exactPool([])).analyze(s.concealed);
  assert.equal(c.shanten, 0); assert.equal(c.total, 0); assert.equal(c.probability, null);
});

test('公開實體去重、暗槓遮罩不扣猜定牌種；分母不是可摸牌牆', () => {
  const o = getObservation(fixture({ hands: { 0: [...W02, '7z'] } }), 0);
  const before = publicPool(o);
  o.players[1].melds.push({ meldId: 'hidden', kind: 'concealedKong', count: 4 });
  assert.deepEqual(publicPool(o), before);
  o.players[2].melds.push({ meldId: 'open', kind: 'pon', tiles: ['2m#0', '2m#1', '2m#2'], fromSeat: 3, sourceEvent: 99 });
  o.players[3].discardHistory.push({ tileId: '2m#0', eventSeq: 99, claimedBy: 2 });
  const p = publicPool(o);
  assert.equal(p.counts[KINDS.indexOf('2m')], 1);
  assert.equal(p.counts.reduce((a, b) => a + b, 0), 116);
  const a = analyzeObservation(o, false);
  assert.equal(a.best[0].analysis.improving, 5);
  assert.equal(a.best[0].analysis.probability, 5 / 116);
  o.available = 0;
  assert.deepEqual(analyzeObservation(o, false), a);
});

test('待搶加槓公開的第四張也須扣除，不能只讀既有碰牌', () => {
  let s = fixture({ hands: { 0: '2m', 1: W02 }, melds: { 0: [{ tiles: '222m' }] } });
  s = step(s, 0, legalActions(s, 0).find(a => a.type === 'KAN_ADDED'));
  const o = getObservation(s, 1), p = publicPool(o);
  assert.ok(o.offeredKong);
  assert.equal(p.counts[KINDS.indexOf('2m')], 0);
});

test('134遇2兩種吃法逐一分析，共用引擎禁捨，不改輸入', () => {
  const s = discard(fixture({ hands: { 0: '2m', 1: '1345m 67m 123p 456p 789s 1z' } }), 0, '2m');
  const o = getObservation(s, 1), copy = structuredClone(o), a = analyzeObservation(o);
  assert.equal(a.claims.length, 2);
  for (const c of a.claims) {
    const own = c.intent.ownTiles.map(kindOf).sort();
    const banned = own.includes('4m') ? ['2m', '5m'] : ['2m'];
    assert.ok(c.discards.length > 0);
    assert.ok(c.discards.every(d => !banned.includes(d.kind) && d.analysis.effective === 16));
  }
  assert.deepEqual(o, copy);
});

test('牌型聽牌與目前合法胡牌分開，過水保持結構聽口', () => {
  const s = discard(fixture({ hands: { 0: '2m', 1: W02 }, restrictions: { 1: { passedWin: true } } }), 0, '2m');
  const a = analyzeObservation(getObservation(s, 1));
  assert.equal(a.current.shanten, 0); assert.equal(a.canWin, false);
  assert.ok(a.current.effectiveTiles.some(t => t.kind === '2m'));
});

test('更換他家暗手、暗槓與牌牆但真人觀察相同，分析與AI完全相同', () => {
  const a = fixture({ hands: { 0: [...W02, '7z'] }, melds: { 1: [{ kind: 'concealedKong', tiles: '4444z' }] } });
  const swap = id => id.startsWith('4z#') ? id.replace('4z', '6z') : id.startsWith('6z#') ? id.replace('6z', '4z') : id;
  const b = structuredClone(a);
  b.players.forEach(p => { p.concealed = p.concealed.map(swap); p.melds.forEach(m => { m.tiles = m.tiles.map(swap); }); });
  b.wallRandom = 789;
  // Keep consumed wall prefix out of the live tail: only reverse the actual unexposed region.
  b.wall.order = [...a.wall.order.slice(0, a.wall.head).map(swap), ...a.wall.order.slice(a.wall.head, a.wall.tail + 1).map(swap).reverse(), ...a.wall.order.slice(a.wall.tail + 1).map(swap)];
  assertState(b);
  const oa = getObservation(a, 0), ob = getObservation(b, 0);
  assert.deepEqual(oa, ob);
  assert.deepEqual(analyzeObservation(oa), analyzeObservation(ob));
  assert.deepEqual(chooseAction(oa, oa.legalActions, 11), chooseAction(ob, ob.legalActions, 11));
});

test('分析／牌池邊界拒絕非法牌數、第五張、副露、重複ID及重疊牌池', () => {
  const s = sample(W02), analyzer = createAnalyzer(s.pool);
  assert.throws(() => analyzer.analyze(null), /INVALID_ANALYSIS_HAND/);
  assert.throws(() => analyzer.analyze(['1m']), /INVALID_EFFECTIVE/);
  assert.throws(() => analyzer.analyze(kinds('11111m 222m 333m 444m 55m')), /INVALID_ANALYSIS_HAND/);
  assert.throws(() => exactPool(['1m#0', '1m#0']), /INVALID_TILE_POOL/);
  assert.throws(() => exactPool(['f1#0']), /INVALID_TILE_POOL/);
  assert.throws(() => createAnalyzer({ source: 'public', counts: Array(34) }), /INVALID_TILE_POOL/);
  assert.throws(() => createAnalyzer({ source: 'public', counts: Array(34).fill(5) }), /INVALID_TILE_POOL/);
  assert.throws(() => createAnalyzer({ source: 'public', counts: Array(34).fill(4) }).analyze(s.concealed), /POOL_OVERLAPS/);
});

// Independent exhaustive oracle: with four declared groups, enumerate every final group and pair.
// This does not reuse the target dynamic program or its distances.
const targetCache = new Map();
function oracleFour(s) {
  const key = JSON.stringify(s.melds);
  if (!targetCache.has(key)) {
    const groups = KINDS.map(k => [k, k, k]), targets = [];
    for (const suit of 'mps') for (let rank = 1; rank <= 7; rank++) groups.push([rank, rank + 1, rank + 2].map(n => n + suit));
    for (const group of groups) for (const pair of KINDS) {
      const target = [...group, pair, pair];
      if (isWinningHand(target, s.melds)) targets.push([...new Set(target)].map(k => [k, target.filter(t => t === k).length]));
    }
    targetCache.set(key, targets);
  }
  const have = new Map(KINDS.map(k => [k, s.concealed.filter(t => t === k).length]));
  return Math.min(...targetCache.get(key).map(target => target.reduce((n, [k, count]) => n + Math.max(0, count - have.get(k)), 0) - 1));
}

test('80個四副露手牌距離與有效進張符合獨立完整目標枚舉', () => {
  const declarations = ['111m', '222m', '333m', ['4444p', 'concealedKong']];
  const base = sample([], declarations);
  const free = DECK.filter(t => !isFlower(t) && !base.melds.flatMap(m => m.tiles).includes(t));
  let random = 123;
  for (let n = 0; n < 80; n++) {
    const available = [...free], hand = [];
    for (let j = 0; j < 4; j++) { random = (Math.imul(random, 1664525) + 1013904223) >>> 0; hand.push(kindOf(available.splice(random % available.length, 1)[0])); }
    const s = sample(hand, declarations), a = run(s);
    assert.equal(a.shanten, oracleFour(s)); verifyExample(s, a);
    const improving = KINDS.filter(k => {
      if (s.melds.flatMap(m => m.tiles).map(kindOf).filter(t => t === k).length + s.concealed.filter(t => t === k).length === 4) return false;
      return oracleFour({ ...s, concealed: [...s.concealed, k] }) < a.shanten;
    });
    assert.deepEqual(a.effectiveTiles.map(t => t.kind), improving);
  }
});

test('60個閉手字牌案例對照全部42種五刻子加將的完整目標', () => {
  const honors = KINDS.slice(27), targets = [];
  for (let excluded = 0; excluded < 7; excluded++) for (let pair = 0; pair < 7; pair++) {
    if (pair === excluded) continue;
    targets.push(honors.map((_, i) => i === excluded ? 0 : i === pair ? 2 : 3));
  }
  let random = 567;
  for (let n = 0; n < 60; n++) {
    const available = honors.flatMap(k => Array(4).fill(k)), hand = [];
    for (let j = 0; j < 16 + n % 2; j++) { random = (Math.imul(random, 1664525) + 1013904223) >>> 0; hand.push(available.splice(random % available.length, 1)[0]); }
    const s = sample(hand), a = run(s), counts = honors.map(k => hand.filter(t => t === k).length);
    const expected = Math.min(...targets.map(t => t.reduce((cost, amount, i) => cost + Math.max(0, amount - counts[i]), 0) - 1));
    assert.equal(a.shanten, expected); verifyExample(s, a);
    if (a.shanten === 0 && a.effective === 16) assert.deepEqual(a.effectiveTiles.map(t => t.kind), winningTiles(hand));
    if (a.shanten === -1) assert.ok(isWinningHand(hand));
  }
});
