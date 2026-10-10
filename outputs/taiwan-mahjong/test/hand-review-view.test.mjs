import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewActionName, reviewMetricsText, reviewSummaryRows } from '../dist/hand-review-view.js';
import { buildHandReview } from '../dist/hand-review.js';
import { captureDecision } from '../dist/decision-snapshot.js';
import { getObservation } from '../dist/engine.js';
import { fixture, discard } from './fixtures.mjs';

test('局後摘要最多三項、原選擇必在且不改完整並列候選', () => {
  const o=getObservation(fixture(),0), a=o.legalActions.find(a=>a.type==='DISCARD');
  const {cards:[card]}=buildHandReview([captureDecision(o,a,'TW16-CLASSIC-v1')],o.matchId,o.handId,0);
  const all=structuredClone(card.rows), summary=reviewSummaryRows(card);
  assert.equal(summary.length,3); assert.equal(summary[0].chosen,true);
  assert.ok(card.rows.length>summary.length); assert.deepEqual(card.rows,all);
  assert.match(reviewActionName(summary[0].candidate.intent),/^打/);
});

test('牌效格式區分E17不適用與E16公開張數，不生成概率或零風險', () => {
  const o=getObservation(fixture(),0), a=o.legalActions.find(a=>a.type==='DISCARD');
  const {cards:[card]}=buildHandReview([captureDecision(o,a,'TW16-CLASSIC-v1')],o.matchId,o.handId,0);
  assert.match(reviewMetricsText(card.evidence.current),/17張.*不適用/);
  const m=card.rows.find(r=>r.candidate.efficiency).candidate.efficiency;
  assert.match(reviewMetricsText(m),/公開有效進張.*未知一般牌/);
  assert.doesNotMatch(reviewMetricsText(m),/%|風險|最佳/);
});

test('兩吃法有不同可讀標籤，過不偽造牌效', () => {
  const o=getObservation(discard(fixture({hands:{0:'2m',1:'1345m67m123p456p789s1z'}}),0,'2m'),1);
  const a=o.legalActions.find(a=>a.type==='PASS');
  const {cards:[card]}=buildHandReview([captureDecision(o,a,'TW16-CLASSIC-v1')],o.matchId,o.handId,1);
  const labels=card.rows.filter(r=>r.candidate.intent.type==='CHI').map(r=>reviewActionName(r.candidate.intent));
  assert.deepEqual(labels.sort(),['吃：用一萬＋三萬','吃：用三萬＋四萬'].sort());
  const pass=card.rows.find(r=>r.chosen); assert.equal(reviewActionName(pass.candidate.intent),'過'); assert.equal(pass.candidate.efficiency,null);
});
