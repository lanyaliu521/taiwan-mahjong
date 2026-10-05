import type { Decomposition, ScoreInput, ScoreItem, ScoreResult, Seat } from './model.js';
import { decompose, winningTiles } from './hand.js';
import { kindOf } from './tiles.js';

type Assignment = { group: number; wait: 'pair' | 'triplet' | 'closed' | 'edge' | 'twoSided' };
function assignments(hand: Decomposition, winning: string | null, declared: number): Assignment[] {
  if (winning === null) return [{ group: -1, wait: 'pair' }];
  const result: Assignment[] = hand.pair === winning ? [{ group: -1, wait: 'pair' }] : [];
  hand.groups.forEach((g, i) => {
    if (i < declared || !g.tiles.includes(winning)) return;
    const at = g.tiles.indexOf(winning);
    const wait = g.kind === 'triplet' ? 'triplet' : at === 1 ? 'closed' :
      (g.tiles[0][0] === '1' && at === 2) || (g.tiles[0][0] === '7' && at === 0) ? 'edge' : 'twoSided';
    result.push({ group: i, wait });
  });
  return result;
}

/** Structural scoring only; passed wins, replacement bans and flower-victory triggers belong to the engine. */
export function evaluateHand(input: ScoreInput): ScoreResult | null {
  const hands = decompose(input.concealed, input.melds);
  if (!hands.length || !['selfDraw', 'ron', 'robKong'].includes(input.source)) return null;
  if (!/^[1-4]z$/.test(input.seatWind) || !/^[1-4]z$/.test(input.roundWind)) return null;
  if (!Array.isArray(input.flowers) || input.flowers.some(f => typeof f !== 'string')) return null;
  const flowers = input.flowers.map(kindOf);
  if (flowers.some(f => !/^f[1-8]$/.test(f)) || new Set(flowers).size !== flowers.length) return null;
  const concealed = input.concealed.map(kindOf);
  const winning = input.winningTile === null ? null : kindOf(input.winningTile);
  const selfDraw = input.source === 'selfDraw';
  if (winning === null ? !input.heavenly || !selfDraw || input.melds.length !== 0 : !concealed.includes(winning)) return null;
  const prior = [...concealed];
  if (winning !== null) prior.splice(prior.indexOf(winning), 1);
  const waits = winning === null ? [] : winningTiles(prior, input.melds);
  const closed = input.melds.every(m => m.kind === 'concealedKong');
  const all = concealed.concat(input.melds.flatMap(m => m.tiles.map(kindOf)));
  const suits = new Set(all.filter(t => t[1] !== 'z').map(t => t[1]));
  const honors = all.some(t => t[1] === 'z');
  let best: ScoreResult | null = null;
  let bestKey = '';
  for (const hand of hands) for (const assignment of assignments(hand, winning, input.melds.length)) {
    const items: ScoreItem[] = [];
    const excluded: string[] = [];
    const add = (id: string, tai: number, reason: string, condition = true): void => { if (condition) items.push({ id, tai, reason }); };
    const remove = (by: string, ...ids: string[]): void => {
      for (const id of ids) {
        const found = items.findIndex(item => item.id === id);
        if (found !== -1) { items.splice(found, 1); excluded.push(`${id} 由 ${by} 取代`); }
      }
    };
    const triplets = hand.groups.filter(g => g.kind === 'triplet').map(g => g.tiles[0]);
    const dragons = triplets.filter(t => /^[5-7]z$/.test(t)).length;
    const winds = triplets.filter(t => /^[1-4]z$/.test(t)).length;
    const dark = input.melds.filter(m => m.kind === 'concealedKong').length +
      hand.groups.slice(input.melds.length).filter(g => g.kind === 'triplet').length -
      (!selfDraw && assignment.wait === 'triplet' ? 1 : 0);
    add('S01', 1, '自摸', selfDraw);
    add('S02', 1, '門清', closed);
    add('S03', dragons, `三元 ${dragons} 組`, dragons > 0);
    add('S04', 1, '圈風', triplets.includes(input.roundWind));
    add('S05', 1, '門風', triplets.includes(input.seatWind));
    let properFlowers = 0;
    let bouquets = 0;
    for (const offset of [0, 4]) {
      const complete = [1, 2, 3, 4].every(n => flowers.includes(`f${n + offset}`));
      const proper = flowers.includes(`f${Number(input.seatWind[0]) + offset}`);
      if (complete) { bouquets++; excluded.push(`S06 ${offset === 0 ? '四季' : '四君子'}正花由 S11 取代`); }
      else if (proper) properFlowers++;
    }
    add('S06', properFlowers, `正花 ${properFlowers} 張`, properFlowers > 0);
    add('S07', 1, '獨聽', waits.length === 1 && ['closed', 'edge', 'pair'].includes(assignment.wait));
    add('S08', 1, '搶槓', input.source === 'robKong');
    add('S09', 1, '槓上開花', selfDraw && input.afterReplacement === true);
    add('S10', 1, '海底撈月', selfDraw && input.lastAvailable === true);
    add('S11', bouquets * 2, `花槓 ${bouquets} 組`, bouquets > 0);
    add('S12', 2, '全求人', !selfDraw && input.melds.length === 5 && input.melds.every(m => m.kind !== 'concealedKong'));
    add('S13', 2, '平胡', input.source === 'ron' && triplets.length === 0 && !honors && flowers.length === 0 && assignment.wait === 'twoSided' && waits.length >= 2);
    add('S14', 2, '三暗刻', dark >= 3);
    add('S15', 3, '門清一摸三', closed && selfDraw);
    add('S16', 4, '碰碰胡', triplets.length === 5);
    add('S17', 4, '混一色', suits.size === 1 && honors);
    add('S18', 4, '小三元', dragons === 2 && /^[5-7]z$/.test(hand.pair));
    add('S19', 5, '四暗刻', dark >= 4);
    add('S20', 8, '五暗刻', dark === 5);
    add('S21', 8, '清一色', suits.size === 1 && !honors);
    add('S22', 8, '小四喜', winds === 3 && /^[1-4]z$/.test(hand.pair));
    add('S23', 8, '大三元', dragons === 3);
    add('S26', 16, '字一色', suits.size === 0);
    add('S27', 16, '大四喜', winds === 4);
    add('S28', 16, '人胡', input.human === true && input.source === 'ron' && input.melds.length === 0);
    add('S29', 16, '地胡', input.earthly === true && selfDraw && input.melds.length === 0);
    add('S30', 16, '天胡', input.heavenly === true && selfDraw && input.melds.length === 0);
    for (const [by, ids] of [
      ['S15', ['S01', 'S02']], ['S18', ['S03']], ['S19', ['S14']], ['S20', ['S14', 'S19']],
      ['S22', ['S04', 'S05']], ['S23', ['S03', 'S18']], ['S26', ['S16']], ['S27', ['S04', 'S05', 'S22']],
      ['S28', ['S02']], ['S29', ['S01', 'S02', 'S15']], ['S30', ['S01', 'S02', 'S07', 'S09', 'S15']],
    ] as const) if (items.some(item => item.id === by)) remove(by, ...ids);
    const tai = items.reduce((sum, item) => sum + item.tai, 0);
    const key = items.map(i => i.id).join(',') + JSON.stringify(hand) + JSON.stringify(assignment);
    if (best === null || tai > best.tai || tai === best.tai && key < bestKey) {
      best = { tai, items, excluded, decomposition: hand };
      bestKey = key;
    }
  }
  return best;
}

export function settlePayments(winner: Seat, payers: Seat[], baseTai: number, dealer: Seat, streak: number): number[] {
  const validSeat = (s: number): boolean => Number.isInteger(s) && s >= 0 && s <= 3;
  if (!validSeat(winner) || !validSeat(dealer) || !Number.isSafeInteger(baseTai) || baseTai < 0 || !Number.isSafeInteger(streak) || streak < 0 ||
      !Array.isArray(payers) || payers.length === 0 || new Set(payers).size !== payers.length || payers.some(s => !validSeat(s) || s === winner)) throw new Error('INVALID_PAYMENT');
  const delta = [0, 0, 0, 0];
  for (const payer of payers) {
    const amount = 30 + 10 * (baseTai + (payer === dealer || winner === dealer ? 1 + 2 * streak : 0));
    if (!Number.isSafeInteger(amount) || !Number.isSafeInteger(delta[winner] + amount)) throw new Error('INVALID_PAYMENT');
    delta[payer] -= amount;
    delta[winner] += amount;
  }
  return delta;
}
