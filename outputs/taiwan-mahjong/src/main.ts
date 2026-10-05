import { getObservation, legalActions } from './engine.js';
import { createSession, automaticAction, advance, encodeSession, decodeSession } from './session.js';
import type { Session } from './session.js';
import { render } from './view.js';
import type { UICommand } from './view.js';
import { PRACTICE_KEY, createPractice, drawPractice, discardPractice, encodePractice, decodePractice } from './practice.js';
import type { Practice } from './practice.js';
import { renderPractice } from './practice-view.js';
import { showTutorial } from './tutorial-view.js';

const COACH_KEY = 'tw16:coach:v1';
let coachEnabled = true;
let coachNotice = '';
try { coachEnabled = localStorage.getItem(COACH_KEY) !== 'off'; } catch { /* Preference stays in memory when storage is unavailable. */ }

const SAVE_KEY = 'tw16:TW16-CLASSIC-v1:save';
const root = document.querySelector<HTMLElement>('#app')!;
let session: Session | null = null;
let saved: Session | null = null;
let rawSave: string | null = null;
let unreadableSave = false;
let selectedTile: string | null = null;
let paused = false;
let speed: 'normal' | 'fast' = 'normal';
let notice = '';
let status = '';
let failed = false;
let timer: ReturnType<typeof setTimeout> | undefined;
let generation = 0;
let rendered = 0;
let mode: 'game' | 'practice' = 'game';
let practice: Practice | null = null;
let practiceSaved: Practice | null = null;
let practiceRaw: string | null = null;
let practiceUnreadable = false;
let practiceNotice = '';
let practiceBlocked = false;
try {
  practiceRaw = localStorage.getItem(PRACTICE_KEY);
  if (practiceRaw !== null) {
    try { practiceSaved = decodePractice(practiceRaw); }
    catch { practiceNotice = '練習存檔無法讀取，原資料已保留；開始新題並確認後才會取代。'; }
  }
} catch { practiceUnreadable = true; practiceNotice = '目前無法讀取練習存檔；關閉頁面可能無法續練。'; }
try {
  rawSave = localStorage.getItem(SAVE_KEY);
  if (rawSave !== null) {
    try { saved = decodeSession(rawSave); }
    catch { notice = '舊存檔無法讀取，已保留原資料。選擇開始新一將並確認後才會取代。'; }
  }
} catch { unreadableSave = true; notice = '目前無法讀取本機存檔；仍可開局，但關閉頁面可能無法續局。'; }

function persist(): boolean {
  if (!session) return true;
  try {
    const text = encodeSession(session);
    localStorage.setItem(SAVE_KEY, text);
    rawSave = text;
    saved = session;
    notice = '';
    return true;
  } catch { notice = '牌局可繼續，但這一步未能儲存。請保持頁面開啟，以免失去目前進度。'; return false; }
}
function persistPractice(): boolean {
  if (!practice) return true;
  try {
    const text = encodePractice(practice);
    localStorage.setItem(PRACTICE_KEY, text); practiceRaw = text; practiceSaved = practice; practiceNotice = ''; return true;
  } catch { practiceNotice = '本次練習未能儲存；上次存檔已保留。請保持頁面開啟，以免失去目前進度。'; return false; }
}
function stopTimer(): void { clearTimeout(timer); timer = undefined; generation++; }
function needsAutomation(): boolean {
  if (mode !== 'game' || !session || paused || failed || ['handResult', 'matchResult'].includes(session.game.phase)) return false;
  const game = session.game;
  return legalActions(game, 'engine').length > 0 || (!legalActions(game, 0).length && ([1, 2, 3] as const).some(s => legalActions(game, s).length));
}
function paint(): void {
  const screen = ++rendered;
  if (mode === 'practice') {
    renderPractice(root, practice, practiceNotice, practiceSaved !== null, practiceBlocked, command => { if (screen === rendered) send(command); });
    return;
  }
  const game = session ? getObservation(session.game, 0) : null;
  if (selectedTile && !game?.self.concealed.includes(selectedTile)) selectedTile = null;
  let message = status;
  if (paused) message = '牌局已暫停，按繼續即可恢復。';
  else if (game?.legalActions.length) message = game.phase === 'awaitDiscard' ? '輪到你：Tab 選牌，雙擊打出；Enter 或空白鍵也可出牌。' : '有可回應的牌，請選擇操作或按「過」。';
  const current = session?.game;
  render(root, {
    game, selectedTile, drawnTile: current?.turn === 0 && current.phase === 'awaitDiscard' ? current.drawContext.lastTile : null,
    busy: needsAutomation() || failed, paused, speed, coachEnabled, coachNotice, status: message, notice, hasSave: saved !== null,
  }, command => { if (screen === rendered) send(command); });
}
function refresh(): void {
  stopTimer();
  paint();
  if (!needsAutomation()) return;
  const scheduled = generation;
  timer = setTimeout(() => {
    if (scheduled !== generation || !session || paused) return;
    try {
      const next = automaticAction(session);
      if (!next) return;
      session = advance(session, next.actor, next.intent, session.game.version, next.randomState);
      const labels: Record<string, string> = { DEAL: '正在發牌', REPLACE: '補牌', DRAW: '摸牌', DISCARD: '出牌', CHI: '吃', PON: '碰', KAN_OPEN: '明槓', KAN_ADDED: '加槓', KAN_CLOSED: '暗槓', WIN: '胡牌', PASS: '過', RESOLVE: '確認牌局' };
      status = `${next.actor === 'engine' ? '' : `電腦 ${next.actor}・`}${labels[next.intent.type] ?? ''}`;
      persist();
    } catch (error) {
      failed = true;
      notice = '牌局遇到問題，已停止自動操作並保留上一步存檔。可重新整理後選擇繼續牌局。';
      console.error('Game paused after a rejected transition:', error);
    }
    refresh();
  }, speed === 'fast' ? 80 : 420);
}
function start(): void {
  if ((session || rawSave !== null || unreadableSave) && !window.confirm('開始新一將會取代目前的本機存檔。確定重新開始？')) return;
  unreadableSave = false;
  session = createSession(); selectedTile = null; paused = false; failed = false; status = '準備開局';
  persist(); refresh();
}
function send(command: UICommand): void {
  if (command.type === 'tutorial') {
    if (mode === 'practice' ? !practiceBlocked && !persistPractice() : session && !failed && !persist()) { refresh(); return; }
    paused = true; stopTimer(); paint(); showTutorial(root); return;
  }
  if (command.type === 'coach-toggle') {
    coachEnabled = !coachEnabled; coachNotice = '';
    try { localStorage.setItem(COACH_KEY, coachEnabled ? 'on' : 'off'); }
    catch { coachNotice = '教練設定本次已套用，但無法保存；重新開啟可能恢復預設。'; }
    refresh(); return;
  }
  if (command.type === 'practice') {
    if (session && !failed && !persist()) { refresh(); return; }
    paused = true; stopTimer(); mode = 'practice'; paint(); return;
  }
  if (command.type === 'game') {
    if (!practiceBlocked && !persistPractice()) { paint(); return; }
    mode = 'game'; refresh(); return;
  }
  if (mode === 'practice') {
    if (command.type === 'practice-start' || command.type === 'practice-replay') {
      if (command.type === 'practice-replay' && (!practice || practiceBlocked)) return;
      if ((practice || practiceRaw !== null || practiceUnreadable) && !window.confirm(command.type === 'practice-replay' ? '同題重練會回到原始手牌和牌序，取代本題進度。確定？' : '新隨機題會取代練習存檔，對戰存檔不受影響。確定？')) return;
      practice = command.type === 'practice-replay' ? createPractice(practice!.seed) : createPractice();
      practiceBlocked = false; practiceUnreadable = false; persistPractice(); paint(); return;
    }
    if (practiceBlocked) return;
    if (command.type === 'practice-resume') { if (practiceSaved) { practice = decodePractice(encodePractice(practiceSaved)); paint(); } return; }
    if (!practice) return;
    try {
      if (command.type === 'practice-draw') practice = drawPractice(practice);
      else if (command.type === 'practice-discard') practice = discardPractice(practice, command.tileId);
      else return;
      persistPractice(); paint();
    } catch { practiceNotice = '這個操作已失效，請依目前的練習畫面選擇。'; paint(); }
    return;
  }
  if (command.type === 'start' || command.type === 'new') { start(); return; }
  if (command.type === 'resume') {
    if (saved) { session = decodeSession(encodeSession(saved)); paused = false; failed = false; selectedTile = null; status = '已恢復牌局'; refresh(); }
    return;
  }
  if (command.type === 'speed') { speed = command.value; refresh(); return; }
  if (command.type === 'pause') { paused = !paused; refresh(); return; }
  if (!session || paused || failed) return;
  if (command.type === 'select') {
    if (legalActions(session.game, 0).some(a => a.type === 'DISCARD' && a.tileId === command.tileId)) selectedTile = command.tileId;
    // Keep the clicked element alive for the second tap; the view updates selection locally.
    return;
  }
  try {
    if (command.type === 'next') {
      if (session.game.phase !== 'handResult') return;
      session = advance(session, 'engine', { type: 'NEXT_HAND' }, session.game.version);
    } else if (command.type === 'intent') {
      session = advance(session, 0, command.intent, command.version);
    }
    selectedTile = null; status = ''; persist(); refresh();
  } catch {
    notice = '牌局已更新，這個操作未套用。請依畫面重新選擇。'; refresh();
  }
}
// ponytail: one tab owns local play; stop a second tab rather than merging competing turn histories.
window.addEventListener('storage', event => {
  if (event.key === null || event.key === PRACTICE_KEY && event.newValue !== practiceRaw) {
    practiceBlocked = true; practiceSaved = null; practiceRaw = event.key === null ? null : event.newValue;
    practiceNotice = '另一個分頁已變更練習存檔，此頁已停止練習。請重新整理以使用最新進度。';
    if (mode === 'practice') paint();
  }
  if (event.key === null || event.key === SAVE_KEY && event.newValue !== rawSave) {
    stopTimer(); failed = true; saved = null; rawSave = event.key === null ? null : event.newValue;
    notice = '另一個分頁已變更存檔。此頁已停止操作，請重新整理以使用最新進度。';
    paint();
  }
});
refresh();
