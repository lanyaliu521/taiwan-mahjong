import { reviewDecision, type DecisionSnapshot } from './decision-snapshot.js';
import { evidenceIntent } from './decision-evidence.js';
import type { ReviewRecord } from './review-store.js';
import { kindOf } from './tiles.js';
import type { Intent, Seat } from './model.js';

const exact = (a: Intent) => JSON.stringify(evidenceIntent(a));
/** Physical copies of the same kind have identical visible efficiency/safety evidence. */
function groupKey(a: Intent) {
  if (a.type === 'DISCARD') return `${a.type}:${kindOf(a.tileId)}`;
  if (a.type === 'CHI' || a.type === 'PON') return `${a.type}:${a.ownTiles.map(kindOf).sort().join(',')}`;
  return exact(a);
}
function comparable(s: DecisionSnapshot) {
  const actions = s.observation.legalActions;
  return actions.some(a => a.type === 'CHI' || a.type === 'PON')
    || new Set(actions.filter(a => a.type === 'DISCARD').map(groupKey)).size > 1;
}

/** Read-only, completed-hand caller only. This is a recent sample, not a mistake ranking. */
export function buildHandReview(records: readonly ReviewRecord[], matchId: string, handId: number, seat: Seat) {
  const hand = records.filter((s): s is DecisionSnapshot => s.schemaVersion === 2
    && s.observation.matchId === matchId && s.observation.handId === handId && s.observation.seat === seat);
  const selected = hand.filter(comparable).slice(-3);
  const cards = selected.map(snapshot => {
    const evidence = reviewDecision(snapshot);
    const chosen = exact(snapshot.chosen);
    const rows = new Map<string, { candidate: typeof evidence.candidates[number]; chosen: boolean; efficiencyPreferred: boolean }>();
    for (const candidate of evidence.candidates) {
      const key = groupKey(candidate.intent), picked = candidate.id === chosen;
      const existing = rows.get(key);
      if (!existing || picked) rows.set(key, { candidate, chosen: picked,
        efficiencyPreferred: candidate.intent.type === 'DISCARD' && evidence.discardPreference.kinds.includes(kindOf(candidate.intent.tileId)) });
    }
    return { snapshot: structuredClone(snapshot), evidence, rows: [...rows.values()],
      selectionNote: '最近三筆可比較決策；不是錯誤排名。',
      claimNote: '吃碰是當時提出的選擇；取得牌與後捨仍受仲裁及合法性限制。',
    };
  });
  return { cards, retainedForHand: hand.length, shown: cards.length,
    limitation: '僅含本瀏覽器仍保留的記錄，不是完整牌譜；只比较當時可見證據，不使用後續結果評判。' };
}
