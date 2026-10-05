import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, legalActions, applyAction, getObservation, assertState, serialize, restore } from '../dist/engine.js';
import { DECK, kindOf } from '../dist/tiles.js';
import { fixture, action, step, run, choose, discard, resolve, settleForced, kinds, W02, WIN, effective, available } from './fixtures.mjs';
import { chooseAction, seededRandom } from '../scripts/simulate.mjs';

const has = (s, seat, type) => legalActions(s, seat).some(a => a.type === type);
const end = s => { assert.equal(s.phase, 'handResult'); assert.equal(s.settlement.delta.reduce((a, b) => a + b, 0), 0); return s; };
const flowerDraw = opts => run(fixture({ phase: 'awaitDraw', ...opts }), 'engine', 'DRAW');
const replace = s => run(s, 'engine', 'REPLACE');
const noWin = (s, seat) => assert.equal(has(s, seat, 'WIN'), false);
const kongHand = '5555m 123p 456p 789p 123s 1z';

test('E01 起手補花逐輪進行，莊家 E17 不能重摸', () => {
  const deck = [...DECK];
  for (const [position, id] of [[0, 'f1#0'], [4, 'f2#0'], [143, 'f3#0'], [142, '9s#0']]) {
    const index = deck.indexOf(id); [deck[position], deck[index]] = [deck[index], deck[position]];
  }
  let s = run(createGame({ deck, dealer: 0, seed: 1 }), 'engine', 'DEAL');
  assert.equal(s.players[0].flowers.length, 1); assert.equal(s.players[1].flowers.length, 1);
  s = replace(s); assert.equal(s.players[0].flowers.length, 2);
  const before = s.players[1].concealed.length;
  s = replace(s); assert.equal(s.players[1].concealed.length, before + 1);
  for (let n = 0; n < 30 && s.phase === 'initialFlowers'; n++) {
    const intent = legalActions(s, 'engine')[0]; assert.ok(intent); s = step(s, 'engine', intent);
  }
  assert.equal(s.phase, 'awaitDiscard'); assert.deepEqual(s.players.map(effective), [17, 16, 16, 16]);
  assert.equal(has(s, 'engine', 'DRAW'), false);
});

test('E02 正常摸花及連續尾補每次只抽一張', () => {
  let s = fixture({ phase: 'awaitDraw', head: 'f1', tail: '9m f2' });
  const { head, tail } = s.wall;
  s = run(s, 'engine', 'DRAW'); assert.equal(s.wall.head, head + 1); assert.equal(s.phase, 'awaitReplacement');
  s = replace(s); assert.equal(s.wall.tail, tail - 1); assert.equal(s.phase, 'awaitReplacement');
  s = replace(s); assert.equal(s.wall.tail, tail - 2); assert.equal(s.phase, 'awaitDiscard');
  assert.equal(s.players[0].flowers.length, 2); assert.equal(effective(s.players[0]), 17);
});

test('E03 胡優先於碰及吃，未勝副露不動牌', () => {
  let s = fixture({ hands: { 0: '2m', 1: '34m', 2: '22m', 3: W02 } });
  s = discard(s, 0, '2m');
  assert.ok(has(s, 1, 'CHI')); assert.ok(has(s, 2, 'PON')); assert.ok(has(s, 3, 'WIN'));
  const before = s.players.map(p => [...p.concealed]);
  s = end(resolve(s, { 1: 'CHI', 2: 'PON', 3: 'WIN' }));
  assert.equal(s.settlement.winner, 3); assert.deepEqual(s.players[1].concealed, before[1]); assert.deepEqual(s.players[2].concealed, before[2]);
  assert.equal(s.players[1].restrictions.passedWin, false);
});

test('E04 攔胡依座次，較遠先答仍等近家', () => {
  const start = () => discard(fixture({ hands: { 0: '2m', 1: W02, 3: W02 } }), 0, '2m');
  for (const nearWins of [true, false]) {
    let s = run(start(), 3, 'WIN');
    assert.equal(has(s, 'engine', 'RESOLVE'), false);
    s = end(resolve(s, { 1: nearWins ? 'WIN' : 'PASS' }));
    assert.equal(s.settlement.winner, nearWins ? 1 : 3);
    if (nearWins) assert.equal(s.players[3].restrictions.passedWin, false);
  }
});

test('E05 只可吃上家', () => {
  for (const source of [0, 1, 3]) {
    const s = discard(fixture({ turn: source, hands: { [source]: '2m', 2: '34m' } }), source, '2m');
    assert.equal(has(s, 2, 'CHI'), source === 1);
  }
});

test('E06 禁止明槓上家，但仍可碰', () => {
  const s = discard(fixture({ hands: { 0: '5m', 1: '555m' } }), 0, '5m');
  assert.equal(has(s, 1, 'KAN_OPEN'), false); assert.ok(has(s, 1, 'PON'));
});

function addedFixture(extra = {}) {
  return fixture({ hands: { 0: '5m', 1: W02 }, melds: { 0: [{ tiles: '555m' }] }, ...extra });
}
test('E07 搶槓保留原碰，第四张從暗手移至結算且不補牌', () => {
  let s = addedFixture(); const tile = s.players[0].concealed.find(t => kindOf(t) === '5m'), tail = s.wall.tail;
  s = run(s, 0, 'KAN_ADDED'); assert.equal(s.phase, 'awaitRobKong');
  assert.ok(s.players[0].concealed.includes(tile)); assert.equal(s.players[0].melds[0].tiles.length, 3);
  s = restore(serialize(s)); assertState(s);
  s = end(resolve(s, { 1: 'WIN' }));
  assert.equal(s.settlement.source, 'robKong'); assert.equal(s.settlement.externalTile, tile);
  assert.equal(s.wall.tail, tail); assert.equal(s.players[0].melds[0].kind, 'pon');
  assert.equal(s.players[0].concealed.includes(tile), false);
});

test('E08 加槓正式成立才解除過水與准許尾補', () => {
  let s = addedFixture({ restrictions: { 0: { passedWin: true } } });
  s = run(s, 0, 'KAN_ADDED'); assert.equal(s.players[0].restrictions.passedWin, true);
  s = resolve(s); assert.equal(s.phase, 'awaitReplacement');
  assert.equal(s.players[0].melds[0].kind, 'addedKong'); assert.equal(s.players[0].restrictions.passedWin, false);
  const tail = s.wall.tail; s = replace(s); assert.equal(s.wall.tail, tail - 1);
});

test('E09 明槓補牌成胡仍禁止一般自摸且不額外過水', () => {
  let s = fixture({ hands: { 0: '5m', 2: '555m 123p 456p 789p 123s 1z' }, tail: '1z' });
  s = resolve(discard(s, 0, '5m'), { 2: 'KAN_OPEN' });
  s = replace(s); assert.equal(s.phase, 'awaitDiscard'); noWin(s, 2);
  assert.equal(s.drawContext.selfDrawForbidden, true); assert.equal(s.players[2].restrictions.passedWin, false);
});

test('E10 放過二萬也禁止其他五萬聽口與自摸', () => {
  let s = discard(fixture({ hands: { 0: '2m', 1: W02 }, head: '5m' }), 0, '2m');
  assert.ok(has(s, 1, 'WIN')); s = resolve(s);
  assert.equal(s.players[1].restrictions.passedWin, true);
  s = run(s, 'engine', 'DRAW'); noWin(s, 1);
  const other = discard(fixture({ hands: { 0: '5m', 1: W02 }, restrictions: { 1: { passedWin: true } } }), 0, '5m');
  noWin(other, 1);
});

test('E11 序列化還原保留過水及牌權', () => {
  const s = fixture({ restrictions: { 0: { passedWin: true, passedPon: ['5m'], lastDiscard: '9p' } } });
  const copy = restore(serialize(s)); assert.deepEqual(copy, s); assertState(copy);
});

test('E12 暗槓及補牌不解除過水', () => {
  let s = fixture({ hands: { 0: kongHand }, tail: '1z', restrictions: { 0: { passedWin: true } } });
  s = run(s, 0, 'KAN_CLOSED'); assert.equal(s.players[0].restrictions.passedWin, true);
  s = replace(s); assert.equal(s.players[0].restrictions.passedWin, true); noWin(s, 0);
});

test('E13 尾補減可用張數並保留16', () => {
  let s = fixture({ phase: 'awaitDraw', head: 'f1', tail: '9m', available: 3, flowers: { 1: 'f2 f3', 2: 'f4 f5', 3: 'f6 f7 f8' } });
  s = run(s, 'engine', 'DRAW'); assert.equal(available(s), 2);
  s = replace(s); assert.equal(available(s), 1); assert.equal(s.wall.tail - s.wall.head + 1, 17);
});

test('E14 尾三張禁吃碰明槓，但胡牌仍存在', () => {
  for (const a of [0, 1, 3]) {
    const s = discard(fixture({ hands: { 0: '2m', 1: '34m', 2: '222m', 3: W02 }, available: a }), 0, '2m');
    for (const seat of [1, 2, 3]) assert.equal(legalActions(s, seat).some(x => ['CHI', 'PON', 'KAN_OPEN'].includes(x.type)), false);
    assert.ok(has(s, 3, 'WIN'));
  }
});

test('E15 最後普通牌打出仍先等胡，無胡才流局', () => {
  for (const wins of [true, false]) {
    let s = fixture({ phase: 'awaitDraw', head: '2m', hands: { 1: W02 }, available: 1 });
    s = run(s, 'engine', 'DRAW'); assert.equal(available(s), 0);
    s = discard(s, 0, '2m'); assert.equal(s.phase, 'awaitClaims'); assert.ok(has(s, 1, 'WIN'));
    s = end(resolve(s, { 1: wins ? 'WIN' : 'PASS' })); assert.equal(s.settlement.source, wins ? 'ron' : 'draw');
  }
});

test('E16 最後花無補時保留16且不偽造出牌', () => {
  let s = flowerDraw({ head: 'f8', available: 1, flowers: { 1: 'f1 f2', 2: 'f3 f4', 3: 'f5 f6 f7' } });
  s = end(settleForced(s)); assert.equal(s.settlement.source, 'draw'); assert.equal(available(s), 0);
  assert.equal(effective(s.players[0]), 16); assert.equal(s.wall.tail - s.wall.head + 1, 16);
});

test('E17 可用零張禁止新暗槓及加槓', () => {
  const closed = fixture({ hands: { 0: kongHand }, available: 0 });
  const added = addedFixture({ available: 0 });
  assert.equal(has(closed, 0, 'KAN_CLOSED'), false); assert.equal(has(added, 0, 'KAN_ADDED'), false);
});

test('E18 自取第七花必須補完，唯一一花者支付', () => {
  let s = flowerDraw({ head: 'f7', tail: '9m', flowers: { 0: 'f1 f2 f3 f4 f5 f6', 1: 'f8' } });
  assert.notEqual(s.phase, 'handResult'); s = end(settleForced(replace(s)));
  assert.equal(s.settlement.source, 'sevenFlowers'); assert.equal(s.settlement.winner, 0);
  assert.equal(effective(s.players[0]), 17); assert.ok(s.settlement.delta[1] < 0); assert.equal(s.settlement.delta[2], 0); assert.equal(s.settlement.delta[3], 0);
});

test('E19 他家取末花立即七搶一，贏家 E16 不另補牌', () => {
  const original = fixture({ phase: 'awaitDraw', turn: 1, head: 'f8', flowers: { 0: 'f1 f2 f3 f4 f5 f6 f7' } });
  const s = end(settleForced(run(original, 'engine', 'DRAW')));
  assert.equal(s.settlement.winner, 0); assert.equal(s.settlement.source, 'sevenFlowers');
  assert.equal(effective(s.players[0]), 16); assert.equal(s.wall.tail, original.wall.tail); assert.equal(s.players[1].flowers.length, 1);
});

test('E20 八仙完成補牌才一次結算三家付款', () => {
  let s = flowerDraw({ head: 'f8', tail: '5m', hands: { 0: W02 }, flowers: { 0: 'f1 f2 f3 f4 f5 f6 f7' } });
  assert.notEqual(s.phase, 'handResult'); s = end(settleForced(replace(s)));
  assert.equal(s.settlement.source, 'eightFlowers'); assert.equal(s.settlement.winner, 0);
  assert.ok(s.settlement.delta.slice(1).every(n => n < 0)); assert.ok(s.settlement.score.tai > 8);
});

test('E21 莊胡與流局 N2 續為 N3', () => {
  let win = fixture({ hands: { 0: WIN }, streak: 2 }); win = end(run(win, 0, 'WIN'));
  let draw = fixture({ phase: 'awaitDraw', streak: 2, available: 0 }); draw = end(run(draw, 'engine', 'RESOLVE'));
  for (const s of [win, draw]) {
    const next = run(s, 'engine', 'NEXT_HAND'); assert.equal(next.dealer, 0); assert.equal(next.streak, 3);
    assert.equal(next.dealerAdvances, 0); assert.equal(next.roundWind, '1z');
  }
});

test('E22 閒胡換莊清連莊，第四次移莊進南圈', () => {
  let s = fixture({ turn: 2, dealer: 3, dealerAdvances: 3, streak: 2, hands: { 2: WIN } });
  s = run(end(run(s, 2, 'WIN')), 'engine', 'NEXT_HAND');
  assert.equal(s.dealer, 0); assert.equal(s.streak, 0); assert.equal(s.dealerAdvances, 4); assert.equal(s.roundWind, '2z');
});

test('E23 經連莊及流局後第16次移莊完成一將', () => {
  let context = { dealer: 0, dealerAdvances: 0, streak: 0 }, count = 0;
  for (const outcome of ['draw', 'dealer', ...Array(16).fill('other')]) {
    const turn = outcome === 'other' ? (context.dealer + 1) % 4 : context.dealer;
    let s = fixture({ ...context, turn, phase: outcome === 'draw' ? 'awaitDraw' : 'awaitDiscard', hands: outcome === 'draw' ? {} : { [turn]: WIN }, ...(outcome === 'draw' ? { available: 0 } : {}) });
    s = end(outcome === 'draw' ? run(s, 'engine', 'RESOLVE') : run(s, turn, 'WIN'));
    s = run(s, 'engine', 'NEXT_HAND'); count++;
    if (count < 18) assert.equal(s.phase, 'setup'); else { assert.equal(s.phase, 'matchResult'); assert.equal(s.dealerAdvances, 16); }
    context = { dealer: s.dealer, dealerAdvances: s.dealerAdvances, streak: s.streak };
  }
  assert.equal(count, 18);
});

test('E24 重複、過期、錯玩家及非法實體牌動作不能改局面', () => {
  const s = fixture(), intent = choose(s, 0, 'DISCARD'), a = action(s, 0, intent);
  const accepted = applyAction(s, a); assert.ok(accepted.ok);
  for (const invalid of [a, action(accepted.state, 0, intent, { version: s.version }), action(accepted.state, 1, intent), action(accepted.state, 0, { type: 'DISCARD', tileId: 'no-tile' })]) {
    const before = serialize(accepted.state), result = applyAction(accepted.state, invalid);
    assert.equal(result.ok, false); assert.equal(serialize(result.state), before);
  }
});

test('E25 未知暗手與牆互換不改觀察，暗槓牌種不可外洩', () => {
  const s = fixture({ melds: { 2: [{ kind: 'concealedKong', tiles: '5555m' }] } });
  const changed = structuredClone(s), a = changed.players[1].concealed[0], b = changed.wall.order[changed.wall.head];
  changed.players[1].concealed[0] = b;
  changed.wall.order = changed.wall.order.map(t => t === a ? b : t === b ? a : t); assertState(changed);
  assert.deepEqual(getObservation(s, 0), getObservation(changed, 0));
  assert.deepEqual(legalActions(s, 0), legalActions(changed, 0));
  assert.deepEqual(chooseAction(getObservation(s, 0), legalActions(s, 0), seededRandom(7)), chooseAction(getObservation(changed, 0), legalActions(changed, 0), seededRandom(7)));
  const view = getObservation(s, 0); assert.equal('wall' in view, false); assert.equal('wallRandom' in view, false);
  assert.equal(JSON.stringify(view.players[2].melds).includes('5m'), false);
  assert.equal('concealed' in view.players[1], false);
});

test('E26 結算重載與下一局不重複加分', () => {
  const settled = end(run(fixture({ hands: { 0: WIN } }), 0, 'WIN'));
  const scores = [...settled.scores], copy = restore(serialize(settled));
  assert.deepEqual(copy.scores, scores); const next = run(copy, 'engine', 'NEXT_HAND'); assert.deepEqual(next.scores, scores);
  assert.equal(has(next, 'engine', 'NEXT_HAND'), false); assert.equal(scores.reduce((a, b) => a + b, 0), 0);
});

test('E27 吃34萬取2萬後禁打2及5，只按所選吃法', () => {
  let s = discard(fixture({ hands: { 0: '2m', 1: '2345m' } }), 0, '2m');
  s = resolve(s, { 1: a => a.type === 'CHI' && a.ownTiles.map(kindOf).sort().join() === '3m,4m' });
  const discards = legalActions(s, 1).filter(a => a.type === 'DISCARD').map(a => kindOf(a.tileId));
  assert.equal(discards.includes('2m'), false); assert.equal(discards.includes('5m'), false); assert.ok(discards.length);
  assert.equal(has(s, 1, 'KAN_CLOSED'), false); noWin(s, 1);
});

test('E28 四槓及四風不另流局', () => {
  let s = fixture({ hands: { 0: '123p 1z' }, melds: { 0: [{ kind: 'concealedKong', tiles: '1111m' }, { kind: 'concealedKong', tiles: '2222m' }, { kind: 'concealedKong', tiles: '3333m' }, { kind: 'concealedKong', tiles: '4444m' }] } });
  s = resolve(discard(s, 0, '1z')); assert.equal(s.phase, 'awaitDraw');
  s = fixture({ hands: { 0: '1z', 1: '1z', 2: '1z', 3: '1z' }, head: '8m 8p 8s' });
  for (let seat = 0; seat < 4; seat++) { if (seat) s = run(s, 'engine', 'DRAW'); s = resolve(discard(s, seat, '1z')); }
  assert.equal(s.phase, 'awaitDraw'); assert.equal(s.settlement, null);
});

test('E29 過水摸中後捨4筒改聽仍不解除', () => {
  let s = fixture({ phase: 'awaitDraw', hands: { 0: W02 }, head: '5m', restrictions: { 0: { passedWin: true } } });
  s = run(s, 'engine', 'DRAW'); noWin(s, 0); s = discard(s, 0, '4p'); assert.equal(s.players[0].restrictions.passedWin, true);
});

test('E30 捨非結構胡牌的9萬才解除過水', () => {
  let s = fixture({ phase: 'awaitDraw', hands: { 0: W02 }, head: '9m', restrictions: { 0: { passedWin: true } } });
  s = run(s, 'engine', 'DRAW'); s = discard(s, 0, '9m'); assert.equal(s.players[0].restrictions.passedWin, false);
});

test('E31 放棄合法自摸也設過水', () => {
  let s = fixture({ phase: 'awaitDraw', hands: { 0: W02 }, head: '5m' });
  s = run(s, 'engine', 'DRAW'); assert.ok(has(s, 0, 'WIN')); s = discard(s, 0, '4p'); assert.equal(s.players[0].restrictions.passedWin, true);
});

test('E32 明槓後再次暗槓仍保留禁自摸', () => {
  let s = fixture({ hands: { 0: '5m', 2: '555m 6666m 123p 789p 12s 1z' }, tail: '3s 1z' });
  s = resolve(discard(s, 0, '5m'), { 2: 'KAN_OPEN' }); s = replace(s); s = run(s, 2, 'KAN_CLOSED');
  s = replace(s); assert.equal(s.drawContext.selfDrawForbidden, true); noWin(s, 2);
});

test('E33 開局閒家七搶一優先於莊家天胡', () => {
  let s = fixture({ hands: { 0: WIN }, flowers: { 1: 'f1 f2 f3 f4 f5 f6 f7', 2: 'f8' } });
  s.phase = 'initialFlowers'; s.pending = { kind: 'initialFlowers', queue: [], later: [] };
  s.drawContext = { source: 'deal', lastTile: null, replacement: false, selfDrawForbidden: false };
  s.openingContext = { draws: [0, 0, 0, 0], discards: [0, 0, 0, 0], interrupted: false };
  assertState(s);
  s = end(run(s, 'engine', 'RESOLVE')); assert.equal(s.settlement.winner, 1); assert.equal(effective(s.players[1]), 16);
  assert.equal(s.settlement.source, 'sevenFlowers'); assert.equal(s.settlement.delta[0], 0); assert.ok(s.settlement.delta[2] < 0);
});

test('E34 過水或明槓禁自摸不擋花胡但排除正常台', () => {
  for (const restriction of ['passedWin', 'selfDrawForbidden']) {
    let s = flowerDraw({ head: 'f8', tail: '5m', hands: { 0: W02 }, flowers: { 0: 'f1 f2 f3 f4 f5 f6 f7' }, ...(restriction === 'passedWin' ? { restrictions: { 0: { passedWin: true } } } : {}) });
    if (restriction === 'selfDrawForbidden') { s.drawContext.selfDrawForbidden = true; s.drawContext.source = 'exposedKong'; }
    s = end(settleForced(replace(s))); assert.equal(s.settlement.source, 'eightFlowers'); assert.equal(s.settlement.score.tai, 8);
    assert.deepEqual(s.settlement.delta, [360, -120, -120, -120]);
  }
});

test('E35 過碰維持到自己出牌，補花不清除', () => {
  let s = discard(fixture({ hands: { 0: '5m', 1: '55m' }, head: 'f1', tail: '9p' }), 0, '5m');
  assert.ok(has(s, 1, 'PON')); s = resolve(s); assert.ok(s.players[1].restrictions.passedPon.includes('5m'));
  s = run(s, 'engine', 'DRAW'); s = replace(s); assert.ok(s.players[1].restrictions.passedPon.includes('5m'));
  const blocked = discard(fixture({ hands: { 0: '5m', 1: '55m' }, restrictions: { 1: { passedPon: ['5m'] } } }), 0, '5m'); assert.equal(has(blocked, 1, 'PON'), false);
  s = discard(s, 1, '9p'); assert.deepEqual(s.players[1].restrictions.passedPon, []);
});

test('E36 最後自捨同種禁回吃碰，改打後解除', () => {
  for (const lastDiscard of ['5m', '9p']) {
    const s = discard(fixture({ hands: { 0: '5m', 1: '3455m' }, restrictions: { 1: { lastDiscard } } }), 0, '5m');
    assert.equal(has(s, 1, 'PON'), lastDiscard === '9p'); assert.equal(has(s, 1, 'CHI'), lastDiscard === '9p');
  }
});

test('花胡補牌耗盡的第七或第八花不成立', () => {
  for (const count of [6, 7]) {
    let s = flowerDraw({ head: `f${count + 1}`, available: 1, flowers: { 0: Array.from({ length: count }, (_, i) => `f${i + 1}`), ...(count === 6 ? { 1: 'f8' } : {}) } });
    s = end(settleForced(s)); assert.equal(s.settlement.source, 'draw'); assert.equal(s.settlement.winner, null);
  }
});

test('存檔拒絕未知版本、重複牌及不一致階段', () => {
  const s = fixture();
  for (const mutate of [x => { x.schemaVersion = 99; }, x => { x.players[0].concealed[0] = x.players[1].concealed[0]; }, x => { x.phase = 'awaitRobKong'; x.pending = null; }]) {
    const bad = structuredClone(s); mutate(bad); assert.throws(() => restore(JSON.stringify(bad)));
  }
  assert.throws(() => restore('{')); assert.throws(() => createGame({ deck: DECK.slice(1) }));
});

test('攔胡使較遠家碰的選擇無效，不可因此記過水', () => {
  let s = discard(fixture({ hands: { 0: '5m', 1: W02, 3: '123p 456p 789p 123s 11z 55m' } }), 0, '5m');
  assert.ok(has(s, 3, 'WIN')); s = run(s, 3, 'PON');
  s = end(resolve(s, { 1: 'WIN' })); assert.equal(s.settlement.winner, 1);
  assert.equal(s.players[3].restrictions.passedWin, false); assert.deepEqual(s.players[3].restrictions.passedPon, []);
});

test('一般副露胡拆解及結算可存檔恢復', () => {
  let s = fixture({ hands: { 0: '456m 234p 345s 789s 11z' }, melds: { 0: [{ kind: 'chi', tiles: '123m' }] } });
  s = end(run(s, 0, 'WIN')); assert.equal(s.settlement.score.decomposition.groups.length, 5);
  assert.deepEqual(restore(serialize(s)), s);
});

test('尾局A0他家末花的立即七搶一優先於無補流局', () => {
  let s = fixture({ phase: 'awaitDraw', turn: 1, head: 'f8', available: 1, flowers: { 0: 'f1 f2 f3 f4 f5 f6 f7' } });
  s = end(settleForced(run(s, 'engine', 'DRAW')));
  assert.equal(available(s), 0); assert.equal(s.settlement.source, 'sevenFlowers'); assert.equal(s.settlement.winner, 0);
  assert.equal(effective(s.players[0]), 16); assert.equal(effective(s.players[1]), 16);
});

test('真正明槓接補花成八仙時只算花胡，不加成形正常手牌', () => {
  let s = fixture({ hands: { 0: '5m', 2: '555m 123p 456p 789p 123s 1z' }, flowers: { 2: 'f1 f2 f3 f4 f5 f6 f7' }, tail: '1z f8' });
  s = resolve(discard(s, 0, '5m'), { 2: 'KAN_OPEN' });
  s = replace(s); assert.equal(s.phase, 'awaitReplacement'); assert.equal(s.players[2].flowers.length, 8);
  s = end(settleForced(replace(s))); assert.equal(s.settlement.source, 'eightFlowers'); assert.equal(s.settlement.winner, 2);
  assert.equal(s.settlement.score.tai, 8); assert.deepEqual(s.settlement.score.items.map(x => x.id), ['S25']);
});

test('開局閒家八仙E16立即強制結算，三家付款', () => {
  let s = fixture({ flowers: { 2: 'f1 f2 f3 f4 f5 f6 f7 f8' } });
  s.phase = 'initialFlowers'; s.pending = { kind: 'initialFlowers', queue: [], later: [] };
  s.drawContext = { source: 'deal', lastTile: null, replacement: false, selfDrawForbidden: false };
  s.openingContext = { draws: [0, 0, 0, 0], discards: [0, 0, 0, 0], interrupted: false }; assertState(s);
  s = end(run(s, 'engine', 'RESOLVE')); assert.equal(s.settlement.source, 'eightFlowers'); assert.equal(s.settlement.winner, 2);
  assert.equal(effective(s.players[2]), 16); assert.equal(s.settlement.score.tai, 8); assert.equal(s.settlement.delta.filter(x => x < 0).length, 3);
});
