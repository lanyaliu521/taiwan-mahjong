import test from 'node:test';
import assert from 'node:assert/strict';
import { captureDecision, validateDecisionSnapshot, reviewDecision } from '../dist/decision-snapshot.js';
import { decisionEvidence } from '../dist/decision-evidence.js';
import { getObservation, legalActions } from '../dist/engine.js';
import { createSession, advance } from '../dist/session.js';
import { chooseAction } from '../dist/ai.js';
import { fixture, discard, run, WIN } from './fixtures.mjs';
import { appendReview, readReviewArchive, REVIEW_KEY } from '../dist/review-store.js';
const RULES = 'TW16-CLASSIC-v1';
const capture = (s, seat = 0, type = 'DISCARD') => {
  const o = getObservation(s, seat), a = o.legalActions.find(a => a.type === type);
  assert.ok(a, type); return captureDecision(o, a, RULES);
};

test('公開快照捨牌／兩吃法／碰／WIN往返，證據與當時觀察一致', () => {
  const s = discard(fixture({ hands: { 0: '2m', 1: '1345m67m123p456p789s1z' } }), 0, '2m');
  const states = [[fixture(), 0], [s, 1],
    [discard(fixture({ hands: { 0: '1m', 2: '111m123p456p789s11z23s' } }), 0, '1m'), 2],
    [fixture({ hands: { 0: WIN } }), 0]];
  for (const [state, seat] of states) {
    const o = getObservation(state, seat), before = structuredClone(o);
    for (const a of o.legalActions) {
      const snapshot = captureDecision(o, a, RULES);
      assert.deepEqual(reviewDecision(JSON.parse(JSON.stringify(snapshot))), decisionEvidence(o, RULES));
      assert.equal('settlement' in snapshot.observation, false);
      assert.deepEqual(o, before);
    }
  }
});

test('完整公開牌河／花牌與暗槓遮罩，拒絕新增私有欄位', () => {
  const s = fixture({ flowers: { 0: 'f1', 1: 'f2' }, melds: { 1: [{ kind: 'concealedKong', tiles: '1111m' }] } });
  const snapshot = capture(s);
  assert.deepEqual(snapshot.observation.players[1].melds[0], { meldId: 'meld-1-0', kind: 'concealedKong', count: 4 });
  assert.equal(snapshot.observation.players[1].flowers[0], 'f2#0');
  const bad = structuredClone(snapshot); bad.observation.players[1].melds[0].tiles = ['1m#0'];
  assert.throws(() => validateDecisionSnapshot(bad));
  const o = getObservation(s, 0); o.settlement = { private: 'future' }; o.seed = 999;
  assert.deepEqual(captureDecision(o, snapshot.chosen, RULES), snapshot);
});

test('搶槓觀察保留公開第四張與合法選項，不保存對手暗手', () => {
  let s = fixture({ hands: { 0: '3m', 1: '12m123p456p789p123s11z' }, melds: { 0: [{ tiles: '333m' }] } });
  s = run(s, 0, 'KAN_ADDED');
  const snap = capture(s, 1, 'WIN');
  assert.ok(snap.observation.offeredKong);
  assert.equal(snap.observation.lastDiscard, null);
  assert.deepEqual(reviewDecision(snap), decisionEvidence(getObservation(s, 1), RULES));
});

test('白名單、牌權、歷史引用、座位／階段、禁止吃碰、錯版本及選擇矛盾拒絕', () => {
  const base = capture(fixture());
  const mutations = [
    s => { s.extra = 1; }, s => { s.observation.settlement = null; }, s => { s.observation.self.secret = []; },
    s => { s.observation.players[1].concealed = []; }, s => { s.observation.self.concealed[1] = s.observation.self.concealed[0]; },
    s => { s.observation.players[1].concealedCount = 0; }, s => { s.observation.scores[0] = 100; },
    s => { s.observation.turn = 1; }, s => { s.observation.phase = 'handResult'; },
    s => { s.observation.legalActions = []; }, s => { s.chosen = { type: 'DISCARD', tileId: 'f1#0' }; },
    s => { s.observation.self.restrictions.forbiddenDiscards = [s.chosen.tileId.slice(0, 2)]; },
    s => { s.observation.players[1].discardHistory.push({ tileId: s.chosen.tileId, eventSeq: 999, claimedBy: null }); },
  ];
  for (const mutate of mutations) { const s = structuredClone(base); mutate(s); assert.throws(() => validateDecisionSnapshot(s)); }
  const newer = structuredClone(base); newer.analyzerVersion = 'future';
  assert.throws(() => reviewDecision(newer), /UNSUPPORTED_REVIEW_ANALYZER/);
  const chi = capture(discard(fixture({ hands: { 0: '2m', 1: '1345m67m123p456p789s1z' } }), 0, '2m'), 1, 'CHI');
  chi.observation.available = 3;
  assert.throws(() => validateDecisionSnapshot(chi));
});

test('v2獨立鍵往返，不改舊v1及遊戲存檔', () => {
  const data = new Map([['tw16:review:v1', 'LEGACY'], ['tw16:TW16-CLASSIC-v1:save', 'GAME']]);
  const storage = { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) };
  const s = capture(fixture()); appendReview(storage, null, s);
  assert.equal(REVIEW_KEY, 'tw16:review:v2');
  assert.deepEqual(readReviewArchive(storage).records, [s]);
  assert.equal(data.get('tw16:review:v1'), 'LEGACY'); assert.equal(data.get('tw16:TW16-CLASSIC-v1:save'), 'GAME');
});

test('600次真實轉移內各玩家所有可決策觀察皆可捕獲／重算，無需補齊隱藏資訊', () => {
  let session = createSession({ seed: 20261010, dealer: 0 }); session.aiRandom = [1, 2, 3];
  let count = 0, random = 17;
  for (let i = 0; i < 600; i++) {
    let actor = 'engine', intent = legalActions(session.game, 'engine')[0];
    if (!intent) {
      for (let seat = 0; seat < 4; seat++) {
        const o = getObservation(session.game, seat);
        if (!o.legalActions.length) continue;
        const decision = chooseAction(o, o.legalActions, random); random = decision.randomState;
        const snap = captureDecision(o, decision.intent, RULES);
        assert.deepEqual(reviewDecision(snap), decisionEvidence(o, RULES)); count++;
        actor = seat; intent = decision.intent; break;
      }
    }
    if (!intent) break;
    session = advance(session, actor, intent, session.game.version);
  }
  assert.ok(count > 100);
});
