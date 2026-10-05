import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getObservation, legalActions, assertState } from '../dist/engine.js';
import { automaticAction, decodeSession, encodeSession } from '../dist/session.js';
import { kindOf } from '../dist/tiles.js';
import { resolve, effective } from './fixtures.mjs';
import { chiFixture, createChiFixtures } from './chi-fixtures.mjs';

const ownKinds = action => action.ownTiles.map(kindOf).sort().join(',');
const chiChoices = actions => actions.filter(a => a.type === 'CHI').map(ownKinds).sort();

for (const [suit, name] of [['m', '萬'], ['p', '筒'], ['s', '索']]) {
  test(`134${name} 遇上家打2：四席均提供13與34吃法，真人觀察及續局也保留兩組`, () => {
    const expected = [`1${suit},3${suit}`, `3${suit},4${suit}`];
    for (const seat of [0, 1, 2, 3]) {
      const state = chiFixture(suit, seat);
      assertState(state);
      assert.deepEqual(chiChoices(legalActions(state, seat)), expected);
      assert.deepEqual(chiChoices(getObservation(state, seat).legalActions), expected);
      const copy = decodeSession(encodeSession({ schemaVersion: 1, game: state, aiRandom: [17, 29, 43] }));
      assert.deepEqual(chiChoices(getObservation(copy.game, seat).legalActions), expected);
      if (seat === 0) assert.equal(automaticAction(copy), null, 'must wait for the human to choose');
    }
  });

  for (const ranks of [[1, 3], [3, 4]]) {
    test(`134${name} 的${ranks.join('+')}吃法可真正提交，且只禁打該吃法對應牌`, () => {
      const expected = ranks.map(rank => `${rank}${suit}`).join(',');
      const state = resolve(chiFixture(suit), { 0: a => a.type === 'CHI' && ownKinds(a) === expected });
      assert.equal(state.phase, 'awaitDiscard');
      assert.equal(state.turn, 0);
      assert.deepEqual(state.players[0].melds[0].tiles.map(kindOf).sort(), [...ranks, 2].sort().map(rank => `${rank}${suit}`));
      assert.deepEqual(state.players[0].restrictions.forbiddenDiscards, (ranks[0] === 1 ? [2] : [2, 5]).map(rank => `${rank}${suit}`));
      assert.ok(legalActions(state, 0).some(a => a.type === 'DISCARD' && kindOf(a.tileId) === `${ranks[0] === 1 ? 4 : 1}${suit}`));
      assert.equal(effective(state.players[0]), 17);
      assertState(state);
    });
  }
}

test('已凍結的回吃限制與尾三張限制仍排除兩種吃法', () => {
  for (const options of [{ restrictions: { 0: { lastDiscard: '2m' } } }, { available: 3 }]) {
    assert.deepEqual(chiChoices(legalActions(chiFixture('m', 0, options), 0)), []);
  }
});

test('瀏覽器吃牌驗收場景與可重建的合法快照一致', () => {
  const saved = JSON.parse(readFileSync(new URL('./chi-fixtures.json', import.meta.url), 'utf8'));
  assert.deepEqual(saved, createChiFixtures());
});
