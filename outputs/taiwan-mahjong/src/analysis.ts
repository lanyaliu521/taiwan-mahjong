import type { getObservation } from './engine.js';
import { discardBan } from './engine.js';
import { prepareHand } from './hand.js';
import type { Meld, TileId, TileKind } from './model.js';
import { DECK, KINDS, kindOf, isFlower } from './tiles.js';

type Observation = ReturnType<typeof getObservation>;
export type TilePool = { source: 'exact' | 'public'; counts: number[] };
export type ShapeExample = {
  completed: TileKind[][]; partials: TileKind[][]; pair: TileKind[]; singles: TileKind[];
  target: { groups: TileKind[][]; pair: TileKind };
};
export type Analysis = {
  shanten: number; effective: number; improving: number; total: number;
  probability: number | null; source: TilePool['source'];
  effectiveTiles: { kind: TileKind; count: number }[];
  example: ShapeExample | null;
};
export type DiscardAnalysis = { kind: TileKind; analysis: Analysis };
const indices = new Map(KINDS.map((k, i) => [k, i]));
const physical = new Set(DECK);

/** Exact practice pool: physical IDs are unique; flowers are outside this model. */
export function exactPool(tiles: TileId[]): TilePool {
  if (!Array.isArray(tiles) || new Set(tiles).size !== tiles.length || tiles.some(t => !physical.has(t) || isFlower(t))) throw new Error('INVALID_TILE_POOL');
  const counts = Array<number>(34).fill(0);
  for (const tile of tiles) counts[indices.get(kindOf(tile))!]++;
  return { source: 'exact', counts };
}

/** Unseen ordinary tiles, not the actual drawable wall. Includes exposed rob-kong tiles. */
export function publicPool(o: Observation): TilePool {
  const seen = new Set([...o.self.concealed, ...o.self.melds.flatMap(m => m.tiles)]);
  for (const p of o.players) {
    p.discardHistory.forEach(d => seen.add(d.tileId));
    for (const m of p.melds) if ('tiles' in m) m.tiles.forEach(t => seen.add(t));
  }
  if (o.lastDiscard) seen.add(o.lastDiscard.tileId);
  if (o.offeredKong) seen.add(o.offeredKong.tileId);
  const counts = Array<number>(34).fill(4);
  for (const tile of seen) {
    if (!physical.has(tile)) throw new Error('INVALID_VISIBLE_TILE');
    const i = indices.get(kindOf(tile));
    if (i !== undefined) counts[i]--;
  }
  return { source: 'public', counts };
}

/** One bounded cache per decision. Targets are five groups plus a pair, capped by declared tiles. */
export function createAnalyzer(pool: TilePool) {
  if (!pool || !['exact', 'public'].includes(pool.source) || !Array.isArray(pool.counts) || pool.counts.length !== 34 || Array.from(pool.counts).some(n => !Number.isInteger(n) || n < 0 || n > 4)) throw new Error('INVALID_TILE_POOL');
  const remaining = [...pool.counts], source = pool.source;
  const total = remaining.reduce((a, b) => a + b, 0);
  const cache = new Map<string, number[]>(), distances = new Map<string, number>();

  // Scan target tiles from left to right. a/b are sequence starts from the previous two ranks.
  // Slot = groups*2 + pair; value = minimum missing tiles to that valid suit target.
  function profiles(have: number[], cap: number[], suited: boolean, a = 0, b = 0): number[] {
    const key = `${+suited}:${a}${b}:${have.join('')}:${cap.join('')}`;
    const saved = cache.get(key);
    if (saved) return saved;
    const result = Array<number>(12).fill(Infinity);
    if (!have.length) { if (!a && !b) result[0] = 0; }
    else for (let start = 0; start <= (suited && have.length > 2 ? cap[0] - a - b : 0); start++) {
      for (let triplet = 0; triplet <= 1; triplet++) for (let pair = 0; pair <= 1; pair++) {
        const wanted = a + b + start + triplet * 3 + pair * 2;
        if (wanted > cap[0]) continue;
        const rest = profiles(have.slice(1), cap.slice(1), suited, start, a);
        const missing = Math.max(0, wanted - have[0]);
        for (let slot = 0; slot < 12; slot++) {
          const m = (slot >> 1) + start + triplet, p = (slot & 1) + pair;
          if (m <= 5 && p <= 1) result[m * 2 + p] = Math.min(result[m * 2 + p], rest[slot] + missing);
        }
      }
    }
    cache.set(key, result); return result;
  }
  function combine(have: number[], cap: number[]) {
    const steps = [Array<number>(12).fill(Infinity)]; steps[0][0] = 0;
    const parts: number[][] = [];
    for (let suit = 0; suit < 4; suit++) {
      const end = suit === 3 ? 34 : suit * 9 + 9;
      const part = profiles(have.slice(suit * 9, end), cap.slice(suit * 9, end), suit < 3);
      parts.push(part);
      const next = Array<number>(12).fill(Infinity);
      for (let x = 0; x < 12; x++) for (let y = 0; y < 12; y++) {
        const m = (x >> 1) + (y >> 1), p = (x & 1) + (y & 1);
        if (m <= 5 && p <= 1) next[m * 2 + p] = Math.min(next[m * 2 + p], steps[suit][x] + part[y]);
      }
      steps.push(next);
    }
    return { steps, parts };
  }
  function distance(have: number[], cap: number[], open: number): number {
    const key = `${open}:${have.join('')}:${cap.join('')}`;
    const saved = distances.get(key);
    if (saved !== undefined) return saved;
    const value = combine(have, cap).steps[4][(5 - open) * 2 + 1] - 1;
    distances.set(key, value); return value;
  }
  function example(have: number[], cap: number[], melds: Meld[]): ShapeExample {
    const { steps, parts } = combine(have, cap);
    const slots: number[] = []; let slot = (5 - melds.length) * 2 + 1;
    for (let suit = 3; suit >= 0; suit--) for (let part = 0; part < 12; part++) {
      const m = (slot >> 1) - (part >> 1), p = (slot & 1) - (part & 1);
      if (m < 0 || p < 0) continue;
      const previous = m * 2 + p;
      if (steps[suit][previous] + parts[suit][part] === steps[suit + 1][slot]) { slots[suit] = part; slot = previous; break; }
    }
    const target: ShapeExample['target'] = { groups: [], pair: '' };
    function trace(h: number[], c: number[], suited: boolean, offset: number, wantedSlot: number, a = 0, b = 0): void {
      if (!h.length) return;
      const cost = profiles(h, c, suited, a, b)[wantedSlot];
      for (let start = 0; start <= (suited && h.length > 2 ? c[0] - a - b : 0); start++) {
        for (let triplet = 0; triplet <= 1; triplet++) for (let pair = 0; pair <= 1; pair++) {
          const n = a + b + start + triplet * 3 + pair * 2;
          const m = (wantedSlot >> 1) - start - triplet, p = (wantedSlot & 1) - pair;
          if (n > c[0] || m < 0 || p < 0) continue;
          const restSlot = m * 2 + p;
          if (Math.max(0, n - h[0]) + profiles(h.slice(1), c.slice(1), suited, start, a)[restSlot] !== cost) continue;
          for (let k = 0; k < start; k++) target.groups.push(KINDS.slice(offset, offset + 3));
          if (triplet) target.groups.push(Array(3).fill(KINDS[offset]));
          if (pair) target.pair = KINDS[offset];
          trace(h.slice(1), c.slice(1), suited, offset + 1, restSlot, start, a); return;
        }
      }
    }
    for (let suit = 0; suit < 4; suit++) {
      const end = suit === 3 ? 34 : suit * 9 + 9;
      trace(have.slice(suit * 9, end), cap.slice(suit * 9, end), suit < 3, suit * 9, slots[suit]);
    }
    const left = [...have], completed = melds.map(m => m.tiles.slice(0, 3).map(kindOf).sort()), partials: TileKind[][] = [];
    const take = (tiles: TileKind[]) => tiles.filter(k => { const i = indices.get(k)!; if (!left[i]) return false; left[i]--; return true; });
    const pairIndex = indices.get(target.pair)!;
    const pair = left[pairIndex] >= 2 ? take([target.pair, target.pair]) : [];
    const rest: TileKind[][] = [];
    for (const group of target.groups) {
      const needed = Array<number>(34).fill(0); group.forEach(k => needed[indices.get(k)!]++);
      if (needed.every((n, i) => n <= left[i])) completed.push(take(group)); else rest.push(group);
    }
    // This is one allocation to a closest target, not a unique strategic decomposition.
    for (const group of rest) { const held = take(group); if (held.length === 2) partials.push(held); else held.forEach(k => left[indices.get(k)!]++); }
    return { completed, partials, pair, singles: left.flatMap((n, i) => Array(n).fill(KINDS[i])), target };
  }
  function analyze(concealed: TileKind[], melds: Meld[] = [], withExample = true): Analysis {
    if (!Array.isArray(concealed) || !Array.isArray(melds)) throw new Error('INVALID_ANALYSIS_HAND');
    const effective = concealed.length + melds.length * 3;
    if (effective !== 16 && effective !== 17) throw new Error('INVALID_EFFECTIVE_COUNT');
    const prepared = prepareHand(concealed, melds, effective);
    if (!prepared) throw new Error('INVALID_ANALYSIS_HAND');
    const { counts, capacity } = prepared;
    if (remaining.some((n, i) => n > capacity[i] - counts[i])) throw new Error('POOL_OVERLAPS_OWN_HAND');
    const shanten = distance(counts, capacity, melds.length), effectiveTiles: Analysis['effectiveTiles'] = [];
    // E17 comparisons must use discards() first; a completed E17 needs no further improvement.
    if (effective === 16) for (let i = 0; i < 34; i++) if (counts[i] < capacity[i]) {
      counts[i]++;
      if (distance(counts, capacity, melds.length) < shanten) effectiveTiles.push({ kind: KINDS[i], count: remaining[i] });
      counts[i]--;
    }
    const improving = effectiveTiles.reduce((n, t) => n + t.count, 0);
    return { shanten, effective, improving, total, probability: total ? improving / total : null, source, effectiveTiles, example: withExample ? example(counts, capacity, melds) : null };
  }
  function discards(concealed: TileKind[], melds: Meld[], allowed: TileKind[], withExample = true): DiscardAnalysis[] {
    if (!Array.isArray(concealed) || !Array.isArray(melds) || !Array.isArray(allowed)) throw new Error('INVALID_ANALYSIS_HAND');
    if (concealed.length + melds.length * 3 !== 17 || !prepareHand(concealed, melds, 17)) throw new Error('INVALID_ANALYSIS_HAND');
    if (allowed.some(k => !concealed.some(t => kindOf(t) === k))) throw new Error('INVALID_DISCARD_CANDIDATE');
    return [...new Set(allowed)].map(kind => {
      const rest = [...concealed]; rest.splice(rest.findIndex(k => kindOf(k) === kind), 1);
      return { kind, analysis: analyze(rest, melds, withExample) };
    });
  }
  return { analyze, discards };
}

export const compareAnalysis = (a: Analysis, b: Analysis): number => b.shanten - a.shanten || a.improving - b.improving;
export const bestDiscards = (choices: DiscardAnalysis[]): DiscardAnalysis[] => choices.filter(a => choices.every(b => compareAnalysis(a.analysis, b.analysis) >= 0));

/** Only engine-approved chi/pon choices, each followed by engine's shared discard ban. */
export function analyzeObservation(o: Observation, withExample = true) {
  const analyzer = createAnalyzer(publicPool(o)), hand = o.self.concealed.map(kindOf), melds = o.self.melds;
  const current = analyzer.analyze(hand, melds, withExample);
  const discards = hand.length + 3 * melds.length === 17 ? analyzer.discards(hand, melds, o.legalActions.flatMap(a => a.type === 'DISCARD' ? [kindOf(a.tileId)] : []), withExample) : [];
  const claims = o.legalActions.flatMap(intent => {
    if (intent.type !== 'CHI' && intent.type !== 'PON') return [];
    if (!o.lastDiscard) throw new Error('MISSING_DISCARD');
    const owned = new Set(intent.ownTiles), tile = o.lastDiscard.tileId;
    const nextHand = o.self.concealed.filter(t => !owned.has(t)).map(kindOf);
    const nextMelds: Meld[] = [...melds, { meldId: 'analysis', kind: intent.type === 'CHI' ? 'chi' : 'pon', tiles: [...intent.ownTiles, tile], fromSeat: o.lastDiscard.seat, sourceEvent: 0 }];
    const ban = intent.type === 'CHI' ? discardBan(intent.ownTiles, tile) : [kindOf(tile)];
    const choices = analyzer.discards(nextHand, nextMelds, nextHand.filter(k => !ban.includes(k)), withExample);
    const best = bestDiscards(choices), after = best[0]?.analysis;
    const effect = !after ? 'unavailable' : after.shanten < current.shanten ? 'closer' : after.shanten > current.shanten ? 'worse' : after.improving > current.improving ? 'moreOptions' : after.improving < current.improving ? 'worse' : 'same';
    return [{ intent, discards: choices, best, effect, losesClosed: melds.every(m => m.kind === 'concealedKong') }];
  });
  return { current, discards, best: bestDiscards(discards), claims, canWin: o.legalActions.some(a => a.type === 'WIN') };
}
