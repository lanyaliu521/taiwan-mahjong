import type { getObservation } from './engine.js';
import type { Intent } from './model.js';
import { KINDS, kindOf } from './tiles.js';

type Observation = ReturnType<typeof getObservation>;
type Quality = { shanten: number; improving: number };
const indexOf = (id: string): number => KINDS.indexOf(kindOf(id));
const intentKey = (a: Intent): string => JSON.stringify(a, ['type', 'source', 'windowId', 'tileId', 'ownTiles', 'meldId']);

// Each slot is (completed groups * 2 + pair), containing the maximum incomplete groups.
// Keeping only that maximum avoids enumerating the same suit partitions repeatedly.
function makeDistance() {
  const cache = new Map<string, number[]>();
  function profiles(counts: number[], suited: boolean, usedPair = -1): number[] {
    const key = `${+suited}:${usedPair}:${counts.join('')}`;
    const saved = cache.get(key);
    if (saved) return saved;
    const i = counts.findIndex(n => n > 0), result = Array<number>(12).fill(-1);
    if (i < 0) result[0] = 0;
    else {
      const remove = (tiles: number[], meld: number, pair: number, partial: number, blockPair = -1) => {
        const rest = [...counts];
        for (const t of tiles) rest[t]--;
        profiles(rest, suited, blockPair).forEach((value, slot) => {
          const m = (slot >> 1) + meld, p = (slot & 1) + pair;
          if (value >= 0 && m <= 5 && p <= 1) result[m * 2 + p] = Math.max(result[m * 2 + p], value + partial);
        });
      };
      remove([i], 0, 0, 0);
      if (counts[i] >= 3) remove([i, i, i], 1, 0, 0);
      // Four identical tiles cannot supply both a head and a second pair needing a fifth copy.
      if (counts[i] >= 2 && i !== usedPair) { remove([i, i], 0, 1, 0, i); remove([i, i], 0, 0, 1, i); }
      if (suited && i < 7 && counts[i + 1] && counts[i + 2]) remove([i, i + 1, i + 2], 1, 0, 0);
      if (suited && i < 8 && counts[i + 1]) remove([i, i + 1], 0, 0, 1);
      if (suited && i < 7 && counts[i + 2]) remove([i, i + 2], 0, 0, 1);
    }
    cache.set(key, result);
    return result;
  }
  return (counts: number[], open: number): number => {
    let combined = Array<number>(12).fill(-1);
    combined[open * 2] = 0;
    for (let suit = 0; suit < 4; suit++) {
      const part = profiles(counts.slice(suit * 9, suit * 9 + (suit === 3 ? 7 : 9)), suit < 3);
      const next = Array<number>(12).fill(-1);
      combined.forEach((a, x) => part.forEach((b, y) => {
        const m = (x >> 1) + (y >> 1), p = (x & 1) + (y & 1);
        if (a >= 0 && b >= 0 && m <= 5 && p <= 1) next[m * 2 + p] = Math.max(next[m * 2 + p], a + b);
      }));
      combined = next;
    }
    return Math.min(...combined.map((partial, slot) => partial < 0 ? Infinity : 10 - 2 * (slot >> 1) - Math.min(partial, 5 - (slot >> 1)) - (slot & 1)));
  };
}

/** Fair local policy: its entire knowledge is the supplied player observation. */
export function chooseAction(observation: Observation, actions: Intent[], randomState: number): { intent: Intent; randomState: number; reason: string } {
  if (!Number.isInteger(randomState) || randomState < 1 || randomState > 0xffffffff) throw new Error('INVALID_AI_RANDOM_STATE');
  const allowed = new Set(observation.legalActions.map(intentKey));
  const legal = actions.filter(a => allowed.has(intentKey(a)));
  if (!legal.length) throw new Error('NO_LEGAL_AI_ACTION');
  let nextRandom = randomState;
  nextRandom ^= nextRandom << 13; nextRandom ^= nextRandom >>> 17; nextRandom ^= nextRandom << 5;
  nextRandom >>>= 0;
  const win = legal.find(a => a.type === 'WIN');
  if (win) return { intent: win, randomState: nextRandom, reason: '優先選擇合法胡牌' };

  const counts = Array<number>(34).fill(0), seen = new Set(observation.self.concealed);
  observation.self.concealed.forEach(id => counts[indexOf(id)]++);
  for (const player of observation.players) {
    player.discardHistory.forEach(d => seen.add(d.tileId));
    for (const meld of player.melds) if ('tiles' in meld) meld.tiles.forEach(id => seen.add(id));
  }
  const remaining = Array<number>(34).fill(4);
  seen.forEach(id => { const i = indexOf(id); if (i >= 0) remaining[i]--; });
  const distance = makeDistance(), evaluated = new Map<string, Quality>();
  function quality(hand: number[], open: number): Quality {
    const key = `${open}:${hand.join('')}`, saved = evaluated.get(key);
    if (saved) return saved;
    const shanten = distance(hand, open);
    let improving = 0;
    for (let i = 0; i < 34; i++) if (remaining[i] > 0) {
      hand[i]++;
      if (distance(hand, open) < shanten) improving += remaining[i];
      hand[i]--;
    }
    const result = { shanten, improving };
    evaluated.set(key, result);
    return result;
  }
  const score = (q: Quality): number => -1000 * q.shanten + q.improving;
  const open = observation.self.melds.length;
  // ponytail: one-draw tile efficiency, no opponent-hand inference or score search.
  // Add deeper search only after measured playing-strength needs justify its browser cost.
  const candidates = legal.map(intent => {
    const hand = [...counts];
    let groups = open, bonus = 0, q: Quality;
    if (intent.type === 'DISCARD') {
      hand[indexOf(intent.tileId)]--;
      q = quality(hand, groups);
    } else if (intent.type === 'CHI' || intent.type === 'PON') {
      intent.ownTiles.forEach(id => hand[indexOf(id)]--);
      groups++;
      const own = intent.ownTiles.map(indexOf).sort((a, b) => a - b);
      const forbidden = (i: number) => intent.type === 'PON' ? i === own[0] :
        Math.floor(i / 9) === Math.floor(own[0] / 9) && [own[0], own[1], i].sort((a, b) => a - b).every((n, j, a) => j === 0 || n === a[j - 1] + 1);
      const afterDiscard = hand.flatMap((n, i) => {
        if (!n || forbidden(i)) return [];
        hand[i]--; const value = quality(hand, groups); hand[i]++;
        return [value];
      });
      q = afterDiscard.sort((a, b) => score(b) - score(a))[0];
      bonus = -0.1; // Preserve the closed hand when calling does not improve efficiency.
    } else if (intent.type === 'KAN_CLOSED' || intent.type === 'KAN_OPEN' || intent.type === 'KAN_ADDED') {
      const removed = intent.type === 'KAN_ADDED' ? [intent.tileId] : intent.ownTiles;
      removed.forEach(id => hand[indexOf(id)]--);
      if (intent.type !== 'KAN_ADDED') groups++;
      q = quality(hand, groups);
      // Accept a replacement draw only when the remaining shape is at least as good.
      // ponytail: no rob-kong risk estimate; add public-discard defence with a stronger policy.
      bonus = 0.1;
    } else q = quality(hand, groups);
    return { intent, q, value: score(q) + bonus };
  });
  const best = Math.max(...candidates.map(c => c.value)), tied = candidates.filter(c => c.value === best);
  const selected = tied[Math.floor(nextRandom / 4294967296 * tied.length)];
  const shape = selected.q.shanten === 0 ? '聽牌' : `${selected.q.shanten} 向聽`;
  return { intent: selected.intent, randomState: nextRandom, reason: `${shape}；依公開資訊估計有效進張 ${selected.q.improving} 張` };
}
