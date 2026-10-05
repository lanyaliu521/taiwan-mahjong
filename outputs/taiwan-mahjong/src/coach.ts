import type { getObservation } from './engine.js';
import { analyzeObservation } from './analysis.js';

/** Accept only the human's masked observation, and only completed decision hands. */
export function coachAnalysis(o: ReturnType<typeof getObservation>) {
  const effective = o.self.concealed.length + o.self.melds.length * 3;
  if (!['awaitDiscard', 'awaitClaims', 'awaitRobKong'].includes(o.phase) || ![16, 17].includes(effective) || !o.legalActions.some(a => ['DISCARD', 'CHI', 'PON', 'WIN', 'PASS'].includes(a.type))) return null;
  return analyzeObservation(o);
}
