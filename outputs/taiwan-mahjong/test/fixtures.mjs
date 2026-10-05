import assert from 'node:assert/strict';
import { createGame, applyAction, legalActions, assertState } from '../dist/engine.js';
import { DECK, kindOf, isFlower } from '../dist/tiles.js';

export const kinds = text => Array.isArray(text) ? text : (text.match(/[1-9]+[mpsz]|f[1-8]/g) ?? []).flatMap(t => t[0] === 'f' ? [t] : [...t.slice(0, -1)].map(n => n + t.at(-1)));
export const W02 = kinds('34m 456p 234p 345s 789s 11z');
export const WIN = kinds('123m 456m 234p 345s 789s 11z');
export const effective = p => p.concealed.length + p.melds.length * 3;
export const available = s => Math.max(0, s.wall.tail - s.wall.head + 1 - 16);

// Independent scenario builder: physical ownership is allocated before assembling the reference wall.
export function fixture(options = {}) {
  const { turn = 0, phase = 'awaitDiscard', hands = {}, melds = {}, flowers = {}, head = [], tail = [], available: usable } = options;
  const state = createGame({ dealer: options.dealer ?? 0, matchId: 'fixture', seed: 1 });
  const free = new Set(DECK);
  const take = kind => {
    const id = [...free].find(t => kindOf(t) === kind);
    assert.ok(id, `fixture needs unavailable tile ${kind}`);
    free.delete(id);
    return id;
  };
  for (let seat = 0; seat < 4; seat++) {
    const p = state.players[seat];
    p.concealed = kinds(hands[seat] ?? []).map(take);
    p.flowers = kinds(flowers[seat] ?? []).map(take);
    p.melds = (melds[seat] ?? []).map((m, i) => ({ meldId: `meld-${seat}-${i}`, kind: m.kind ?? 'pon', tiles: kinds(m.tiles).map(take), fromSeat: m.kind === 'concealedKong' ? null : (m.fromSeat ?? (seat + 3) % 4), sourceEvent: i + 1 }));
  }
  const lastDiscards = Object.entries(options.restrictions ?? {}).filter(([, r]) => r.lastDiscard).map(([seat, r]) => [Number(seat), take(r.lastDiscard)]);
  const first = kinds(head).map(take), last = kinds(tail).map(take);
  // Sparse deterministic filler minimizes accidental melds; explicit scenario hands always get priority.
  const fillerOrder = [...free].filter(t => !isFlower(t)).sort((a, b) => {
    const ka = kindOf(a), kb = kindOf(b);
    return Number(a.at(-1)) - Number(b.at(-1)) || Number(ka[0]) % 3 - Number(kb[0]) % 3 || ka.localeCompare(kb);
  });
  for (let seat = 0; seat < 4; seat++) {
    const p = state.players[seat];
    const target = 16 + (phase === 'awaitDiscard' && turn === seat ? 1 : 0);
    while (effective(p) < target) {
      const id = fillerOrder.find(t => free.has(t));
      assert.ok(id, 'fixture filler exhausted'); free.delete(id); p.concealed.push(id);
    }
    assert.equal(effective(p), target, `seat ${seat} effective count`);
  }
  let middle = [...free];
  if (usable !== undefined) {
    const count = 16 + usable - first.length - last.length;
    assert.ok(count >= 0 && count <= middle.length);
    const removed = middle.slice(count); middle = middle.slice(0, count);
    for (const id of removed) {
      if (isFlower(id)) [...state.players].sort((a, b) => a.flowers.length - b.flowers.length)[0].flowers.push(id);
      else state.players[3].discardHistory.push({ tileId: id, eventSeq: 0, claimedBy: null });
    }
  }
  const remaining = [...first, ...middle, ...last];
  const remSet = new Set(remaining);
  state.wall = { order: [...DECK.filter(t => !remSet.has(t)), ...remaining], head: 144 - remaining.length, tail: 143, reserveCount: 16 };
  Object.assign(state, { phase, turn, dealer: options.dealer ?? 0, streak: options.streak ?? 0, dealerAdvances: options.dealerAdvances ?? 0, roundWind: `${Math.floor((options.dealerAdvances ?? 0) / 4) + 1}z` });
  state.initialDealer = (state.dealer - state.dealerAdvances % 4 + 4) % 4;
  let seq = 0;
  for (let seat = 0; seat < 4; seat++) for (const m of state.players[seat].melds) {
    m.sourceEvent = ++seq;
    if (m.fromSeat !== null) state.players[m.fromSeat].discardHistory.unshift({ tileId: m.tiles[0], eventSeq: m.sourceEvent, claimedBy: seat });
  }
  for (const [seat, tileId] of lastDiscards) state.players[seat].discardHistory.push({ tileId, eventSeq: 0, claimedBy: null });
  for (const p of state.players) {
    p.discardHistory.sort((a, b) => (a.eventSeq || 10000) - (b.eventSeq || 10000));
    for (const d of p.discardHistory) if (!d.eventSeq) d.eventSeq = ++seq;
    p.restrictions.lastDiscard = p.discardHistory.length ? kindOf(p.discardHistory.at(-1).tileId) : null;
  }
  state.eventSeq = seq + 10; state.version = state.eventSeq;
  state.drawContext = { source: 'normal', lastTile: phase === 'awaitDraw' ? null : state.players[turn].concealed.at(-1) ?? null, replacement: false, selfDrawForbidden: false };
  state.openingContext = { draws: [2, 2, 2, 2], discards: state.players.map(p => p.discardHistory.length), interrupted: true };
  state.pending = null;
  if (options.restrictions) for (const [seat, restriction] of Object.entries(options.restrictions)) Object.assign(state.players[seat].restrictions, restriction);
  if (options.drawContext) Object.assign(state.drawContext, options.drawContext);
  assertState(state);
  return state;
}

export function action(state, actor, intent, overrides = {}) {
  return { opId: `${state.matchId}-${state.handId}-${state.version}-${actor}`, matchId: state.matchId, handId: state.handId, version: state.version, actor, intent, ...overrides };
}
export function step(state, actor, intent) {
  const before = JSON.stringify(state);
  const result = applyAction(state, action(state, actor, intent));
  assert.equal(result.ok, true, `rejected ${JSON.stringify(intent)}: ${result.error}`);
  assert.equal(JSON.stringify(state), before, 'pure transition mutated caller state');
  assert.equal(result.state.version, state.version + 1);
  assertState(result.state);
  return result.state;
}
export function choose(state, actor, type, predicate = () => true) {
  const intent = legalActions(state, actor).find(a => a.type === type && predicate(a));
  assert.ok(intent, `${type} missing for ${actor} in ${state.phase}`);
  return intent;
}
export const run = (s, actor, type, predicate) => step(s, actor, choose(s, actor, type, predicate));
export const discard = (s, seat, kind) => run(s, seat, 'DISCARD', a => kindOf(a.tileId) === kind);
export function resolve(s, choices = {}) {
  for (let seat = 0; seat < 4; seat++) {
    const acts = legalActions(s, seat);
    if (!acts.length) continue;
    const selected = typeof choices[seat] === 'function' ? acts.find(choices[seat]) : acts.find(a => a.type === (choices[seat] ?? 'PASS'));
    assert.ok(selected, `missing response ${choices[seat] ?? 'PASS'} for ${seat}`);
    s = step(s, seat, selected);
  }
  return run(s, 'engine', 'RESOLVE');
}
export function settleForced(s) {
  for (let n = 0; n < 12 && !['handResult', 'matchResult'].includes(s.phase); n++) {
    const intent = legalActions(s, 'engine').find(a => a.type === 'RESOLVE');
    if (!intent) break;
    s = step(s, 'engine', intent);
  }
  return s;
}
