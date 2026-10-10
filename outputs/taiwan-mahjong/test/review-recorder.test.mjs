import test from 'node:test';
import assert from 'node:assert/strict';
import { createReviewRecorder } from '../dist/review-recorder.js';
import { REVIEW_KEY, decodeReviewArchive } from '../dist/review-store.js';
import { getObservation } from '../dist/engine.js';
import { fixture } from './fixtures.mjs';
const observation = getObservation(fixture(), 0);
const action = observation.legalActions.find(a => a.type === 'DISCARD');
const settle = () => new Promise(resolve => setImmediate(resolve));
const locks = { request: async (_name, _options, callback) => callback({}) };
const setup = (lock = locks, initial = null) => {
  let raw = initial, writes = 0;
  const storage = { getItem: () => raw, setItem: (key, value) => { assert.equal(key, REVIEW_KEY); writes++; raw = value; } };
  const recorder = createReviewRecorder(storage, () => {}, lock);
  return { recorder, raw: () => raw, writes: () => writes };
};

test('慢速保存連續收集決策，非共享參照且有界，依次成功不漏記', async () => {
  let release;
  const gate = new Promise(resolve => release = resolve);
  const app = setup({ request: async (_name, _options, callback) => { await gate; return callback({}); } });
  for (let i = 0; i < 22; i++) {
    const o = structuredClone(observation); o.version += i;
    app.recorder.record(o, action, 'TW16-CLASSIC-v1'); o.matchId = 'mutated';
  }
  assert.equal(app.recorder.status().pending, 20); assert.match(app.recorder.status().notice, /暫停收集/);
  release(); await settle();
  const records = decodeReviewArchive(app.raw()); assert.equal(records.length, 20);
  assert.ok(records.every(r => r.observation.matchId !== 'mutated'));
  assert.equal(app.recorder.status().pending, 0);
});

test('回呼顯示失敗不阻止保存；壞檔必須明確清除後才恢復', async () => {
  const app = setup(locks, '{broken');
  app.recorder.record(observation, action, 'TW16-CLASSIC-v1'); await settle();
  assert.equal(app.raw(), '{broken'); assert.equal(app.writes(), 0);
  await app.recorder.retry(); assert.equal(app.raw(), '{broken');
  await app.recorder.clear(); assert.equal(app.recorder.status().pending, 0);
  app.recorder.record(observation, action, 'TW16-CLASSIC-v1'); await settle();
  assert.equal(decodeReviewArchive(app.raw()).length, 1);
  let raw = null;
  const recorder = createReviewRecorder({ getItem: () => raw, setItem: (_k,v) => raw = v }, () => { throw Error('view failed'); }, locks);
  recorder.record(observation, action, 'TW16-CLASSIC-v1'); await settle();
  assert.equal(decodeReviewArchive(raw).length, 1);
});
