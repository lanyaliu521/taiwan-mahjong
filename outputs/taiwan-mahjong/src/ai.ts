import type { getObservation } from './engine.js';
import type { Intent, Meld } from './model.js';
import { kindOf } from './tiles.js';
import { createAnalyzer, publicPool, analyzeObservation, compareAnalysis } from './analysis.js';

const intentKey = (a: Intent): string => JSON.stringify(a, ['type', 'source', 'windowId', 'tileId', 'ownTiles', 'meldId']);

/** Fair local policy: its entire knowledge is the supplied player observation. */
export function chooseAction(observation: ReturnType<typeof getObservation>, actions: Intent[], randomState: number): { intent: Intent; randomState: number; reason: string } {
  if (!Number.isInteger(randomState) || randomState < 1 || randomState > 0xffffffff) throw new Error('INVALID_AI_RANDOM_STATE');
  const allowed = new Set(observation.legalActions.map(intentKey));
  const legal = actions.filter(a => allowed.has(intentKey(a)));
  if (!legal.length) throw new Error('NO_LEGAL_AI_ACTION');
  let nextRandom = randomState;
  nextRandom ^= nextRandom << 13; nextRandom ^= nextRandom >>> 17; nextRandom ^= nextRandom << 5;
  nextRandom >>>= 0;
  const win = legal.find(a => a.type === 'WIN');
  if (win) return { intent: win, randomState: nextRandom, reason: '優先選擇合法胡牌' };

  const summary = analyzeObservation(observation, false);
  const analyzer = createAnalyzer(publicPool(observation));
  // ponytail: one-draw tile efficiency; add deeper search only after measured strength needs.
  const candidates = legal.map(intent => {
    let q = summary.current, bonus = 0;
    if (intent.type === 'DISCARD') {
      q = summary.discards.find(d => d.kind === kindOf(intent.tileId))!.analysis;
    } else if (intent.type === 'CHI' || intent.type === 'PON') {
      const claim = summary.claims.find(c => intentKey(c.intent) === intentKey(intent))!;
      if (!claim.best.length) throw new Error('NO_LEGAL_POST_CLAIM_DISCARD');
      q = claim.best[0].analysis;
      bonus = -0.1; // Preserve the closed hand when calling does not improve efficiency.
    } else if (intent.type === 'KAN_CLOSED' || intent.type === 'KAN_OPEN' || intent.type === 'KAN_ADDED') {
      const removed = intent.type === 'KAN_ADDED' ? [intent.tileId] : intent.ownTiles;
      const hand = observation.self.concealed.filter(t => !removed.includes(t)).map(kindOf);
      let melds: Meld[];
      if (intent.type === 'KAN_ADDED') {
        melds = observation.self.melds.map(m => m.meldId === intent.meldId ? { ...m, kind: 'addedKong', tiles: [...m.tiles, intent.tileId] } : m);
      } else {
        if (intent.type === 'KAN_OPEN' && !observation.lastDiscard) throw new Error('MISSING_DISCARD');
        melds = [...observation.self.melds, { meldId: 'analysis-kong', kind: intent.type === 'KAN_CLOSED' ? 'concealedKong' : 'exposedKong', tiles: [...intent.ownTiles, ...(intent.type === 'KAN_OPEN' ? [observation.lastDiscard!.tileId] : [])], fromSeat: intent.type === 'KAN_CLOSED' ? null : observation.lastDiscard!.seat, sourceEvent: 0 }];
      }
      q = analyzer.analyze(hand, melds, false);
      // ponytail: no rob-kong risk estimate; add public-discard defence with a stronger policy.
      bonus = 0.1;
    }
    return { intent, q, bonus };
  });
  const sorted = candidates.sort((a, b) => compareAnalysis(b.q, a.q) || b.bonus - a.bonus);
  const first = sorted[0], tied = sorted.filter(c => compareAnalysis(c.q, first.q) === 0 && c.bonus === first.bonus);
  const selected = tied[Math.floor(nextRandom / 4294967296 * tied.length)];
  const shape = selected.q.shanten === 0 ? '聽牌' : `${selected.q.shanten} 向聽`;
  return { intent: selected.intent, randomState: nextRandom, reason: `${shape}；依公開資訊估計有效進張 ${selected.q.improving} 張` };
}
