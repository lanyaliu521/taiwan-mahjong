import test from 'node:test';
import assert from 'node:assert/strict';
import { DECK, KINDS, kindOf, isFlower } from '../dist/tiles.js';
import { createAnalyzer, exactPool, bestDiscards } from '../dist/analysis.js';
import { createPractice, discardPractice, drawPractice, encodePractice, decodePractice, restorePractice, practiceAnalysis, PRACTICE_KEY } from '../dist/practice.js';

const ordinary = DECK.filter(t => !isFlower(t));
const makeNonWinning = (from = 1) => {
  for (let seed = from; seed < from + 100; seed++) {
    const p = createPractice(seed);
    if (p.phase === 'discard') return p;
  }
  assert.fail('expected a non-winning initial seed');
};
const cloned = p => JSON.parse(JSON.stringify(p));

test('ordinary physical tiles and initial pool are unique and complete', () => {
  const p = createPractice(42);
  assert.equal(ordinary.length, 136);
  assert.equal(new Set(ordinary).size, 136);
  assert.equal(p.hand.length, 17);
  assert.equal(p.pool.length, 119);
  assert.equal(p.discards.length, 0);
  assert.ok([...p.hand, ...p.pool].every(t => !isFlower(t)));
  assert.equal(new Set([...p.hand, ...p.pool]).size, 136);
  assert.deepEqual([...p.hand, ...p.pool].sort(), ordinary.sort());
  assert.equal(PRACTICE_KEY, 'tw16:practice:v1');
});

test('fixed seeds replay exactly and seed validation rejects invalid values', () => {
  assert.deepEqual(createPractice(123456), createPractice(123456));
  for (const seed of [0, -1, 1.2, NaN, Infinity, 0x100000000, '2']) assert.throws(() => createPractice(seed));
});

test('discard moves a physical tile out of hand without returning it to pool; draw removes pool head', () => {
  const p = makeNonWinning();
  const tile = p.hand[0];
  const afterDiscard = discardPractice(p, tile);
  assert.equal(afterDiscard.phase, 'draw');
  assert.equal(afterDiscard.hand.length, 16);
  assert.equal(afterDiscard.pool.length, 119);
  assert.deepEqual(afterDiscard.discards, [tile]);
  assert.ok(!afterDiscard.pool.includes(tile));
  assert.equal(p.hand.length, 17, 'actions leave prior snapshots unchanged');
  const afterDraw = drawPractice(afterDiscard);
  assert.equal(afterDraw.hand.length, 17);
  assert.equal(afterDraw.pool.length, 118);
  assert.equal(afterDraw.drawnTile, afterDiscard.pool[0]);
  assert.deepEqual(afterDraw.pool, afterDiscard.pool.slice(1));
});

test('illegal actions and exhausted-pool draw are rejected', () => {
  const p = makeNonWinning();
  assert.throws(() => discardPractice(p, 'not-a-tile'));
  assert.throws(() => drawPractice(p));
  const d = discardPractice(p, p.hand[0]);
  assert.throws(() => discardPractice(d, p.hand[1]));
  assert.throws(() => drawPractice({ ...d, pool: [] }));
});

test('one complete practice run reaches a terminal phase without losing tile accounting', () => {
  let p = makeNonWinning(77);
  for (let guard = 0; guard < 240 && !['complete', 'exhausted'].includes(p.phase); guard++) {
    if (p.phase === 'discard') p = discardPractice(p, p.hand[0]);
    else p = drawPractice(p);
  }
  assert.ok(['complete', 'exhausted'].includes(p.phase));
  assert.equal(p.phase, 'exhausted');
  assert.equal(p.pool.length, 0);
  assert.deepEqual(decodePractice(encodePractice(p)), p);
  assert.equal(practiceAnalysis(p).current.probability, null);
  assert.equal(p.hand.length, p.phase === 'complete' ? 17 : 16);
  assert.equal(p.hand.length + p.pool.length + p.discards.length, 136);
  assert.equal(new Set([...p.hand, ...p.pool, ...p.discards]).size, 136);
});

test('shared efficiency choices complete a valid seed and the completed save cannot draw or discard', () => {
  let p = createPractice(42), steps = 0;
  while (!['complete', 'exhausted'].includes(p.phase)) {
    assert.ok(++steps < 241);
    if (p.phase === 'draw') p = drawPractice(p);
    else { const kind = practiceAnalysis(p).best[0].kind; p = discardPractice(p, p.hand.find(t => kindOf(t) === kind)); }
  }
  assert.equal(p.phase, 'complete');
  assert.equal(practiceAnalysis(p).current.shanten, -1);
  assert.deepEqual(decodePractice(encodePractice(p)), p);
  assert.throws(() => discardPractice(p, p.hand[0])); assert.throws(() => drawPractice(p));
});

test('encode/decode and restore agree at every reachable stage', () => {
  let p = makeNonWinning(200);
  const snapshots = [p];
  for (let i = 0; i < 8; i++) {
    p = discardPractice(p, p.hand[0]); snapshots.push(p);
    if (p.phase !== 'draw') break;
    p = drawPractice(p); snapshots.push(p);
  }
  for (const state of snapshots) {
    assert.deepEqual(restorePractice(cloned(state)), state);
    assert.deepEqual(decodePractice(encodePractice(state)), state);
  }
  assert.throws(() => decodePractice('{'));
});

test('restore rejects tampering, unknown versions, duplicate IDs, order changes, fifth copies, phases and logs', () => {
  const p = makeNonWinning(300);
  const valid = discardPractice(p, p.hand[0]);
  const invalid = [];
  invalid.push({ ...cloned(valid), schemaVersion: 2 });
  invalid.push({ ...cloned(valid), phase: 'complete' });
  invalid.push({ ...cloned(valid), hand: [valid.pool[0], ...valid.hand.slice(1)] });
  invalid.push({ ...cloned(valid), pool: [...valid.pool].reverse() });
  invalid.push({ ...cloned(valid), hand: [...valid.hand, valid.hand[0]] });
  invalid.push({ ...cloned(valid), hand: [...valid.hand.slice(0, 4), '1m#0', ...valid.hand.slice(5)] });
  invalid.push({ ...cloned(valid), discards: ['1m#0', '1m#0'] });
  invalid.push({ ...cloned(valid), discards: ['f1#0'] });
  invalid.push({ ...cloned(valid), discards: ['bogus'] });
  invalid.push({ ...cloned(valid), drawnTile: '1m#0' });
  for (const save of invalid) assert.throws(() => restorePractice(save));
  assert.throws(() => restorePractice(null));
  assert.throws(() => restorePractice({ ...cloned(valid), extra: true }));
  assert.throws(() => restorePractice({ ...cloned(valid), discards: Array(121).fill('1m#0') }));

  const drawn = drawPractice(valid);
  const reordered = cloned(drawn); reordered.pool.reverse();
  assert.throws(() => restorePractice(reordered));
  const duplicate = cloned(drawn); duplicate.hand[0] = duplicate.hand[1];
  assert.throws(() => restorePractice(duplicate));
  const fifth = cloned(drawn); fifth.hand = [...fifth.hand, ...Array(5).fill('1m#0')];
  assert.throws(() => restorePractice(fifth));
  const wrongPhase = cloned(drawn); wrongPhase.phase = 'exhausted';
  assert.throws(() => restorePractice(wrongPhase));
});

test('practice probability is hand-checkable and uses the shared exact analyzer', () => {
  const p = makeNonWinning(400);
  const result = practiceAnalysis(p);
  const direct = createAnalyzer(exactPool(p.pool));
  assert.deepEqual(result.current, direct.analyze(p.hand.map(kindOf)));
  assert.deepEqual(result.choices, direct.discards(p.hand.map(kindOf), [], p.hand.map(kindOf)));
  assert.deepEqual(result.best, bestDiscards(result.choices));
  const withoutOwned = new Set(p.hand.map(kindOf));
  for (const tile of result.current.effectiveTiles) assert.ok(!withoutOwned.has(tile.kind));
  assert.equal(result.current.total, 119);
  assert.equal(result.current.improving, result.current.effectiveTiles.reduce((n, t) => n + t.count, 0));
  assert.equal(result.current.probability, result.current.improving / 119);

  const afterDiscard = discardPractice(p, p.hand[0]);
  const feedback = practiceAnalysis(afterDiscard).feedback;
  assert.ok(feedback);
  assert.equal(feedback.chosen.kind, kindOf(p.hand[0]));
  const beforeHand = [...afterDiscard.hand.map(kindOf), kindOf(p.hand[0])];
  const beforeChoices = createAnalyzer(exactPool(afterDiscard.pool)).discards(beforeHand, [], beforeHand);
  assert.deepEqual(feedback.best, bestDiscards(beforeChoices));
  assert.deepEqual(feedback.chosen, beforeChoices.find(c => c.kind === kindOf(p.hand[0])));
});
