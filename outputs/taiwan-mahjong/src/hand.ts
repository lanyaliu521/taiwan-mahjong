import type { Decomposition, Meld, TileKind } from './model.js';
import { KINDS, kindOf } from './tiles.js';

type Group = Decomposition['groups'][number];
const index = new Map(KINDS.map((kind, i) => [kind, i]));

export function prepareHand(concealed: TileKind[], melds: Meld[], effective: number): { counts: number[]; declared: Group[]; capacity: number[] } | null {
  if (!Array.isArray(concealed) || !Array.isArray(melds) || melds.length > 5 || concealed.length + melds.length * 3 !== effective) return null;
  const counts = Array<number>(34).fill(0);
  const total = Array<number>(34).fill(0);
  const declared: Group[] = [];
  for (const tile of concealed) {
    if (typeof tile !== 'string') return null;
    const i = index.get(kindOf(tile));
    if (i === undefined || ++total[i] > 4) return null;
    counts[i]++;
  }
  for (const meld of melds) {
    if (!meld || !Array.isArray(meld.tiles) || meld.tiles.some(t => typeof t !== 'string')) return null;
    const ids = meld.tiles.map(t => index.get(kindOf(t)));
    if (ids.some(i => i === undefined)) return null;
    const sorted = (ids as number[]).sort((a, b) => a - b);
    const first = sorted[0];
    if (meld.kind === 'chi') {
      if (sorted.length !== 3 || first >= 27 || first % 9 > 6 || sorted[1] !== first + 1 || sorted[2] !== first + 2) return null;
    } else {
      const size = meld.kind === 'pon' ? 3 : ['exposedKong', 'concealedKong', 'addedKong'].includes(meld.kind) ? 4 : 0;
      if (!size || sorted.length !== size || sorted.some(i => i !== first)) return null;
    }
    for (const i of sorted) if (++total[i] > 4) return null;
    declared.push({ kind: meld.kind === 'chi' ? 'sequence' : 'triplet', tiles: sorted.slice(0, 3).map(i => KINDS[i]) });
  }
  return { counts, declared, capacity: total.map((n, i) => 4 - n + counts[i]) };
}

/** Complete five-group decompositions; declared melds come first, then concealed groups. */
export function decompose(concealed: TileKind[], melds: Meld[] = []): Decomposition[] {
  const prepared = prepareHand(concealed, melds, 17);
  if (!prepared) return [];
  const { counts, declared } = prepared;
  const results: Decomposition[] = [];
  const groups: Group[] = [];
  function visit(pair: TileKind): void {
    const first = counts.findIndex(n => n > 0);
    if (first === -1) {
      results.push({ pair, groups: [...declared, ...groups] });
      return;
    }
    if (counts[first] >= 3) {
      counts[first] -= 3;
      groups.push({ kind: 'triplet', tiles: Array(3).fill(KINDS[first]) });
      visit(pair);
      groups.pop();
      counts[first] += 3;
    }
    if (first < 27 && first % 9 < 7 && counts[first + 1] && counts[first + 2]) {
      counts[first]--; counts[first + 1]--; counts[first + 2]--;
      groups.push({ kind: 'sequence', tiles: KINDS.slice(first, first + 3) });
      visit(pair);
      groups.pop();
      counts[first]++; counts[first + 1]++; counts[first + 2]++;
    }
  }
  for (let i = 0; i < counts.length; i++) {
    if (counts[i] < 2) continue;
    counts[i] -= 2;
    visit(KINDS[i]);
    counts[i] += 2;
  }
  return results;
}

export function isWinningHand(concealed: TileKind[], melds: Meld[] = []): boolean {
  return decompose(concealed, melds).length > 0;
}

export function winningTiles(concealed: TileKind[], melds: Meld[] = []): TileKind[] {
  if (!prepareHand(concealed, melds, 16)) return [];
  // The full-hand validator also excludes a fifth copy already held in any meld.
  return KINDS.filter(kind => isWinningHand([...concealed, kind], melds));
}
