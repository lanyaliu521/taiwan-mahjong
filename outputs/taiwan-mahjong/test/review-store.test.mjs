import test from 'node:test';
import assert from 'node:assert/strict';
import { captureDiscard, validateDiscardSnapshot, decodeReviewArchive, readReviewArchive, appendReview, clearReview, REVIEW_KEY, REVIEW_LIMITS } from '../dist/review-store.js';
import { getObservation } from '../dist/engine.js';
import { fixture } from './fixtures.mjs';
const rules = 'TW16-CLASSIC-v1';
const observation = () => getObservation(fixture(), 0);
const record = () => {
  const o = observation(); return captureDiscard(o, o.legalActions.find(a => a.type === 'DISCARD').tileId, rules);
};
const archive = s => JSON.stringify({ schemaVersion: 1, records: [s] });
function storage() {
  const data = new Map([['tw16:TW16-CLASSIC-v1:save', 'GAME'], ['tw16:practice:v1', 'PRACTICE']]);
  return { data, fail: false, getItem(k) { return data.get(k) ?? null; }, setItem(k, v) { if (this.fail) throw new Error('QUOTA'); data.set(k, v); } };
}

test('L2A1 白名單擷取、重新載入及無共享參照；不保存事後結算／其他家暗牌', () => {
  const o = observation(), chosen = o.legalActions.find(a => a.type === 'DISCARD').tileId;
  const before = structuredClone(o), a = captureDiscard(o, chosen, rules);
  assert.deepEqual(o, before);
  o.settlement = { secret: 'future' }; o.extra = { wall: 'secret' };
  assert.deepEqual(captureDiscard(o, chosen, rules), a);
  assert.deepEqual(decodeReviewArchive(archive(a)), [a]);
  assert.equal('players' in a, false); assert.equal('settlement' in a, false);
  a.concealed.pop(); assert.equal(o.self.concealed.length, 17);
});

test('L2A1 拒絕未知欄位／版本、壞牌權、超容量、非法選擇與禁捨矛盾', () => {
  const base = record();
  const mutations = [
    s => { s.wall = []; }, s => { s.schemaVersion = 2; }, s => { s.analyzerVersion = 'future'; },
    s => { s.rulesVersion = 'other'; }, s => { s.concealed[1] = s.concealed[0]; },
    s => { s.knownTiles = []; }, s => { s.knownTiles.push('1m#9'); },
    s => { s.chosenTileId = 'f1#0'; }, s => { s.legalTileIds.pop(); },
    s => { s.forbiddenKinds = [s.chosenTileId.slice(0, 2)]; },
    s => { s.opponentGroups[0].count = 6; }, s => { s.opponentGroups[0].secretHand = []; },
    s => { s.version = -1; }, s => { s.concealed.pop(); }, s => { s.matchId = 'x'.repeat(257); },
  ];
  for (const mutate of mutations) { const s = structuredClone(base); mutate(s); assert.throws(() => validateDiscardSnapshot(s), /INVALID_REVIEW_DATA/); }
  assert.throws(() => decodeReviewArchive('{'));
  assert.throws(() => decodeReviewArchive(' '.repeat(REVIEW_LIMITS.totalBytes + 1)));
  assert.throws(() => decodeReviewArchive(JSON.stringify({ schemaVersion: 1, records: [base, base] })));
});

test('L2A1 僅待捨牌與實際合法捨牌可擷取，錯桌規／洩漏暗槓拒絕', () => {
  const o = observation(), chosen = record().chosenTileId;
  assert.throws(() => captureDiscard(o, chosen, 'other'));
  assert.throws(() => captureDiscard({ ...o, phase: 'awaitClaims' }, chosen, rules));
  assert.throws(() => captureDiscard({ ...o, legalActions: [] }, chosen, rules));
  o.players[1].melds = [{ kind: 'concealedKong', tiles: ['1m#0'] }];
  assert.throws(() => captureDiscard(o, chosen, rules));
});

test('L2A1 重試冪等、同識別異選擇拒絕；20筆上限只移除最舊記錄', () => {
  const store = storage(), base = record(); let raw = null;
  for (let i = 0; i < 22; i++) raw = appendReview(store, raw, { ...base, version: i });
  const loaded = readReviewArchive(store);
  assert.equal(loaded.records.length, 20); assert.equal(loaded.records[0].version, 2);
  assert.equal(appendReview(store, raw, { ...base, version: 21 }), raw);
  const changed = { ...base, version: 21, chosenTileId: base.legalTileIds.find(t => t !== base.chosenTileId) };
  assert.throws(() => appendReview(store, raw, changed));
  assert.equal(store.getItem(REVIEW_KEY), raw);
});

test('L2A1 配額失敗保留舊檔；已知跨頁衝突拒寫及拒清，壞檔不自動重設', () => {
  const store = storage(), s = record(), raw = appendReview(store, null, s);
  store.fail = true;
  assert.throws(() => appendReview(store, raw, { ...s, version: s.version + 1 }), /QUOTA/);
  assert.equal(store.getItem(REVIEW_KEY), raw);
  assert.throws(() => clearReview(store, raw), /QUOTA/);
  assert.equal(store.getItem(REVIEW_KEY), raw);
  store.fail = false; store.data.set(REVIEW_KEY, '{bad');
  assert.throws(() => appendReview(store, raw, s), /REVIEW_CONFLICT/);
  assert.throws(() => clearReview(store, raw), /REVIEW_CONFLICT/);
  assert.throws(() => readReviewArchive(store));
  assert.throws(() => appendReview(store, '{bad', s));
  assert.equal(store.getItem(REVIEW_KEY), '{bad');
  clearReview(store, '{bad'); // Explicit caller-confirmed deletion is allowed even for a corrupt archive.
  assert.deepEqual(readReviewArchive(store).records, []);
  assert.equal(store.getItem('tw16:TW16-CLASSIC-v1:save'), 'GAME');
  assert.equal(store.getItem('tw16:practice:v1'), 'PRACTICE');
});

test('L2A1 合法暗槓只保留自家已知牌；錯誤面子及重複實體拒絕', () => {
  const o = getObservation(fixture({ hands: { 0: '123p456p789s11z23s' },
    melds: { 0: [{ kind: 'concealedKong', tiles: '1111m' }], 1: [{ kind: 'concealedKong', tiles: '2222m' }] } }), 0);
  // E17 requires fourteen concealed tiles for one declared group.
  const chosen = o.legalActions.find(a => a.type === 'DISCARD').tileId;
  const s = captureDiscard(o, chosen, rules);
  assert.ok(s.knownTiles.includes('1m#0'));
  assert.ok(!s.knownTiles.some(t => t.startsWith('2m')));
  const bad = structuredClone(s); bad.melds[0].tiles[1] = bad.melds[0].tiles[0];
  assert.throws(() => validateDiscardSnapshot(bad));
});
