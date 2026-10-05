import test from 'node:test';
import assert from 'node:assert/strict';
import { assertState, serialize, restore as readSnapshot } from '../dist/validation.js';
import { createGame, legalActions, restore } from '../dist/engine.js';
import { DECK } from '../dist/tiles.js';
import { fixture, run, step, discard, resolve, W02 } from './fixtures.mjs';

const rejectChange = (state, change, pattern = /INVALID_STATE/) => {
  const invalid = structuredClone(state);
  change(invalid);
  const raw = JSON.stringify(invalid);
  const before = JSON.stringify(state);
  assert.throws(() => readSnapshot(raw), pattern);
  assert.equal(JSON.stringify(invalid), raw, 'failed restoration cannot rewrite the rejected save');
  assert.equal(JSON.stringify(state), before, 'validation cannot mutate the original state');
};

test('Saved setup round-trips as an independent state and invalid text stays untouched', () => {
  const state = createGame({ seed: 7, dealer: 2, matchId: 'validation-save' });
  const raw = serialize(state), copy = restore(raw);
  assert.deepEqual(copy, state); assert.notEqual(copy, state);
  copy.scores[0] = 1; assert.equal(state.scores[0], 0);
  for (const raw of ['{', 'null', '[]', 'true', '17', '"state"']) {
    const untouched = raw;
    assert.throws(() => readSnapshot(raw)); assert.equal(raw, untouched);
  }
  assert.throws(() => readSnapshot({}), /save.text/);
});

test('Runtime boundary rejects missing fields, wrong scalar types, unsupported versions and unsafe numbers', () => {
  const state = createGame({ seed: 1, dealer: 0 });
  const changes = [
    s => { delete s.wallRandom; }, s => { s.wallRandom = 0; }, s => { s.wallRandom = 0x100000000; },
    s => { s.schemaVersion = 2; }, s => { s.rulesVersion = 'other'; }, s => { s.matchId = ''; },
    s => { s.handId = 0; }, s => { s.version = 1.5; }, s => { s.eventSeq = Number.MAX_SAFE_INTEGER + 1; },
    s => { s.streak = -1; }, s => { s.turn = 4; }, s => { s.initialDealer = '0'; },
    s => { s.dealerAdvances = 1; }, s => { s.roundWind = '5z'; }, s => { s.phase = 'waiting'; },
    s => { s.scores = [0, 0, 0]; }, s => { s.scores[0] = 1; }, s => { s.players.pop(); },
    s => { s.players[0] = null; }, s => { s.players[0].concealed = {}; },
    s => { s.players[0].restrictions.passedWin = 'false'; }, s => { s.players[0].restrictions.passedPon = ['f1']; },
    s => { s.players[0].restrictions.forbiddenDiscards = ['1m', '1m']; }, s => { s.players[0].restrictions.lastDiscard = '1m'; },
    s => { s.drawContext.source = 'flower'; }, s => { s.drawContext.replacement = 0; },
    s => { s.openingContext.draws = [0, 0, -1, 0]; }, s => { s.openingContext.interrupted = null; },
    s => { s.acceptedOpIds = ['same', 'same']; }, s => { s.acceptedOpIds = [null]; },
    s => { s.pending = { kind: 'initialFlowers', queue: [], later: [] }; },
    s => { s.wall.reserveCount = 17; }, s => { s.wall.head = -1; }, s => { s.wall.tail = 144; },
  ];
  for (const change of changes) rejectChange(state, change);
});

test('The reference wall is exact and each physical tile has one live owner', () => {
  const state = fixture();
  rejectChange(state, s => { s.wall.order[1] = s.wall.order[0]; });
  rejectChange(state, s => { s.wall.order[0] = '1m#4'; });
  rejectChange(state, s => { s.wall.order.pop(); });
  rejectChange(state, s => { s.players[0].concealed[0] = s.players[1].concealed[0]; });
  rejectChange(state, s => { s.players[0].concealed.push(s.wall.order[s.wall.head++]); });
  rejectChange(state, s => { s.players[0].flowers.push(s.wall.order[s.wall.head]); });
  rejectChange(state, s => { s.wall.tail = s.wall.head + 14; });
  assertState(state);
  assert.ok(state.wall.order.slice(0, state.wall.head).some(t => state.players[0].concealed.includes(t)), 'consumed wall positions are references, not duplicate ownership');
});

test('Phase, effective count, pending and replacement context agree', () => {
  const ready = fixture();
  rejectChange(ready, s => { s.phase = 'awaitDraw'; });
  rejectChange(ready, s => { s.phase = 'awaitRobKong'; });
  rejectChange(ready, s => { s.drawContext.lastTile = null; });
  const waiting = fixture({ phase: 'awaitDraw' });
  rejectChange(waiting, s => { s.drawContext.source = 'deal'; });
  rejectChange(waiting, s => { s.pending = { kind: 'discard' }; });
  const replacement = run(fixture({ phase: 'awaitDraw', head: 'f1', tail: '3m' }), 'engine', 'DRAW');
  assert.deepEqual(restore(serialize(replacement)), replacement);
  rejectChange(replacement, s => { s.drawContext.replacement = false; });
  rejectChange(replacement, s => { s.drawContext.source = 'claim'; });
});

test('Initial flower queue and later-round debt must account for every missing tile', () => {
  const deck = [...DECK];
  for (const [position, id] of [[0, 'f1#0'], [4, 'f2#0'], [143, 'f3#0']]) {
    const index = deck.indexOf(id); [deck[position], deck[index]] = [deck[index], deck[position]];
  }
  let state = run(createGame({ dealer: 0, deck, seed: 1 }), 'engine', 'DEAL');
  state = run(state, 'engine', 'REPLACE');
  assert.deepEqual(state.pending.queue, [1]); assert.deepEqual(state.pending.later, [0]);
  assert.deepEqual(restore(serialize(state)), state);
  rejectChange(state, s => { s.pending.later = []; });
  rejectChange(state, s => { s.pending.queue.push(1); });
  rejectChange(state, s => { s.pending.queue[0] = 4; });
  rejectChange(state, s => { s.pending.kind = 'robKong'; });
  rejectChange(state, s => { s.drawContext.source = 'normal'; });
});

test('Claim options and preserved answers reference the window, actor and owned tiles', () => {
  let state = discard(fixture({ hands: { 0: '5m', 2: '55m' } }), 0, '5m');
  const pon = state.pending.options[2].find(x => x.type === 'PON');
  assert.ok(pon);
  rejectChange(state, s => { s.pending.sourceSeat = 1; });
  rejectChange(state, s => { s.pending.tileId = s.players[0].concealed[0]; });
  rejectChange(state, s => { s.pending.options[2] = []; });
  rejectChange(state, s => { s.pending.options[2][0].windowId = 'stale'; });
  rejectChange(state, s => { s.pending.options[0] = [pon]; });
  rejectChange(state, s => { s.pending.responses[0] = { type: 'PASS', windowId: s.pending.windowId }; });
  rejectChange(state, s => { s.pending.options[2] = [{ ...pon, ownTiles: [pon.ownTiles[0], pon.ownTiles[0]] }]; });
  rejectChange(state, s => { s.pending.options[2] = [{ ...pon, ownTiles: s.players[0].concealed.slice(0, 2) }]; });
  state = run(state, 2, 'PASS');
  assert.equal(state.pending.responses[2].type, 'PASS');
  assert.equal(state.players[2].restrictions.passedPon.includes('5m'), false, 'restrictions wait for final arbitration');
  assert.deepEqual(restore(serialize(state)), state, 'answered options and response survive restoration');
});

test('Meld and claimed-discard references are validated without counting history twice', () => {
  const state = resolve(discard(fixture({ hands: { 0: '5m', 2: '55m' } }), 0, '5m'), { 2: 'PON' });
  assert.deepEqual(restore(serialize(state)), state);
  rejectChange(state, s => { s.players[2].melds[0].sourceEvent++; });
  rejectChange(state, s => { s.players[2].melds[0].fromSeat = 2; });
  rejectChange(state, s => { s.players[2].melds[0].kind = 'chi'; });
  rejectChange(state, s => { s.players[0].discardHistory.at(-1).claimedBy = null; });
  rejectChange(state, s => { s.players[0].discardHistory.at(-1).claimedBy = 1; });
  rejectChange(state, s => { s.openingContext.discards[0]--; });
});

test('Pending rob-kong tile stays in its original concealed hand until terminal settlement', () => {
  let state = run(fixture({ hands: { 0: '5m', 1: W02 }, melds: { 0: [{ tiles: '555m' }] } }), 0, 'KAN_ADDED');
  const fourth = state.pending.tileId;
  assert.ok(state.players[0].concealed.includes(fourth));
  assert.deepEqual(restore(serialize(state)), state);
  rejectChange(state, s => { s.players[0].melds[0].tiles.push(fourth); });
  rejectChange(state, s => { s.pending.meldId = 'missing'; });
  rejectChange(state, s => { s.pending.tileId = s.players[1].concealed[0]; });
  state = resolve(state, { 1: 'WIN' });
  assert.equal(state.settlement.externalTile, fourth);
  assert.equal(state.players[0].concealed.includes(fourth), false);
  assert.deepEqual(restore(serialize(state)), state);
  rejectChange(state, s => { s.players[0].concealed.push(fourth); });
  rejectChange(state, s => { s.settlement.externalTile = null; });
  rejectChange(state, s => { s.settlement.id += ':twice'; });
  rejectChange(state, s => { s.settlement.delta[1]++; });
  rejectChange(state, s => { s.settlement.score.tai++; });
  rejectChange(state, s => { s.settlement.score.items[0].id = ['S08']; });
  rejectChange(state, s => { s.settlement.score.decomposition.pair = '8z'; });
});

test('Every automatic and player transition through complete seeded hands can be saved and resumed', () => {
  const seen = new Set();
  for (const seed of [1, 19, 517]) {
    let state = createGame({ seed, matchId: `save-walk-${seed}` });
    let transitions = 0;
    while (state.phase !== 'handResult' && transitions++ < 1000) {
      seen.add(state.phase);
      const raw = serialize(state);
      assert.deepEqual(restore(raw), state);
      let actor = 'engine', intent = legalActions(state, actor)[0];
      if (!intent) {
        for (let seat = 0; seat < 4 && !intent; seat++) {
          const actions = legalActions(state, seat);
          intent = actions.find(a => a.type === 'PASS') ?? actions.filter(a => a.type === 'DISCARD').at(-1);
          if (intent) actor = seat;
        }
      }
      assert.ok(intent, `resumable path missing in ${state.phase}`);
      const expected = step(state, actor, intent), resumed = step(restore(raw), actor, intent);
      assert.deepEqual(resumed, expected); state = expected;
    }
    assert.equal(state.phase, 'handResult');
    assert.deepEqual(restore(serialize(state)), state);
    const next = run(restore(serialize(state)), 'engine', 'NEXT_HAND');
    assert.deepEqual(next.scores, state.scores, 'restore and next hand never repay settlement');
    assertState(next);
  }
  for (const phase of ['setup', 'initialFlowers', 'awaitDraw', 'awaitDiscard', 'awaitClaims', 'awaitReplacement']) assert.ok(seen.has(phase), phase);
});
