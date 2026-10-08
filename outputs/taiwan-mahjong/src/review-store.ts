import type { getObservation } from './engine.js';
import type { Meld, Seat } from './model.js';
import { EVIDENCE_VERSION } from './decision-evidence.js';
import { DECK, KINDS, kindOf, isFlower } from './tiles.js';
import { prepareHand } from './hand.js';

export const REVIEW_KEY = 'tw16:review:v1';
export const REVIEW_LIMITS = { records: 20, recordBytes: 32768, totalBytes: 262144 } as const;
type StoragePort = Pick<Storage, 'getItem' | 'setItem'>;
type Observation = ReturnType<typeof getObservation>;
export type DiscardSnapshot = {
  schemaVersion: 1; rulesVersion: 'TW16-CLASSIC-v1'; analyzerVersion: string; kind: 'discard';
  matchId: string; handId: number; version: number; seat: Seat; dealer: Seat; streak: number;
  concealed: string[]; melds: Meld[]; knownTiles: string[]; opponentGroups: { seat: Seat; count: number }[];
  forbiddenKinds: string[]; legalTileIds: string[]; chosenTileId: string;
};
const bytes = (s: string) => new TextEncoder().encode(s).length;
function requireValue(ok: unknown): asserts ok { if (!ok) throw new Error('INVALID_REVIEW_DATA'); }
function keys(v: unknown, names: string) {
  requireValue(v && typeof v === 'object' && !Array.isArray(v));
  requireValue(Object.keys(v).sort().join(',') === names.split(' ').sort().join(','));
}
function integer(v: unknown, max = Number.MAX_SAFE_INTEGER, min = 0) { requireValue(Number.isSafeInteger(v) && Number(v) >= min && Number(v) <= max); }
function text(v: unknown) { requireValue(typeof v === 'string' && v.length > 0 && v.length <= 256); }
const ordinary = new Set(DECK.filter(t => !isFlower(t)));
function tiles(v: unknown): asserts v is string[] {
  requireValue(Array.isArray(v) && v.length <= 136 && v.every(t => ordinary.has(t)) && new Set(v).size === v.length);
}
const identity = (s: DiscardSnapshot) => JSON.stringify([s.matchId, s.handId, s.version, s.seat]);

/** Strict limited DTO. Does not authenticate edited local data or authorize engine actions. */
export function validateDiscardSnapshot(value: unknown): asserts value is DiscardSnapshot {
  keys(value, 'schemaVersion rulesVersion analyzerVersion kind matchId handId version seat dealer streak concealed melds knownTiles opponentGroups forbiddenKinds legalTileIds chosenTileId');
  const s = value as DiscardSnapshot;
  requireValue(s.schemaVersion === 1 && s.rulesVersion === 'TW16-CLASSIC-v1' && s.analyzerVersion === EVIDENCE_VERSION && s.kind === 'discard');
  text(s.matchId); integer(s.handId, Number.MAX_SAFE_INTEGER, 1); integer(s.version); integer(s.seat, 3); integer(s.dealer, 3); integer(s.streak);
  tiles(s.concealed); tiles(s.knownTiles); tiles(s.legalTileIds);
  requireValue(Array.isArray(s.melds) && s.melds.length <= 5);
  for (const m of s.melds) {
    keys(m, 'meldId kind tiles fromSeat sourceEvent'); text(m.meldId); integer(m.sourceEvent);
    tiles(m.tiles);
    requireValue(['chi', 'pon', 'exposedKong', 'concealedKong', 'addedKong'].includes(m.kind));
    if (m.kind === 'concealedKong') requireValue(m.fromSeat === null);
    else { integer(m.fromSeat, 3); requireValue(m.fromSeat !== s.seat); }
  }
  requireValue(new Set(s.melds.map(m => m.meldId)).size === s.melds.length);
  const owned = [...s.concealed, ...s.melds.flatMap(m => m.tiles)];
  requireValue(new Set(owned).size === owned.length && owned.every(t => s.knownTiles.includes(t)));
  requireValue(prepareHand(s.concealed, s.melds, 17));
  requireValue(Array.isArray(s.opponentGroups) && s.opponentGroups.length === 3);
  for (const p of s.opponentGroups) { keys(p, 'seat count'); integer(p.seat, 3); integer(p.count, 5); requireValue(p.seat !== s.seat); }
  requireValue(new Set(s.opponentGroups.map(p => p.seat)).size === 3);
  requireValue(136 - s.knownTiles.length >= s.opponentGroups.reduce((n, p) => n + 16 - 3 * p.count, 0));
  requireValue(Array.isArray(s.forbiddenKinds) && s.forbiddenKinds.length <= 34
    && s.forbiddenKinds.every(k => KINDS.includes(k)) && new Set(s.forbiddenKinds).size === s.forbiddenKinds.length);
  const expected = s.concealed.filter(t => !s.forbiddenKinds.includes(kindOf(t))).sort();
  requireValue(expected.length && JSON.stringify([...s.legalTileIds].sort()) === JSON.stringify(expected));
  requireValue(s.legalTileIds.includes(s.chosenTileId));
  requireValue(bytes(JSON.stringify(s)) <= REVIEW_LIMITS.recordBytes);
}

/** Call only after a matching human discard was accepted; capture the pre-action observation. */
export function captureDiscard(o: Observation, chosenTileId: string, rulesVersion: string): DiscardSnapshot {
  requireValue(rulesVersion === 'TW16-CLASSIC-v1' && o.phase === 'awaitDiscard' && o.turn === o.seat);
  requireValue(!('wall' in o) && o.players.length === 4 && o.players.every((p, seat) => seat === o.seat
    || !('concealed' in p) && p.melds.every(m => m.kind !== 'concealedKong' || !('tiles' in m))));
  const known = new Set([...o.self.concealed, ...o.self.melds.flatMap(m => m.tiles)]);
  for (const p of o.players) {
    p.discardHistory.forEach(d => known.add(d.tileId));
    p.melds.forEach(m => { if ('tiles' in m) m.tiles.forEach(t => known.add(t)); });
  }
  const s: DiscardSnapshot = { schemaVersion: 1, rulesVersion, analyzerVersion: EVIDENCE_VERSION, kind: 'discard',
    matchId: o.matchId, handId: o.handId, version: o.version, seat: o.seat, dealer: o.dealer, streak: o.streak,
    concealed: [...o.self.concealed], melds: o.self.melds.map(m => ({ meldId: m.meldId, kind: m.kind,
      tiles: [...m.tiles], fromSeat: m.fromSeat, sourceEvent: m.sourceEvent })), knownTiles: [...known].sort(),
    opponentGroups: o.players.flatMap((p, seat) => seat === o.seat ? [] : [{ seat: seat as Seat, count: p.melds.length }]),
    forbiddenKinds: [...o.self.restrictions.forbiddenDiscards],
    legalTileIds: o.legalActions.flatMap(a => a.type === 'DISCARD' ? [a.tileId] : []).sort(), chosenTileId };
  validateDiscardSnapshot(s);
  return s;
}

export function decodeReviewArchive(raw: string | null): DiscardSnapshot[] {
  if (raw === null) return [];
  requireValue(bytes(raw) <= REVIEW_LIMITS.totalBytes);
  const value = JSON.parse(raw);
  keys(value, 'schemaVersion records');
  requireValue(value.schemaVersion === 1 && Array.isArray(value.records) && value.records.length <= REVIEW_LIMITS.records);
  value.records.forEach(validateDiscardSnapshot);
  requireValue(new Set(value.records.map(identity)).size === value.records.length);
  return value.records;
}

export function readReviewArchive(storage: StoragePort) {
  const raw = storage.getItem(REVIEW_KEY);
  return { raw, records: decodeReviewArchive(raw) };
}

/** expectedRaw is a stale-write guard, NOT an atomic cross-tab transaction. */
export function appendReview(storage: StoragePort, expectedRaw: string | null, snapshot: DiscardSnapshot) {
  validateDiscardSnapshot(snapshot);
  const records = decodeReviewArchive(expectedRaw);
  if (storage.getItem(REVIEW_KEY) !== expectedRaw) throw new Error('REVIEW_CONFLICT');
  const existing = records.find(s => identity(s) === identity(snapshot));
  if (existing) {
    requireValue(JSON.stringify(existing) === JSON.stringify(snapshot));
    return expectedRaw; // Retry is idempotent; never replace a conflicting historical choice.
  }
  records.push(snapshot);
  let raw = JSON.stringify({ schemaVersion: 1, records });
  while (records.length > REVIEW_LIMITS.records || bytes(raw) > REVIEW_LIMITS.totalBytes) {
    records.shift(); raw = JSON.stringify({ schemaVersion: 1, records });
  }
  // A single setItem preserves the previous archive if quota/security throws. No remove-before-write.
  storage.setItem(REVIEW_KEY, raw);
  return raw;
}

/** The UI must obtain explicit confirmation first; this never touches game/practice saves. */
export function clearReview(storage: StoragePort, expectedRaw: string | null) {
  if (storage.getItem(REVIEW_KEY) !== expectedRaw) throw new Error('REVIEW_CONFLICT');
  const raw = JSON.stringify({ schemaVersion: 1, records: [] });
  storage.setItem(REVIEW_KEY, raw);
  return raw;
}
// ponytail: discard-only records without full river reconstruction; add claim DTOs and an atomic
// cross-tab write gate before live integration. Do not attach this storage helper directly to main.
