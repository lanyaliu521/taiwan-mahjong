import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { createGame, getObservation, assertState } from '../dist/engine.js';
import { automaticAction, advance, encodeSession, decodeSession } from '../dist/session.js';
import { chooseAction } from '../dist/ai.js';

// Four formal policies exercise complete matches; seat 0 stands in for human choices.
// The session controller still must stop and return control before every seat-0 choice.
const report = { seed: 20261005, matches: 0, hands: 0, steps: 0, humanChoices: 0, restores: 0, phases: {}, sources: {}, maxDecisionMs: 0, elapsedMs: 0 };
const started = performance.now();
for (let match = 0; match < 3; match++) {
  let session = { schemaVersion: 1, game: createGame({ seed: report.seed + match, matchId: `m3-${match}` }), aiRandom: [17, 29, 43] };
  let humanRandom = 61;
  let handSteps = 0;
  while (session.game.phase !== 'matchResult') {
    assert.ok(++handSteps < 1500 && session.game.handId < 2000, 'stalled match');
    report.phases[session.game.phase] = (report.phases[session.game.phase] ?? 0) + 1;
    if (report.steps % 37 === 0 || session.game.phase === 'handResult') {
      const restored = decodeSession(encodeSession(session));
      assert.deepEqual(restored, session);
      assert.deepEqual(automaticAction(restored), automaticAction(session));
      session = restored; report.restores++;
    }
    const decisionStart = performance.now();
    let action = automaticAction(session);
    if (session.game.phase === 'handResult') {
      assert.equal(action, null);
      report.hands++; handSteps = 0;
      const result = session.game.settlement;
      report.sources[result.source] = (report.sources[result.source] ?? 0) + 1;
      assert.equal(session.game.scores.reduce((a, b) => a + b, 0), 0);
      action = { actor: 'engine', intent: { type: 'NEXT_HAND' } };
    } else if (!action) {
      const observation = getObservation(session.game, 0);
      assert.ok(observation.legalActions.length, 'controller stopped without a human choice');
      const chosen = chooseAction(observation, observation.legalActions, humanRandom);
      humanRandom = chosen.randomState;
      action = { actor: 0, intent: chosen.intent }; report.humanChoices++;
    }
    report.maxDecisionMs = Math.max(report.maxDecisionMs, performance.now() - decisionStart);
    session = advance(session, action.actor, action.intent, session.game.version, action.randomState);
    assertState(session.game); report.steps++;
  }
  assert.equal(session.game.dealerAdvances, 16);
  assert.equal(automaticAction(session), null);
  assert.deepEqual(decodeSession(encodeSession(session)), session);
  report.matches++;
}
report.elapsedMs = Math.round(performance.now() - started);
report.maxDecisionMs = Math.round(report.maxDecisionMs * 100) / 100;
writeFileSync(new URL('../M3-SIMULATION.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
