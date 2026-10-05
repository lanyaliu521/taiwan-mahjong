import type { Action, ClaimWindow, GameState, Intent, Meld, Player, ScoreInput, ScoreResult, Seat, TileId, TileKind } from './model.js';
import { DECK, KINDS, isFlower, kindOf, nextSeat, seatWind, shuffledDeck } from './tiles.js';
import { isWinningHand, winningTiles } from './hand.js';
import { evaluateHand, settlePayments } from './scoring.js';
import { assertState, restore as readSnapshot, serialize } from './validation.js';
export { assertState, serialize } from './validation.js';

const seats: Seat[] = [0, 1, 2, 3];
const emptyPlayer = (): Player => ({ concealed: [], melds: [], flowers: [], discardHistory: [], restrictions: { passedWin: false, passedPon: [], lastDiscard: null, forbiddenDiscards: [] } });
const context = (source: GameState['drawContext']['source']): GameState['drawContext'] => ({ source, lastTile: null, replacement: false, selfDrawForbidden: false });
export const availableTiles = (s: GameState): number => Math.max(0, s.wall.tail - s.wall.head + 1 - 16);
const effective = (p: Player): number => p.concealed.length + 3 * p.melds.length;
const kinds = (ts: TileId[]): TileKind[] => ts.map(kindOf);
function random(s: { wallRandom: number }): number {
  // ponytail: local reproducible PRNG; use server-owned randomness if competitive multiplayer is added.
  let x = s.wallRandom; x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  s.wallRandom = x >>> 0; return s.wallRandom / 4294967296;
}
export function createGame(options: { dealer?: Seat; deck?: TileId[]; matchId?: string; seed?: number } = {}): GameState {
  const rng = { wallRandom: options.seed ?? (crypto.getRandomValues(new Uint32Array(1))[0] || 1) };
  if (!Number.isInteger(rng.wallRandom) || rng.wallRandom < 1 || rng.wallRandom > 0xffffffff) throw new Error('INVALID_SEED');
  const dealer = options.dealer ?? Math.floor(random(rng) * 4) as Seat;
  const order = options.deck ? [...options.deck] : shuffledDeck(() => random(rng));
  const s: GameState = {
    schemaVersion: 1, rulesVersion: 'TW16-CLASSIC-v1', matchId: options.matchId ?? crypto.randomUUID(), handId: 1, version: 0, eventSeq: 0,
    initialDealer: dealer, dealer, dealerAdvances: 0, roundWind: '1z', streak: 0, scores: [0, 0, 0, 0],
    wall: { order, head: 0, tail: 143, reserveCount: 16 }, wallRandom: rng.wallRandom,
    players: seats.map(emptyPlayer), phase: 'setup', turn: dealer, drawContext: context('deal'),
    openingContext: { draws: [0, 0, 0, 0], discards: [0, 0, 0, 0], interrupted: false }, pending: null, acceptedOpIds: [], settlement: null,
  };
  assertState(s); return s;
}
const windowOf = (s: GameState): ClaimWindow | null => s.pending?.kind === 'discard' || s.pending?.kind === 'robKong' ? s.pending : null;
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
  return JSON.stringify(value);
}
const sameIntent = (a: Intent, b: Intent): boolean => canonical(a) === canonical(b);
function remove(p: Player, ids: TileId[]): void {
  for (const id of ids) {
    const i = p.concealed.indexOf(id);
    if (i < 0) throw new Error('MISSING_OWN_TILE');
    p.concealed.splice(i, 1);
  }
}
function inputFor(s: GameState, seat: Seat, source: ScoreInput['source'], tile: TileId | null): ScoreInput {
  const p = s.players[seat], ownTurn = source === 'selfDraw';
  return {
    concealed: kinds(p.concealed).concat(!ownTurn && tile ? [kindOf(tile)] : []), melds: p.melds, flowers: kinds(p.flowers), winningTile: tile ? kindOf(tile) : null,
    source, seatWind: seatWind(seat, s.dealer), roundWind: s.roundWind,
    heavenly: ownTurn && seat === s.dealer && s.drawContext.source === 'deal' && !s.openingContext.interrupted && s.openingContext.discards[s.dealer] === 0,
    earthly: ownTurn && seat !== s.dealer && s.openingContext.draws[seat] === 1 && !s.openingContext.interrupted && s.openingContext.discards[seat] === 0,
    human: !ownTurn && source === 'ron' && seat !== s.dealer && s.openingContext.draws[seat] === 0 && !s.openingContext.interrupted,
    afterReplacement: ownTurn && s.drawContext.replacement && s.drawContext.source !== 'deal',
    lastAvailable: ownTurn && s.drawContext.source !== 'deal' && availableTiles(s) === 0,
  };
}
function normalScore(s: GameState, seat: Seat, source: ScoreInput['source'], tile: TileId | null): ScoreResult | null {
  const p = s.players[seat];
  if (p.restrictions.passedWin || (source === 'selfDraw' && (s.drawContext.selfDrawForbidden || s.drawContext.source === 'claim'))) return null;
  const input = inputFor(s, seat, source, tile);
  if (!isWinningHand(input.concealed, p.melds)) return null;
  return evaluateHand(input);
}
function finish(s: GameState, winner: Seat | null, source: NonNullable<GameState['settlement']>['source'], score: ScoreResult | null, payers: Seat[] = [], externalTile: TileId | null = null): void {
  if (s.settlement) throw new Error('ALREADY_SETTLED');
  const delta = winner === null ? [0, 0, 0, 0] : settlePayments(winner, payers, score!.tai, s.dealer, s.streak);
  s.scores = s.scores.map((n, i) => n + delta[i]);
  s.settlement = { id: `${s.matchId}:${s.handId}`, winner, source, score, delta, externalTile };
  s.phase = 'handResult'; s.pending = null;
}
function flowerWin(s: GameState, winner: Seat, mode: 'sevenFlowers' | 'eightFlowers', allowNormal: boolean): void {
  const normal = allowNormal && effective(s.players[winner]) === 17 ? normalScore(s, winner, 'selfDraw', s.drawContext.source === 'deal' ? null : s.drawContext.lastTile) : null;
  const items = normal?.items.filter(x => x.id !== 'S06' && x.id !== 'S11') ?? [];
  items.push({ id: mode === 'sevenFlowers' ? 'S24' : 'S25', tai: 8, reason: mode === 'sevenFlowers' ? '七花／一花分布' : '取得八花並完成補牌' });
  const score: ScoreResult = { tai: items.reduce((n, x) => n + x.tai, 0), items, excluded: [...(normal?.excluded ?? []), 'S06', 'S11'], decomposition: normal?.decomposition ?? null };
  const payers = mode === 'eightFlowers' ? seats.filter(x => x !== winner) : seats.filter(x => x !== winner && s.players[x].flowers.length === 1);
  finish(s, winner, mode, score, payers);
}
function checkFlowers(s: GameState, opening = false): boolean {
  const winner = seats.find(x => s.players[x].flowers.length === 8 || (s.players[x].flowers.length === 7 && seats.some(y => y !== x && s.players[y].flowers.length === 1)));
  if (winner === undefined || (!opening && (winner !== s.turn || effective(s.players[winner]) !== 17))) return false;
  flowerWin(s, winner, s.players[winner].flowers.length === 8 ? 'eightFlowers' : 'sevenFlowers', winner === s.turn); return true;
}
function receive(s: GameState, id: TileId, initial: boolean): boolean {
  const p = s.players[s.turn];
  s.drawContext.lastTile = id;
  if (!isFlower(id)) { p.concealed.push(id); return false; }
  const before = p.flowers.length;
  p.flowers.push(id);
  if (!initial && before === 0) {
    const seven = seats.find(x => x !== s.turn && s.players[x].flowers.length === 7);
    if (seven !== undefined) flowerWin(s, seven, 'sevenFlowers', false);
  }
  return true;
}
function discardBan(own: TileId[], tile: TileId): TileKind[] {
  const a = kinds(own);
  return KINDS.filter(k => {
    const ns = [...a, k].sort();
    return ns[0][1] !== 'z' && ns.every(x => x[1] === ns[0][1]) && Number(ns[1][0]) === Number(ns[0][0]) + 1 && Number(ns[2][0]) === Number(ns[1][0]) + 1;
  });
}
function possibleClaims(s: GameState, seat: Seat, w: ClaimWindow): Intent[] {
  if (seat === w.sourceSeat) return [];
  const p = s.players[seat], k = kindOf(w.tileId), own = p.concealed.filter(x => kindOf(x) === k), result: Intent[] = [];
  const source = w.kind === 'robKong' ? 'robKong' : 'ron';
  if (normalScore(s, seat, source, w.tileId)) result.push({ type: 'WIN', source, windowId: w.windowId });
  if (w.kind === 'robKong' || availableTiles(s) <= 3) return result;
  if (own.length >= 3 && nextSeat(w.sourceSeat) !== seat) result.push({ type: 'KAN_OPEN', ownTiles: own.slice(0, 3), windowId: w.windowId });
  if (p.restrictions.lastDiscard === k) return result;
  if (own.length >= 2 && !p.restrictions.passedPon.includes(k) && p.concealed.some(t => kindOf(t) !== k)) result.push({ type: 'PON', ownTiles: own.slice(0, 2), windowId: w.windowId });
  if (seat === nextSeat(w.sourceSeat) && k[1] !== 'z') {
    const rank = Number(k[0]);
    for (let start = rank - 2; start <= rank; start++) {
      if (start < 1 || start > 7) continue;
      const needed = [start, start + 1, start + 2].filter(n => n !== rank).map(n => `${n}${k[1]}`);
      const ids = needed.map(n => p.concealed.find(t => kindOf(t) === n));
      if (ids.some(x => x === undefined)) continue;
      const ownTiles = ids as TileId[], ban = discardBan(ownTiles, w.tileId);
      if (p.concealed.some(t => !ownTiles.includes(t) && !ban.includes(kindOf(t)))) result.push({ type: 'CHI', ownTiles, windowId: w.windowId });
    }
  }
  return result;
}
function openWindow(s: GameState, kind: ClaimWindow['kind'], sourceSeat: Seat, tileId: TileId, meldId?: string): void {
  const w: ClaimWindow = { kind, windowId: `${s.handId}:${s.eventSeq}`, sourceSeat, tileId, ...(meldId ? { meldId } : {}), options: {}, responses: {} };
  for (const seat of seats) { const opts = possibleClaims(s, seat, w); if (opts.length) w.options[seat] = opts; }
  s.pending = w; s.phase = kind === 'discard' ? 'awaitClaims' : 'awaitRobKong';
}
const priority = (i: Intent): number => i.type === 'WIN' ? 3 : i.type === 'PON' || i.type === 'KAN_OPEN' ? 2 : i.type === 'CHI' ? 1 : 0;
function windowReady(w: ClaimWindow): boolean {
  const ordered = seats.filter(x => w.options[x]).sort((a, b) => (a - w.sourceSeat + 4) % 4 - (b - w.sourceSeat + 4) % 4);
  const winning = ordered.filter(x => w.responses[x]?.type !== 'PASS' && w.responses[x] && priority(w.responses[x]!) > 0).sort((a, b) => priority(w.responses[b]!) - priority(w.responses[a]!));
  const best = winning[0];
  return ordered.every(x => {
    if (w.responses[x]) return true;
    if (best === undefined) return false;
    const max = Math.max(...w.options[x]!.map(priority)), chosen = priority(w.responses[best]!);
    return max < chosen || (max === chosen && (x - w.sourceSeat + 4) % 4 > (best - w.sourceSeat + 4) % 4);
  });
}
export function legalActions(s: GameState, actor: Seat | 'engine'): Intent[] {
  if (actor === 'engine') {
    if (s.phase === 'setup') return [{ type: 'DEAL' }];
    if (s.phase === 'initialFlowers') return [{ type: s.pending?.kind === 'initialFlowers' && s.pending.queue.length ? 'REPLACE' : 'RESOLVE' }];
    if (s.phase === 'awaitDraw') return [{ type: availableTiles(s) ? 'DRAW' : 'RESOLVE' }];
    if (s.phase === 'awaitReplacement') return [{ type: availableTiles(s) ? 'REPLACE' : 'RESOLVE' }];
    if ((s.phase === 'awaitClaims' || s.phase === 'awaitRobKong') && windowReady(windowOf(s)!)) return [{ type: 'RESOLVE' }];
    if (s.phase === 'handResult') return [{ type: 'NEXT_HAND' }];
    return [];
  }
  if (!seats.includes(actor)) return [];
  const w = windowOf(s);
  if (w) return w.options[actor] && !w.responses[actor] && !windowReady(w) ? [...w.options[actor]!, { type: 'PASS', windowId: w.windowId }] : [];
  if (s.phase !== 'awaitDiscard' || s.turn !== actor) return [];
  const p = s.players[actor], result: Intent[] = [];
  if (normalScore(s, actor, 'selfDraw', s.drawContext.source === 'deal' ? null : s.drawContext.lastTile)) result.push({ type: 'WIN', source: 'selfDraw' });
  if (s.drawContext.source !== 'claim' && availableTiles(s) > 0) {
    for (const k of new Set(kinds(p.concealed))) {
      const ids = p.concealed.filter(t => kindOf(t) === k);
      if (ids.length === 4) result.push({ type: 'KAN_CLOSED', ownTiles: ids });
      const pon = p.melds.find(m => m.kind === 'pon' && kindOf(m.tiles[0]) === k);
      if (pon) result.push({ type: 'KAN_ADDED', meldId: pon.meldId, tileId: ids[0] });
    }
  }
  return result.concat(p.concealed.filter(t => !p.restrictions.forbiddenDiscards.includes(kindOf(t))).map(tileId => ({ type: 'DISCARD', tileId })));
}
function markDeclines(s: GameState, seat: Seat, chosen: Intent, options: Intent[]): void {
  const r = s.players[seat].restrictions;
  if (chosen.type !== 'WIN' && options.some(x => x.type === 'WIN')) r.passedWin = true;
  if (chosen.type !== 'PON' && chosen.type !== 'KAN_OPEN' && chosen.type !== 'WIN' && options.some(x => x.type === 'PON')) {
    const w = windowOf(s)!; r.passedPon = [...new Set([...r.passedPon, kindOf(w.tileId)])];
  }
}
function resolveClaims(s: GameState): void {
  const w = windowOf(s)!;
  const order = seats.filter(x => w.responses[x] && priority(w.responses[x]!) > 0).sort((a, b) => priority(w.responses[b]!) - priority(w.responses[a]!) || (a - w.sourceSeat + 4) % 4 - (b - w.sourceSeat + 4) % 4);
  const winner = order[0];
  // Record only choices that could have changed the final ruling, regardless of response arrival order.
  for (const seat of seats) {
    const response = w.responses[seat];
    if (!response) continue;
    const actionable = (w.options[seat] ?? []).filter(option => winner === undefined ||
      priority(option) > priority(w.responses[winner]!) ||
      (priority(option) === priority(w.responses[winner]!) && (seat - w.sourceSeat + 4) % 4 <= (winner - w.sourceSeat + 4) % 4));
    markDeclines(s, seat, response, actionable);
  }
  if (winner !== undefined) {
    const action = w.responses[winner]!, p = s.players[winner];
    if (action.type === 'WIN') {
      const source = w.kind === 'discard' ? 'ron' : 'robKong';
      const score = normalScore(s, winner, source, w.tileId);
      if (!score) throw new Error('INVALID_CLAIM_WIN');
      if (w.kind === 'robKong') remove(s.players[w.sourceSeat], [w.tileId]);
      else s.players[w.sourceSeat].discardHistory.at(-1)!.claimedBy = winner;
      finish(s, winner, source, score, [w.sourceSeat], w.tileId); return;
    }
    if (action.type !== 'CHI' && action.type !== 'PON' && action.type !== 'KAN_OPEN') throw new Error('INVALID_CLAIM');
    const discard = s.players[w.sourceSeat].discardHistory.at(-1)!;
    remove(p, action.ownTiles); discard.claimedBy = winner;
    p.melds.push({ meldId: `${s.handId}:${s.eventSeq}`, kind: action.type === 'CHI' ? 'chi' : action.type === 'PON' ? 'pon' : 'exposedKong', tiles: [...action.ownTiles, w.tileId], fromSeat: w.sourceSeat, sourceEvent: discard.eventSeq });
    p.restrictions.forbiddenDiscards = action.type === 'CHI' ? discardBan(action.ownTiles, w.tileId) : action.type === 'PON' ? [kindOf(w.tileId)] : [];
    s.turn = winner; s.pending = null; s.openingContext.interrupted = true;
    s.drawContext = context(action.type === 'KAN_OPEN' ? 'exposedKong' : 'claim');
    if (action.type === 'KAN_OPEN') { s.drawContext.selfDrawForbidden = true; s.drawContext.replacement = true; s.phase = 'awaitReplacement'; }
    else s.phase = 'awaitDiscard';
    return;
  }
  if (w.kind === 'robKong') {
    const p = s.players[w.sourceSeat], meld = p.melds.find(x => x.meldId === w.meldId)!;
    remove(p, [w.tileId]); meld.tiles.push(w.tileId); meld.kind = 'addedKong'; p.restrictions.passedWin = false;
    s.drawContext.source = 'addedKong'; s.drawContext.replacement = true; s.drawContext.lastTile = null;
    s.pending = null; s.phase = 'awaitReplacement'; return;
  }
  s.pending = null;
  if (availableTiles(s) === 0) finish(s, null, 'draw', null);
  else { s.turn = nextSeat(w.sourceSeat); s.phase = 'awaitDraw'; s.drawContext = context('normal'); }
}
function nextHand(s: GameState): void {
  if (s.settlement!.winner === null || s.settlement!.winner === s.dealer) s.streak++;
  else { s.dealer = nextSeat(s.dealer); s.dealerAdvances++; s.streak = 0; }
  s.roundWind = `${Math.min(3, Math.floor(s.dealerAdvances / 4)) + 1}z`;
  if (s.dealerAdvances === 16) { s.phase = 'matchResult'; return; }
  s.handId++; s.players = seats.map(emptyPlayer); s.turn = s.dealer; s.drawContext = context('deal');
  s.wall = { order: shuffledDeck(() => random(s)), head: 0, tail: 143, reserveCount: 16 };
  s.openingContext = { draws: [0, 0, 0, 0], discards: [0, 0, 0, 0], interrupted: false };
  s.phase = 'setup'; s.pending = null; s.settlement = null; s.acceptedOpIds = [];
}
export function applyAction(state: GameState, action: Action): { ok: true; state: GameState; events: string[] } | { ok: false; state: GameState; error: string } {
  const reject = (error: string) => ({ ok: false as const, state, error });
  if (!action || typeof action !== 'object' || typeof action.opId !== 'string' || !action.opId || action.opId.length > 128 || !action.intent) return reject('INVALID_ACTION');
  if (action.matchId !== state.matchId || action.handId !== state.handId) return reject('WRONG_HAND');
  if (state.acceptedOpIds.includes(action.opId)) return reject('DUPLICATE_OPERATION');
  if (action.version !== state.version) return reject('STALE_VERSION');
  const options = legalActions(state, action.actor);
  if (!options.some(i => sameIntent(i, action.intent))) return reject('ILLEGAL_ACTION');
  const s = structuredClone(state), a = action.intent, p = s.players[s.turn];
  s.version++; s.eventSeq++; s.acceptedOpIds.push(action.opId);
  switch (a.type) {
    case 'DEAL': {
      for (let round = 0; round < 4; round++) for (let offset = 0; offset < 4; offset++) {
        const seat = ((s.dealer + offset) % 4) as Seat;
        s.players[seat].concealed.push(...s.wall.order.slice(s.wall.head, s.wall.head + 4)); s.wall.head += 4;
      }
      s.players[s.dealer].concealed.push(s.wall.order[s.wall.head++]);
      const queue: Seat[] = [];
      for (let n = 0; n < 4; n++) {
        const seat = ((s.dealer + n) % 4) as Seat, player = s.players[seat];
        player.flowers = player.concealed.filter(isFlower); player.concealed = player.concealed.filter(t => !isFlower(t));
        queue.push(...player.flowers.map(() => seat));
      }
      s.pending = { kind: 'initialFlowers', queue, later: [] }; s.phase = 'initialFlowers'; break;
    }
    case 'DRAW': {
      s.drawContext = context('normal'); s.openingContext.draws[s.turn]++;
      const id = s.wall.order[s.wall.head++], flower = receive(s, id, false);
      if (s.settlement) break;
      s.phase = flower ? 'awaitReplacement' : 'awaitDiscard';
      s.drawContext.replacement = flower;
      if (!flower) checkFlowers(s); break;
    }
    case 'REPLACE': {
      if (s.pending?.kind === 'initialFlowers') {
        const pending = s.pending;
        s.turn = pending.queue.shift()!;
        if (receive(s, s.wall.order[s.wall.tail--], true)) pending.later.push(s.turn);
        if (!pending.queue.length && pending.later.length) { pending.queue = pending.later; pending.later = []; }
      } else {
        const flower = receive(s, s.wall.order[s.wall.tail--], false);
        if (s.settlement) break;
        if (!flower) { s.phase = 'awaitDiscard'; checkFlowers(s); }
      }
      break;
    }
    case 'RESOLVE': {
      if (s.phase === 'initialFlowers') {
        s.pending = null; s.turn = s.dealer; s.drawContext = context('deal');
        if (!checkFlowers(s, true)) s.phase = 'awaitDiscard';
      } else if (windowOf(s)) resolveClaims(s);
      else finish(s, null, 'draw', null);
      break;
    }
    case 'DISCARD': {
      markDeclines(s, s.turn, a, options); remove(p, [a.tileId]);
      const r = p.restrictions, k = kindOf(a.tileId);
      if (r.passedWin && !winningTiles(kinds(p.concealed), p.melds).includes(k)) r.passedWin = false;
      r.passedPon = []; r.lastDiscard = k; r.forbiddenDiscards = [];
      p.discardHistory.push({ tileId: a.tileId, eventSeq: s.eventSeq, claimedBy: null });
      s.openingContext.discards[s.turn]++; s.drawContext.selfDrawForbidden = false;
      openWindow(s, 'discard', s.turn, a.tileId); break;
    }
    case 'KAN_CLOSED': {
      markDeclines(s, s.turn, a, options); remove(p, a.ownTiles);
      p.melds.push({ meldId: `${s.handId}:${s.eventSeq}`, kind: 'concealedKong', tiles: [...a.ownTiles], fromSeat: null, sourceEvent: s.eventSeq });
      s.openingContext.interrupted = true; s.drawContext.source = 'concealedKong'; s.drawContext.lastTile = null; s.drawContext.replacement = true; s.phase = 'awaitReplacement'; break;
    }
    case 'KAN_ADDED':
      markDeclines(s, s.turn, a, options); s.openingContext.interrupted = true; openWindow(s, 'robKong', s.turn, a.tileId, a.meldId); break;
    case 'WIN':
      if (a.source === 'selfDraw') finish(s, s.turn, 'selfDraw', normalScore(s, s.turn, 'selfDraw', s.drawContext.source === 'deal' ? null : s.drawContext.lastTile)!, seats.filter(x => x !== s.turn));
      else windowOf(s)!.responses[action.actor as Seat] = a;
      break;
    case 'CHI': case 'PON': case 'KAN_OPEN': case 'PASS': {
      const seat = action.actor as Seat, w = windowOf(s)!;
      w.responses[seat] = a; break;
    }
    case 'NEXT_HAND': nextHand(s); break;
  }
  assertState(s);
  return { ok: true, state: s, events: [a.type, ...(s.phase === 'handResult' ? [s.settlement!.source] : [])] };
}
export function getObservation(s: GameState, seat: Seat) {
  if (!seats.includes(seat)) throw new Error('INVALID_SEAT');
  const p = s.players[seat];
  return structuredClone({
    seat, matchId: s.matchId, handId: s.handId, version: s.version, phase: s.phase, turn: s.turn,
    dealer: s.dealer, roundWind: s.roundWind, streak: s.streak, scores: s.scores, available: availableTiles(s),
    self: { concealed: p.concealed, melds: p.melds, flowers: p.flowers, restrictions: p.restrictions },
    players: s.players.map((player, i) => ({ concealedCount: player.concealed.length, flowers: player.flowers, discardHistory: player.discardHistory,
      melds: player.melds.map(m => m.kind === 'concealedKong' && i !== seat ? { meldId: m.meldId, kind: m.kind, count: 4 } : m) })),
    legalActions: legalActions(s, seat),
    lastDiscard: windowOf(s)?.kind === 'discard' ? { seat: windowOf(s)!.sourceSeat, tileId: windowOf(s)!.tileId } : null,
    offeredKong: windowOf(s)?.kind === 'robKong' ? { seat: windowOf(s)!.sourceSeat, tileId: windowOf(s)!.tileId } : null,
    settlement: s.settlement,
  });
}
export function restore(json: string): GameState {
  const s = readSnapshot(json), w = windowOf(s);
  if (w) for (const seat of seats) {
    // Responses do not change restrictions until arbitration; verify every saved candidate against the hand.
    const actual = possibleClaims(s, seat, w), saved = w.options[seat] ?? [];
    if (canonical(actual) !== canonical(saved)) throw new Error('CORRUPT_CLAIM_OPTIONS');
  }
  return s;
}
