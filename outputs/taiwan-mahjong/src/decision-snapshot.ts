import type { getObservation } from './engine.js';
import type { Intent, Meld } from './model.js';
import { decisionEvidence, evidenceIntent, EVIDENCE_VERSION } from './decision-evidence.js';
import { DECK, KINDS, kindOf, isFlower } from './tiles.js';
import { prepareHand, isWinningHand } from './hand.js';
import { discardBan } from './engine.js';

type Observation = ReturnType<typeof getObservation>;
export type DecisionSnapshot = {
  schemaVersion: 2; rulesVersion: 'TW16-CLASSIC-v1'; analyzerVersion: string;
  observation: Omit<Observation, 'settlement'>; chosen: Intent;
};
const fields = 'seat matchId handId version phase turn dealer roundWind streak scores available self players legalActions lastDiscard offeredKong';
const deck = new Set(DECK);
function check(ok: unknown): asserts ok { if (!ok) throw new Error('INVALID_DECISION_SNAPSHOT'); }
function keys(v: unknown, names: string) {
  check(v && typeof v === 'object' && !Array.isArray(v));
  check(Object.keys(v).sort().join(',') === names.split(' ').sort().join(','));
}
function int(v: unknown, max = Number.MAX_SAFE_INTEGER, min = 0) { check(Number.isSafeInteger(v) && Number(v) >= min && Number(v) <= max); }
function id(v: unknown) { check(typeof v === 'string' && v.length > 0 && v.length <= 256); }
function list(v: unknown, max: number): asserts v is unknown[] { check(Array.isArray(v) && v.length <= max); }
function tiles(v: unknown, flower = false): asserts v is string[] {
  list(v, flower ? 8 : 136); check(v.every(t => typeof t === 'string' && deck.has(t) && isFlower(t) === flower));
  check(new Set(v).size === v.length);
}
function kindList(v: unknown) { list(v, 34); check(v.every(k => typeof k === 'string' && KINDS.includes(k)) && new Set(v).size === v.length); }
function meld(m: Meld, owner: number) {
  keys(m, 'meldId kind tiles fromSeat sourceEvent'); id(m.meldId); int(m.sourceEvent); tiles(m.tiles);
  check(prepareHand([], [m], 3));
  if (m.kind === 'concealedKong') check(m.fromSeat === null);
  else { int(m.fromSeat, 3); check(m.fromSeat !== owner); }
}
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const key = (a: Intent) => JSON.stringify(evidenceIntent(a));

/** Whitelist and consistency validation, not authentication of user-edited local history. */
export function validateDecisionSnapshot(value: unknown): asserts value is DecisionSnapshot {
  keys(value, 'schemaVersion rulesVersion analyzerVersion observation chosen');
  const s = value as DecisionSnapshot;
  check(s.schemaVersion === 2 && s.rulesVersion === 'TW16-CLASSIC-v1');
  if (s.analyzerVersion !== EVIDENCE_VERSION) throw new Error('UNSUPPORTED_REVIEW_ANALYZER');
  const o = s.observation; keys(o, fields);
  int(o.seat, 3); int(o.turn, 3); int(o.dealer, 3); int(o.streak); id(o.matchId); int(o.handId, Number.MAX_SAFE_INTEGER, 1); int(o.version);
  check(['awaitDiscard', 'awaitClaims', 'awaitRobKong'].includes(o.phase));
  check(['1z', '2z', '3z', '4z'].includes(o.roundWind)); int(o.available, 128);
  list(o.scores, 4); check(o.scores.length === 4); o.scores.forEach(n => int(n, Number.MAX_SAFE_INTEGER, -Number.MAX_SAFE_INTEGER));
  check(o.scores.reduce((a, b) => a + b, 0) === 0);
  keys(o.self, 'concealed melds flowers restrictions'); tiles(o.self.concealed); tiles(o.self.flowers, true);
  list(o.self.melds, 5); o.self.melds.forEach(m => meld(m, o.seat));
  const r = o.self.restrictions;
  keys(r, 'passedWin passedPon lastDiscard forbiddenDiscards'); check(typeof r.passedWin === 'boolean');
  kindList(r.passedPon); kindList(r.forbiddenDiscards); check(r.lastDiscard === null || KINDS.includes(r.lastDiscard));
  const effective = o.phase === 'awaitDiscard' ? 17 : 16;
  check(prepareHand(o.self.concealed, o.self.melds, effective));
  if (effective === 17) check(o.turn === o.seat);
  list(o.players, 4); check(o.players.length === 4);
  const owners = new Set<string>(), meldIds = new Set<string>();
  const own = (tile: string) => { check(!owners.has(tile)); owners.add(tile); };
  o.self.concealed.forEach(own);
  o.players.forEach((p, seat) => {
    keys(p, 'concealedCount flowers discardHistory melds'); int(p.concealedCount, 17);
    tiles(p.flowers, true); p.flowers.forEach(own); list(p.melds, 5); list(p.discardHistory, 136);
    if (seat === o.seat) check(p.concealedCount === o.self.concealed.length && same(p.flowers, o.self.flowers) && same(p.melds, o.self.melds));
    for (const m of p.melds) {
      if (m.kind === 'concealedKong' && seat !== o.seat) { keys(m, 'meldId kind count'); id(m.meldId); check('count' in m && m.count === 4); }
      else { meld(m as Meld, seat); (m as Meld).tiles.forEach(own); }
      check(!meldIds.has(m.meldId)); meldIds.add(m.meldId);
    }
    const count = p.concealedCount + 3 * p.melds.length;
    check(count === (seat === o.seat ? effective : o.phase === 'awaitRobKong' && seat === o.turn ? 17 : 16));
    let previous = -1;
    for (const d of p.discardHistory) {
      keys(d, 'tileId eventSeq claimedBy'); check(deck.has(d.tileId) && !isFlower(d.tileId)); int(d.eventSeq); check(d.eventSeq > previous); previous = d.eventSeq;
      if (d.claimedBy === null) own(d.tileId);
      else { int(d.claimedBy, 3); check(d.claimedBy !== seat); }
    }
  });
  for (const [seat, p] of o.players.entries()) for (const d of p.discardHistory) if (d.claimedBy !== null) {
    check(o.players[d.claimedBy].melds.some(m => 'tiles' in m && m.fromSeat === seat && m.sourceEvent === d.eventSeq && m.tiles.includes(d.tileId)));
  }
  const ownLast = o.players[o.seat].discardHistory.at(-1);
  check(r.lastDiscard === (ownLast ? kindOf(ownLast.tileId) : null));
  for (const offered of [o.lastDiscard, o.offeredKong]) if (offered !== null) {
    keys(offered, 'seat tileId'); int(offered.seat, 3); check(offered.seat !== o.seat && offered.seat === o.turn);
    check(deck.has(offered.tileId) && !isFlower(offered.tileId));
  }
  if (o.phase === 'awaitDiscard') check(o.lastDiscard === null && o.offeredKong === null);
  if (o.phase === 'awaitClaims') {
    check(o.lastDiscard !== null && o.offeredKong === null);
    const last = o.players[o.lastDiscard.seat].discardHistory.at(-1);
    check(last && last.claimedBy === null && last.tileId === o.lastDiscard.tileId);
  }
  if (o.phase === 'awaitRobKong') {
    check(o.offeredKong !== null && o.lastDiscard === null && !owners.has(o.offeredKong.tileId));
    check(o.players[o.offeredKong.seat].melds.some(m => m.kind === 'pon' && 'tiles' in m && kindOf(m.tiles[0]) === kindOf(o.offeredKong!.tileId)));
  }
  const visibleOrdinary = [...owners].filter(t => !isFlower(t)).length;
  const unknownOwned = o.players.reduce((n, p, seat) => n + (seat === o.seat ? 0 : p.concealedCount
    + p.melds.filter(m => m.kind === 'concealedKong').length * 4), 0);
  check(visibleOrdinary + unknownOwned <= 136);
  list(o.legalActions, 100); check(o.legalActions.length > 0);
  const offered = o.lastDiscard ?? o.offeredKong;
  for (const a of [...o.legalActions, s.chosen]) {
    check(a && typeof a === 'object');
    const normalized = evidenceIntent(a); keys(a, Object.keys(normalized).join(' '));
    if ('windowId' in a) { id(a.windowId); check(offered !== null); }
    if ('ownTiles' in a) { tiles(a.ownTiles); check(a.ownTiles.every(t => o.self.concealed.includes(t))); }
    if ('tileId' in a) check(o.self.concealed.includes(a.tileId));
    switch (a.type) {
      case 'DISCARD': check(effective === 17 && !r.forbiddenDiscards.includes(kindOf(a.tileId))); break;
      case 'CHI': case 'PON': case 'KAN_OPEN': {
        check(o.phase === 'awaitClaims' && offered && o.available > 3);
        check(a.ownTiles.length === (a.type === 'KAN_OPEN' ? 3 : 2));
        const k = kindOf(offered.tileId), group = [...a.ownTiles, offered.tileId];
        if (a.type === 'CHI') check((offered.seat + 1) % 4 === o.seat && prepareHand([], [{ meldId: '', kind: 'chi', tiles: group, fromSeat: offered.seat, sourceEvent: 0 }], 3));
        else check(group.every(t => kindOf(t) === k));
        if (a.type === 'KAN_OPEN') check((offered.seat + 1) % 4 !== o.seat);
        else {
          check(r.lastDiscard !== k && (a.type !== 'PON' || !r.passedPon.includes(k)));
          const ban = a.type === 'CHI' ? discardBan(a.ownTiles, offered.tileId) : [k];
          check(o.self.concealed.some(t => !a.ownTiles.includes(t) && !ban.includes(kindOf(t))));
        }
        break;
      }
      case 'KAN_CLOSED': check(effective === 17 && o.available > 0 && a.ownTiles.length === 4 && a.ownTiles.every(t => kindOf(t) === kindOf(a.ownTiles[0]))); break;
      case 'KAN_ADDED': check(effective === 17 && o.available > 0 && o.self.melds.some(m => m.meldId === a.meldId && m.kind === 'pon' && kindOf(m.tiles[0]) === kindOf(a.tileId))); break;
      case 'PASS': check(offered !== null); break;
      case 'WIN': check(!r.passedWin && a.source === (effective === 17 ? 'selfDraw' : o.phase === 'awaitClaims' ? 'ron' : 'robKong')
        && isWinningHand([...o.self.concealed, ...(offered ? [offered.tileId] : [])], o.self.melds)); break;
      default: throw new Error('INVALID_DECISION_SNAPSHOT');
    }
  }
  if (effective === 17) check(same(o.legalActions.flatMap(a => a.type === 'DISCARD' ? [a.tileId] : []).sort(),
    o.self.concealed.filter(t => !r.forbiddenDiscards.includes(kindOf(t))).sort()));
  const actionKeys = o.legalActions.map(key); check(new Set(actionKeys).size === actionKeys.length && actionKeys.includes(key(s.chosen)));
  const windowIds = new Set(o.legalActions.flatMap(a => 'windowId' in a ? [a.windowId] : [])); check(windowIds.size <= 1);
  check(new TextEncoder().encode(JSON.stringify(s)).length <= 32768);
}

/** Trusted engine observation in; never retain settlement or arbitrary extra fields. */
export function captureDecision(o: Observation, chosen: Intent, rulesVersion: string): DecisionSnapshot {
  check(rulesVersion === 'TW16-CLASSIC-v1');
  const observation = Object.fromEntries(fields.split(' ').map(k => [k, o[k as keyof Observation]])) as DecisionSnapshot['observation'];
  const snapshot: DecisionSnapshot = structuredClone({ schemaVersion: 2, rulesVersion, analyzerVersion: EVIDENCE_VERSION, observation, chosen: evidenceIntent(chosen) });
  validateDecisionSnapshot(snapshot);
  return snapshot;
}

export function reviewDecision(snapshot: unknown) {
  validateDecisionSnapshot(snapshot);
  return decisionEvidence({ ...snapshot.observation, settlement: null }, snapshot.rulesVersion);
}
