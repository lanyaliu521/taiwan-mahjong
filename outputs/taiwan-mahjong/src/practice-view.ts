import type { Practice } from './practice.js';
import { practiceAnalysis } from './practice.js';
import type { Analysis, DiscardAnalysis } from './analysis.js';
import { compareAnalysis } from './analysis.js';
import { kindOf } from './tiles.js';
import { node, button, tile, tileName } from './view.js';
import type { UICommand } from './view.js';

const distance = (a: Analysis) => a.shanten < 0 ? '牌型已完成' : a.shanten === 0 ? '牌型聽牌' : `至少再 ${a.shanten} 次有效改善可聽牌`;
function stats(a: Analysis): HTMLElement {
  const block = node('div', 'practice-stats');
  block.append(node('h3', '', distance(a)));
  block.append(node('p', '', a.shanten < 0 ? '本題已達成五面子一對將，練習不計台。' : a.probability === null ? '牌池已用完' : `下一張改善機率：${a.improving}／${a.total}＝${(a.probability * 100).toFixed(1)}%`));
  const list = node('div', 'practice-effective');
  list.setAttribute('aria-label', '有效進張與剩餘張數');
  for (const t of a.effectiveTiles) {
    const item = node('span', 'practice-effective-item'); item.append(tile(t.kind, 'tile-small'), node('span', '', `${t.count}張`)); list.append(item);
  }
  block.append(list);
  if (a.effectiveTiles.length && !a.improving && a.total) block.append(node('p', 'action-note', '結構有效牌已全部離開牌池；目前這條進牌路徑已無可用張。'));
  const e = a.example;
  if (e) {
    const detail = node('details', 'practice-detail'); detail.dataset.persist = 'shape';
    detail.append(node('summary', '', `一種拆法：面子 ${e.completed.length}／5、搭子 ${e.partials.length}、將牌${e.pair.length ? '已備' : '未備'}`));
    for (const [label, groups] of [['面子', e.completed], ['搭子', e.partials], ['將牌', e.pair.length ? [e.pair] : []], ['單張', e.singles.map(k => [k])]] as const) {
      const row = node('div', 'practice-shape'); row.append(node('span', '', label));
      for (const group of groups) { const cards = node('span', 'meld-tiles'); group.forEach(k => cards.append(tile(k, 'tile-small'))); row.append(cards); }
      detail.append(row);
    }
    detail.append(node('p', 'muted', '這是通往一個最近目標的分配；拆法可能不唯一，搭數不等於胡牌距離。')); block.append(detail);
  }
  return block;
}
function bestText(choices: DiscardAnalysis[]) { return choices.map(c => tileName(c.kind)).join('、'); }

export function renderPractice(root: HTMLElement, p: Practice | null, notice: string, hasSave: boolean, blocked: boolean, send: (c: UICommand) => void): void {
  const focused = root.contains(document.activeElement) ? (document.activeElement as HTMLElement).dataset.focus : undefined;
  const opened = new Set(Array.from(root.querySelectorAll<HTMLDetailsElement>('details[open][data-persist]'), d => d.dataset.persist));
  const shell = node('div', 'app-shell practice-shell');
  const head = node('header', 'site-header'); head.append(node('h1', '', '純練習模式'), button('返回對戰', 'game', () => send({ type: 'game' }), 'button button-quiet'));
  shell.append(head);
  if (notice) { const alert = node('p', 'notice', notice); alert.setAttribute('role', 'alert'); shell.append(alert); }
  const main = node('main', 'practice-main');
  main.append(node('p', 'practice-intro', '台灣十六張牌效率練習：136張一般牌、不含花，沒有對手、吃碰槓、計台或保留牌尾。'));
  const tools = node('div', 'practice-tools');
  if (!p && hasSave) tools.append(button('繼續上次練習', 'practice-resume', () => send({ type: 'practice-resume' }), 'button button-primary', blocked));
  tools.append(button(p ? '換一題隨機手牌' : '開始隨機練習', 'practice-start', () => send({ type: 'practice-start' }), 'button button-secondary'));
  if (p) tools.append(button('同題重練', 'practice-replay', () => send({ type: 'practice-replay' }), 'button button-quiet', blocked));
  main.append(tools);
  if (!p) main.append(node('p', 'practice-empty', '先給16張，再摸1張。單擊預覽捨牌效果，雙擊打出；捨牌後按「摸下一張」繼續。練習獨立續存，不會取代對戰。'));
  else {
    const analysis = practiceAnalysis(p);
    const status = node('p', 'practice-status'); status.setAttribute('role', 'status');
    status.textContent = p.phase === 'complete' ? '完成！五面子一對將。可換題，或從相同牌序重練。' : p.phase === 'exhausted' ? '本題牌池已用完。可換題或同題重練。' : p.phase === 'draw' ? '捨牌已完成。看過回饋後，按「摸下一張」。' : '單擊手牌預覽；雙擊同張打出。鍵盤 Tab 預覽，Enter 或空白鍵打出。';
    main.append(status, node('p', 'muted', `第 ${p.discards.length + 1} 次選牌 · 剩餘牌池 ${p.pool.length} 張 · 題號 ${p.seed}`));
    const hand = node('div', 'hand practice-hand'); hand.setAttribute('role', 'group'); hand.setAttribute('aria-label', '練習手牌');
    const preview = node('section', 'practice-preview'); preview.setAttribute('aria-label', '捨牌預覽');
    let lastTap: { id: string; time: number } | null = null;
    const select = (id: string) => {
      if (p.phase !== 'discard') return;
      const choice = analysis.choices.find(c => c.kind === kindOf(id))!;
      for (const control of Array.from(hand.querySelectorAll<HTMLButtonElement>('button'))) { const selected = control.dataset.tile === id; control.classList.toggle('selected', selected); control.setAttribute('aria-pressed', String(selected)); }
      preview.replaceChildren(node('h2', '', `捨出 ${tileName(id)} 後`), stats(choice.analysis));
    };
    const sorted = [...p.hand].sort((a, b) => 'mpsz'.indexOf(kindOf(a)[1]) - 'mpsz'.indexOf(kindOf(b)[1]) || a.localeCompare(b));
    if (p.drawnTile) { sorted.splice(sorted.indexOf(p.drawnTile), 1); sorted.push(p.drawnTile); }
    for (const id of sorted) {
      const play = () => send({ type: 'practice-discard', tileId: id });
      const control = button('', `practice-tile-${id}`, event => {
        if (!event.detail) { play(); return; }
        const now = performance.now();
        // ponytail: same 450ms double-tap window as battle; add preferences only with accessibility feedback.
        if (lastTap?.id === id && now - lastTap.time <= 450) { lastTap = null; play(); return; }
        lastTap = { id, time: now }; select(id);
      }, `hand-tile ${id === p.drawnTile ? 'drawn' : ''}`, blocked || p.phase !== 'discard');
      control.dataset.tile = id; control.setAttribute('aria-label', `${tileName(id)}${id === p.drawnTile ? '，剛摸入' : ''}`); control.setAttribute('aria-pressed', 'false'); control.append(tile(id));
      control.addEventListener('focus', () => select(id));
      control.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); if (!event.repeat && !control.disabled) play(); } });
      hand.append(control);
    }
    main.append(hand);
    if (p.phase === 'draw') main.append(button('摸下一張', 'practice-draw', () => send({ type: 'practice-draw' }), 'button button-primary', blocked));
    if (analysis.feedback) {
      const f = analysis.feedback, best = f.best[0].analysis;
      main.append(node('p', 'practice-feedback', `已捨 ${tileName(p.discards.at(-1)!)}。${compareAnalysis(f.chosen.analysis, best) === 0 ? '本次與最佳候選牌效相同。' : `本次 ${f.chosen.analysis.shanten} 向聽、有效 ${f.chosen.analysis.improving} 張；牌效較佳候選為 ${bestText(f.best)}（${best.shanten} 向聽、有效 ${best.improving} 張）。`}`));
    }
    if (p.phase === 'discard') {
      preview.append(node('h2', '', '捨牌預覽'), node('p', '', '選一張手牌，查看捨出後的距離與有效進張。'));
      const hints = node('details', 'practice-detail'); hints.dataset.persist = 'best'; hints.append(node('summary', '', '查看本次牌效較佳候選'), node('p', '', bestText(analysis.best)), node('p', 'muted', '先比較向聽，再比較下一張有效牌數；相同者並列，不估防守、台數或最終勝率。')); main.append(hints);
    } else preview.append(stats(analysis.current));
    main.append(preview);
    const river = node('details', 'practice-detail'); river.dataset.persist = 'river'; river.append(node('summary', '', `本題棄牌（${p.discards.length}張，不回牌池）`));
    const cards = node('div', 'practice-river'); p.discards.forEach(t => cards.append(tile(t, 'tile-small'))); river.append(cards); main.append(river);
    main.append(node('p', 'practice-assumptions', '機率＝剩餘牌池中的有效張數／全部剩餘張數，只表示下一張改善機會。向聽是結構下限，不是還要摸幾次或胡牌承諾。同題重練會還原起點與原牌序。'));
  }
  shell.append(main); root.replaceChildren(shell);
  for (const d of Array.from(root.querySelectorAll<HTMLDetailsElement>('details[data-persist]'))) if (opened.has(d.dataset.persist)) d.open = true;
  if (focused) (Array.from(root.querySelectorAll<HTMLElement>('[data-focus]')).find(e => e.dataset.focus === focused) ?? root.querySelector<HTMLElement>(p?.phase === 'draw' ? '[data-focus="practice-draw"]' : '.practice-hand button:not(:disabled)'))?.focus({ preventScroll: true });
}
