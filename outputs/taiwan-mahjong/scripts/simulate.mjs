import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createGame, legalActions, applyAction, getObservation, assertState, serialize, restore } from '../dist/engine.js';
import { KINDS, kindOf } from '../dist/tiles.js';
import { winningTiles } from '../dist/hand.js';

export function seededRandom(seed) {
  let x = seed >>> 0 || 1;
  return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return (x >>> 0) / 4294967296; };
}

const index = new Map(KINDS.map((k, i) => [k, i]));
function handValue(tiles) {
  const original = Array(34).fill(0); tiles.forEach(t => original[index.get(kindOf(t))]++);
  let best = -Infinity;
  for (const tripletsFirst of [true, false]) {
    const counts = [...original]; let score = 0;
    const triplets = () => { for (let i = 0; i < 34; i++) if (counts[i] >= 3) { counts[i] -= 3; score += 12; } };
    if (tripletsFirst) triplets();
    for (let i = 0; i < 27; i++) if (i % 9 < 7) while (counts[i] && counts[i + 1] && counts[i + 2]) { counts[i]--; counts[i + 1]--; counts[i + 2]--; score += 12; }
    if (!tripletsFirst) triplets();
    let pairs = 0;
    for (let i = 0; i < 34; i++) if (counts[i] >= 2) { counts[i] -= 2; score += pairs++ ? 3.5 : 5; }
    for (const distance of [1, 2]) for (let i = 0; i < 27; i++) if (i % 9 + distance < 9 && counts[i] && counts[i + distance]) {
      counts[i]--; counts[i + distance]--; score += distance === 1 ? 3.3 : 2.8;
    }
    for (let i = 0; i < 27; i++) score += counts[i] * (4 - Math.abs(i % 9 - 4)) * 0.02;
    best = Math.max(best, score);
  }
  return best;
}

/** M1 smoke policy: its arguments are the complete information boundary. */
export function chooseAction(observation, actions, random) {
  const win = actions.find(a => a.type === 'WIN'); if (win) return win;
  const kong = actions.find(a => ['KAN_CLOSED', 'KAN_ADDED', 'KAN_OPEN'].includes(a.type));
  if (kong && random() < 0.8) return kong;
  const melds = actions.filter(a => a.type === 'PON' || a.type === 'CHI');
  if (melds.length && random() < 0.92) {
    return melds.map(a => ({ a, score: handValue(observation.self.concealed.filter(t => !a.ownTiles.includes(t))) })).sort((a, b) => b.score - a.score)[0].a;
  }
  const discards = actions.filter(a => a.type === 'DISCARD');
  if (discards.length) {
    const scored = discards.map(a => {
      const rest = observation.self.concealed.filter(t => t !== a.tileId);
      // ponytail: greedy local grouping is only a smoke driver; M2 should add an evaluated strategy separately.
      const waits = rest.length <= 7 ? winningTiles(rest.map(kindOf), observation.self.melds).length : 0;
      return { a, score: handValue(rest) + waits * 100 + random() * 0.001 };
    });
    return scored.sort((a, b) => b.score - a.score)[0].a;
  }
  return actions.find(a => a.type === 'PASS') ?? actions[0];
}

export function simulate({ hands = 1000, matches = 3, seed = 20261004, maxStepsPerHand = 1200, maxHandsPerMatch = 2000 } = {}) {
  const started = performance.now();
  const report = { seed, requestedHands: hands, requestedMatches: matches, hands: 0, matches: 0, steps: 0, wins: 0, draws: 0, sources: {}, actions: {}, roundWinds: {}, maxStreak: 0, maxStepsPerHand: 0, restoredSnapshots: 0, matchSummaries: [] };
  let s, trace = [], matchSeed = seed, stepsThisHand = 0;
  const strategies = [0, 1, 2, 3].map(seat => seededRandom((seed ^ Math.imul(seat + 1, 0x9e3779b9)) >>> 0));
  const startMatch = () => { s = createGame({ seed: matchSeed, matchId: `simulation-${matchSeed}` }); stepsThisHand = 0; trace = []; };
  try {
    startMatch();
    while (report.hands < hands || report.matches < matches) {
      if (s.handId > maxHandsPerMatch || stepsThisHand > maxStepsPerHand) throw new Error(`Simulation limit at hand ${s.handId}, step ${stepsThisHand}`);
      let actor = 'engine', actions = legalActions(s, actor), intent = actions[0];
      if (!intent) {
        for (let seat = 0; seat < 4; seat++) {
          actions = legalActions(s, seat); if (!actions.length) continue;
          actor = seat; const observation = getObservation(s, seat);
          const clone = structuredClone(observation), immutable = JSON.stringify(observation);
          intent = chooseAction(clone, structuredClone(actions), strategies[seat]);
          assert.equal(JSON.stringify(observation), immutable); break;
        }
      }
      assert.ok(intent, `dead end at ${s.phase}`);
      const a = { opId: `sim-${report.steps}`, matchId: s.matchId, handId: s.handId, version: s.version, actor, intent };
      trace.push(a);
      const prior = s, result = applyAction(s, a); assert.equal(result.ok, true, result.error);
      s = result.state; assertState(s); report.steps++; stepsThisHand++;
      report.actions[intent.type] = (report.actions[intent.type] ?? 0) + 1;
      // Resume during real waiting windows and terminal displays to catch lost responses and duplicate settlement.
      if (report.steps % 97 === 0 || s.phase === 'handResult') {
        const text = serialize(s), restored = restore(text); assert.deepEqual(restored, s); s = restored; report.restoredSnapshots++;
      }
      if (s.phase === 'handResult' && prior.phase !== 'handResult') {
        report.hands++; report[s.settlement.winner === null ? 'draws' : 'wins']++;
        report.sources[s.settlement.source] = (report.sources[s.settlement.source] ?? 0) + 1;
        report.roundWinds[s.roundWind] = (report.roundWinds[s.roundWind] ?? 0) + 1;
        report.maxStreak = Math.max(report.maxStreak, s.streak); report.maxStepsPerHand = Math.max(report.maxStepsPerHand, stepsThisHand);
        assert.equal(s.scores.reduce((a, b) => a + b, 0), 0);
        stepsThisHand = 0;
      }
      if (s.phase === 'matchResult') {
        report.matches++; report.matchSummaries.push({ seed: matchSeed, hands: s.handId, dealerAdvances: s.dealerAdvances, roundWind: s.roundWind, scores: s.scores });
        matchSeed = (matchSeed + 1) >>> 0 || 1; startMatch();
      }
    }
  } catch (error) {
    const directory = new URL('../../../work/taiwan-mahjong/', import.meta.url); mkdirSync(directory, { recursive: true });
    const path = new URL(`simulation-failure-${matchSeed}.json`, directory);
    writeFileSync(path, JSON.stringify({ seed, matchSeed, error: String(error), state: s, trace, report }, null, 2));
    throw new Error(`${error.message}; replay saved to ${fileURLToPath(path)}`, { cause: error });
  }
  report.elapsedMs = Math.round(performance.now() - started);
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const values = { hands: 1000, matches: 3, seed: 20261004 };
  for (let i = 2; i < process.argv.length; i += 2) {
    const name = process.argv[i].replace(/^--/, ''), value = Number(process.argv[i + 1]);
    if (!(name in values) || !Number.isSafeInteger(value) || value < 0 || name === 'seed' && (value < 1 || value > 0xffffffff)) throw new Error('Usage: node scripts/simulate.mjs [--hands N] [--matches N] [--seed uint32]');
    values[name] = value;
  }
  const report = simulate(values);
  writeFileSync(new URL('../SIMULATION.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
}
