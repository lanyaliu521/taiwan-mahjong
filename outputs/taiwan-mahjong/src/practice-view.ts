import type { Practice } from './practice.js';
import { practiceAnalysis } from './practice.js';
import type { Analysis, DiscardAnalysis } from './analysis.js';
import { compareAnalysis } from './analysis.js';
import { kindOf } from './tiles.js';
import { node, button, tile, tileName } from './view.js';
import type { UICommand } from './view.js';

const distance = (a: Analysis) => a.shanten < 0 ? '牌型已完成' : a.shanten === 0 ? '已聽牌，等候1張合適牌成胡牌形' : `至少再 ${a.shanten} 次有效改善可聽牌`;
function stats(a: Analysis): HTMLElement {
  const block = node('div', 'practice-stats');
  const metrics = node('div', 'practice-metrics');
  const shape = node('div', 'practice-metric');
  shape.append(node('span', 'metric-label', '距離聽牌'), node('strong', '', a.shanten < 0 ? '已完成' : a.shanten === 0 ? '聽牌' : `${a.shanten} 向聽`), node('p', '', distance(a)));
  const chance = node('div', 'practice-metric');
  chance.append(node('span', 'metric-label', '下一張改善機率'), node('strong', '', a.shanten < 0 ? '完成' : a.probability === null ? '無剩餘牌' : `${(a.probability * 100).toFixed(1)}%`), node('p', '', a.shanten < 0 ? '五面子一對將' : `${a.improving} 張有效牌／牌池 ${a.total} 張`));
  metrics.append(shape, chance); block.append(metrics);
  if (a.shanten >= 0) block.append(node('p', 'effective-heading', `可縮短距離的進牌 · ${a.effectiveTiles.length} 種、共 ${a.improving} 張`));
  const list = node('div', 'practice-effective');
  list.tabIndex = 0; list.setAttribute('role', 'region'); list.setAttribute('aria-label', '有效進張與剩餘張數，可左右捲動');
  for (const t of a.effectiveTiles) {
    const item = node('span', `practice-effective-item ${t.count ? '' : 'is-exhausted'}`);
    item.setAttribute('aria-label', `${tileName(t.kind)}，剩餘 ${t.count} 張`);
    item.append(tile(t.kind), node('span', '', `剩 ${t.count} 張`)); list.append(item);
  }
  if (a.effectiveTiles.length) block.append(list);
  if (a.effectiveTiles.length) block.append(node('p', 'effective-tip', '左右滑動看全部進牌；這是改善距離的機率，不是胡牌機率。'));
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
  const intro = node('p', 'practice-intro', p ? '十六張練習 · 五面子一對將' : '136張一般牌、不含花；只練進牌與捨牌，不設對手或計台。');
  intro.tabIndex = -1; intro.dataset.focus = 'practice-entry'; main.append(intro);
  const tools = node('div', 'practice-tools');
  if (!p && hasSave) tools.append(button('繼續上次練習', 'practice-resume', () => send({ type: 'practice-resume' }), 'button button-primary', blocked));
  tools.append(button(p ? '換一題隨機手牌' : '開始隨機練習', 'practice-start', () => send({ type: 'practice-start' }), 'button button-secondary'));
  if (p) tools.append(button('同題重練', 'practice-replay', () => send({ type: 'practice-replay' }), 'button button-quiet', blocked));
  if (!p) main.append(tools);
  if (!p) main.append(node('p', 'practice-empty', '先給16張，再摸1張。單擊預覽捨牌效果，雙擊打出；捨牌後按「摸下一張」繼續。練習獨立續存，不會取代對戰。'));
  else {
    const analysis = practiceAnalysis(p);
    const workspace = node('div', 'practice-workspace'), playArea = node('section', 'practice-play'), more = node('aside', 'practice-more');
    const status = node('p', 'practice-status'); status.tabIndex = -1; status.setAttribute('role', 'status');
    status.textContent = p.phase === 'complete' ? '完成！五面子一對將。可換題或同題重練。' : p.phase === 'exhausted' ? '牌池已用完。可換題或同題重練。' : p.phase === 'draw' ? '② 看回饋，再摸下一張' : '① 選一張預覽，雙擊同張捨出';
    playArea.append(status, node('p', 'practice-progress', `手牌 ${p.hand.length} 張 · 已捨 ${p.discards.length} 張 · 牌池 ${p.pool.length} 張`));
    const hand = node('div', 'hand practice-hand'); hand.setAttribute('role', 'group'); hand.setAttribute('aria-label', '練習手牌');
    const preview = node('section', 'practice-preview'); preview.setAttribute('aria-label', '捨牌預覽');
    const selection = node('p', 'practice-selection', '單擊／Tab 預覽 · 雙擊／Enter／空白鍵捨牌');
    selection.setAttribute('role', 'status');
    let lastTap: { id: string; time: number } | null = null;
    const select = (id: string) => {
      if (p.phase !== 'discard') return;
      const choice = analysis.choices.find(c => c.kind === kindOf(id))!;
      for (const control of Array.from(hand.querySelectorAll<HTMLButtonElement>('button'))) { const selected = control.dataset.tile === id; control.classList.toggle('selected', selected); control.setAttribute('aria-pressed', String(selected)); }
      const shapeOpen = preview.querySelector<HTMLDetailsElement>('[data-persist="shape"]')?.open;
      preview.replaceChildren(node('h2', '', `若捨出 ${tileName(id)}`), stats(choice.analysis));
      const detail = preview.querySelector<HTMLDetailsElement>('[data-persist="shape"]'); if (detail && shapeOpen) detail.open = true;
      selection.textContent = `已選 ${tileName(id)} · 雙擊這張捨出 · Enter／空白鍵也可捨牌`;
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
      control.addEventListener('focus', () => { lastTap = null; select(id); });
      control.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); if (!event.repeat && !control.disabled) play(); } });
      hand.append(control);
    }
    playArea.append(hand);
    const step = node('div', 'practice-step');
    if (p.phase === 'draw') step.append(button('摸下一張', 'practice-draw', () => send({ type: 'practice-draw' }), 'button button-primary', blocked), node('p', '', '捨出的牌不回池；摸牌後再選下一張。'));
    else if (p.phase === 'discard') step.append(selection);
    else step.append(tools);
    playArea.append(step);
    if (analysis.feedback) {
      const f = analysis.feedback, best = f.best[0].analysis;
      const same = compareAnalysis(f.chosen.analysis, best) === 0;
      const feedback = node('div', 'practice-feedback');
      feedback.append(node('strong', '', `已捨 ${tileName(p.discards.at(-1)!)} · ${same ? '牌效與較佳候選相同' : '還有牌效較佳的選擇'}`));
      if (!same) feedback.append(node('p', '', `本次：${f.chosen.analysis.shanten} 向聽、有效 ${f.chosen.analysis.improving} 張。候選 ${bestText(f.best)}：${best.shanten} 向聽、有效 ${best.improving} 張。`), node('p', 'muted', best.shanten < f.chosen.analysis.shanten ? '先看距離，再看有效張數；進牌張數較多，不一定更接近胡牌形。' : '距離相同時，比較有效張數；有效張數越多，下一張改善機會越大。'));
      playArea.append(feedback);
    }
    if (p.phase === 'discard') {
      preview.append(node('h2', '', '捨牌預覽'), node('p', 'preview-empty', '點一張手牌，這裡會顯示捨出後的距離與進牌機會。'));
      const hints = node('details', 'practice-detail'); hints.dataset.persist = 'best'; hints.append(node('summary', '', '比較較佳捨牌候選'));
      const candidates = node('div', 'practice-candidates');
      for (const choice of analysis.best) {
        const control = button('', `preview-${choice.kind}`, () => { lastTap = null; select(p.hand.find(t => kindOf(t) === choice.kind)!); }, 'practice-candidate', blocked);
        control.setAttribute('aria-label', `預覽捨出 ${tileName(choice.kind)}`);
        control.append(tile(choice.kind, 'tile-small'), node('span', '', `${choice.analysis.shanten} 向聽\n有效 ${choice.analysis.improving} 張`)); candidates.append(control);
      }
      hints.append(candidates, node('p', 'muted', '點候選只預覽，不會出牌。先比距離，再比有效張數；相同者並列，不是唯一正解。')); more.append(hints);
    } else preview.append(stats(analysis.current));
    playArea.append(preview);
    const river = node('details', 'practice-detail'); river.dataset.persist = 'river'; river.append(node('summary', '', `本題棄牌（${p.discards.length}張，不回牌池）`));
    const cards = node('div', 'practice-river'); p.discards.forEach(t => cards.append(tile(t, 'tile-small'))); river.append(cards); more.append(river);
    const settings = node('details', 'practice-detail'); settings.dataset.persist = 'settings'; settings.append(node('summary', '', '換題、重練與練習說明'));
    if (p.phase === 'discard' || p.phase === 'draw') settings.append(tools);
    settings.append(node('p', 'muted', `題號 ${p.seed} · 同題重練還原起點與原牌序。`), node('p', 'practice-assumptions', '136張一般牌，不含花、沒有對手、吃碰槓、計台或保留牌尾。機率只代表下一張改善機會，向聽是結構下限，不是還需摸幾次或胡牌承諾。'));
    more.append(settings); workspace.append(playArea, more); main.append(workspace);
  }
  shell.append(main); root.replaceChildren(shell);
  for (const d of Array.from(root.querySelectorAll<HTMLDetailsElement>('details[data-persist]'))) if (opened.has(d.dataset.persist)) d.open = true;
  if (focused) (focused === 'practice' ? intro : Array.from(root.querySelectorAll<HTMLElement>('[data-focus]')).find(e => e.dataset.focus === focused) ?? root.querySelector<HTMLElement>(p?.phase === 'draw' ? '[data-focus="practice-draw"]' : '.practice-status'))?.focus({ preventScroll: true });
}
