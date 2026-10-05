import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, legalActions, getObservation, assertState } from '../dist/engine.js';
import { createSession, automaticAction, advance, encodeSession, decodeSession } from '../dist/session.js';
import { fixture, discard, run, resolve, W02 } from './fixtures.mjs';

const sessionFor = game => ({ schemaVersion: 1, game, aiRandom: [17, 29, 43] });
const seeded = seed => sessionFor(createGame({ seed, dealer: 0, matchId: `session-${seed}` }));
const commit = (session, action) => advance(session, action.actor, action.intent, session.game.version, action.randomState);
const contains = (options, intent) => options.some(option => JSON.stringify(option) === JSON.stringify(intent));

test('新一將快照包含三家獨立策略狀態且可還原', () => {
  const session = createSession();
  assert.equal(session.schemaVersion, 1);
  assert.equal(session.game.phase, 'setup');
  assert.equal(session.aiRandom.length, 3);
  for (const seed of session.aiRandom) assert.ok(Number.isInteger(seed) && seed > 0 && seed <= 0xffffffff);
  const copy = decodeSession(encodeSession(session));
  assert.deepEqual(copy, session);
  assert.notEqual(copy.game, session.game);
  assert.notEqual(copy.aiRandom, session.aiRandom);
});

test('自動發牌與補花完成後等待真人；讀取下一步不消耗策略亂數', () => {
  let session = seeded(23);
  for (let steps = 0; steps < 30; steps++) {
    const before = structuredClone(session);
    const next = automaticAction(session);
    assert.deepEqual(automaticAction(session), next);
    assert.deepEqual(session, before);
    if (!next) break;
    assert.equal(next.actor, 'engine');
    session = commit(session, next);
  }
  assert.equal(session.game.phase, 'awaitDiscard');
  assert.equal(session.game.turn, 0);
  assert.ok(legalActions(session.game, 0).some(a => a.type === 'DISCARD'));
  assert.equal(automaticAction(session), null);
  assert.deepEqual(session.aiRandom, [17, 29, 43]);
});

test('有可影響裁決的真人回應時保持等待，已回答的真人不會再被喚醒', () => {
  let session = sessionFor(discard(fixture({ turn: 3, hands: { 3: '2m', 0: W02, 1: W02 } }), 3, '2m'));
  assert.ok(legalActions(session.game, 0).some(a => a.type === 'WIN'));
  assert.equal(automaticAction(session), null);
  const pass = legalActions(session.game, 0).find(a => a.type === 'PASS');
  session = advance(session, 0, pass, session.game.version);
  session = decodeSession(encodeSession(session));
  assert.equal(legalActions(session.game, 0).length, 0);
  const next = automaticAction(session);
  assert.ok(next);
  assert.equal(next.actor, 1);
  assert.equal(next.intent.type, 'WIN');
  session = commit(session, next);
  assert.equal(automaticAction(session)?.intent.type, 'RESOLVE');
});

test('引擎已判定真人無法改判時直接裁決，不停在失效的吃牌選擇', () => {
  const game = discard(fixture({ turn: 3, hands: { 3: '2m', 0: '34m', 1: W02 } }), 3, '2m');
  assert.ok(legalActions(game, 0).some(a => a.type === 'CHI'));
  const answered = run(game, 1, 'WIN');
  assert.equal(legalActions(answered, 0).length, 0);
  assert.deepEqual(automaticAction(sessionFor(answered))?.intent, { type: 'RESOLVE' });
});

test('結算及將結束不自動跳頁，下一局只由明確操作推進一次', () => {
  const game = resolve(discard(fixture({ dealer: 3, dealerAdvances: 15, turn: 3, hands: { 3: '2m', 0: W02 } }), 3, '2m'), { 0: 'WIN' });
  const session = sessionFor(game), before = structuredClone(session);
  assert.equal(session.game.phase, 'handResult');
  assert.equal(automaticAction(session), null);
  assert.equal(automaticAction(decodeSession(encodeSession(session))), null);
  const next = advance(session, 'engine', { type: 'NEXT_HAND' }, game.version);
  assert.equal(next.game.phase, 'matchResult');
  assert.equal(next.game.dealerAdvances, 16);
  assert.deepEqual(next.game.scores, game.scores);
  assert.equal(automaticAction(next), null);
  assert.throws(() => advance(next, 'engine', { type: 'NEXT_HAND' }, game.version));
  assert.deepEqual(session, before);
});

test('過期、重複與非法提交不修改牌局或策略亂數', () => {
  const session = seeded(5), before = structuredClone(session);
  const next = advance(session, 'engine', { type: 'DEAL' }, session.game.version);
  assert.equal(next.game.version, session.game.version + 1);
  assert.deepEqual(session, before);
  const after = structuredClone(next);
  assert.throws(() => advance(next, 'engine', { type: 'DEAL' }, session.game.version));
  assert.deepEqual(next, after);
  assert.throws(() => advance(session, 1, { type: 'DRAW' }, session.game.version, 100));
  assert.deepEqual(session, before);
});

test('策略亂數只能由電腦以有效狀態一起提交', () => {
  const session = sessionFor(fixture({ turn: 1 })), before = structuredClone(session);
  const next = automaticAction(session);
  assert.equal(next.actor, 1);
  for (const randomState of [0, -1, 1.5, '17', null, NaN, Infinity, 0x100000000]) {
    assert.throws(() => advance(session, 1, next.intent, session.game.version, randomState));
    assert.deepEqual(session, before);
  }
  const human = sessionFor(fixture()), choice = legalActions(human.game, 0).find(a => a.type === 'DISCARD');
  assert.throws(() => advance(human, 0, choice, human.game.version, 17));
  const setup = seeded(4);
  assert.throws(() => advance(setup, 'engine', { type: 'DEAL' }, setup.game.version, 17));
});

test('壞快照、未知版本、缺失策略亂數與不合法引擎快照都被拒絕', () => {
  for (const raw of ['{', 'null', '[]', 'true', '0', '"session"']) assert.throws(() => decodeSession(raw));
  const changes = [
    s => { s.schemaVersion = 2; }, s => { delete s.game; }, s => { s.game = null; },
    s => { delete s.aiRandom; }, s => { s.aiRandom = []; }, s => { s.aiRandom.push(3); },
    s => { s.aiRandom[0] = 0; }, s => { s.aiRandom[0] = -1; }, s => { s.aiRandom[0] = 1.5; },
    s => { s.aiRandom[0] = '7'; }, s => { s.aiRandom[0] = 0x100000000; },
    s => { s.game.wall.order[0] = s.game.wall.order[1]; },
  ];
  for (const change of changes) {
    const invalid = seeded(1); change(invalid);
    const raw = JSON.stringify(invalid);
    assert.throws(() => decodeSession(raw));
    assert.equal(JSON.stringify(invalid), raw);
  }
});

test('應用還原會重算引擎候選，不能藏掉真人的胡牌回應', () => {
  const session = sessionFor(discard(fixture({ turn: 3, hands: { 3: '2m', 0: W02 } }), 3, '2m'));
  delete session.game.pending.options[0];
  assert.throws(() => decodeSession(JSON.stringify(session)), /CORRUPT_CLAIM_OPTIONS/);
});

test('公平觀察遮住他家暗手、暗槓、限制及牌牆種子，並與原狀態分離', () => {
  const game = fixture({ melds: { 2: [{ kind: 'concealedKong', tiles: '1111m' }] } });
  const before = structuredClone(game);
  for (const seat of [0, 1, 2, 3]) {
    const observation = getObservation(game, seat), raw = JSON.stringify(observation);
    assert.deepEqual(observation.self.concealed, game.players[seat].concealed);
    for (const hidden of ['wall', 'wallRandom', 'pending', 'acceptedOpIds', 'aiRandom']) assert.equal(Object.hasOwn(observation, hidden), false);
    for (const other of [0, 1, 2, 3].filter(s => s !== seat)) {
      assert.equal(Object.hasOwn(observation.players[other], 'concealed'), false);
      assert.equal(Object.hasOwn(observation.players[other], 'restrictions'), false);
      for (const tile of game.players[other].concealed) assert.equal(raw.includes(`"${tile}"`), false);
      for (const meld of game.players[other].melds.filter(m => m.kind === 'concealedKong')) {
        for (const tile of meld.tiles) assert.equal(raw.includes(`"${tile}"`), false);
      }
    }
    observation.self.concealed.length = 0;
    assert.deepEqual(game, before);
  }
});

test('六個固定牌局以一真人三電腦完整走到結算；每個存檔恢復後下一步完全相同', t => {
  let humanMoves = 0, aiMoves = 0, restored = 0;
  const seen = new Set();
  for (const seed of [1, 19, 37, 73, 101, 517]) {
    let session = seeded(seed), steps = 0;
    while (session.game.phase !== 'handResult' && steps++ < 700) {
      seen.add(session.game.phase);
      const before = structuredClone(session), next = automaticAction(session);
      assert.deepEqual(session, before, '選擇動作不可推進牌局或策略亂數');
      const restoredSession = decodeSession(encodeSession(session));
      assert.deepEqual(restoredSession, session);
      assert.deepEqual(automaticAction(restoredSession), next, '同存檔的下一步必須一致');
      restored++;
      let actor, intent, randomState;
      if (next) {
        ({ actor, intent, randomState } = next);
        assert.notEqual(actor, 0);
        assert.ok(contains(legalActions(session.game, actor), intent));
        if (actor !== 'engine') {
          assert.equal(legalActions(session.game, 0).length, 0, '有真人合法動作時不能自動跳過');
          aiMoves++;
        }
      } else {
        actor = 0;
        const options = legalActions(session.game, actor);
        assert.ok(options.length, `無合法選擇卻停在 ${session.game.phase}`);
        intent = options.find(a => a.type === 'WIN') ?? options.find(a => a.type === 'PASS') ?? options.find(a => a.type === 'DISCARD');
        assert.ok(intent);
        humanMoves++;
      }
      const nextSession = advance(session, actor, intent, session.game.version, randomState);
      assert.deepEqual(advance(restoredSession, actor, intent, restoredSession.game.version, randomState), nextSession);
      assert.deepEqual(session, before);
      assertState(nextSession.game);
      if (actor === 'engine' || actor === 0) assert.deepEqual(nextSession.aiRandom, session.aiRandom);
      else {
        assert.equal(nextSession.aiRandom[actor - 1], randomState);
        for (const other of [1, 2, 3].filter(s => s !== actor)) assert.equal(nextSession.aiRandom[other - 1], session.aiRandom[other - 1]);
      }
      session = nextSession;
    }
    assert.equal(session.game.phase, 'handResult', `牌局 ${seed} 未於上限內結束`);
    assert.equal(session.game.settlement.delta.reduce((a, b) => a + b, 0), 0);
    assert.equal(automaticAction(session), null);
    const settled = decodeSession(encodeSession(session));
    assert.deepEqual(settled.game.scores, session.game.scores);
    const next = advance(settled, 'engine', { type: 'NEXT_HAND' }, settled.game.version);
    assert.equal(next.game.handId, settled.game.handId + 1);
    assert.deepEqual(next.game.scores, settled.game.scores, '下一局不能重付結算');
  }
  assert.ok(humanMoves > 0 && aiMoves > 0 && restored > 100);
  for (const phase of ['setup', 'initialFlowers', 'awaitDraw', 'awaitDiscard', 'awaitClaims']) assert.ok(seen.has(phase));
  t.diagnostic(`6 局，${humanMoves} 次真人選擇，${aiMoves} 次電腦選擇，${restored} 次逐步存檔還原核對`);
});
