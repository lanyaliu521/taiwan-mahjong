import type { TileId } from './model.js';
import { shuffledDeck, isFlower, kindOf } from './tiles.js';
import { isWinningHand } from './hand.js';
import { createAnalyzer, exactPool, bestDiscards } from './analysis.js';

export const PRACTICE_KEY = 'tw16:practice:v1';
export type Practice = {
  schemaVersion: 1; seed: number; hand: TileId[]; pool: TileId[]; discards: TileId[];
  phase: 'discard' | 'draw' | 'complete' | 'exhausted'; drawnTile: TileId | null;
};
export function createPractice(seed = crypto.getRandomValues(new Uint32Array(1))[0] || 1): Practice {
  if (!Number.isInteger(seed) || seed < 1 || seed > 0xffffffff) throw new Error('INVALID_PRACTICE_SEED');
  let random = seed;
  const deck = shuffledDeck(() => {
    random ^= random << 13; random ^= random >>> 17; random ^= random << 5; random >>>= 0;
    return random / 4294967296;
  }).filter(t => !isFlower(t));
  const hand = deck.splice(0, 17);
  return { schemaVersion: 1, seed, hand, pool: deck, discards: [], phase: isWinningHand(hand.map(kindOf)) ? 'complete' : 'discard', drawnTile: hand[16] };
}
export function discardPractice(p: Practice, tile: TileId): Practice {
  const index = p.hand.indexOf(tile);
  if (p.phase !== 'discard' || index < 0) throw new Error('INVALID_PRACTICE_DISCARD');
  const hand = [...p.hand]; hand.splice(index, 1);
  return { ...p, hand, discards: [...p.discards, tile], drawnTile: null, phase: p.pool.length ? 'draw' : 'exhausted' };
}
export function drawPractice(p: Practice): Practice {
  if (p.phase !== 'draw' || !p.pool.length) throw new Error('INVALID_PRACTICE_DRAW');
  const tile = p.pool[0], hand = [...p.hand, tile];
  return { ...p, hand, pool: p.pool.slice(1), drawnTile: tile, phase: isWinningHand(hand.map(kindOf)) ? 'complete' : 'discard' };
}
/** Replaying the seed and choices validates ownership, phase, and exact wall order together. */
export function restorePractice(value: unknown): Practice {
  if (!value || typeof value !== 'object') throw new Error('INVALID_PRACTICE_SAVE');
  const v = value as Practice;
  if (v.schemaVersion !== 1 || !Number.isInteger(v.seed) || v.seed < 1 || v.seed > 0xffffffff || !Array.isArray(v.discards) || v.discards.length > 120) throw new Error('INVALID_PRACTICE_SAVE');
  let expected = createPractice(v.seed);
  for (const tile of v.discards) {
    if (expected.phase === 'draw') expected = drawPractice(expected);
    expected = discardPractice(expected, tile);
  }
  if (expected.phase === 'draw' && (v.phase === 'discard' || v.phase === 'complete')) expected = drawPractice(expected);
  const keys = Object.keys(expected) as (keyof Practice)[];
  if (Object.keys(v).length !== keys.length || keys.some(k => JSON.stringify(v[k]) !== JSON.stringify(expected[k]))) throw new Error('INVALID_PRACTICE_SAVE');
  return expected;
}
export const encodePractice = (p: Practice): string => JSON.stringify(restorePractice(p));
export const decodePractice = (raw: string): Practice => restorePractice(JSON.parse(raw));

/** No opponent or wall prediction: only the exact remaining practice pool. */
export function practiceAnalysis(p: Practice) {
  const analyzer = createAnalyzer(exactPool(p.pool)), hand = p.hand.map(kindOf);
  const choices = p.phase === 'discard' ? analyzer.discards(hand, [], hand) : [];
  const before = p.phase === 'draw' || p.phase === 'exhausted'
    ? analyzer.discards([...hand, kindOf(p.discards.at(-1)!)], [], [...hand, kindOf(p.discards.at(-1)!)]) : [];
  return { current: analyzer.analyze(hand), choices, best: bestDiscards(choices),
    feedback: before.length ? { chosen: before.find(c => c.kind === kindOf(p.discards.at(-1)!))!, best: bestDiscards(before) } : null };
}
