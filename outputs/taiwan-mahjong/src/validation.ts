import type { ClaimWindow, GameState, Intent, Seat } from './model.js';
import { DECK, KINDS, isFlower, kindOf, nextSeat } from './tiles.js';

const deckIds = new Set(DECK);
const kinds = new Set(KINDS);
const phases = ['setup', 'initialFlowers', 'awaitDraw', 'awaitDiscard', 'awaitClaims', 'awaitRobKong', 'awaitReplacement', 'handResult', 'matchResult'];
function check(ok: unknown, path: string): asserts ok {
  if (!ok) throw new Error(`INVALID_STATE: ${path}`);
}
function object(value: unknown, path: string): asserts value is Record<string, unknown> {
  check(value !== null && typeof value === 'object' && !Array.isArray(value), path);
  check(Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null, path);
}
function array(value: unknown, path: string): asserts value is unknown[] { check(Array.isArray(value), path); }
function integer(value: unknown, path: string, min = 0, max = Number.MAX_SAFE_INTEGER): asserts value is number {
  check(Number.isSafeInteger(value) && Number(value) >= min && Number(value) <= max, path);
}
function id(value: unknown, path: string): asserts value is string {
  check(typeof value === 'string' && value.length > 0 && value.length <= 256, path);
}
function bool(value: unknown, path: string): void { check(typeof value === 'boolean', path); }
function seat(value: unknown, path: string): asserts value is Seat { integer(value, path, 0, 3); }
function tile(value: unknown, path: string): asserts value is string { check(typeof value === 'string' && deckIds.has(value), path); }
function kind(value: unknown, path: string): void { check(typeof value === 'string' && kinds.has(value), path); }
function unique(values: readonly unknown[], path: string): void { check(new Set(values).size === values.length, path); }
function tileList(value: unknown, path: string, flower = false): asserts value is string[] {
  array(value, path);
  value.forEach(t => { tile(t, path); check(isFlower(t) === flower, path); });
  unique(value, path);
}
function kindList(value: unknown, path: string): void {
  array(value, path); value.forEach(k => kind(k, path)); unique(value, path);
}
function fourNumbers(value: unknown, path: string, min: number): asserts value is number[] {
  array(value, path); check(value.length === 4, path); value.forEach(n => integer(n, path, min));
}
function sequence(values: string[]): boolean {
  const sorted = values.map(kindOf).sort();
  return sorted.length === 3 && /^[1-7][mps]$/.test(sorted[0]) && sorted[1] === `${Number(sorted[0][0]) + 1}${sorted[0][1]}` && sorted[2] === `${Number(sorted[0][0]) + 2}${sorted[0][1]}`;
}
function equalIntent(a: Intent, b: Intent): boolean {
  if (a.type !== b.type) return false;
  if (a.type === 'WIN' && b.type === 'WIN') return a.source === b.source && a.windowId === b.windowId;
  if ((a.type === 'CHI' || a.type === 'PON' || a.type === 'KAN_OPEN') && (b.type === 'CHI' || b.type === 'PON' || b.type === 'KAN_OPEN')) {
    return a.windowId === b.windowId && [...a.ownTiles].sort().join() === [...b.ownTiles].sort().join();
  }
  return a.type === 'PASS' && b.type === 'PASS' && a.windowId === b.windowId;
}

function windowIntent(value: unknown, window: ClaimWindow, actor: Seat, state: GameState, response: boolean): asserts value is Intent {
  object(value, 'pending.intent');
  check(value.windowId === window.windowId, 'pending.intent.windowId');
  if (value.type === 'PASS') { check(response, 'pending.options.PASS'); return; }
  if (value.type === 'WIN') {
    check(value.source === (window.kind === 'discard' ? 'ron' : 'robKong'), 'pending.WIN.source');
    return;
  }
  check(window.kind === 'discard' && ['CHI', 'PON', 'KAN_OPEN'].includes(String(value.type)), 'pending.intent.type');
  tileList(value.ownTiles, 'pending.ownTiles');
  const ownTiles = value.ownTiles;
  check(value.ownTiles.length === (value.type === 'KAN_OPEN' ? 3 : 2), 'pending.ownTiles.length');
  const player = state.players[actor];
  check(value.ownTiles.every(t => player.concealed.includes(t)), 'pending.ownTiles.owner');
  check(state.wall.tail - state.wall.head + 1 - 16 > 3, 'pending.claim.wall');
  if (value.type === 'CHI') {
    check(actor === nextSeat(window.sourceSeat) && sequence([...value.ownTiles, window.tileId]), 'pending.CHI');
  } else {
    check(value.ownTiles.every(t => kindOf(t) === kindOf(window.tileId)), 'pending.triplet');
    if (value.type === 'KAN_OPEN') check(actor !== nextSeat(window.sourceSeat), 'pending.KAN_OPEN.source');
  }
  if (value.type !== 'KAN_OPEN') {
    check(player.restrictions.lastDiscard !== kindOf(window.tileId), 'pending.claim.lastDiscard');
    const remaining = player.concealed.filter(t => !ownTiles.includes(t));
    check(remaining.some(t => value.type === 'CHI' ? !sequence([...ownTiles, t]) : kindOf(t) !== kindOf(window.tileId)), 'pending.claim.discard');
  }
}

/** Validate every stored field before any resumed action can consume it. */
export function assertState(value: unknown): asserts value is GameState {
  object(value, 'state');
  const s = value as unknown as GameState;
  check(s.schemaVersion === 1 && s.rulesVersion === 'TW16-CLASSIC-v1', 'version');
  id(s.matchId, 'matchId'); integer(s.handId, 'handId', 1);
  integer(s.version, 'version'); integer(s.eventSeq, 'eventSeq');
  integer(value.wallRandom, 'wallRandom', 1, 0xffffffff);
  seat(s.initialDealer, 'initialDealer'); seat(s.dealer, 'dealer'); seat(s.turn, 'turn');
  integer(s.dealerAdvances, 'dealerAdvances', 0, 16); integer(s.streak, 'streak');
  check(s.dealer === (s.initialDealer + s.dealerAdvances) % 4, 'dealerAdvances.dealer');
  check(s.roundWind === `${Math.min(3, Math.floor(s.dealerAdvances / 4)) + 1}z`, 'roundWind');
  check(phases.includes(s.phase), 'phase');
  check((s.dealerAdvances === 16) === (s.phase === 'matchResult'), 'matchResult.dealerAdvances');
  fourNumbers(s.scores, 'scores', Number.MIN_SAFE_INTEGER);
  check(s.scores.reduce((a, b) => a + b, 0) === 0, 'scores.sum');
  object(s.wall, 'wall'); array(s.wall.order, 'wall.order');
  check(s.wall.order.length === 144, 'wall.order.length');
  s.wall.order.forEach(t => tile(t, 'wall.order')); unique(s.wall.order, 'wall.order.duplicate');
  integer(s.wall.head, 'wall.head', 0, 128); integer(s.wall.tail, 'wall.tail', 15, 143);
  check(s.wall.reserveCount === 16 && s.wall.tail - s.wall.head + 1 >= 16, 'wall.reserve');
  const owned: string[] = s.wall.order.slice(s.wall.head, s.wall.tail + 1);
  const meldIds: string[] = [], discardIds: string[] = [], discardEvents: number[] = [];
  array(s.players, 'players'); check(s.players.length === 4, 'players.length');
  s.players.forEach((player, playerSeat) => {
    object(player, 'player'); tileList(player.concealed, 'concealed'); tileList(player.flowers, 'flowers', true);
    check(player.concealed.length <= 17 && player.flowers.length <= 8, 'player.count');
    owned.push(...player.concealed, ...player.flowers);
    array(player.melds, 'melds'); check(player.melds.length <= 5, 'melds.length');
    player.melds.forEach(meld => {
      object(meld, 'meld'); id(meld.meldId, 'meldId'); meldIds.push(meld.meldId);
      check(['chi', 'pon', 'exposedKong', 'concealedKong', 'addedKong'].includes(meld.kind), 'meld.kind');
      tileList(meld.tiles, 'meld.tiles');
      check(meld.tiles.length === (meld.kind === 'chi' || meld.kind === 'pon' ? 3 : 4), 'meld.tiles.length');
      check(meld.kind === 'chi' ? sequence(meld.tiles) : meld.tiles.every(t => kindOf(t) === kindOf(meld.tiles[0])), 'meld.shape');
      integer(meld.sourceEvent, 'meld.sourceEvent', 0, s.eventSeq);
      if (meld.kind === 'concealedKong') check(meld.fromSeat === null, 'meld.fromSeat');
      else {
        seat(meld.fromSeat, 'meld.fromSeat'); check(meld.fromSeat !== playerSeat, 'meld.fromSeat.self');
        if (meld.kind === 'chi') check(playerSeat === nextSeat(meld.fromSeat), 'meld.chi.source');
        if (meld.kind === 'exposedKong') check(playerSeat !== nextSeat(meld.fromSeat), 'meld.exposedKong.source');
      }
      owned.push(...meld.tiles);
    });
    array(player.discardHistory, 'discardHistory');
    let previousEvent = -1;
    player.discardHistory.forEach(discard => {
      object(discard, 'discard'); tile(discard.tileId, 'discard.tileId'); check(!isFlower(discard.tileId), 'discard.flower');
      integer(discard.eventSeq, 'discard.eventSeq', 0, s.eventSeq); check(discard.eventSeq > previousEvent, 'discard.eventSeq.order');
      previousEvent = discard.eventSeq; discardIds.push(discard.tileId); discardEvents.push(discard.eventSeq);
      if (discard.claimedBy === null) owned.push(discard.tileId);
      else { seat(discard.claimedBy, 'discard.claimedBy'); check(discard.claimedBy !== playerSeat, 'discard.claimedBy.self'); }
    });
    object(player.restrictions, 'restrictions'); bool(player.restrictions.passedWin, 'passedWin');
    kindList(player.restrictions.passedPon, 'passedPon'); kindList(player.restrictions.forbiddenDiscards, 'forbiddenDiscards');
    if (player.restrictions.lastDiscard !== null) kind(player.restrictions.lastDiscard, 'lastDiscard');
    check(player.restrictions.lastDiscard === (player.discardHistory.length ? kindOf(player.discardHistory.at(-1)!.tileId) : null), 'lastDiscard.history');
  });
  unique(meldIds, 'meldId.duplicate'); unique(discardIds, 'discard.duplicate'); unique(discardEvents, 'discard.eventSeq.duplicate');
  object(s.drawContext, 'drawContext');
  check(['deal', 'normal', 'claim', 'exposedKong', 'concealedKong', 'addedKong'].includes(s.drawContext.source), 'drawContext.source');
  if (s.drawContext.lastTile !== null) tile(s.drawContext.lastTile, 'drawContext.lastTile');
  bool(s.drawContext.replacement, 'drawContext.replacement'); bool(s.drawContext.selfDrawForbidden, 'drawContext.selfDrawForbidden');
  object(s.openingContext, 'openingContext');
  fourNumbers(s.openingContext.draws, 'openingContext.draws', 0); fourNumbers(s.openingContext.discards, 'openingContext.discards', 0);
  bool(s.openingContext.interrupted, 'openingContext.interrupted');
  s.players.forEach((p, i) => check(s.openingContext.discards[i] === p.discardHistory.length, 'openingContext.discards.history'));
  array(s.acceptedOpIds, 'acceptedOpIds'); s.acceptedOpIds.forEach(x => id(x, 'opId')); unique(s.acceptedOpIds, 'opId.duplicate');

  const terminal = s.phase === 'handResult' || s.phase === 'matchResult';
  if (!terminal) check(s.settlement === null, 'settlement.phase');
  else validateSettlement(s, owned);
  check(owned.length === 144, 'tiles.count'); unique(owned, 'tiles.ownership');
  validateReferences(s);
  validatePhase(s);
}

function validateReferences(s: GameState): void {
  s.players.forEach((p, owner) => {
    p.melds.forEach(m => {
      if (m.fromSeat === null) return;
      check(s.players[m.fromSeat].discardHistory.some(d => d.eventSeq === m.sourceEvent && d.claimedBy === owner && m.tiles.includes(d.tileId)), 'meld.source.reference');
    });
    p.discardHistory.forEach(d => {
      if (d.claimedBy === null) return;
      check(s.players[d.claimedBy].melds.some(m => m.fromSeat === owner && m.sourceEvent === d.eventSeq && m.tiles.includes(d.tileId)) || (s.settlement?.externalTile === d.tileId && s.settlement.source === 'ron' && s.settlement.winner === d.claimedBy), 'discard.claim.reference');
    });
  });
}

function validatePhase(s: GameState): void {
  const effective = s.players.map(p => p.concealed.length + 3 * p.melds.length);
  const c = s.drawContext;
  if (s.phase === 'setup') {
    check(s.pending === null && s.turn === s.dealer && s.wall.head === 0 && s.wall.tail === 143, 'setup');
    check(s.players.every(p => p.concealed.length + p.melds.length + p.flowers.length + p.discardHistory.length === 0), 'setup.players');
    check(c.source === 'deal' && c.lastTile === null && !c.replacement && !c.selfDrawForbidden, 'setup.context');
    check(s.openingContext.draws.every(n => n === 0) && !s.openingContext.interrupted, 'setup.opening');
    return;
  }
  if (s.phase === 'initialFlowers') {
    object(s.pending, 'initialFlowers.pending'); check(s.pending.kind === 'initialFlowers', 'initialFlowers.kind');
    array(s.pending.queue, 'initialFlowers.queue'); array(s.pending.later, 'initialFlowers.later');
    const debt = [...s.pending.queue, ...s.pending.later]; debt.forEach(n => seat(n, 'initialFlowers.seat'));
    s.players.forEach((p, i) => {
      check(p.melds.length === 0 && p.discardHistory.length === 0, 'initialFlowers.players');
      check(effective[i] + debt.filter(n => n === i).length === (i === s.dealer ? 17 : 16), 'initialFlowers.debt');
    });
    check(c.source === 'deal' && !c.replacement && !c.selfDrawForbidden, 'initialFlowers.context');
    check(s.openingContext.draws.every(n => n === 0) && !s.openingContext.interrupted, 'initialFlowers.opening');
    return;
  }
  if (s.phase === 'handResult' || s.phase === 'matchResult') { check(s.pending === null, 'terminal.pending'); return; }
  effective.forEach((count, i) => check(count === ((s.phase === 'awaitDiscard' || s.phase === 'awaitRobKong') && i === s.turn ? 17 : 16), 'effective.count'));
  if (s.phase === 'awaitClaims' || s.phase === 'awaitRobKong') {
    object(s.pending, 'pending'); check(s.pending.kind === (s.phase === 'awaitClaims' ? 'discard' : 'robKong'), 'pending.phase');
    const w = s.pending as ClaimWindow;
    id(w.windowId, 'windowId'); seat(w.sourceSeat, 'sourceSeat'); check(w.sourceSeat === s.turn, 'pending.turn');
    tile(w.tileId, 'pending.tileId'); check(!isFlower(w.tileId), 'pending.tileId.flower');
    if (w.kind === 'discard') {
      check(w.meldId === undefined, 'pending.discard.meldId');
      const last = s.players[s.turn].discardHistory.at(-1);
      check(last?.tileId === w.tileId && last.claimedBy === null, 'pending.discard.reference');
    } else {
      id(w.meldId, 'pending.meldId');
      const meld = s.players[s.turn].melds.find(m => m.meldId === w.meldId);
      check(meld?.kind === 'pon' && kindOf(meld.tiles[0]) === kindOf(w.tileId) && s.players[s.turn].concealed.includes(w.tileId), 'pending.robKong.reference');
      check(s.wall.tail - s.wall.head + 1 > 16, 'pending.robKong.wall');
    }
    object(w.options, 'pending.options'); object(w.responses, 'pending.responses');
    for (const [key, options] of Object.entries(w.options)) {
      check(/^[0-3]$/.test(key) && Number(key) !== w.sourceSeat, 'pending.options.seat');
      array(options, 'pending.options'); check(options.length > 0, 'pending.options.empty');
      options.forEach((intent, i) => {
        windowIntent(intent, w, Number(key) as Seat, s, false);
        check(!options.slice(0, i).some(prior => equalIntent(prior, intent)), 'pending.options.duplicate');
      });
    }
    for (const [key, response] of Object.entries(w.responses)) {
      check(/^[0-3]$/.test(key) && Object.hasOwn(w.options, key), 'pending.responses.seat');
      windowIntent(response, w, Number(key) as Seat, s, true);
      check(response.type === 'PASS' || w.options[Number(key) as Seat]!.some(option => equalIntent(response, option)), 'pending.responses.option');
    }
    return;
  }
  check(s.pending === null, 'pending.phase');
  if (s.phase === 'awaitDraw') check(c.source === 'normal' && c.lastTile === null && !c.replacement && !c.selfDrawForbidden, 'awaitDraw.context');
  if (s.phase === 'awaitReplacement') check(c.source !== 'deal' && c.source !== 'claim' && c.replacement, 'awaitReplacement.context');
  if (s.phase === 'awaitDiscard') {
    if (c.source === 'claim') check(c.lastTile === null && !c.replacement && !c.selfDrawForbidden, 'claim.context');
    else if (c.source !== 'deal') check(c.lastTile !== null && s.players[s.turn].concealed.includes(c.lastTile), 'awaitDiscard.lastTile');
    if (c.source === 'exposedKong') check(c.selfDrawForbidden && c.replacement, 'exposedKong.context');
  }
}

function validateSettlement(s: GameState, owned: string[]): void {
  object(s.settlement, 'settlement');
  const result = s.settlement;
  check(result.id === `${s.matchId}:${s.handId}`, 'settlement.id');
  check(['draw', 'selfDraw', 'ron', 'robKong', 'sevenFlowers', 'eightFlowers'].includes(result.source), 'settlement.source');
  fourNumbers(result.delta, 'settlement.delta', Number.MIN_SAFE_INTEGER);
  check(result.delta.reduce((a, b) => a + b, 0) === 0, 'settlement.delta.sum');
  if (result.externalTile !== null) { tile(result.externalTile, 'settlement.externalTile'); check(!isFlower(result.externalTile), 'settlement.externalTile.flower'); owned.push(result.externalTile); }
  if (result.source === 'draw') {
    check(result.winner === null && result.score === null && result.externalTile === null && result.delta.every(n => n === 0), 'settlement.draw');
    return;
  }
  seat(result.winner, 'settlement.winner');
  check(result.delta[result.winner] > 0 && result.delta.every((n, i) => i === result.winner || n <= 0), 'settlement.delta.winner');
  check((result.source === 'ron' || result.source === 'robKong') === (result.externalTile !== null), 'settlement.externalTile.source');
  if (result.source === 'ron' || result.source === 'robKong' || result.source === 'sevenFlowers') check(result.delta.filter(n => n < 0).length === 1, 'settlement.delta.payer');
  else check(result.delta.filter(n => n < 0).length === 3, 'settlement.delta.payers');
  if (result.source === 'sevenFlowers') check(s.players[result.winner].flowers.length === 7 && s.players.some((p, i) => i !== result.winner && p.flowers.length === 1), 'settlement.sevenFlowers');
  if (result.source === 'eightFlowers') check(s.players[result.winner].flowers.length === 8, 'settlement.eightFlowers');
  object(result.score, 'settlement.score');
  const score = result.score;
  integer(score.tai, 'score.tai'); array(score.items, 'score.items');
  score.items.forEach(item => {
    object(item, 'score.item'); check(typeof item.id === 'string' && /^S(0[1-9]|[12][0-9]|3[0-2])$/.test(item.id), 'score.item.id');
    integer(item.tai, 'score.item.tai'); check(typeof item.reason === 'string', 'score.item.reason');
  });
  check(score.items.reduce((sum, item) => sum + item.tai, 0) === score.tai, 'score.tai.sum');
  array(score.excluded, 'score.excluded'); check(score.excluded.every(x => typeof x === 'string'), 'score.excluded.item');
  if (score.decomposition !== null) {
    object(score.decomposition, 'score.decomposition'); kind(score.decomposition.pair, 'decomposition.pair');
    array(score.decomposition.groups, 'decomposition.groups');
    check(score.decomposition.groups.length === 5, 'decomposition.groups.length');
    score.decomposition.groups.forEach(group => {
      object(group, 'decomposition.group'); array(group.tiles, 'decomposition.tiles');
      check(group.tiles.length === 3, 'decomposition.tiles.length'); group.tiles.forEach(t => kind(t, 'decomposition.tile'));
      check(group.kind === 'sequence' ? sequence(group.tiles) : group.kind === 'triplet' && group.tiles.every(t => t === group.tiles[0]), 'decomposition.group.shape');
    });
    const player = s.players[result.winner], decomposition = score.decomposition;
    player.melds.forEach((meld, i) => {
      check(decomposition.groups[i].kind === (meld.kind === 'chi' ? 'sequence' : 'triplet') && [...decomposition.groups[i].tiles].sort().join() === meld.tiles.map(kindOf).sort().slice(0, 3).join(), 'decomposition.meld');
    });
    const concealed = [decomposition.pair, decomposition.pair, ...decomposition.groups.slice(player.melds.length).flatMap(group => group.tiles)].sort();
    check(concealed.join() === [...player.concealed, ...(result.externalTile ? [result.externalTile] : [])].map(kindOf).sort().join(), 'decomposition.concealed');
  }
}

export function serialize(state: GameState): string { assertState(state); return JSON.stringify(state); }
export function restore(json: string): GameState {
  check(typeof json === 'string', 'save.text');
  const value: unknown = JSON.parse(json);
  assertState(value);
  return value;
}
