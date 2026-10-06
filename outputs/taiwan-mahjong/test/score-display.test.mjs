import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreLines } from '../dist/view.js';
import { fixture, run } from './fixtures.mjs';

const score = (hand, flowers = '') => run(fixture({ hands: { 0: hand }, flowers: { 0: flowers } }), 0, 'WIN').settlement.score;
const total = lines => lines.reduce((sum, item) => sum + item.tai, 0);

test('結算逐條列紅中發財與正花，只列實際得台且不改原分數', () => {
  const settled = score('123m456m789p555z666z77s', 'f1f5f2'), before = structuredClone(settled);
  const lines = scoreLines(settled);
  assert.equal(lines[0].reason, '門清一摸三');
  assert.ok(lines.some(i => i.reason === '門清一摸三' && i.tai === 3));
  assert.ok(lines.some(i => i.reason === '紅中' && i.tai === 1));
  assert.ok(lines.some(i => i.reason === '發財' && i.tai === 1));
  assert.ok(lines.some(i => i.reason === '2 花（正花）' && i.tai === 2));
  assert.ok(!lines.some(i => ['白板', '門清', '自摸'].includes(i.reason)));
  assert.equal(total(lines), settled.tai); assert.deepEqual(settled, before);
});

test('大三元取代三元後不重新列出紅中發財白板加台', () => {
  const settled = score('123m456m555z666z777z22s'), lines = scoreLines(settled);
  assert.ok(lines.some(i => i.reason === '大三元' && i.tai === 8));
  assert.ok(!lines.some(i => ['紅中', '發財', '白板'].includes(i.reason)));
  assert.equal(total(lines), settled.tai);
});

test('花槓取代同組正花，另一組正花仍列出；零台不新增項目', () => {
  const settled = score('123m456m789p555z666z77s', 'f1f2f3f4f5'), lines = scoreLines(settled);
  assert.ok(lines.some(i => i.reason === '花槓 1 組' && i.tai === 2));
  assert.ok(lines.some(i => i.reason === '1 花（正花）' && i.tai === 1));
  assert.equal(total(lines), settled.tai);
  assert.deepEqual(scoreLines({ tai: 0, items: [], excluded: [], decomposition: null }), []);
});
