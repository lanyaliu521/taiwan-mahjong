import type { TilePool } from './analysis.js';
import { KINDS } from './tiles.js';

/** Research-only sufficient proof for ordinary ron, not a probability or policy.
 * Input must come from publicPool(ownObservation); the candidate is held by self.
 * Unknown tiles include opponents and the reserve. No furiten assumptions.
 */
export function ordinaryRonSafety(pool: TilePool, kind: string) {
  const index = KINDS.indexOf(kind);
  if (index < 0 || !pool || pool.source !== 'public' || !Array.isArray(pool.counts)
    || pool.counts.length !== 34 || Array.from(pool.counts).some(n => !Number.isInteger(n) || n < 0 || n > 4)) {
    throw new Error('INVALID_PUBLIC_SAFETY_INPUT');
  }
  const possibleUses: { type: 'pair' | 'triplet' | 'sequence'; needs: string[] }[] = [];
  if (pool.counts[index] >= 1) possibleUses.push({ type: 'pair', needs: [kind] });
  if (pool.counts[index] >= 2) possibleUses.push({ type: 'triplet', needs: [kind, kind] });
  if (index < 27) {
    const first = Math.floor(index / 9) * 9;
    for (let start = Math.max(first, index - 2); start <= Math.min(index, first + 6); start++) {
      const others = [start, start + 1, start + 2].filter(i => i !== index);
      if (others.every(i => pool.counts[i] > 0)) possibleUses.push({ type: 'sequence', needs: others.map(i => KINDS[i]) });
    }
  }
  // ponytail: local completion routes only; per-opponent full-shape constraints come after calibration.
  return { kind, provenSafe: possibleUses.length === 0, possibleUses };
}
