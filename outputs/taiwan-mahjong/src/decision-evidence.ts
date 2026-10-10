import type { getObservation } from './engine.js';
import type { Intent } from './model.js';
import { analyzeObservation, type Analysis } from './analysis.js';
import { discardRiskEvidence } from './risk-evidence.js';
import { KINDS, kindOf } from './tiles.js';

export const EVIDENCE_VERSION = 'tw16-evidence-1';
const RULES = 'TW16-CLASSIC-v1';
type Observation = ReturnType<typeof getObservation>;

// Explicit fields: never serialize arbitrary caller properties into evidence.
export function evidenceIntent(a: Intent): Intent {
  switch (a.type) {
    case 'DISCARD': return { type: a.type, tileId: a.tileId };
    case 'CHI': case 'PON': case 'KAN_OPEN': return { type: a.type, windowId: a.windowId, ownTiles: [...a.ownTiles].sort() };
    case 'KAN_CLOSED': return { type: a.type, ownTiles: [...a.ownTiles].sort() };
    case 'KAN_ADDED': return { type: a.type, meldId: a.meldId, tileId: a.tileId };
    case 'WIN': return a.windowId === undefined ? { type: a.type, source: a.source }
      : { type: a.type, source: a.source, windowId: a.windowId };
    case 'PASS': return { type: a.type, windowId: a.windowId };
    case 'DEAL': case 'DRAW': case 'REPLACE': case 'RESOLVE': case 'NEXT_HAND': return { type: a.type };
    default: throw new Error('INVALID_EVIDENCE_ACTION');
  }
}
const actionKey = (a: Intent) => JSON.stringify(evidenceIntent(a));
const kindOrder = (a: { kind: string }, b: { kind: string }) => KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind);
const metrics = (a: Analysis) => ({ level: 'E1' as const, status: 'supported' as const,
  shanten: a.shanten, effective: a.effective, improving: a.effective === 16 ? a.improving : null,
  improvementStatus: a.effective === 16 ? 'supported' as const : 'notApplicable' as const,
  publicPoolTotal: a.total, publicImprovingRatio: a.effective === 16 && a.total ? a.improving / a.total : null,
  effectiveTiles: a.effectiveTiles.map(t => ({ kind: t.kind, count: t.count })),
  scope: '公開未知一般牌，含其他家暗手與牌尾；比例不是實際可摸牌牆機率。',
});

/** Internal engine Observation only. Not a saved-data/import validator or action authorization. */
export function decisionEvidence(o: Observation, rulesVersion: string) {
  if (rulesVersion !== RULES) throw new Error('UNSUPPORTED_EVIDENCE_RULES');
  if (!o || 'wall' in o || !o.self || !Array.isArray(o.players) || o.players.length !== 4
    || !Number.isInteger(o.seat) || o.seat < 0 || o.seat > 3
    || o.players.some((p, seat) => seat !== o.seat && ('concealed' in p
      || p.melds.some(m => m.kind === 'concealedKong' && 'tiles' in m)))) throw new Error('UNMASKED_EVIDENCE_INPUT');
  // Check ownership before analysis so foreign DISCARDs never acquire a legal label.
  for (const a of o.legalActions) {
    if (a.type === 'DISCARD' && !o.self.concealed.includes(a.tileId)) throw new Error('INVALID_DISCARD_OWNER');
  }
  const effective = o.self.concealed.length + 3 * o.self.melds.length;
  const ready = ['awaitDiscard', 'awaitClaims', 'awaitRobKong'].includes(o.phase) && [16, 17].includes(effective);
  const analysis = ready ? analyzeObservation(o, false) : null;
  const risks = ready && o.legalActions.some(a => a.type === 'DISCARD') ? discardRiskEvidence(o).candidates : [];
  const actions = [...new Map(o.legalActions.map(a => [actionKey(a), evidenceIntent(a)])).entries()]
    .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  const candidates = actions.map(([id, intent]) => {
    const discard = intent.type === 'DISCARD' ? analysis?.discards.find(d => d.kind === kindOf(intent.tileId)) : undefined;
    const claim = analysis?.claims.find(c => actionKey(c.intent) === id);
    const risk = discard ? risks.find(r => r.kind === discard.kind) : undefined;
    return { id, intent, legality: { level: 'E1' as const, status: 'supported' as const, scope: '本次引擎觀察的合法候選；執行前仍須重驗版本及合法性。' },
      efficiency: discard ? metrics(discard.analysis) : null,
      postClaim: claim ? { conditional: '須先取得吃碰；仲裁後重新驗合法捨牌。', losesClosed: claim.losesClosed,
        discards: [...claim.discards].sort(kindOrder).map(d => ({ kind: d.kind, efficiency: metrics(d.analysis) })),
        preferredKinds: [...claim.best].sort(kindOrder).map(d => d.kind), level: 'E3' as const,
        objective: '僅比較吃碰後向聽較低、再比較公開有效進張較多；未評估防守或整體收益。' } : null,
      safety: risk ? { level: 'E2' as const, scope: '當時公開容量；本次對指定座位普通放槍，不涵蓋未來自摸、花胡或續莊。',
        opponents: risk.opponents.map(p => ({ seat: p.seat, status: p.provenSafe ? 'proven' as const : 'unknown' as const,
          remainingRoutes: p.possibleUses, explanation: p.provenSafe ? '已排除本模型涵蓋的成形路徑。' : '尚無充分安全證明；不表示必定危險。' })) } : null,
      unknownReason: discard ? null : claim ? '尚無吃碰後捨牌安全與整體收益模型。' : '此動作未提供牌效／安全比較；null不表示零風險或不合法。',
    };
  });
  // ponytail: internal evidence only; L2 must validate a versioned snapshot DTO before reading saved data.
  return structuredClone({ schemaVersion: 1 as const, rulesVersion: RULES, analyzerVersion: EVIDENCE_VERSION,
    decision: { matchId: o.matchId, handId: o.handId, version: o.version, seat: o.seat },
    status: analysis ? 'available' as const : 'unavailable' as const, current: analysis ? metrics(analysis.current) : null,
    canWin: o.legalActions.some(a => a.type === 'WIN'), candidates,
    discardPreference: { level: 'E3' as const, objective: '僅向聽較低優先，同向聽再比較公開有效進張；不是全局最佳。',
      kinds: analysis ? [...analysis.best].sort(kindOrder).map(d => d.kind) : [] },
    overallStrategy: { status: 'unknown' as const, explanation: '無校準放槍率或完整收益模型，不判定唯一整體最佳選擇。' },
  });
}
