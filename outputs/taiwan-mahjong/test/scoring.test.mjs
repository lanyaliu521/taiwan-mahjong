import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decompose, isWinningHand, winningTiles } from '../dist/hand.js';
import { evaluateHand, settlePayments } from '../dist/scoring.js';

const cases = JSON.parse(readFileSync(new URL('../../taiwan-mahjong-m0/cases.json', import.meta.url), 'utf8'));
const tiles = text => text.split(' ').flatMap(group => [...group.slice(0, -1)].map(n => n + group.at(-1)));
const meld = (kind, text) => ({ meldId: text, kind, tiles: tiles(text), fromSeat: kind === 'concealedKong' ? null : 0, sourceEvent: 1 });
const input = (text, winningTile, overrides = {}) => ({ concealed: tiles(text), melds: [], flowers: [], winningTile, source: 'ron', seatWind: '2z', roundWind: '1z', ...overrides });
const baseText = '123m 456m 234p 345s 789s 11z';
const base = input(baseText, '1z');
const opened = input('456m 234p 345s 789s 11z', '6m', { melds: [meld('chi', '123m')] });
const flat = input('234m 456p 234p 345s 789s 55m', '2m');
const dark3 = input('111m 444m 222p 345s 789s 33z', '3z');
const dark4 = input('111m 444m 222p 555p 789s 33z', '3z');
const dark5 = input('111m 444m 222p 555p 777s 33z', '3z');
const smallDragons = input('123m 456m 234p 555z 666z 77z', '7z');
const largeDragons = input('123m 456m 555z 666z 777z 22p', '2p');
const smallWinds = input('111z 222z 333z 123m 456p 44z', '4z');
const largeWinds = input('111z 222z 333z 444z 123m 55p', '5p');
const allHonors = input('111z 222z 333z 555z 666z 77z', '7z');
const fullyOpen = { ...base, concealed: ['2z', '2z'], winningTile: '2z', melds: cases.handCases.find(c => c.id === 'H08').melds };
const score = value => { const result = evaluateHand(value); assert.ok(result, 'expected a structurally winning hand'); return result; };
const item = (value, id) => score(value).items.find(i => i.id === id);

for (const c of cases.handCases) test(`${c.id}: ${c.name}`, () => {
  assert.equal(isWinningHand(c.concealed, c.melds), c.expectedWin);
  if (c.expectedDecompositionsAtLeast) assert.ok(decompose(c.concealed, c.melds).length >= c.expectedDecompositionsAtLeast);
  if (c.expectedWin) for (const d of decompose(c.concealed, c.melds)) assert.equal(d.groups.length, 5);
});
for (const c of cases.waitCases) test(`${c.id}: ${c.name}`, () => {
  assert.deepEqual(winningTiles(c.concealed, c.melds), c.expectedWaits);
  for (const winningTile of c.expectedWaits) {
    const result = evaluateHand({ ...base, concealed: [...c.concealed, winningTile], melds: c.melds, winningTile });
    assert.equal(result.items.some(i => i.id === 'S07'), ['W01', 'W03', 'W04'].includes(c.id));
  }
});
for (const c of cases.paymentCases) test(`${c.id}: ${c.name}`, () => {
  const delta = settlePayments(c.winner, c.payers, c.baseTai, c.dealer, c.streak);
  assert.deepEqual(delta, c.expectedDelta);
  assert.equal(delta.reduce((a, b) => a + b, 0), 0);
  for (const payer of c.payers) assert.equal(-delta[payer], c.expectedTransfers[payer]);
});

// Independent concrete positive/negative hands for every normal-hand scoring ID.
// S24/S25 need a table-wide flower event; engine tests own their trigger coverage.
const coverage = {
  S01: [{ ...opened, source: 'selfDraw' }, opened, 1],
  S02: [base, opened, 1],
  S03: [input('123m 456m 234p 345s 555z 22z', '2z'), input('123m 456m 234p 345s 789s 55z', '5z'), 1],
  S04: [input('123m 456m 234p 345s 111z 22z', '2z'), input('123m 456m 234p 345s 222z 11z', '1z'), 1],
  S05: [input('123m 456m 234p 345s 222z 11z', '1z'), input('123m 456m 234p 345s 111z 22z', '2z'), 1],
  S06: [{ ...base, flowers: ['f2'] }, { ...base, flowers: ['f1'] }, 1],
  S07: [base, flat, 1],
  S08: [{ ...base, source: 'robKong' }, base, 1],
  S09: [{ ...opened, source: 'selfDraw', afterReplacement: true }, { ...opened, source: 'selfDraw' }, 1],
  S10: [{ ...opened, source: 'selfDraw', lastAvailable: true }, { ...opened, lastAvailable: true }, 1],
  S11: [{ ...base, flowers: ['f1', 'f2', 'f3', 'f4'] }, { ...base, flowers: ['f1', 'f2', 'f3'] }, 2],
  S12: [fullyOpen, { ...fullyOpen, melds: [...fullyOpen.melds.slice(0, 4), meld('concealedKong', '1111z')] }, 2],
  S13: [flat, { ...flat, source: 'selfDraw' }, 2],
  S14: [dark3, { ...dark3, winningTile: '2p' }, 2],
  S15: [{ ...base, source: 'selfDraw' }, base, 3],
  S16: [dark5, dark4, 4],
  S17: [input('123m 456m 789m 111z 555z 22m', '2m'), base, 4],
  S18: [smallDragons, largeDragons, 4],
  S19: [dark4, dark3, 5],
  S20: [dark5, { ...dark5, winningTile: '7s' }, 8],
  S21: [input('123m 123m 456m 456m 789m 99m', '9m'), base, 8],
  S22: [smallWinds, largeWinds, 8],
  S23: [largeDragons, smallDragons, 8],
  S26: [allHonors, base, 16],
  S27: [largeWinds, smallWinds, 16],
  S28: [{ ...base, human: true }, { ...base, human: false }, 16],
  S29: [{ ...base, source: 'selfDraw', earthly: true }, { ...base, source: 'selfDraw', earthly: false }, 16],
  S30: [{ ...base, source: 'selfDraw', seatWind: '1z', heavenly: true }, { ...base, source: 'selfDraw', heavenly: false }, 16],
};
for (const [id, [positive, negative, tai]] of Object.entries(coverage)) test(`${id}: concrete positive and negative scoring`, () => {
  assert.equal(item(positive, id)?.tai, tai, `${id} positive`);
  assert.equal(item(negative, id), undefined, `${id} negative`);
});
test('Coverage includes every M0 normal score ID; payment and flower IDs have dedicated suites', () => {
  assert.deepEqual(Object.keys(coverage), cases.scoreCoverage.map(c => c.scoreId).filter(id => !['S24', 'S25', 'S31', 'S32'].includes(id)));
});

test('R15 picks the best complete decomposition, not a union of decompositions', () => {
  const result = score(input('111m 222m 333m 456p 789s 55z', '5z'));
  assert.equal(result.tai, 4); // 門清1＋獨聽1＋三暗刻2; three 123m sequences score less.
  assert.equal(result.decomposition.groups.filter(g => g.kind === 'triplet').length, 3);
  assert.equal(result.items.some(i => i.id === 'S13'), false);
});
test('R15 enumerates winning-tile assignments within a single decomposition', () => {
  const result = score(input('111m 123m 444p 777s 999s 22z', '1m'));
  assert.equal(result.tai, 6); // Assign 1m to 123m: 門清1＋四暗刻5, not a ron-completed 111m.
  assert.equal(result.items.find(i => i.id === 'S19')?.tai, 5);
  assert.equal(result.items.some(i => i.id === 'S14'), false);
});
test('S07 never awards a lone structural shanpon wait', () => {
  const prior = tiles('789s 789s 111m 444m 77s 33z');
  assert.deepEqual(winningTiles(prior), ['3z']);
  assert.equal(item({ ...base, concealed: [...prior, '3z'], winningTile: '3z' }, 'S07'), undefined);
});
test('S13 rejects flowers, honor pairs, triplets, closed waits, robbing, and a multiwait pair assignment', () => {
  for (const value of [
    { ...flat, flowers: ['f1'] }, base, dark3, { ...flat, source: 'robKong' },
    input('456m 456p 234p 345s 789s 22m', '5m'),
    input('123m 456m 789m 234p 678s 55p', '5p'),
  ]) assert.equal(item(value, 'S13'), undefined);
  assert.deepEqual(winningTiles(tiles('123m 456m 789m 234p 678s 5p')), ['2p', '5p']);
});
test('S12 permits single wait and robbing, but neither self-draw nor a concealed kong', () => {
  assert.equal(score(fullyOpen).tai, 4); // 圈風1＋全求人2＋獨聽1.
  assert.equal(item(fullyOpen, 'S07')?.tai, 1);
  assert.equal(item({ ...fullyOpen, source: 'robKong' }, 'S12')?.tai, 2);
  assert.equal(item({ ...fullyOpen, source: 'selfDraw' }, 'S12'), undefined);
});
test('Concealed kongs preserve closed status and count as concealed triplets', () => {
  const value = input('444m 222p 345s 789s 33z', '3z', { melds: [meld('concealedKong', '1111m')] });
  assert.equal(item(value, 'S02')?.tai, 1);
  assert.equal(item(value, 'S14')?.tai, 2);
  assert.equal(item({ ...value, source: 'selfDraw' }, 'S15')?.tai, 3);
  for (const kind of ['pon', 'exposedKong', 'addedKong']) {
    const openedValue = { ...value, melds: [meld(kind, kind === 'pon' ? '111m' : '1111m')] };
    assert.equal(item(openedValue, 'S02'), undefined);
    assert.equal(item(openedValue, 'S14'), undefined);
  }
});
test('Five concealed triplets can stack with all triplets; discard-completed triplet reduces to four', () => {
  assert.equal(score(dark5).tai, 14); // 門清1＋獨聽1＋碰碰4＋五暗8.
  assert.equal(item(dark5, 'S16')?.tai, 4);
  assert.equal(item(dark5, 'S14'), undefined);
  assert.equal(item(dark5, 'S19'), undefined);
  assert.equal(item({ ...dark5, winningTile: '7s' }, 'S19')?.tai, 5);
  assert.equal(item({ ...dark5, winningTile: '7s', source: 'selfDraw' }, 'S20')?.tai, 8);
});
test('Dragon, wind and suit higher awards remove only their specified lower awards', () => {
  for (const value of [smallDragons, largeDragons]) assert.equal(item(value, 'S03'), undefined);
  for (const value of [smallWinds, largeWinds]) {
    assert.equal(item(value, 'S04'), undefined);
    assert.equal(item(value, 'S05'), undefined);
  }
  assert.equal(item(allHonors, 'S16'), undefined);
  assert.equal(item(allHonors, 'S18')?.tai, 4);
  assert.equal(item(input('111z 222z 333z 555z 666z 44z', '4z'), 'S22')?.tai, 8);
  assert.equal(item(allHonors, 'S17'), undefined);
  assert.equal(item(coverage.S21[0], 'S17'), undefined);
  const doubleWind = input('123m 456m 234p 345s 222z 11z', '1z', { roundWind: '2z' });
  assert.equal(item(doubleWind, 'S04')?.tai, 1);
  assert.equal(item(doubleWind, 'S05')?.tai, 1);
});
test('Flower sets replace only their own proper flower and normalize physical IDs', () => {
  const value = { ...base, flowers: ['f1#0', 'f2#0', 'f3#0', 'f4#0', 'f6#0'] };
  assert.equal(item(value, 'S11')?.tai, 2);
  assert.equal(item(value, 'S06')?.tai, 1);
  assert.equal(item({ ...base, flowers: ['f2', 'f6'] }, 'S06')?.tai, 2);
  assert.equal(item({ ...base, flowers: ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8'] }, 'S11')?.tai, 4);
});
test('Opening and self-draw mutual exclusions follow the frozen table', () => {
  const self = { ...base, source: 'selfDraw', afterReplacement: true, lastAvailable: true };
  assert.deepEqual(score(self).items.map(i => i.id), ['S07', 'S09', 'S10', 'S15']);
  assert.deepEqual(score({ ...self, earthly: true }).items.map(i => i.id), ['S07', 'S09', 'S10', 'S29']);
  const heaven = score({ ...base, source: 'selfDraw', heavenly: true, afterReplacement: true, winningTile: null });
  assert.deepEqual(heaven.items.map(i => i.id), ['S30']);
  assert.deepEqual(score({ ...base, human: true }).items.map(i => i.id), ['S07', 'S28']);
  assert.equal(item({ ...base, source: 'selfDraw', human: true }, 'S28'), undefined);
  assert.equal(item({ ...base, earthly: true }, 'S29'), undefined);
  const kong = input('456m 234p 345s 789s 11z', '1z', { melds: [meld('concealedKong', '1111m')], source: 'selfDraw', heavenly: true });
  assert.equal(item(kong, 'S30'), undefined);
});
test('Zero tai is a valid open ron, with the fixed base payment', () => {
  assert.equal(score(opened).tai, 0);
  assert.deepEqual(settlePayments(1, [2], 0, 0, 99), [0, 30, -30, 0]);
});
test('Invalid structures, excess copies and malformed melds cannot win', () => {
  assert.deepEqual(winningTiles(tiles('1111m 234p 456p 789s 123s')), []);
  for (const value of [
    input('111m 11m 234p 456p 789s 123s', '1m'),
    { ...base, concealed: [...base.concealed.slice(1), 'f1'] },
    { ...opened, melds: [meld('chi', '123z')] },
    { ...opened, melds: [meld('chi', '891m')] },
    { ...opened, melds: [meld('pon', '1111m')] },
    { ...opened, melds: [meld('concealedKong', '111m')] },
  ]) assert.equal(evaluateHand(value), null);
  assert.deepEqual(winningTiles(base.concealed), []);
});
test('Scoring validates flower identities, winds and winning-tile membership', () => {
  for (const value of [
    { ...base, flowers: ['f1', 'f1#0'] }, { ...base, flowers: ['f9'] }, { ...base, flowers: ['1m'] },
    { ...base, seatWind: '5z' }, { ...base, roundWind: '1m' }, { ...base, winningTile: '9m' },
    { ...base, winningTile: null },
  ]) assert.equal(evaluateHand(value), null);
});
test('Payments reject duplicate/winning payers, invalid seats, negative tai and unsafe totals', () => {
  for (const args of [[1, [2, 2], 0, 0, 0], [1, [1], 0, 0, 0], [4, [2], 0, 0, 0],
    [1, [4], 0, 0, 0], [1, [], 0, 0, 0], [1, [2], -1, 0, 0], [1, [2], 0, 0, -1], [1, [0], 0, 0, Number.MAX_SAFE_INTEGER]]) {
    assert.throws(() => settlePayments(...args), /INVALID_PAYMENT/);
  }
});
test('Evaluation is deterministic and does not mutate the source hand', () => {
  const original = structuredClone(coverage.S21[0]);
  const snapshot = JSON.stringify(original);
  const first = evaluateHand(original);
  assert.deepEqual(evaluateHand(original), first);
  assert.equal(JSON.stringify(original), snapshot);
  assert.ok(isWinningHand(base.concealed.map((kind, i) => `${kind}#${i % 4}`)));
});
