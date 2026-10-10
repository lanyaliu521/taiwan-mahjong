import test from 'node:test';
import assert from 'node:assert/strict';
import { captureDiscard, appendReviewLocked, clearReviewLocked, readReviewArchive, REVIEW_KEY } from '../dist/review-store.js';
import { getObservation } from '../dist/engine.js';
import { fixture } from './fixtures.mjs';

function setup() {
  const o = getObservation(fixture(), 0), record = captureDiscard(o, o.self.concealed[0], 'TW16-CLASSIC-v1');
  let raw = null, writes = 0;
  const storage = { getItem(key) { assert.equal(key, REVIEW_KEY); return raw; }, setItem(key, value) { assert.equal(key, REVIEW_KEY); writes++; raw = value; } };
  let held = false;
  // Deterministic two-client scheduler. Real browser locks are checked separately.
  const locks = { async request(name, options, callback) {
    assert.equal(name, REVIEW_KEY); assert.deepEqual(options, { mode: 'exclusive', ifAvailable: true });
    if (held) return callback(null);
    held = true;
    try { await Promise.resolve(); return await callback({ name, mode: 'exclusive' }); }
    finally { held = false; }
  } };
  return { record, storage, locks, writes: () => writes };
}

test('互斥：兩個同時追加只能一個成功，失敗者重讀後可保留兩筆', async () => {
  const { record, storage, locks, writes } = setup();
  const next = { ...record, version: record.version + 1 };
  const result = await Promise.allSettled([appendReviewLocked(storage, null, record, locks), appendReviewLocked(storage, null, next, locks)]);
  assert.equal(result.filter(r => r.status === 'fulfilled').length, 1);
  assert.match(result.find(r => r.status === 'rejected').reason.message, /REVIEW_BUSY/);
  assert.equal(writes(), 1);
  const read = readReviewArchive(storage);
  const missing = read.records[0].version === record.version ? next : record;
  await appendReviewLocked(storage, read.raw, missing, locks);
  assert.equal(readReviewArchive(storage).records.length, 2);
});

test('同鎖清除／追加不能互相穿插；鎖內仍拒絕過期expectedRaw', async () => {
  const { record, storage, locks, writes } = setup();
  const raw = await appendReviewLocked(storage, null, record, locks);
  const results = await Promise.allSettled([clearReviewLocked(storage, raw, locks), appendReviewLocked(storage, raw, { ...record, version: record.version + 1 }, locks)]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(writes(), 2);
  await assert.rejects(appendReviewLocked(storage, raw, record, locks), /REVIEW_CONFLICT/);
  assert.equal(writes(), 2);
});

test('不支援／拒絕鎖時完全不寫，例外後鎖釋放，排隊期間來源變動不改捕獲資料', async () => {
  const { record, storage, locks, writes } = setup();
  await assert.rejects(appendReviewLocked(storage, null, record, null), /REVIEW_LOCK_UNAVAILABLE/);
  await assert.rejects(clearReviewLocked(storage, null, null), /REVIEW_LOCK_UNAVAILABLE/);
  const denied = { request() { throw new Error('LOCK_DENIED'); } };
  await assert.rejects(appendReviewLocked(storage, null, record, denied), /LOCK_DENIED/);
  assert.equal(writes(), 0);
  const originalVersion = record.version;
  const pending = appendReviewLocked(storage, null, record, locks);
  record.version++;
  await pending;
  assert.equal(readReviewArchive(storage).records[0].version, originalVersion);
  await assert.rejects(appendReviewLocked(storage, null, record, locks), /REVIEW_CONFLICT/);
  await clearReviewLocked(storage, readReviewArchive(storage).raw, locks);
  assert.deepEqual(readReviewArchive(storage).records, []);
});
