import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as engine from '../dist/engine.js';
import * as sessions from '../dist/session.js';
import * as practices from '../dist/practice.js';

const key = 'tw16:TW16-CLASSIC-v1:save';
const initial = () => ({ schemaVersion: 1, game: engine.createGame({ seed: 17, dealer: 0, matchId: 'controller-review' }), aiRandom: [17, 29, 43] });
const compiled = ts.transpileModule(fs.readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;

// Exercise the actual controller with native Node mocks; no browser or test dependency is needed.
function controller(raw = null, confirm = true, faults = {}) {
  const storage = new Map(raw === null ? [] : [[key, raw]]), timers = new Map(), delays = new Map(), handlers = new Map();
  if (faults.coachRaw !== undefined) storage.set('tw16:coach:v1', faults.coachRaw);
  if (faults.practiceRaw !== undefined) storage.set(practices.PRACTICE_KEY, faults.practiceRaw);
  let send, view, timerId = 0, confirmations = 0, writes = 0, tutorialOpens = 0;
  vm.runInNewContext(compiled, {
    require(name) {
      if (name === './engine.js') return engine;
      if (name === './session.js') return sessions;
      if (name === './practice.js') return practices;
      if (name === './practice-view.js') return { renderPractice: (_root, practice, notice, hasSave, blocked, handler) => { view = { practice, notice, hasSave, blocked }; send = handler; } };
      if (name === './view.js') return { render: (_root, state, handler) => { view = state; send = handler; } };
      if (name === './tutorial-view.js') return { showTutorial: () => { tutorialOpens++; } };
      throw Error(name);
    },
    exports: {}, console, crypto, document: { querySelector: () => ({}) },
    window: { confirm: () => { confirmations++; return confirm; }, addEventListener: (name, handler) => handlers.set(name, handler) },
    localStorage: {
      getItem: k => { if (faults.read) throw faults.read; return storage.get(k) ?? null; },
      setItem: (k, v) => { writes++; if (faults.write || k === practices.PRACTICE_KEY && faults.practiceWrite) throw faults.write || faults.practiceWrite; storage.set(k, v); },
    },
    setTimeout: (callback, delay) => { const id = ++timerId; timers.set(id, callback); delays.set(id, delay); return id; },
    clearTimeout: id => { timers.delete(id); delays.delete(id); },
  });
  return {
    send: command => send(command), timers, delays,
    get view() { return view; }, get confirmations() { return confirmations; }, get uiSend() { return send; }, get writes() { return writes; }, get tutorialOpens() { return tutorialOpens; },
    tick() {
      assert.equal(timers.size, 1, '每次只能排入一個自動操作');
      const [id, callback] = timers.entries().next().value;
      timers.delete(id); delays.delete(id); callback();
    },
    raw: () => storage.get(key) ?? null,
    practiceRaw: () => storage.get(practices.PRACTICE_KEY) ?? null,
    remotePractice(raw) {
      if (raw === null) storage.delete(practices.PRACTICE_KEY); else storage.set(practices.PRACTICE_KEY, raw);
      handlers.get('storage')({ key: practices.PRACTICE_KEY, newValue: raw });
    },
    remote(raw, clear = false) {
      if (raw === null) storage.delete(key); else storage.set(key, raw);
      handlers.get('storage')({ key: clear ? null : key, newValue: raw });
    },
  };
}

test('他頁改存檔或清空後，首頁不可恢復舊快照或自動覆寫新進度', () => {
  const old = initial(), oldRaw = sessions.encodeSession(old);
  let latest = old;
  for (let n = 0; n < 3; n++) {
    const next = sessions.automaticAction(latest);
    latest = sessions.advance(latest, next.actor, next.intent, latest.game.version, next.randomState);
  }
  for (const newRaw of [sessions.encodeSession(latest), null]) {
    const app = controller(oldRaw);
    assert.equal(app.view.hasSave, true);
    app.remote(newRaw, newRaw === null);
    assert.equal(app.view.hasSave, false);
    app.send({ type: 'resume' });
    assert.equal(app.timers.size, 0);
    assert.equal(app.view.game, null);
    assert.equal(app.raw(), newRaw);
    assert.match(app.view.notice, /另一個分頁/);
  }
});

test('儲存被 SecurityError 禁用時仍可行牌，且顯示無法續存的提示', () => {
  const denied = new DOMException('Storage is disabled', 'SecurityError');
  const app = controller(null, true, { read: denied, write: denied });
  assert.match(app.view.notice, /無法讀取/);
  assert.equal(app.view.hasSave, false);
  app.send({ type: 'start' });
  assert.match(app.view.notice, /未能儲存/);
  const before = app.view.game.version;
  app.tick();
  assert.ok(app.view.game.version > before);
  assert.equal(app.raw(), null);
  assert.match(app.view.notice, /未能儲存/);
});

test('已有存檔但讀取遭 SecurityError 時，取消開始仍保留未知原資料', () => {
  const raw = sessions.encodeSession(initial());
  const app = controller(raw, false, { read: new DOMException('Storage read is disabled', 'SecurityError') });
  assert.match(app.view.notice, /無法讀取/);
  assert.equal(app.view.hasSave, false);
  app.send({ type: 'start' });
  assert.equal(app.confirmations, 1);
  assert.equal(app.raw(), raw);
  assert.equal(app.view.game, null);
  assert.equal(app.timers.size, 0);
});

test('QuotaExceededError 保留最後成功存檔，恢復寫入後保存最新進度並清除提示', () => {
  const raw = sessions.encodeSession(initial());
  const faults = { write: new DOMException('Storage is full', 'QuotaExceededError') };
  const app = controller(raw, true, faults);
  app.send({ type: 'resume' });
  app.tick();
  assert.equal(app.raw(), raw);
  assert.ok(app.view.game.version > initial().game.version);
  assert.match(app.view.notice, /未能儲存/);
  faults.write = null;
  app.tick();
  assert.equal(app.view.notice, '');
  assert.equal(sessions.decodeSession(app.raw()).game.version, app.view.game.version);
  assert.notEqual(app.raw(), raw);
});

for (const [label, raw] of [
  ['壞 JSON', '{broken'],
  ['未知版本', JSON.stringify({ ...initial(), schemaVersion: 99 })],
  ['空字串', ''],
]) test(`${label}存檔在取消新局後逐字保留`, () => {
  const app = controller(raw, false);
  assert.equal(app.view.hasSave, false);
  app.send({ type: 'start' });
  assert.equal(app.confirmations, 1);
  assert.equal(app.raw(), raw);
  assert.equal(app.view.game, null);
  assert.equal(app.timers.size, 0);
});

test('行牌中的另一頁更新存檔後，遲到計時器與舊 UI 不得覆寫最新進度', () => {
  const raw = sessions.encodeSession(initial()), app = controller(raw);
  app.send({ type: 'resume' });
  const late = [...app.timers.values()][0], oldSend = app.uiSend;
  const next = sessions.automaticAction(initial());
  const remote = sessions.encodeSession(sessions.advance(initial(), next.actor, next.intent, initial().game.version, next.randomState));
  app.remote(remote);
  late();
  oldSend({ type: 'resume' });
  app.send({ type: 'pause' });
  app.send({ type: 'pause' });
  app.send({ type: 'speed', value: 'fast' });
  assert.equal(app.raw(), remote);
  assert.equal(app.timers.size, 0);
  assert.match(app.view.notice, /另一個分頁/);
});

test('切換速度、暫停及繼續均使舊計時器失效，且只保留一個當前計時器', () => {
  const raw = sessions.encodeSession(initial()), app = controller(raw);
  app.send({ type: 'resume' });
  const normal = [...app.timers.values()][0];
  assert.deepEqual([...app.delays.values()], [420]);
  app.send({ type: 'speed', value: 'fast' });
  assert.deepEqual([...app.delays.values()], [80]);
  normal();
  assert.equal(app.raw(), raw);
  const fast = [...app.timers.values()][0];
  app.send({ type: 'pause' });
  fast();
  assert.equal(app.timers.size, 0);
  assert.equal(app.raw(), raw);
  app.send({ type: 'speed', value: 'normal' });
  assert.equal(app.timers.size, 0);
  app.send({ type: 'pause' });
  assert.deepEqual([...app.delays.values()], [420]);
  fast(); normal();
  assert.equal(app.raw(), raw);
  app.tick();
  assert.equal(sessions.decodeSession(app.raw()).game.version, initial().game.version + 1);
});

test('選牌不重繪或存檔，同畫面的連點提交只出牌一次', () => {
  let waiting = initial();
  for (let n = 0; n < 20 && !engine.legalActions(waiting.game, 0).length; n++) {
    const next = sessions.automaticAction(waiting);
    assert.ok(next);
    waiting = sessions.advance(waiting, next.actor, next.intent, waiting.game.version, next.randomState);
  }
  const [first, second] = engine.legalActions(waiting.game, 0).filter(action => action.type === 'DISCARD');
  assert.ok(first && second);
  const raw = sessions.encodeSession(waiting), app = controller(raw);
  app.send({ type: 'resume' });
  const sameScreen = app.uiSend, beforeView = app.view, beforeWrites = app.writes;
  for (const intent of [first, second]) {
    sameScreen({ type: 'select', tileId: intent.tileId });
    assert.equal(app.uiSend, sameScreen, '選牌必須保留原畫面的事件處理器');
    assert.equal(app.view, beforeView, '選牌只局部更新手牌，不重繪整個畫面');
    assert.equal(app.raw(), raw);
    assert.equal(app.writes, beforeWrites, '選牌不可寫入存檔');
    assert.equal(app.timers.size, 0, '等待真人期間不可新增自動操作');
  }
  const command = { type: 'intent', intent: second, version: waiting.game.version };
  sameScreen(command);
  const after = app.raw(), stored = sessions.decodeSession(after);
  assert.equal(stored.game.version, waiting.game.version + 1);
  assert.equal(stored.game.players[0].concealed.includes(second.tileId), false);
  sameScreen(command);
  assert.equal(app.raw(), after, '同畫面的重複確認不可再次出牌');
  assert.equal(app.writes, beforeWrites + 1, '同一次出牌只能保存一次');
});

test('暫停再繼續後舊畫面的出牌事件失效，當前畫面仍能正常出牌', () => {
  let waiting = initial();
  for (let n = 0; n < 20 && !engine.legalActions(waiting.game, 0).length; n++) {
    const next = sessions.automaticAction(waiting);
    assert.ok(next);
    waiting = sessions.advance(waiting, next.actor, next.intent, waiting.game.version, next.randomState);
  }
  const intent = engine.legalActions(waiting.game, 0).find(action => action.type === 'DISCARD');
  assert.ok(intent);
  const raw = sessions.encodeSession(waiting), app = controller(raw);
  app.send({ type: 'resume' });
  const oldSend = app.uiSend, command = { type: 'intent', intent, version: waiting.game.version };
  app.send({ type: 'pause' });
  oldSend(command);
  assert.equal(app.raw(), raw);
  app.send({ type: 'pause' });
  oldSend(command);
  assert.equal(app.raw(), raw, '舊畫面操作不得在繼續後重新生效');
  app.send(command);
  assert.equal(sessions.decodeSession(app.raw()).game.version, waiting.game.version + 1);
  const after = app.raw();
  app.send(command);
  assert.equal(app.raw(), after, '重複的舊版本操作不得再次出牌');
});

test('首頁原無存檔但別頁新建後，開始新一將仍須確認取代', () => {
  const app = controller(null, false), recent = sessions.encodeSession(initial());
  app.remote(recent);
  app.send({ type: 'start' });
  assert.equal(app.confirmations, 1);
  assert.equal(app.raw(), recent);
  assert.equal(app.timers.size, 0);
});

test('新一將與暫停使已排入的舊自動操作失效，不能多摸或串到新局', () => {
  const app = controller(sessions.encodeSession(initial()));
  app.send({ type: 'resume' });
  assert.equal(app.timers.size, 1);
  const oldCallback = [...app.timers.values()][0];
  app.send({ type: 'new' });
  assert.equal(app.confirmations, 1);
  const newRaw = app.raw();
  assert.notEqual(sessions.decodeSession(newRaw).game.matchId, initial().game.matchId);
  assert.equal(app.timers.size, 1);
  oldCallback();
  assert.equal(app.raw(), newRaw, '舊計時器不得推進新一將');
  const currentCallback = [...app.timers.values()][0];
  app.send({ type: 'pause' });
  assert.equal(app.timers.size, 0);
  currentCallback();
  assert.equal(app.raw(), newRaw, '暫停後的遲到回呼不得多摸');
});

test('切入練習停止對戰舊計時器；練習操作與返回不覆寫对戰存檔', () => {
  const raw = sessions.encodeSession(initial()), app = controller(raw);
  app.send({ type: 'resume' });
  const late = [...app.timers.values()][0];
  app.send({ type: 'practice' });
  assert.equal(app.timers.size, 0); late(); assert.equal(app.raw(), raw);
  app.send({ type: 'practice-start' });
  const first = app.view.practice;
  app.send({ type: 'practice-discard', tileId: first.hand[0] });
  assert.equal(app.view.practice.hand.length, 16);
  app.send({ type: 'practice-draw' });
  assert.equal(app.view.practice.hand.length, 17); assert.equal(app.raw(), raw);
  assert.equal(practices.decodePractice(app.practiceRaw()).pool.length, 118);
  app.send({ type: 'game' });
  assert.equal(app.view.paused, true); assert.equal(app.view.game.version, initial().game.version);
  assert.equal(app.timers.size, 0); app.send({ type: 'pause' }); assert.equal(app.timers.size, 1);
});

test('練習重載續練及同題重練保存種子；舊畫面重複動作失效', () => {
  const start = practices.createPractice(42), next = practices.discardPractice(start, start.hand[0]);
  const app = controller(null, true, { practiceRaw: practices.encodePractice(next) });
  app.send({ type: 'practice' }); assert.equal(app.view.hasSave, true);
  app.send({ type: 'practice-resume' }); assert.deepEqual(app.view.practice, next);
  const stale = app.uiSend;
  app.send({ type: 'practice-draw' }); const raw = app.practiceRaw(); stale({ type: 'practice-draw' });
  assert.equal(app.practiceRaw(), raw);
  app.send({ type: 'practice-replay' }); assert.deepEqual(app.view.practice, start);
  assert.equal(app.confirmations, 1); assert.equal(app.raw(), null);
});

for (const raw of ['{broken', '', JSON.stringify({ ...practices.createPractice(42), schemaVersion: 99 })]) test('練習壞檔取消換題後保持原文及對戰存檔', () => {
  const gameRaw = sessions.encodeSession(initial()), app = controller(gameRaw, false, { practiceRaw: raw });
  app.send({ type: 'practice' }); assert.equal(app.view.hasSave, false); assert.match(app.view.notice, /原資料已保留/);
  app.send({ type: 'practice-start' }); assert.equal(app.confirmations, 1);
  assert.equal(app.practiceRaw(), raw); assert.equal(app.raw(), gameRaw); assert.equal(app.view.practice, null);
});

test('練習儲存失敗保留上一份存檔並阻止離開；恢復寫入才可切換', () => {
  const p = practices.createPractice(42), raw = practices.encodePractice(p);
  const faults = { practiceRaw: raw, practiceWrite: new DOMException('full', 'QuotaExceededError') };
  const app = controller(null, true, faults); app.send({ type: 'practice' }); app.send({ type: 'practice-resume' });
  app.send({ type: 'practice-discard', tileId: p.hand[0] });
  assert.equal(app.practiceRaw(), raw); assert.equal(app.view.practice.hand.length, 16); assert.match(app.view.notice, /未能儲存/);
  app.send({ type: 'game' }); assert.ok(app.view.practice); assert.equal(app.practiceRaw(), raw);
  faults.practiceWrite = null; app.send({ type: 'game' }); assert.equal(app.view.game, null);
  assert.equal(practices.decodePractice(app.practiceRaw()).hand.length, 16);
});

test('練習跨分頁異動阻止旧畫面與當前操作覆寫，仍可返回對戰', () => {
  const p = practices.createPractice(42), raw = practices.encodePractice(p), app = controller(null, true, { practiceRaw: raw });
  app.send({ type: 'practice' }); app.send({ type: 'practice-resume' }); const stale = app.uiSend;
  const remote = practices.encodePractice(practices.discardPractice(p, p.hand[0])); app.remotePractice(remote);
  stale({ type: 'practice-discard', tileId: p.hand[1] }); app.send({ type: 'practice-discard', tileId: p.hand[1] });
  assert.equal(app.practiceRaw(), remote); assert.equal(app.view.blocked, true); assert.match(app.view.notice, /另一個分頁/);
  app.send({ type: 'game' }); assert.equal(app.view.game, null); assert.equal(app.practiceRaw(), remote);
});

test('對戰存檔寫入失敗時切入練習受阻，對戰狀態仍保留', () => {
  const raw = sessions.encodeSession(initial()), faults = {}, app = controller(raw, true, faults);
  app.send({ type: 'resume' }); faults.write = new DOMException('full', 'QuotaExceededError');
  app.send({ type: 'practice' }); assert.ok(app.view.game); assert.match(app.view.notice, /未能儲存/); assert.equal(app.raw(), raw);
});

test('教練開關保存獨立設定，不改牌局、不行牌，關閉可重載', () => {
  const raw = sessions.encodeSession(initial()), app = controller(raw);
  app.send({ type: 'resume' }); app.send({ type: 'pause' });
  const before = app.raw(), game = app.view.game;
  app.send({ type: 'coach-toggle' });
  assert.equal(app.view.coachEnabled, false); assert.equal(app.raw(), before);
  assert.deepEqual(app.view.game, game); assert.equal(app.timers.size, 0);
  assert.equal(controller(raw, true, { coachRaw: 'off' }).view.coachEnabled, false);
  assert.equal(controller(raw, true, { coachRaw: 'invalid' }).view.coachEnabled, true);
});

test('教練設定寫入失敗仍可切換，原牌局存檔不變且提示未保存', () => {
  const raw = sessions.encodeSession(initial()), app = controller(raw, true, { write: new DOMException('full', 'QuotaExceededError') });
  app.send({ type: 'coach-toggle' });
  assert.equal(app.view.coachEnabled, false); assert.match(app.view.coachNotice, /無法保存/);
  assert.equal(app.raw(), raw); assert.equal(app.timers.size, 0);
});

test('對戰教學暫停並取消舊計時器；逾期畫面與timer都不能再推進牌局', () => {
  const raw = sessions.encodeSession(initial()), app = controller(raw);
  app.send({ type: 'resume' });
  const game = app.view.game, before = app.raw(), oldTimer = [...app.timers.values()][0], stale = app.uiSend;
  app.send({ type: 'tutorial' });
  assert.equal(app.tutorialOpens, 1); assert.equal(app.view.paused, true); assert.equal(app.timers.size, 0);
  stale({ type: 'pause' }); oldTimer();
  assert.equal(app.view.paused, true); assert.equal(app.view.game.version, game.version); assert.equal(app.raw(), before);
});

test('練習教學不改手牌及練習存檔，舊畫面摸牌命令失效', () => {
  const p = practices.createPractice(42), raw = practices.encodePractice(p), app = controller(null, true, { practiceRaw: raw });
  app.send({ type: 'practice' }); app.send({ type: 'practice-resume' });
  const hand = [...app.view.practice.hand], before = app.practiceRaw(), stale = app.uiSend;
  app.send({ type: 'tutorial' });
  assert.equal(app.tutorialOpens, 1); assert.deepEqual(app.view.practice.hand, hand); assert.equal(app.practiceRaw(), before);
  stale({ type: 'practice-draw' });
  assert.deepEqual(app.view.practice.hand, hand); assert.equal(app.practiceRaw(), before);
});

test('教學前存檔寫入失敗時不開教學且牌局維持運行', () => {
  const raw = sessions.encodeSession(initial()), faults = {}, app = controller(raw, true, faults);
  app.send({ type: 'resume' }); faults.write = new DOMException('full', 'QuotaExceededError');
  app.send({ type: 'tutorial' });
  assert.equal(app.tutorialOpens, 0); assert.equal(app.view.paused, false); assert.equal(app.raw(), raw);
  assert.match(app.view.notice, /未能儲存/);
});

test('跨分頁競爭後仍可看教學，但不寫入或覆蓋他頁練習存檔', () => {
  const p = practices.createPractice(42), app = controller(null, true, { practiceRaw: practices.encodePractice(p) });
  app.send({ type: 'practice' }); app.send({ type: 'practice-resume' });
  const remote = practices.encodePractice(practices.discardPractice(p, p.hand[0])); app.remotePractice(remote);
  const writes = app.writes;
  app.send({ type: 'tutorial' });
  assert.equal(app.tutorialOpens, 1); assert.equal(app.view.blocked, true); assert.equal(app.practiceRaw(), remote);
  assert.equal(app.writes, writes);
});
