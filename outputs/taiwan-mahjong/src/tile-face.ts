import type { TileKind } from './model.js';

// Original vector faces. All geometry and text come from these fixed tile tables.
const blue = '#233f68', green = '#19714e', red = '#bd3732', gold = '#b88921';
const numerals = '一二三四五六七八九', honors = '東南西北中發', flowers = '春夏秋冬梅蘭菊竹';
// ponytail: local Kai/serif fonts avoid a download; bundle licensed glyph outlines if identical lettering becomes required.
const font = "'DFKai-SB','KaiTi','BiauKai','Noto Serif TC',serif";
const text = (value: string, x: number, y: number, size: number, color: string) =>
  `<text x="${x}" y="${y}" fill="${color}" font-size="${size}" font-family="${font}" font-weight="700" text-anchor="middle">${value}</text>`;

function dot(x: number, y: number, color: string, radius = 9): string {
  return `<g fill="none" stroke="${color}"><circle cx="${x}" cy="${y}" r="${radius}" stroke-width="2.4"/><circle cx="${x}" cy="${y}" r="${radius * .58}" stroke-width="1.5"/><circle cx="${x}" cy="${y}" r="${radius * .18}" fill="${color}" stroke="none"/></g>`;
}
function circles(rank: number): string {
  if (rank === 1) {
    const petals = Array.from({ length: 12 }, (_, n) => `<ellipse cx="30" cy="28" rx="2.7" ry="6" transform="rotate(${n * 30} 30 42)"/>`).join('');
    return `<g fill="${green}" stroke="${green}"><circle cx="30" cy="42" r="23" fill="none" stroke-width="2.8"/><circle cx="30" cy="42" r="19.5" fill="none" stroke-width="1.2"/>${petals}</g>${dot(30, 42, red, 8)}`;
  }
  const positions: Record<number, [number, number, string][]> = {
    2: [[30, 22, blue], [30, 62, green]],
    3: [[15, 19, blue], [30, 42, red], [45, 65, green]],
    4: [[16, 20, blue], [44, 20, green], [16, 64, green], [44, 64, blue]],
    5: [[16, 20, blue], [44, 20, green], [30, 42, red], [16, 64, green], [44, 64, blue]],
    6: [[16, 18, green], [44, 18, green], [16, 43, red], [44, 43, red], [16, 67, red], [44, 67, red]],
    7: [[15, 15, green], [30, 24, green], [45, 33, green], [16, 50, red], [44, 50, red], [16, 69, red], [44, 69, red]],
    8: [14, 33, 52, 71].flatMap(y => [[18, y, blue], [42, y, blue]] as [number, number, string][]),
    9: [18, 42, 66].flatMap((y, row) => [15, 30, 45].map(x => [x, y, [blue, red, green][row]] as [number, number, string])),
  };
  return positions[rank].map(([x, y, color]) => dot(x, y, color, rank === 2 ? 11 : rank === 9 ? 6.5 : rank >= 7 ? 7.4 : 9)).join('');
}

function bamboo(x: number, y: number, color: string, length = 26, angle = 0): string {
  return `<g transform="translate(${x} ${y}) rotate(${angle})"><rect x="-3.3" y="${-length / 2}" width="6.6" height="${length}" rx="3.3" fill="${color}"/><path d="M-2.3 ${-length / 6}h4.6 M-2.3 ${length / 6}h4.6" stroke="#fffaf0" stroke-width="1.2"/><path d="M-.8 ${-length / 2 + 3}v${length - 6}" stroke="#fffaf0" stroke-width=".8" opacity=".5"/></g>`;
}
function sticks(rank: number): string {
  if (rank === 1) return `<g stroke="${green}" stroke-linecap="round" stroke-linejoin="round"><path d="M30 44Q9 51 11 70Q20 65 25 59Q18 72 25 76Q30 66 33 59Q39 73 47 70Q43 55 36 47" fill="none" stroke-width="2"/><path d="M36 21Q23 27 22 42Q19 56 31 58Q43 57 43 44Q44 33 37 28Q42 24 41 18Q40 12 34 13Q29 14 29 19Z" fill="${green}" stroke-width="1.8"/><path d="M34 32Q26 36 26 47Q27 55 32 55Q40 50 39 40Z" fill="#fffaf0" stroke-width="1.6"/><path d="M33 36Q29 46 32 51 M36 37Q33 46 35 49 M29 20L21 17 M30 17L25 12 M27 60L22 72 M32 61L31 75" fill="none" stroke-width="1.5"/><path d="M42 19L49 22L41 24" fill="${red}" stroke="${red}"/><circle cx="36" cy="19" r="1.7" fill="#fffaf0" stroke="none"/></g>`;
  if (rank === 8) return [[14, 21, 0], [24, 27, 40], [36, 27, -40], [46, 21, 0], [14, 63, 0], [24, 57, -40], [36, 57, 40], [46, 63, 0]].map(([x, y, angle]) => bamboo(x, y, green, 24, angle)).join('');
  const positions: Record<number, [number, number, string][]> = {
    2: [[30, 22, green], [30, 62, green]],
    3: [[30, 21, green], [17, 62, green], [43, 62, green]],
    4: [[17, 22, green], [43, 22, green], [17, 62, green], [43, 62, green]],
    5: [[15, 22, green], [45, 22, green], [30, 42, red], [15, 62, green], [45, 62, green]],
    6: [22, 62].flatMap(y => [14, 30, 46].map(x => [x, y, green] as [number, number, string])),
    7: [[30, 16, red], ...[42, 68].flatMap(y => [14, 30, 46].map(x => [x, y, green] as [number, number, string]))],
    9: [17, 42, 67].flatMap(y => [14, 30, 46].map((x, col) => [x, y, [blue, red, green][col]] as [number, number, string])),
  };
  return positions[rank].map(([x, y, color]) => bamboo(x, y, color, rank >= 7 ? 19 : 27)).join('');
}

function flower(rank: number): string {
  const leafy = rank === 2 || rank === 8;
  let art = `<path d="M17 45Q22 30 19 15" fill="none" stroke="${green}" stroke-width="1.8"/>`;
  if (leafy) art += `<g fill="${green}"><path d="M19 22Q4 18 10 10Q20 13 19 22 M20 30Q29 12 35 16Q33 27 20 30 M19 37Q3 31 8 25Q17 26 19 37 M17 44Q30 30 33 36Q29 43 17 44"/></g>`;
  else {
    const chrysanthemum = rank === 3 || rank === 7;
    const orchid = rank === 6;
    const count = chrysanthemum ? 12 : 5;
    const color = chrysanthemum ? gold : orchid ? '#a34c80' : '#c54b60';
    art += `<g fill="${color}">${Array.from({ length: count }, (_, n) => `<ellipse cx="20" cy="${chrysanthemum ? 17 : 16}" rx="${chrysanthemum ? 2 : orchid ? 3 : 4.6}" ry="${chrysanthemum ? 6 : 6.3}" transform="rotate(${n * 360 / count} 20 24)"/>`).join('')}</g><circle cx="20" cy="24" r="2.5" fill="${gold}"/><path d="M18 40Q7 38 8 32Q15 32 18 40 M20 34Q27 26 30 30Q28 36 20 34" fill="${green}"/>`;
  }
  return art + text(flowers[rank - 1], 36, 72, 31, rank <= 4 ? red : blue);
}

/** Decorative face only; the containing tile supplies its accessible name. */
export function tileFace(kind: TileKind): SVGSVGElement {
  if (!/^(?:[1-9][mps]|[1-7]z|f[1-8])$/.test(kind)) throw new RangeError(`Unknown tile face: ${kind}`);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 60 84');
  svg.setAttribute('width', '100%'); svg.setAttribute('height', '100%');
  svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
  svg.style.pointerEvents = 'none';
  const rank = Number(kind[0] === 'f' ? kind[1] : kind[0]);
  if (kind[0] === 'f') svg.innerHTML = flower(rank);
  else if (kind[1] === 'p') svg.innerHTML = circles(rank);
  else if (kind[1] === 's') svg.innerHTML = sticks(rank);
  else if (kind[1] === 'm') svg.innerHTML = text(numerals[rank - 1], 30, 36, 33, blue) + text('萬', 30, 72, 34, red);
  else if (rank === 7) svg.innerHTML = `<g fill="none" stroke="${blue}" stroke-width="2.5" stroke-linejoin="round"><rect x="12" y="13" width="36" height="58" rx="1"/><path d="M19 19H41L43 23V61L39 65H21L17 61V23Z M12 13L19 19 M48 13L41 19 M12 71L21 65 M48 71L39 65"/></g>`;
  else svg.innerHTML = text(honors[rank - 1], 30, 61, 49, rank === 5 ? red : rank === 6 ? green : blue);
  return svg;
}
