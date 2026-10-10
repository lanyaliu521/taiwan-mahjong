import { button, node, tile, tileName } from './view.js';
import type { buildHandReview } from './hand-review.js';
import type { Intent } from './model.js';

type Review = ReturnType<typeof buildHandReview>;
type Card = Review['cards'][number];
type Row = Card['rows'][number];
type Metrics = NonNullable<Row['candidate']['efficiency']>;
const seatName = (seat: number, own: number) => ['你', '下家', '對家', '上家'][(seat - own + 4) % 4];
export function reviewActionName(intent: Intent): string {
  switch (intent.type) {
    case 'DISCARD': return `打${tileName(intent.tileId)}`;
    case 'CHI': case 'PON': return `${intent.type === 'CHI' ? '吃' : '碰'}：用${intent.ownTiles.map(tileName).join('＋')}`;
    case 'PASS': return '過';
    case 'WIN': return intent.source === 'selfDraw' ? '自摸' : intent.source === 'robKong' ? '搶槓胡' : '胡牌';
    case 'KAN_OPEN': return '明槓';
    case 'KAN_CLOSED': return '暗槓';
    case 'KAN_ADDED': return '加槓';
    default: return '未提供比較的操作';
  }
}
export function reviewMetricsText(m: Metrics): string {
  const shanten = m.shanten < 0 ? '已成胡牌形' : m.shanten === 0 ? '聽牌' : `${m.shanten} 向聽`;
  if (m.improvementStatus !== 'supported') return `${shanten}；此時為17張，進張比例不適用。`;
  return `${shanten}；公開有效進張 ${m.improving} 張／未知一般牌 ${m.publicPoolTotal} 張。`;
}
/** Summary ordering is presentation only: chosen first, then at most two visible alternatives. */
export function reviewSummaryRows(card: Card): Row[] {
  const chosen = card.rows.filter(r => r.chosen);
  const alternatives = card.rows.filter(r => !r.chosen);
  return [...chosen, ...alternatives.filter(r => r.efficiencyPreferred), ...alternatives.filter(r => !r.efficiencyPreferred)].slice(0, 3);
}
function candidateView(row: Row, own: number): HTMLElement {
  const c = row.candidate, section = node('section', `review-candidate${row.chosen ? ' review-chosen' : ''}`);
  section.append(node('h4', '', `${reviewActionName(c.intent)}${row.chosen ? ' · 你的原選擇' : ''}`));
  if (row.efficiencyPreferred) section.append(node('p', 'review-tag', '限定牌效候選（可並列）'));
  if (c.efficiency) {
    section.append(node('p', '', `捨牌後｜${reviewMetricsText(c.efficiency)}`));
    const tiles = c.efficiency.effectiveTiles.filter(t => t.count > 0).map(t => `${tileName(t.kind)}×${t.count}`).join('、');
    section.append(node('p', 'muted', tiles ? `有效進張：${tiles}` : '目前沒有可計入的公開有效進張。'));
  } else if (c.postClaim) {
    section.append(node('p', '', c.postClaim.conditional), node('p', 'muted', c.postClaim.losesClosed ? '本次副露將失去門清。' : '此時已非門清。'));
    const post = node('details'); post.append(node('summary', '', '取得吃碰後，查看合法後捨牌效'));
    const choices = node('ul');
    for (const d of c.postClaim.discards) choices.append(node('li', '', `打${tileName(d.kind)}：${reviewMetricsText(d.efficiency)}${c.postClaim.preferredKinds.includes(d.kind) ? '（限定牌效並列候選）' : ''}`));
    post.append(choices, node('p', 'muted', c.postClaim.objective)); section.append(post);
    section.append(node('p', 'muted', '尚未評估吃碰後捨牌的安全與整體收益。'));
  } else section.append(node('p', 'muted', '此動作尚未提供牌效與安全比較；未提供數值不代表零風險。'));
  if (c.safety) {
    section.append(node('p', '', `普通放槍範圍｜${c.safety.opponents.map(p => `${seatName(p.seat, own)}：${p.status === 'proven' ? '有安全證明' : '未證明安全'}`).join('；')}`));
  }
  return section;
}
function visibleContext(card: Card): HTMLElement {
  const o = card.snapshot.observation, detail = node('details', 'review-context');
  detail.append(node('summary', '', '查看當時公開局況與自己的手牌'));
  detail.append(node('p', '', `${tileName(o.roundWind)}圈；莊家${seatName(o.dealer, o.seat)}，連莊${o.streak}；可用牌${o.available}張。`));
  const hand = node('div', 'review-tiles'); hand.setAttribute('aria-label', '決策前自己的暗手');
  o.self.concealed.forEach(t => hand.append(tile(t, 'tile-small'))); detail.append(hand);
  const offered = o.lastDiscard ?? o.offeredKong;
  if (offered) detail.append(node('p', '', `${seatName(offered.seat, o.seat)}${o.offeredKong ? '提出加槓' : '打出'}${tileName(offered.tileId)}。`));
  for (const [seat, p] of o.players.entries()) {
    const box = node('section'); box.append(node('h4', '', `${seatName(seat, o.seat)} · 積分${o.scores[seat]} · 暗手${p.concealedCount}張`));
    const melds = p.melds.map(m => 'tiles' in m ? `${{chi:'吃',pon:'碰',exposedKong:'明槓',addedKong:'加槓',concealedKong:'暗槓'}[m.kind]} ${m.tiles.map(tileName).join('、')}` : '暗槓（牌種未知）');
    box.append(node('p', '', `副露：${melds.join('；') || '無'}。花牌：${p.flowers.map(tileName).join('、') || '無'}。`));
    box.append(node('p', '', `捨牌順序：${p.discardHistory.map(d => `${tileName(d.tileId)}${d.claimedBy === null ? '' : '（已被取走）'}`).join('、') || '尚無'}。`));
    detail.append(box);
  }
  return detail;
}
export function showHandReview(root: HTMLElement, review: Review | null, pending: number, error = ''): void {
  if (document.querySelector('dialog[data-hand-review]')) return;
  const dialog = node('dialog', 'review-panel'); dialog.dataset.handReview = ''; dialog.setAttribute('aria-labelledby', 'hand-review-title');
  const top = node('div', 'review-top');
  const title = node('h2', '', '本局決策檢討'); title.id = 'hand-review-title'; title.tabIndex = -1;
  top.append(title, button('關閉檢討', 'review-close', () => dialog.close(), 'button button-secondary')); dialog.append(top);
  dialog.append(node('p', '', '回看你當時知道的資訊。這裡比較候選差異，不以後來輸贏判定唯一正解。'));
  if (pending) dialog.append(node('p', 'notice', `此頁有${pending}筆尚未保存，未納入本次檢討；關閉後可在「決策記錄與保存」重試。`));
  if (error) { const notice = node('p', 'notice', error); notice.setAttribute('role', 'alert'); dialog.append(notice); }
  else if (review) {
    dialog.append(node('p', 'muted', `${review.limitation} 本局保留${review.retainedForHand}筆，顯示${review.shown}筆可比較決策。`));
    if (!review.cards.length) dialog.append(node('p', '', '本局尚無可比較的已保存決策。舊牌局、尚未存妥或只有「過」的記錄可能不會出現在這裡。'));
    const cards: HTMLElement[] = [];
    if (review.cards.length) {
      const label = node('label', 'review-picker', '選擇要檢討的決策');
      const select = node('select'); select.setAttribute('aria-label', '選擇要檢討的決策');
      review.cards.forEach((card, index) => { const option = node('option', '', `${index + 1}／${review.cards.length} · ${reviewActionName(card.snapshot.chosen)}`); option.value = String(index); select.append(option); });
      select.addEventListener('change', () => { cards.forEach((card, i) => card.hidden = i !== Number(select.value)); });
      label.append(select); dialog.append(label);
    }
    for (const [index, card] of review.cards.entries()) {
      const section = node('article', 'review-card');
      section.hidden = index !== 0; cards.push(section);
      section.append(node('h3', '', `決策 ${index + 1} · ${reviewActionName(card.snapshot.chosen)}`), node('p', 'muted', card.selectionNote));
      const summary = reviewSummaryRows(card);
      summary.forEach(row => section.append(candidateView(row, card.snapshot.observation.seat)));
      const rest = card.rows.filter(row => !summary.includes(row));
      if (rest.length) {
        const more = node('details', 'review-more'); more.append(node('summary', '', `其他 ${rest.length} 個合法候選（同牌種副本已合併）`));
        rest.forEach(row => more.append(candidateView(row, card.snapshot.observation.seat))); section.append(more);
      }
      section.append(node('p', 'review-limit', '公開有效進張／未知一般牌是可見資訊下的張數比，包含他家暗手與牌尾，並非實際摸牌率。安全證明只限當時對指定家普通放槍，不含未來自摸、花胡或續莊；未知不等於危險。'));
      section.append(node('p', 'review-limit', card.evidence.discardPreference.objective), node('p', 'review-limit', card.evidence.overallStrategy.explanation));
      if (card.rows.some(r => r.candidate.postClaim)) section.append(node('p', 'review-limit', card.claimNote));
      section.append(visibleContext(card)); dialog.append(section);
    }
  }
  dialog.append(button('回到本局結算', 'review-done', () => dialog.close(), 'button button-primary'));
  dialog.addEventListener('close', () => { dialog.remove(); root.querySelector<HTMLElement>('[data-focus="review-open"]')?.focus({ preventScroll: true }); }, { once: true });
  document.body.append(dialog); dialog.showModal(); title.focus();
}
