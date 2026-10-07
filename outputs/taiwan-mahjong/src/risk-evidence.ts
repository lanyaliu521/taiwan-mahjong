import type { getObservation } from './engine.js';
import type { Seat } from './model.js';
import { publicPool } from './analysis.js';
import { ordinaryRonSafety } from './safety.js';
import { KINDS, kindOf } from './tiles.js';
import { settlePayments } from './scoring.js';

/** Offline evidence, not calibrated danger scores. Only engine-produced own observations. */
export function discardRiskEvidence(o: ReturnType<typeof getObservation>) {
  const pool = publicPool(o);
  const legal = new Set(o.legalActions.filter(a => a.type === 'DISCARD').map(a => {
    if (!o.self.concealed.includes(a.tileId)) throw new Error('INVALID_DISCARD_OWNER');
    return kindOf(a.tileId);
  }));
  const held = new Set(o.self.concealed.map(kindOf));
  const candidates = KINDS.filter(k => legal.has(k)).map(kind => {
    const global = ordinaryRonSafety(pool, kind);
    const opponents = o.players.flatMap((p, seat) => {
      if (seat === o.seat) return [];
      // Five declared groups leave only a pair to complete. Masked kongs count as groups, not known tiles.
      const possibleUses = global.possibleUses.filter(use => p.melds.length < 5 || use.type === 'pair');
      return [{ seat, declaredGroups: p.melds.length, publicDiscards: p.discardHistory.length,
        provenSafe: possibleUses.length === 0, possibleUses,
        minimumRonPayment: -settlePayments(seat as Seat, [o.seat], 0, o.dealer, o.streak)[o.seat] }];
    });
    return { kind, provenSafeAgainstAll: opponents.every(p => p.provenSafe), opponents };
  });
  // ponytail: only global capacity proof for reserves; future claim bans must be checked after arbitration.
  const heldSafeKinds = KINDS.filter(k => held.has(k) && ordinaryRonSafety(pool, k).provenSafe);
  return { candidates, heldSafeKinds, currentlyDiscardableSafeKinds: heldSafeKinds.filter(k => legal.has(k)) };
}
