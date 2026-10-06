import { writeFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGame } from '../dist/engine.js';
import { decodeSession, encodeSession } from '../dist/session.js';
import { DECK } from '../dist/tiles.js';
import { fixture, run, discard, resolve, W02 } from '../test/fixtures.mjs';

// Test-only snapshots; the production app does not import this file or expose a fixture loader.
export function createBrowserFixtures() {
  const deck = [...DECK];
  for (const [position, id] of [[0, 'f1#0'], [4, 'f2#0'], [143, 'f3#0'], [142, '9s#0']]) {
    const index = deck.indexOf(id);
    [deck[position], deck[index]] = [deck[index], deck[position]];
  }
  const initial = run(createGame({ deck, dealer: 0, seed: 20261004, matchId: 'm3-initial' }), 'engine', 'DEAL');
  const claims = discard(fixture({ turn: 3, hands: { 3: '2m', 0: W02, 1: W02 } }), 3, '2m');
  const robKong = run(fixture({ turn: 3, hands: { 3: '5m', 0: W02 }, melds: { 3: [{ tiles: '555m' }] } }), 3, 'KAN_ADDED');
  const handResult = resolve(discard(fixture({ dealer: 3, dealerAdvances: 15, turn: 3, hands: { 3: '2m', 0: W02 } }), 3, '2m'), { 0: 'WIN' });
  const games = {
    initialFlowers: initial,
    initialFlowersLater: run(initial, 'engine', 'REPLACE'),
    awaitReplacement: run(fixture({ phase: 'awaitDraw', head: 'f1', tail: '9m f2' }), 'engine', 'DRAW'),
    awaitDiscard: fixture(),
    awaitClaimsUnanswered: claims,
    awaitClaimsAnswered: run(claims, 0, 'PASS'),
    awaitRobKong: robKong,
    exhaustedWait: discard(fixture({ turn: 1, hands: { 0: '111m 222m 333p 444p 555s 1z', 1: '5s' }, restrictions: { 1: { lastDiscard: '1z' }, 2: { lastDiscard: '1z' }, 3: { lastDiscard: '1z' } } }), 1, '5s'),
    handResult,
    matchResult: run(handResult, 'engine', 'NEXT_HAND'),
    feedbackReady: fixture({ hands: { 0: '123m456m123p456p789s1z7z' } }),
    patternResult: run(fixture({ hands: { 0: '123m456m789p555z666z77s' }, flowers: { 0: 'f1f5f2' } }), 0, 'WIN'),
  };
  return Object.entries(games).map(([name, game]) => ({ name, session: decodeSession(encodeSession({ schemaVersion: 1, game, aiRandom: [17, 29, 43] })) }));
}

if (process.argv[1] && resolvePath(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const fixtures = createBrowserFixtures();
  writeFileSync(new URL('../test/browser-fixtures.json', import.meta.url), JSON.stringify(fixtures, null, 2) + '\n');
  console.log(`Saved ${fixtures.length} deterministic browser fixtures.`);
}
