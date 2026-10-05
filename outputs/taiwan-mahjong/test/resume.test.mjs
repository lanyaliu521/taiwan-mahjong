import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assertState, legalActions } from '../dist/engine.js';
import { automaticAction, advance, encodeSession, decodeSession } from '../dist/session.js';
import { createBrowserFixtures } from '../scripts/browser-fixtures.mjs';

const cases = createBrowserFixtures();
const savedCase = name => decodeSession(encodeSession(cases.find(item => item.name === name).session));
const commit = (session, action) => advance(session, action.actor, action.intent, session.game.version, action.randomState);
const nextAction = session => {
  const automatic = automaticAction(session);
  if (automatic) return automatic;
  const human = legalActions(session.game, 0);
  const intent = human.find(a => a.type === 'WIN') ?? human.find(a => a.type === 'DISCARD') ?? human[0];
  if (intent) return { actor: 0, intent };
  const flow = legalActions(session.game, 'engine')[0];
  return flow ? { actor: 'engine', intent: flow } : null;
};

test('瀏覽器固定場景與產生器一致，且不依賴隨機建立Session', () => {
  const saved = JSON.parse(readFileSync(new URL('./browser-fixtures.json', import.meta.url), 'utf8'));
  assert.deepEqual(saved, cases);
  assert.deepEqual(createBrowserFixtures(), cases);
});

for (const { name, session } of cases) test(`等待窗還原 ${name}：牌權、版本、合法選擇及相同動作結果不變`, () => {
  const raw = encodeSession(session), restored = decodeSession(raw);
  assert.deepEqual(restored, session);
  assert.notEqual(restored.game, session.game);
  assertState(restored.game); // Includes all 144 physical tiles and their unique ownership.
  for (const actor of ['engine', 0, 1, 2, 3]) assert.deepEqual(legalActions(restored.game, actor), legalActions(session.game, actor));
  assert.deepEqual(automaticAction(restored), automaticAction(session));
  const action = nextAction(session);
  assert.deepEqual(nextAction(restored), action);
  if (action) {
    const expected = commit(session, action), actual = commit(restored, action);
    assert.deepEqual(actual, expected);
    assertState(actual.game);
    assert.equal(actual.game.version, session.game.version + 1);
    assert.equal(actual.game.eventSeq, session.game.eventSeq + 1);
  } else {
    assert.equal(session.game.phase, 'matchResult');
    assert.throws(() => advance(restored, 'engine', { type: 'NEXT_HAND' }, restored.game.version), /ILLEGAL_ACTION/);
  }
  assert.equal(encodeSession(session), raw, '序列化與比較動作不得修改原存檔');
  assert.equal(encodeSession(restored), raw, '還原物件在提交後仍保持immutable');
});

test('起手補花保留later債務與座次，補完只讓莊家出牌一次', () => {
  let session = savedCase('initialFlowersLater');
  assert.deepEqual(session.game.pending, { kind: 'initialFlowers', queue: [1], later: [0] });
  assert.equal(session.game.players[0].flowers.length, 2);
  const before = session.game.players[1].concealed.length;
  session = commit(session, automaticAction(session));
  assert.equal(session.game.players[1].concealed.length, before + 1);
  assert.deepEqual(session.game.pending, { kind: 'initialFlowers', queue: [0], later: [] });
  for (let n = 0; n < 10 && session.game.phase === 'initialFlowers'; n++) session = commit(decodeSession(encodeSession(session)), automaticAction(session));
  assert.equal(session.game.phase, 'awaitDiscard');
  assert.equal(session.game.turn, 0);
  assert.equal(session.game.wall.head, 65, '莊家起手不可再摸牌');
  assert.deepEqual(session.game.players.map(p => p.concealed.length), [17, 16, 16, 16]);
  assert.equal(automaticAction(session), null);
});

test('連續補花跨兩次還原仍只從尾端各補一張', () => {
  let session = savedCase('awaitReplacement');
  const { head, tail } = session.game.wall;
  session = commit(session, automaticAction(session));
  assert.equal(session.game.phase, 'awaitReplacement');
  assert.equal(session.game.players[0].flowers.length, 2);
  session = decodeSession(encodeSession(session));
  session = commit(session, automaticAction(session));
  assert.equal(session.game.phase, 'awaitDiscard');
  assert.equal(session.game.wall.head, head);
  assert.equal(session.game.wall.tail, tail - 2);
  assert.equal(session.game.players[0].concealed.length, 17);
  assert.equal(automaticAction(session), null);
});

test('真人未答會停、已答不重喚醒，還原後保留同一回應窗與過水', () => {
  const unanswered = savedCase('awaitClaimsUnanswered');
  assert.ok(legalActions(unanswered.game, 0).some(a => a.type === 'WIN'));
  assert.equal(automaticAction(unanswered), null);
  let answered = savedCase('awaitClaimsAnswered');
  assert.equal(answered.game.pending.windowId, unanswered.game.pending.windowId);
  assert.equal(answered.game.pending.responses[0].type, 'PASS');
  assert.deepEqual(legalActions(answered.game, 0), []);
  assert.throws(() => advance(answered, 0, answered.game.pending.responses[0], answered.game.version), /ILLEGAL_ACTION/);
  const next = automaticAction(answered);
  assert.equal(next.actor, 1);
  assert.equal(next.intent.type, 'WIN');
  answered = commit(answered, next);
  answered = commit(decodeSession(encodeSession(answered)), automaticAction(answered));
  assert.equal(answered.game.settlement.winner, 1);
  assert.equal(answered.game.players[0].restrictions.passedWin, true);
});

test('搶槓還原保留第四張暗手牌權；真人胡後只結算一次且不補牌', () => {
  let session = savedCase('awaitRobKong');
  const { tileId, sourceSeat, windowId } = session.game.pending, tail = session.game.wall.tail;
  assert.ok(session.game.players[sourceSeat].concealed.includes(tileId));
  assert.equal(session.game.players[sourceSeat].melds[0].kind, 'pon');
  assert.equal(automaticAction(session), null);
  const win = legalActions(session.game, 0).find(a => a.type === 'WIN' && a.source === 'robKong');
  assert.equal(win.windowId, windowId);
  session = commit(session, { actor: 0, intent: win });
  session = commit(decodeSession(encodeSession(session)), automaticAction(session));
  assert.equal(session.game.phase, 'handResult');
  assert.equal(session.game.settlement.source, 'robKong');
  assert.equal(session.game.settlement.externalTile, tileId);
  assert.equal(session.game.wall.tail, tail);
  assert.equal(session.game.players[sourceSeat].concealed.includes(tileId), false);
  assert.equal(session.game.players[sourceSeat].melds[0].tiles.length, 3);
  assertState(session.game);
  assert.deepEqual(decodeSession(encodeSession(session)), session);
  assert.equal(automaticAction(session), null);
});

test('局結算續讀不重付，將結算不再接受下一局', () => {
  const hand = savedCase('handResult'), match = savedCase('matchResult');
  assert.equal(automaticAction(hand), null);
  assert.equal(automaticAction(match), null);
  const next = commit(hand, { actor: 'engine', intent: { type: 'NEXT_HAND' } });
  assert.equal(next.game.phase, 'matchResult');
  assert.deepEqual(next.game.scores, hand.game.scores);
  assert.deepEqual(next.game.settlement, hand.game.settlement);
  assert.equal(next.game.scores.reduce((a, b) => a + b, 0), 0);
  assert.throws(() => advance(next, 'engine', { type: 'NEXT_HAND' }, hand.game.version));
  assert.deepEqual(legalActions(match.game, 'engine'), []);
});
