import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { createGame, getObservation, availableTiles } from '../dist/engine.js';
import { automaticAction, advance, encodeSession, decodeSession } from '../dist/session.js';
import { chooseAction } from '../dist/ai.js';

// Test-only play with the same fair policies as the game; seat 0 stands in for a human.
const riverCounts = session => session.game.players.map(p => p.discardHistory.filter(d => d.claimedBy === null).length);
let scenes;
for (let seed = 20261005; seed < 20261069 && !scenes; seed++) {
  let session = { schemaVersion: 1, game: createGame({ seed, matchId: `layout-${seed}` }), aiRandom: [17, 29, 43] };
  let humanRandom = 61, lateHand;
  for (let steps = 0; steps < 1500; steps++) {
    const game = session.game;
    if (!lateHand && game.phase === 'awaitDiscard' && game.turn === 0 && availableTiles(game) <= 20 && riverCounts(session).reduce((a, b) => a + b, 0) >= 40) {
      lateHand = decodeSession(encodeSession(session));
    }
    if (game.phase === 'handResult') {
      if (lateHand && game.settlement.winner !== null) {
        const next = advance(session, 'engine', { type: 'NEXT_HAND' }, game.version);
        assert.notEqual(next.game.phase, 'matchResult');
        assert.equal(next.game.handId, game.handId + 1);
        scenes = [{ name: 'lateHand', session: lateHand }, { name: 'lateHandResult', session: decodeSession(encodeSession(session)) }];
      }
      break;
    }
    let action = automaticAction(session);
    if (!action) {
      const observation = getObservation(game, 0);
      assert.ok(observation.legalActions.length, 'stopped without a human action');
      const decision = chooseAction(observation, observation.legalActions, humanRandom);
      humanRandom = decision.randomState;
      action = { actor: 0, intent: decision.intent };
    }
    session = advance(session, action.actor, action.intent, game.version, action.randomState);
  }
}
assert.ok(scenes, 'no dense hand found within the fixed search limit');
writeFileSync(new URL('../test/layout-fixtures.json', import.meta.url), JSON.stringify(scenes, null, 2) + '\n');
console.log(JSON.stringify(scenes.map(({ name, session }) => ({ name, matchId: session.game.matchId, handId: session.game.handId, available: availableTiles(session.game), rivers: riverCounts(session), source: session.game.settlement?.source ?? null })), null, 2));
