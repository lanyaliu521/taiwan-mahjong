import type { getObservation } from './engine.js';
import { createAnalyzer, publicPool } from './analysis.js';
import { kindOf } from './tiles.js';
import { discardRiskEvidence } from './risk-evidence.js';

type Preferences = { maxShantenLoss: number; dealerExposureWeight: number; otherExposureWeight: number };

/** Offline preference experiment. Exposure means missing safety proof, NOT deal-in probability. */
export function compareDiscardPreferences(o: ReturnType<typeof getObservation>, preferences: Preferences) {
  const { maxShantenLoss, dealerExposureWeight, otherExposureWeight } = preferences;
  if (!Number.isInteger(maxShantenLoss) || maxShantenLoss < 0 || maxShantenLoss > 5
    || [dealerExposureWeight, otherExposureWeight].some(n => !Number.isFinite(n) || n < 0 || n > 100)) {
    throw new Error('INVALID_STRATEGY_PREFERENCES');
  }
  if (o.legalActions.some(a => a.type === 'WIN')) return { priority: 'win' as const, candidates: [], best: [] };
  const risk = discardRiskEvidence(o);
  if (!risk.candidates.length) return { priority: 'none' as const, candidates: [], best: [] };
  const shape = createAnalyzer(publicPool(o)).discards(o.self.concealed.map(kindOf), o.self.melds,
    risk.candidates.map(c => c.kind), false);
  const minimumShanten = Math.min(...shape.map(c => c.analysis.shanten));
  const candidates = shape.map(c => {
    const evidence = risk.candidates.find(r => r.kind === c.kind)!;
    const exposurePenalty = evidence.opponents.reduce((sum, p) => sum + (p.provenSafe ? 0
      : p.seat === o.dealer ? dealerExposureWeight : otherExposureWeight), 0);
    return { kind: c.kind, shanten: c.analysis.shanten, improving: c.analysis.improving,
      eligible: c.analysis.shanten <= minimumShanten + maxShantenLoss, exposurePenalty, evidence };
  });
  const eligible = candidates.filter(c => c.eligible);
  const compare = (a: typeof candidates[number], b: typeof candidates[number]) =>
    a.exposurePenalty - b.exposurePenalty || a.shanten - b.shanten || b.improving - a.improving;
  // ponytail: no readiness model or future continuation EV; paired table trials must precede live integration.
  return { priority: 'discard' as const, candidates,
    best: eligible.filter(a => eligible.every(b => compare(a, b) <= 0)).map(c => c.kind) };
}
