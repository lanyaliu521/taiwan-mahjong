import type { Seat, TileId, TileKind } from './model.js';
export const KINDS: TileKind[] = [...'mps'].flatMap(s => Array.from({ length: 9 }, (_, n) => `${n + 1}${s}`)).concat(Array.from({ length: 7 }, (_, n) => `${n + 1}z`));
export const DECK: TileId[] = KINDS.flatMap(k => [0, 1, 2, 3].map(n => `${k}#${n}`)).concat(Array.from({ length: 8 }, (_, n) => `f${n + 1}#0`));
export const kindOf = (id: string): TileKind => id.split('#')[0];
export const isFlower = (id: string): boolean => /^f[1-8](#0)?$/.test(id);
export const nextSeat = (s: Seat): Seat => ((s + 1) % 4) as Seat;
export const seatWind = (seat: Seat, dealer: Seat): TileKind => `${(seat - dealer + 4) % 4 + 1}z`;
export function shuffledDeck(random: () => number = () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296): TileId[] {
  const deck = [...DECK];
  for (let i = deck.length - 1; i > 0; i--) {
    const value = random();
    if (!Number.isFinite(value) || value < 0 || value >= 1) throw new Error('INVALID_RANDOM');
    const j = Math.floor(value * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
