import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHandReview } from '../dist/hand-review.js';
import { captureDecision } from '../dist/decision-snapshot.js';
import { captureDiscard } from '../dist/review-store.js';
import { getObservation } from '../dist/engine.js';
import { fixture, discard } from './fixtures.mjs';
const RULES = 'TW16-CLASSIC-v1';
const o = getObservation(fixture(), 0);
const a = o.legalActions.find(a => a.type === 'DISCARD');
const base = captureDecision(o, a, RULES);

test('只選指定牌局／局／座位最後三筆可比較快照，不冒充完整牌譜', () => {
  const records = Array.from({length:5}, (_,i) => {
    const s = structuredClone(base); s.observation.version += i; return s;
  });
  for (const [key, value] of [['matchId','foreign'],['handId',99],['seat',1]]) {
    const s = structuredClone(base); s.observation[key] = value; records.push(s);
  }
  records.push(captureDiscard(o, a.tileId, RULES));
  const original = structuredClone(records);
  const result = buildHandReview(records, o.matchId, o.handId, 0);
  assert.equal(result.retainedForHand, 5); assert.equal(result.shown, 3);
  assert.deepEqual(result.cards.map(c => c.snapshot.observation.version), [o.version+2,o.version+3,o.version+4]);
  assert.match(result.limitation, /不是完整牌譜/);
  result.cards[0].snapshot.observation.matchId = 'changed';
  assert.deepEqual(records, original);
});

test('合併同牌種實體副本時保留原選擇，並列牌效偏好全保留', () => {
  const state = fixture({ hands: {0:'1123456789m123p11z23s'} });
  const observation = getObservation(state,0);
  const copies = observation.legalActions.filter(a => a.type === 'DISCARD' && a.tileId.startsWith('1m'));
  assert.equal(copies.length,2);
  const snapshot = captureDecision(observation,copies[1],RULES);
  const {cards:[card]} = buildHandReview([snapshot],observation.matchId,observation.handId,0);
  const row = card.rows.filter(r => r.candidate.intent.type === 'DISCARD' && r.candidate.intent.tileId.startsWith('1m'));
  assert.equal(row.length,1); assert.equal(row[0].chosen,true); assert.deepEqual(row[0].candidate.intent,copies[1]);
  assert.equal(card.rows.filter(r=>r.chosen).length,1);
  assert.deepEqual(card.rows.filter(r=>r.efficiencyPreferred).map(r=>r.candidate.intent.tileId.slice(0,2)).sort(), [...card.evidence.discardPreference.kinds].sort());
  assert.equal(card.evidence.overallStrategy.status,'unknown');
});

test('134遇2兩種吃法與過保留，吃碰後捨仍為條件證據；純過不占檢討名額', () => {
  const state = discard(fixture({hands:{0:'2m',1:'1345m67m123p456p789s1z'}}),0,'2m');
  const observation = getObservation(state,1), chosen = observation.legalActions.find(a=>a.type==='PASS');
  const snapshot = captureDecision(observation,chosen,RULES);
  const result = buildHandReview([snapshot],observation.matchId,observation.handId,1);
  const rows = result.cards[0].rows;
  assert.equal(rows.filter(r=>r.candidate.intent.type==='CHI').length,2);
  assert.equal(rows.find(r=>r.chosen).candidate.intent.type,'PASS');
  assert.ok(rows.filter(r=>r.candidate.intent.type==='CHI').every(r=>r.candidate.postClaim.conditional.includes('仲裁')));
  const passOnly = structuredClone(snapshot); passOnly.observation.legalActions=[chosen];
  assert.equal(buildHandReview([passOnly],observation.matchId,observation.handId,1).shown,0);
});
