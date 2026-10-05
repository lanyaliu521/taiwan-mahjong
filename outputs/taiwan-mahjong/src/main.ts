import { getObservation, legalActions } from './engine.js';
import { createSession, automaticAction, advance, encodeSession, decodeSession } from './session.js';
import type { Session } from './session.js';
import { render } from './view.js';
import type { UICommand } from './view.js';

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
try {
  rawSave = localStorage.getItem(SAVE_KEY);
  if (rawSave !== null) {
    try { saved = decodeSession(rawSave); }
    catch { notice = '舊存檔無法讀取，已保留原資料。選擇開始新一將並確認後才會取代。'; }
  }
} catch { unreadableSave = true; notice = '目前無法讀取本機存檔；仍可開局，但關閉頁面可能無法續局。'; }

function persist(): void {
  if (!session) return;
  try {
    const text = encodeSession(session);
    localStorage.setItem(SAVE_KEY, text);
    rawSave = text;
    saved = session;
    notice = '';
  } catch { notice = '牌局可繼續，但這一步未能儲存。請保持頁面開啟，以免失去目前進度。'; }
}
function stopTimer(): void { clearTimeout(timer); timer = undefined; generation++; }
function needsAutomation(): boolean {
  if (!session || paused || failed || ['handResult', 'matchResult'].includes(session.game.phase)) return false;
  const game = session.game;
  return legalActions(game, 'engine').length > 0 || (!legalActions(game, 0).length && ([1, 2, 3] as const).some(s => legalActions(game, s).length));
}
function paint(): void {
  const screen = ++rendered;
  const game = session ? getObservation(session.game, 0) : null;
  if (selectedTile && !game?.self.concealed.includes(selectedTile)) selectedTile = null;
  let message = status;
  if (paused) message = '牌局已暫停，按繼續即可恢復。';
  else if (game?.legalActions.length) message = game.phase === 'awaitDiscard' ? '輪到你：雙擊同一張牌打出；鍵盤 Enter 或空白鍵也可出牌。' : '有可回應的牌，請選擇操作或按「過」。';
  const current = session?.game;
  render(root, {
    game, selectedTile, drawnTile: current?.turn === 0 && current.phase === 'awaitDiscard' ? current.drawContext.lastTile : null,
    busy: needsAutomation() || failed, paused, speed, status: message, notice, hasSave: saved !== null,
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
  if (event.key === null || event.key === SAVE_KEY && event.newValue !== rawSave) {
    stopTimer(); failed = true; saved = null; rawSave = event.newValue;
    notice = '另一個分頁已變更存檔。此頁已停止操作，請重新整理以使用最新進度。';
    paint();
  }
});
refresh();
