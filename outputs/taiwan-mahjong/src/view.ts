import { coachAnalysis } from './coach.js';
import type { Analysis } from './analysis.js';
import type { Intent, Seat } from './model.js';
import type { getObservation } from './engine.js';
import { kindOf, seatWind } from './tiles.js';
import { tileFace } from './tile-face.js';

export type UICommand =
  | { type: 'start' | 'resume' | 'new' | 'next' | 'pause' | 'coach-toggle' | 'tutorial' }
  | { type: 'practice' | 'practice-start' | 'practice-resume' | 'practice-replay' | 'practice-draw' | 'game' }
  | { type: 'practice-discard'; tileId: string }
  | { type: 'speed'; value: 'normal' | 'fast' }
  | { type: 'select'; tileId: string }
  | { type: 'intent'; intent: Intent; version: number };
export type ViewModel = {
  game: ReturnType<typeof getObservation> | null;
  selectedTile: string | null; drawnTile: string | null; busy: boolean; paused: boolean;
  coachEnabled?: boolean; coachNotice?: string;
  speed: 'normal' | 'fast'; status: string; notice: string; hasSave: boolean;
};
type Game = NonNullable<ViewModel['game']>;
type Send = (command: UICommand) => void;
const numerals = '一二三四五六七八九';
const honors = ['東', '南', '西', '北', '中', '發', '白'];
const flowers = ['春', '夏', '秋', '冬', '梅', '蘭', '菊', '竹'];
const names = ['你', '右席', '對席', '左席'];
const relations = ['真人', '下家・電腦', '對家・電腦', '上家・電腦'];
const meldNames = { chi: '吃', pon: '碰', exposedKong: '明槓', concealedKong: '暗槓', addedKong: '加槓' };

export function node<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  element.className = className;
  if (text) element.textContent = text;
  return element;
}
export function button(label: string, key: string, action: (event: MouseEvent) => void, className = 'button', disabled = false): HTMLButtonElement {
  const element = node('button', className, label);
  element.type = 'button'; element.disabled = disabled; element.dataset.focus = key;
  element.addEventListener('click', action);
  return element;
}
export function tileName(id: string): string {
  const kind = kindOf(id);
  if (kind[0] === 'f') return `${flowers[Number(kind[1]) - 1]}花`;
  if (kind[1] === 'z') return honors[Number(kind[0]) - 1];
  return `${numerals[Number(kind[0]) - 1]}${{ m: '萬', p: '筒', s: '索' }[kind[1]] ?? ''}`;
}
export function tile(id: string | null, size = '', selected = false): HTMLSpanElement {
  const kind = id === null ? '' : kindOf(id);
  const face = node('span', `tile ${size} ${id === null ? 'tile-back' : `suit-${kind[0] === 'f' ? 'f' : kind[1]}`} ${selected ? 'is-selected' : ''}`);
  if (id === null) { face.setAttribute('aria-label', '暗牌'); return face; }
  face.setAttribute('aria-label', tileName(id));
  face.append(tileFace(kind));
  return face;
}
function pill(text: string, className = ''): HTMLSpanElement { return node('span', `pill ${className}`, text); }
function signed(value: number): string { return value > 0 ? `+${value}` : String(value); }
function tableDealer(game: Game): Seat { return game.phase === 'matchResult' ? (game.dealer + 3) % 4 as Seat : game.dealer; }
function wind(game: Game, seat: number): string { return tileName(seatWind(seat as Seat, tableDealer(game))); }

function rules(): HTMLDetailsElement {
  const detail = node('details', 'rules'); detail.dataset.persist = 'rules';
  const summary = node('summary', '', '桌規與操作'); summary.dataset.focus = 'rules';
  const body = node('div', 'rules-body');
  body.append(node('p', 'eyebrow', 'TW16-CLASSIC-v1 · 本桌固定規則'), node('h3', '', '十六張，五面子一對將'));
  const entries = [
    ['如何操作', '單擊選牌，快速連點同一張兩次即可打出。鍵盤可用 Tab 選牌，Enter 或空白鍵出牌。可吃、碰、槓、胡時會顯示合法選項，吃牌逐組列出；沒有真人倒數。結算自動彈出，可關閉查看牌桌再重新開啟。'],
    ['牌與座位', '144 張，含春夏秋冬、梅蘭菊竹。逆時針輪流；莊家為東，莊家起手 17 張，補花後直接出牌。'],
    ['摸牌與尾局', '固定留 16 張；補花、補槓同樣消耗可用牌。剩 3 張起不能吃、碰、明槓；最後捨牌仍可胡。'],
    ['回應順序', '胡優先，再碰／明槓，最後下家吃；多家胡由離出牌者最近者胡。明槓不可取上家。'],
    ['吃碰與過水', '吃後不可打回能和吃入兩張組成順子的牌；碰後不可打同種。放棄合法胡會過水，須捨出非自身聽口牌，或正式完成加槓才解除。過碰至自己下次出牌解除。'],
    ['槓與花', '暗槓牌種對其他家隱藏；加槓可搶胡。明槓補牌後本次不可一般自摸。七搶一、八仙過海強制花胡，均為 8 台；依取得花牌的時點判斷是否先補完。'],
    ['計分', '純積分，底 30、每台 10，零台可胡、無封頂。放槍一人付、自摸三人付。每筆涉及莊家，加莊家 1 台及連莊 2N 台。'],
    ['莊與一將', '莊胡或流局連莊；閒家胡才移莊。每四次移莊換圈，16 次移莊結束一將。結算後由你決定何時繼續。'],
    ['公平與續局', '三位電腦僅看自己的手牌及公開資訊。牌局存在這個瀏覽器；請留意畫面上的存檔提示。'],
  ];
  const list = node('dl');
  for (const [title, text] of entries) list.append(node('dt', '', title), node('dd', '', text));
  body.append(list);
  const scoreDetail = node('details', 'tai-reference'); scoreDetail.dataset.persist = 'tai-reference';
  scoreDetail.append(node('summary', '', '查看計台表'));
  const scoreList = node('p', '', '1 台：自摸、門清、三元每組、圈風、門風、正花每張、獨聽、搶槓、槓上開花、海底撈月。2 台：花槓每組、全求人、平胡、三暗刻。3 台：門清一摸三。4 台：碰碰胡、混一色、小三元。5 台：四暗刻。8 台：五暗刻、清一色、小四喜、大三元、七搶一、八仙過海。16 台：字一色、大四喜、人胡、地胡、天胡。');
  scoreDetail.append(scoreList, node('p', 'muted', '依完整拆法取最高台數，不同拆法不可混計。高階台項取代對應低階台項；純花胡不加一般台。沒有八對半、七對或宣告聽牌。'));
  body.append(scoreDetail); detail.append(summary, body); return detail;
}

function header(model: ViewModel, send: Send): HTMLElement {
  const head = node('header', 'site-header');
  const brand = node('div', 'brand');
  const mark = node('span', 'brand-mark', '雀'); mark.setAttribute('aria-hidden', 'true');
  const text = node('div'); text.append(node('h1', '', '台灣十六張'), node('p', '', '一張一刻，好好打牌。'));
  brand.append(mark, text); head.append(brand);
  const tools = node('div', 'header-tools');
  tools.append(pill('本地公平 AI', 'fair-pill'));
  tools.append(button('新手教學', 'tutorial', () => send({ type: 'tutorial' }), 'button button-quiet'));
  if (model.game) {
    const coachToggle = button('教練提示', 'coach-toggle', () => send({ type: 'coach-toggle' }), 'button button-quiet');
    coachToggle.setAttribute('aria-pressed', String(model.coachEnabled !== false)); tools.append(coachToggle);
    tools.append(button('練習', 'practice', () => send({ type: 'practice' }), 'button button-quiet'));
    tools.append(button(model.paused ? '繼續牌局' : '暫停', 'pause', () => send({ type: 'pause' }), 'button button-quiet'));
    const speed = node('label', 'speed-label'); speed.append(node('span', '', '速度'));
    const select = node('select'); select.dataset.focus = 'speed'; select.setAttribute('aria-label', '電腦行牌速度');
    for (const [value, label] of [['normal', '一般'], ['fast', '快速']]) {
      const option = node('option', '', label); option.value = value; select.append(option);
    }
    select.value = model.speed; select.addEventListener('change', () => send({ type: 'speed', value: select.value === 'fast' ? 'fast' : 'normal' }));
    speed.append(select); tools.append(speed, button('重新一將', 'new', () => send({ type: 'new' }), 'button button-quiet'));
  }
  head.append(tools); return head;
}

function home(model: ViewModel, send: Send): HTMLElement {
  const main = node('main', 'welcome');
  const hero = node('section', 'welcome-hero');
  const copy = node('div', 'welcome-copy');
  const title = node('h2', '', '牌桌已備好，\n就等你入座。'); title.tabIndex = -1; title.dataset.focus = 'home-entry';
  copy.append(node('p', 'eyebrow', 'TAIWAN MAHJONG · 十六張'), title, node('p', 'welcome-description', '一位玩家，三位電腦。\n熟悉的台灣桌規，專心打一場好牌。'));
  const actions = node('div', 'welcome-actions');
  if (model.hasSave) actions.append(button('繼續上次牌局', 'resume', () => send({ type: 'resume' }), 'button button-primary button-large', model.busy));
  actions.append(button(model.hasSave ? '開始新的一將' : '開始一將', 'start', () => send({ type: 'start' }), `button ${model.hasSave ? 'button-secondary' : 'button-primary'} button-large`, model.busy));
  actions.append(button('純練習模式', 'practice', () => send({ type: 'practice' }), 'button button-secondary button-large'));
  copy.append(actions, node('p', 'welcome-footnote', '無需登入 · 自動續存 · 真人操作不限時'));
  const art = node('div', 'welcome-art'); art.setAttribute('aria-hidden', 'true');
  const ring = node('div', 'table-ring'); ring.append(node('span', 'ring-north', '北'), node('span', 'ring-east', '東'), node('span', 'ring-south', '南'), node('span', 'ring-west', '西'));
  const fan = node('div', 'tile-fan'); ['1m', '2m', '3m', '5z', '6z'].forEach(id => fan.append(tile(id, 'tile-hero')));
  art.append(ring, fan, node('span', 'art-caption', '底 30 / 台 10 · 純積分'));
  hero.append(copy, art); main.append(hero);
  const features = node('div', 'welcome-features');
  for (const [number, title, text] of [['16', '道地十六張', '五面子一對將，吃碰槓胡完整呈現。'], ['3', '公平的電腦對手', '各自只看手牌與公開資訊，不偷看牌牆。'], ['∞', '照你的節奏', '雙擊出牌，隨時暫停、下次再續。']]) {
    const feature = node('section'); feature.append(node('span', 'feature-number', number), node('h3', '', title), node('p', '', text)); features.append(feature);
  }
  main.append(features); return main;
}

function publicPlayer(game: Game, seat: Seat): HTMLElement {
  const player = game.players[seat];
  const self = seat === game.seat;
  const position = ['south', 'east', 'north', 'west'][seat];
  const section = node('section', `player player-${position} ${game.turn === seat && !game.settlement ? 'is-turn' : ''}`);
  section.setAttribute('aria-label', `${names[seat]}，${wind(game, seat)}風`);
  const label = node('header', 'player-header');
  const avatar = node('span', 'wind-mark', wind(game, seat));
  const title = node('div', 'player-title'); title.append(node('h3', '', names[seat]), node('p', '', relations[seat]));
  const points = node('span', `player-score ${game.scores[seat] > 0 ? 'positive' : ''}`, signed(game.scores[seat])); points.setAttribute('aria-label', `積分 ${game.scores[seat]}`);
  label.append(avatar, title);
  if (!self) label.append(node('span', 'hand-count', `${player.concealedCount} 張`));
  if (tableDealer(game) === seat) label.append(pill(game.phase === 'matchResult' ? '末局莊' : game.streak ? `莊 連${game.streak}` : '莊', 'dealer-pill'));
  label.append(points); section.append(label);
  if (!self) {
    const hidden = node('div', 'opponent-hand'); hidden.setAttribute('aria-label', `${player.concealedCount} 張暗牌`);
    for (let i = 0; i < player.concealedCount; i++) { const back = tile(null, 'tile-hidden'); back.setAttribute('aria-hidden', 'true'); hidden.append(back); }
    section.append(hidden);
  }
  const exposed = node('div', 'exposed');
  for (const meld of player.melds) {
    const group = node('div', 'meld'); group.setAttribute('aria-label', meldNames[meld.kind]);
    const groupTiles = node('span', 'meld-tiles');
    if ('tiles' in meld) {
      const ids = meld.kind === 'chi' ? [...meld.tiles].sort((a, b) => Number(kindOf(a)[0]) - Number(kindOf(b)[0])) : meld.tiles;
      ids.forEach(id => groupTiles.append(tile(id, 'tile-small')));
    }
    else for (let i = 0; i < meld.count; i++) groupTiles.append(tile(null, 'tile-small'));
    group.append(node('span', 'meld-label', meldNames[meld.kind]), groupTiles); exposed.append(group);
  }
  const flowerGroup = node('div', 'flowers'); flowerGroup.setAttribute('aria-label', '花牌');
  flowerGroup.append(node('span', 'area-label', `花 ${player.flowers.length}`));
  player.flowers.forEach(id => flowerGroup.append(tile(id, 'tile-flower')));
  exposed.append(flowerGroup); section.append(exposed); return section;
}

function river(game: Game, seat: Seat): HTMLElement {
  const section = node('section', `river-area river-${['south', 'east', 'north', 'west'][seat]}`);
  section.setAttribute('aria-label', `${names[seat]}的牌河`);
  section.append(node('span', 'river-label', `${names[seat]} · ${wind(game, seat)}`));
  const river = node('div', 'river');
  const player = game.players[seat];
  const liveDiscards = player.discardHistory.filter(discard => discard.claimedBy === null);
  if (!liveDiscards.length) river.append(node('span', 'river-empty', '尚無捨牌'));
  for (const discard of liveDiscards) {
    const current = game.lastDiscard?.tileId === discard.tileId;
    const face = tile(discard.tileId, `tile-river ${current ? 'last-discard' : ''}`);
    if (current) face.setAttribute('aria-label', `${tileName(discard.tileId)}，最新捨牌`);
    river.append(face);
  }
  section.append(river); return section;
}

function tableCenter(model: ViewModel): HTMLElement {
  const game = model.game!;
  const center = node('section', 'table-center'); center.setAttribute('aria-label', '牌局資訊');
  center.append(node('p', 'center-round', `${tileName(game.roundWind)}圈 · 第 ${game.handId} 局`));
  const remaining = node('div', 'remaining'); remaining.append(node('strong', '', String(game.available)), node('span', '', '可用牌'));
  center.append(remaining, node('p', 'center-rule', '固定留 16 · 底 30 台 10'));
  const offering = game.offeredKong ?? game.lastDiscard;
  if (offering) {
    const latest = node('div', 'latest-offer'); latest.append(node('span', '', `${names[offering.seat]}${game.offeredKong ? '加槓' : '打出'}`), tile(offering.tileId, 'tile-offer'));
    center.append(latest);
  } else center.append(node('p', 'center-turn', game.settlement ? '本局已結束' : model.paused ? '牌局已暫停' : `${names[game.turn]}行牌中`));
  return center;
}

function actionLabel(intent: Intent): string {
  switch (intent.type) {
    case 'WIN': return intent.source === 'selfDraw' ? '自摸' : intent.source === 'robKong' ? '搶槓胡' : '胡牌';
    case 'PASS': return '過';
    case 'CHI': return `吃 ${intent.ownTiles.map(tileName).join('・')}`;
    case 'PON': return `碰 ${tileName(intent.ownTiles[0])}`;
    case 'KAN_OPEN': return `明槓 ${tileName(intent.ownTiles[0])}`;
    case 'KAN_CLOSED': return `暗槓 ${tileName(intent.ownTiles[0])}`;
    case 'KAN_ADDED': return `加槓 ${tileName(intent.tileId)}`;
    default: return intent.type;
  }
}

function coachPanel(model: ViewModel) {
  const report = model.coachEnabled === false || model.busy || model.paused ? null : coachAnalysis(model.game!);
  if (!report) return null;
  const detail = node('details', 'coach-panel'); detail.dataset.persist = 'coach';
  const summary = node('summary'); summary.dataset.focus = 'coach';
  const shape = (a: Analysis) => a.shanten < 0 ? '牌型已完成' : a.shanten === 0 ? '已聽牌' : `${a.shanten} 向聽`;
  const distance = (a: Analysis) => `${shape(a)}${a.shanten > 0 ? `・距聽牌至少 ${a.shanten} 次進張` : ''}`;
  detail.append(summary);
  const body = node('div', 'coach-body'), preview = node('div', 'coach-preview'); preview.setAttribute('aria-live', 'polite');
  const describe = (a: Analysis, label: string) => {
    const box = node('div'); box.append(node('strong', '', `${label}：${distance(a)}`));
    if (a.shanten >= 0) box.append(node('p', '', `成胡還需至少 ${a.shanten + 1} 次有效進張（每次都使牌型更接近胡牌）；不代表實際回合數。`));
    box.append(node('p', '', `公開未知牌中，有效牌 ${a.improving}／${a.total} 張${a.probability === null ? '（無可估計牌）' : `（${(a.probability * 100).toFixed(1)}%）`}。`));
    if (a.shanten >= 0 && a.effectiveTiles.length && a.improving === 0) box.append(node('p', 'action-note', '這份後續進張估計已沒有剩餘有效牌，需考慮換一組等待；若當下已有合法胡牌按鈕，仍可胡。'));
    const list = node('div', 'coach-tiles'); list.tabIndex = 0; list.setAttribute('aria-label', '有效進張與剩餘張數，可左右捲動');
    a.effectiveTiles.forEach(t => { const item = node('span', t.count ? '' : 'exhausted'); item.append(tile(t.kind, 'tile-small'), node('span', '', `${t.count}張`)); list.append(item); });
    if (a.effectiveTiles.length) box.append(list);
    const e = a.example;
    if (e) {
      box.append(node('p', '', `拆法示例：${e.completed.length} 組面子、${e.partials.length} 搭、${e.pair.length ? '1 對將' : '尚無將'}、${e.singles.length} 張散牌。`));
      const groups = node('div', 'coach-tiles');
      [...e.completed, ...e.partials, ...(e.pair.length ? [e.pair] : []), ...e.singles.map(k => [k])].forEach(g => { const row = node('span', 'coach-group'); g.forEach(k => row.append(tile(k, 'tile-small'))); groups.append(row); }); box.append(groups);
    }
    return box;
  };
  function select(id: string | null) {
    const choice = report!.discards.find(d => d.kind === (id ? kindOf(id) : ''));
    summary.textContent = `教練 · ${report!.canWin ? '此刻可以胡牌' : choice ? `打出${tileName(choice.kind)}後：${shape(choice.analysis)}` : report!.best.length ? `捨牌後最佳 ${shape(report!.best[0].analysis)}` : shape(report!.current)}`;
    preview.replaceChildren(choice ? describe(choice.analysis, `打出${tileName(choice.kind)}後`) : report!.discards.length ? node('p', '', '單擊手牌預覽，雙擊才打出。') : describe(report!.current, '目前牌型'));
  }
  select(model.selectedTile);
  if (report.canWin) body.append(node('p', 'coach-claim', '此刻有合法胡牌，先考慮胡牌；放棄會過水。以下吃碰比較是假設你放棄本次胡牌。'));
  else if (report.current.shanten < 0) body.append(node('p', '', '牌型已完成，但此刻沒有合法胡牌。吃碰後與明槓補牌不可自摸，過水亦會限制胡牌；請以合法胡牌按鈕為準。'));
  if (report.best.length) body.append(node('p', 'coach-candidates', `牌效較佳候選：${report.best.map(d => tileName(d.kind)).join('、')}。先比較向聽，再比較有效牌張數；同分都保留。`));
  const effects: Record<string, string> = { unavailable: '無合法捨牌', closer: '更接近聽牌：有效進張', worse: '牌效下降', moreOptions: '向聽相同，有效牌增加', same: '牌效相同' };
  for (const claim of report.claims) {
    const after = claim.best[0]?.analysis;
    body.append(node('p', 'coach-claim', `${actionLabel(claim.intent)} → ${effects[claim.effect]}${after ? `；捨 ${claim.best.map(d => tileName(d.kind)).join('／')} 後 ${distance(after)}，有效 ${after.improving} 張` : ''}${claim.losesClosed ? '；會失去門清' : ''}。`));
  }
  body.append(preview);
  if (model.game!.self.restrictions.passedWin) body.append(node('p', '', '目前過水：牌型聽牌不代表此刻可胡，請以合法胡牌按鈕為準。'));
  body.append(node('p', 'coach-footnote', '未知牌包含他家暗牌與牌尾，以上比例不是實際摸牌機率。拆法只是一種最近目標分配；不評估台數、防守或槓後補牌風險。'));
  detail.append(body); return { element: detail, select };
}

function handAndActions(model: ViewModel, send: Send): HTMLElement {
  const game = model.game!;
  const section = node('section', 'hand-panel'); section.setAttribute('aria-label', '你的手牌與操作');
  const head = node('div', 'hand-heading');
  const handTitle = node('h2', '', '你的手牌'); handTitle.tabIndex = -1; handTitle.dataset.focus = 'hand-heading'; handTitle.setAttribute('aria-describedby', 'operation-status');
  head.append(handTitle, node('span', 'hand-tip', '單擊／Tab 選牌 · 雙擊打出'));
  if (game.self.restrictions.passedWin) head.append(pill('過水中', 'restriction-pill'));
  section.append(head);
  const hand = node('div', 'hand'); hand.setAttribute('role', 'group'); hand.setAttribute('aria-label', '選擇要打出的手牌');
  const discards = game.legalActions.filter((action): action is Extract<Intent, { type: 'DISCARD' }> => action.type === 'DISCARD');
  const legalIds = new Set(discards.map(action => action.tileId));
  const coach = coachPanel(model);
  let lastTap: { id: string; time: number } | null = null;
  const sorted = [...game.self.concealed].sort((a, b) => {
    const ka = kindOf(a), kb = kindOf(b); return 'mpsz'.indexOf(ka[1]) - 'mpsz'.indexOf(kb[1]) || Number(ka[0]) - Number(kb[0]) || a.localeCompare(b);
  });
  if (model.drawnTile && sorted.includes(model.drawnTile)) { sorted.splice(sorted.indexOf(model.drawnTile), 1); sorted.push(model.drawnTile); }
  for (const id of sorted) {
    const isSelected = id === model.selectedTile, isDrawn = id === model.drawnTile;
    const play = () => send({ type: 'intent', intent: { type: 'DISCARD', tileId: id }, version: game.version });
    const control = button('', `tile-${id}`, event => {
      if (event.detail === 0) { play(); return; } // Assistive activation without pointer taps.
      const now = performance.now();
      // ponytail: 450ms double-tap window; add a user preference only if accessibility feedback requires it.
      if (lastTap?.id === id && now - lastTap.time <= 450) { lastTap = null; play(); return; }
      lastTap = { id, time: now };
      select();
    }, `hand-tile ${isSelected ? 'selected' : ''} ${isDrawn ? 'drawn' : ''} ${discards.length && !legalIds.has(id) ? 'unavailable' : ''}`, model.busy || model.paused || !legalIds.has(id));
    const select = () => {
      for (const other of Array.from(hand.querySelectorAll<HTMLButtonElement>('button'))) {
        other.classList.toggle('selected', other === control); other.setAttribute('aria-pressed', String(other === control));
      }
      coach?.select(id);
      send({ type: 'select', tileId: id });
    };
    control.addEventListener('focus', () => { if (!control.disabled) { lastTap = null; select(); } });
    control.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      if (!event.repeat && !control.disabled) play();
    });
    control.setAttribute('aria-label', `${tileName(id)}${isDrawn ? '，剛摸入' : ''}${discards.length && !legalIds.has(id) ? '，目前不可打出' : ''}`);
    control.setAttribute('aria-pressed', String(isSelected)); control.append(tile(id)); hand.append(control);
  }
  section.append(hand);
  const operation = node('div', 'operation');
  const hint = node('div', 'operation-hint'); hint.setAttribute('role', 'status'); hint.setAttribute('aria-live', 'polite'); hint.append(node('span', 'turn-indicator'), node('p', '', model.status || (game.settlement ? '請查看本局結算' : '等待行牌')));
  const actions = node('div', 'action-buttons');
  const disabled = model.busy || model.paused;
  const choices = game.legalActions.filter(action => ['WIN', 'PASS', 'CHI', 'PON', 'KAN_OPEN', 'KAN_CLOSED', 'KAN_ADDED'].includes(action.type));
  choices.sort((a, b) => Number(a.type === 'PASS') - Number(b.type === 'PASS') || Number(b.type === 'WIN') - Number(a.type === 'WIN'));
  choices.forEach((intent, index) => {
    const control = button(actionLabel(intent), `action-${intent.type}-${index}`, () => send({ type: 'intent', intent, version: game.version }), `button ${intent.type === 'WIN' ? 'button-win' : intent.type === 'PASS' ? 'button-quiet' : 'button-secondary'}`, disabled);
    if (intent.type === 'CHI') {
      control.setAttribute('aria-label', actionLabel(intent));
      control.classList.add('chi-choice'); control.replaceChildren(node('span', '', '吃'));
      const group = node('span', 'chi-tiles');
      [...intent.ownTiles, game.lastDiscard!.tileId].sort((a, b) => Number(kindOf(a)[0]) - Number(kindOf(b)[0])).forEach(id => {
        const face = tile(id, 'tile-small');
        if (id === game.lastDiscard!.tileId) face.classList.add('claimed-tile');
        group.append(face);
      });
      control.append(group);
    }
    if (intent.type === 'PASS') control.title = choices.some(action => action.type === 'WIN') ? '放棄這次胡牌會進入過水' : choices.some(action => action.type === 'PON') ? '放棄這次碰牌會記錄過碰' : '放棄這次回應';
    actions.append(control);
  });
  if (model.paused) actions.append(button('繼續牌局', 'continue', () => send({ type: 'pause' }), 'button button-primary'));
  hint.querySelector('p')!.id = 'operation-status';
  operation.append(hint, actions); section.append(operation);
  if (model.coachNotice) section.append(node('p', 'action-note', model.coachNotice));
  if (discards.length && game.self.restrictions.forbiddenDiscards.length) section.append(node('p', 'action-note', `吃碰後本次不可打出：${game.self.restrictions.forbiddenDiscards.map(tileName).join('、')}。`));
  if (choices.some(action => action.type === 'WIN')) section.append(node('p', 'action-note', '此刻可以胡牌；放棄合法胡牌會進入過水。'));
  if (coach) section.append(coach.element);
  return section;
}

function result(model: ViewModel, send: Send): HTMLDialogElement {
  const game = model.game!, settlement = game.settlement!;
  const section = node('dialog', 'result-panel'); section.dataset.result = settlement.id; section.setAttribute('aria-labelledby', 'result-title');
  const title = node('div', 'result-title');
  const source = { draw: '流局', selfDraw: '自摸', ron: '胡牌', robKong: '搶槓胡', sevenFlowers: '七搶一', eightFlowers: '八仙過海' }[settlement.source];
  title.append(node('p', 'eyebrow', game.phase === 'matchResult' ? '一將完成' : '本局結算'), node('h2', '', settlement.winner === null ? '流局，好牌留待下一局。' : `${names[settlement.winner]}${source}`));
  if (settlement.score) title.append(node('span', 'result-tai', `${settlement.score.tai} 台`));
  const heading = title.querySelector('h2')!; heading.id = 'result-title'; heading.tabIndex = -1;
  title.append(button('返回牌桌', 'close-result', () => section.close(), 'button button-quiet'));
  section.append(title);
  if (model.notice) section.append(node('p', 'notice', model.notice));
  const breakdown = node('details', 'result-breakdown'); breakdown.dataset.persist = `result-${settlement.id}`;
  breakdown.append(node('summary', '', '查看胡牌拆法與計台明細'));
  const decomposition = settlement.score?.decomposition;
  if (decomposition) {
    const shape = node('section', 'winning-shape'); shape.setAttribute('aria-label', '胡牌拆法，五面子一對將');
    shape.append(node('h3', '', '胡牌拆法 · 五面子一對將'));
    const groups = node('div', 'winning-groups');
    decomposition.groups.forEach((group, index) => {
      const meld = settlement.winner === null ? undefined : game.players[settlement.winner].melds[index];
      const label = meld ? meldNames[meld.kind] : group.kind === 'sequence' ? '順子' : '刻子';
      const cards = meld && !['chi', 'pon'].includes(meld.kind) ? [...group.tiles, group.tiles[0]] : group.tiles;
      const block = node('div', 'winning-group'); block.setAttribute('aria-label', label);
      const faces = node('div', 'meld-tiles'); cards.forEach(id => faces.append(tile(id, 'tile-small')));
      block.append(faces, node('span', '', label)); groups.append(block);
    });
    const pair = node('div', 'winning-group'); pair.setAttribute('aria-label', '一對將');
    const faces = node('div', 'meld-tiles'); faces.append(tile(decomposition.pair, 'tile-small'), tile(decomposition.pair, 'tile-small'));
    pair.append(faces, node('span', '', '一對將')); groups.append(pair);
    shape.append(groups); breakdown.append(shape);
  }
  const details = node('div', 'result-body');
  const items = node('div', 'score-items');
  if (settlement.score) {
    for (const item of settlement.score.items) { const line = node('div', 'score-item'); line.append(node('span', '', item.reason), node('strong', '', `${item.tai} 台`)); items.append(line); }
    if (!settlement.score.items.length) items.append(node('p', '', '零台胡牌'));
    items.append(node('p', 'muted', '涉及莊家的付款另加莊家 1 台、連莊 2N 台；實際收付如下。'));
  } else items.append(node('p', 'muted', '本局無收付，莊家繼續連莊。'));
  if (settlement.externalTile) { const winning = node('div', 'winning-tile'); winning.append(node('span', '', '胡入牌'), tile(settlement.externalTile, 'tile-small')); items.append(winning); }
  const scores = node('table', 'result-scores');
  const caption = node('caption', 'sr-only', '本局積分變動與總分'); scores.append(caption);
  const thead = node('thead'), headerRow = node('tr'); ['座位', '本局', '總分'].forEach(text => { const th = node('th', '', text); th.scope = 'col'; headerRow.append(th); }); thead.append(headerRow); scores.append(thead);
  const tbody = node('tbody');
  game.scores.forEach((score, seat) => { const row = node('tr', seat === settlement.winner ? 'winner-row' : ''); row.append(node('th', '', `${names[seat]} · ${wind(game, seat)}`), node('td', settlement.delta[seat] > 0 ? 'positive' : '', signed(settlement.delta[seat])), node('td', '', signed(score))); tbody.append(row); });
  scores.append(tbody); details.append(items); breakdown.append(details); section.append(scores, breakdown);
  const footer = node('div', 'result-footer'); footer.append(node('p', 'muted', game.phase === 'matchResult' ? '東南西北四圈結束。謝謝入座。' : '本局已結算，準備好再開始下一局。'), button(game.phase === 'matchResult' ? '再打一將' : '下一局', game.phase === 'matchResult' ? 'new-result' : 'next', () => send({ type: game.phase === 'matchResult' ? 'new' : 'next' }), 'button button-primary', model.busy || model.paused));
  section.append(footer); return section;
}

// ponytail: layout memory lasts for this page session; persist UI preferences only if requested.
const detailStates = new WeakMap<HTMLElement, Map<string, boolean>>();
export function preserveDetails(root: HTMLElement): () => void {
  const details = detailStates.get(root) ?? new Map<string, boolean>();
  detailStates.set(root, details);
  for (const detail of Array.from(root.querySelectorAll<HTMLDetailsElement>('details[data-persist]'))) details.set(detail.dataset.persist!, detail.open);
  return () => {
    for (const detail of Array.from(root.querySelectorAll<HTMLDetailsElement>('details[data-persist]'))) {
      detail.open = details.get(detail.dataset.persist!) ?? false;
      detail.addEventListener('toggle', () => { if (root.contains(detail)) details.set(detail.dataset.persist!, detail.open); });
    }
  };
}

/** Render only the player's masked observation; hidden game state never enters this module. */
export function render(root: HTMLElement, model: ViewModel, send: Send): void {
  const previousResult = root.querySelector<HTMLDialogElement>('dialog[data-result]');
  const tableScroll = root.querySelector('.table-grid')?.scrollTop ?? 0;
  const showResult = !previousResult || previousResult.dataset.result !== model.game?.settlement?.id || previousResult.open;
  let resultDialog: HTMLDialogElement | undefined;
  const focus = root.contains(document.activeElement) ? (document.activeElement as HTMLElement).dataset.focus : undefined;
  const restoreDetails = preserveDetails(root);
  const shell = node('div', `app-shell ${model.game ? 'in-game' : ''}`); shell.append(header(model, send));
  if (model.notice) { const notice = node('p', 'notice', model.notice); notice.setAttribute('role', 'alert'); shell.append(notice); }
  if (!model.game) shell.append(home(model, send));
  else {
    const main = node('main', 'game-main');
    const heading = node('div', 'table-heading'); heading.append(node('p', 'eyebrow', '你的私人牌桌'), node('p', 'table-subtitle', model.game.phase === 'matchResult' ? `一將完成 · 最後莊家 ${names[tableDealer(model.game)]}` : `${tileName(model.game.roundWind)}圈 · 莊家 ${names[model.game.dealer]}${model.game.streak ? ` · 連 ${model.game.streak}` : ''}`));
    const table = node('div', 'table-grid');
    for (const seat of [2, 3, 1, 0] as Seat[]) table.append(publicPlayer(model.game, seat));
    const sea = node('div', 'discard-table'); sea.setAttribute('aria-label', '中央牌河');
    for (const seat of [2, 3, 1, 0] as Seat[]) sea.append(river(model.game, seat));
    sea.append(tableCenter(model)); table.append(sea); main.append(heading, table, handAndActions(model, send));
    if (model.game.settlement) {
      resultDialog = result(model, send);
      const dialog = resultDialog;
      const reopen = button('查看本局結算', 'show-result', () => { dialog.showModal(); dialog.querySelector<HTMLElement>('h2')?.focus(); }, 'button button-primary result-reopen');
      dialog.addEventListener('close', () => reopen.focus({ preventScroll: true }));
      main.append(reopen, dialog);
    }
    shell.append(main);
  }
  shell.append(rules());
  const footer = node('footer', 'site-footer'); footer.append(node('span', '', '台灣十六張'), node('span', '', '本地運行 · 純積分 · TW16-CLASSIC-v1')); shell.append(footer);
  // ponytail: replace a small local table and restore focused controls; use keyed patching only if measured rendering cost warrants it.
  root.replaceChildren(shell);
  const table = root.querySelector('.table-grid'); if (table) table.scrollTop = tableScroll;
  restoreDetails();
  if (focus) {
    const target = Array.from(root.querySelectorAll<HTMLElement>('[data-focus]')).find(element => element.dataset.focus === focus);
    if (target && !target.matches(':disabled')) target.focus({ preventScroll: true });
    else if (['game', 'resume', 'start', 'next'].includes(focus) || focus.startsWith('tile-') || focus.startsWith('action-')) root.querySelector<HTMLElement>(model.game ? '[data-focus="hand-heading"]' : '[data-focus="home-entry"]')?.focus({ preventScroll: true });
  }
  if (resultDialog && showResult) { resultDialog.showModal(); resultDialog.querySelector<HTMLElement>('h2')?.focus(); }
}
