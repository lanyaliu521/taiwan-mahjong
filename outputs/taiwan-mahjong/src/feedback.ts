import type { getObservation } from './engine.js';
import { coachAnalysis } from './coach.js';
import { kindOf } from './tiles.js';

type Observation = ReturnType<typeof getObservation>;
export type PlayFeedback = { key: string; title: string; detail: string; kind: 'progress' | 'ready' | 'action' };
export type PlayProgress = { handId: number; closest: number; praised: boolean };

/** UI-only encouragement: own legal choices, never opponent analysis or win predictions. */
export function discardFeedback(o: Observation, tileId: string, previous: PlayProgress | null) {
  const report = coachAnalysis(o), choice = report?.discards.find(c => c.kind === kindOf(tileId));
  if (!report || !choice || !o.legalActions.some(a => a.type === 'DISCARD' && a.tileId === tileId)) return { progress: previous, feedback: null };
  const old = previous?.handId === o.handId ? previous : null;
  const q = choice.analysis;
  let feedback: PlayFeedback | null = null;
  const make = (title: string, detail: string, kind: PlayFeedback['kind']): PlayFeedback => ({ key: `${o.handId}:${o.version}:discard`, title, detail, kind });
  // Do not praise a missed legal win, exhausted waits, or structural completion without win eligibility.
  if (!report.canWin && q.shanten >= 0 && q.improving > 0) {
    if (q.shanten === 0 && (!old || old.closest > 0)) feedback = make('牌型已聽！', `公開有效牌 ${q.improving} 張；實際胡牌以合法按鈕為準。`, 'ready');
    else if (old && q.shanten < old.closest) feedback = make('更接近胡牌了', `${old.closest} → ${q.shanten} 向聽，這手牌又往前一步。`, 'progress');
    else if (!old?.praised && report.best.some(c => c.kind === choice.kind)) feedback = make('這步牌效不錯！', '與合法候選中的最佳一步牌效相同。', 'progress');
  }
  return { progress: { handId: o.handId, closest: Math.min(old?.closest ?? Infinity, q.shanten), praised: old?.praised || feedback !== null }, feedback };
}

export function meldFeedback(before: Observation, after: Observation): PlayFeedback | null {
  if (before.handId !== after.handId || after.settlement || after.self.melds.length <= before.self.melds.length) return null;
  const meld = after.self.melds.at(-1)!;
  if (meld.kind !== 'chi' && meld.kind !== 'pon') return null;
  return { key: `${after.handId}:${after.version}:meld`, title: meld.kind === 'chi' ? '吃牌成立' : '碰牌成立', detail: '一組面子到手，接著選一張合法手牌捨出。', kind: 'action' };
}
