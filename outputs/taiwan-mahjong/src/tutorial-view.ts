import { button, node, tile, tileName } from './view.js';

const titles = ['認識台灣十六張', '練一次選牌與出牌', '134 遇到 2，怎麼吃？', '碰、槓與按過', '五面子一對才是胡牌形', '看懂提示，再回牌桌'];

/** A local UI exercise: never receives a game, hidden tiles, save data or game commands. */
export function showTutorial(root: HTMLElement): void {
  const dialog = node('dialog', 'tutorial-panel'); dialog.setAttribute('aria-labelledby', 'tutorial-title');
  let step = 0;
  const close = () => dialog.close();
  dialog.addEventListener('close', () => { dialog.remove(); root.querySelector<HTMLElement>('[data-focus="tutorial"]')?.focus({ preventScroll: true }); }, { once: true });
  function render(): void {
    const heading = node('h2', '', titles[step]); heading.id = 'tutorial-title'; heading.tabIndex = -1;
    const top = node('div', 'tutorial-top'); top.append(node('p', 'eyebrow', `新手操作教學 · ${step + 1}／${titles.length}`), button('關閉教學', 'tutorial-close', close, 'button button-quiet'));
    const body = node('div', 'tutorial-body');
    const text = (content: string) => body.append(node('p', '', content));
    const cards = (kinds: string[]) => { const row = node('div', 'tutorial-tiles'); kinds.forEach(k => row.append(tile(k, 'tile-small'))); body.append(row); };
    if (step === 0) {
      text('本遊戲是台灣16張：平時16張，摸牌後17張，通常捨1張回16張。你與3位公平電腦輪流行牌，真人操作不限時。');
      cards(['1m', '5m', '9m', '1p', '5p', '9p', '1s', '5s', '9s']);
      text('萬、筒、索各有1到9；同花色連續3張是順子，同牌3張是刻子。東南西北中發白不能組順子。花牌不放進一般胡牌形，亮出後通常自動補牌；花胡例外由遊戲判定，例如一家已有七花、別家亮出最後一花時立即結算，不再補牌。');
      cards(['1z', '2z', '3z', '4z', '5z', '6z', '7z', 'f1']);
      text('以下是獨立示範，不改目前牌局或練習存檔。開啟教學會暫停對戰，關閉後需自行繼續。桌規以本遊戲TW16-CLASSIC-v1為準。');
    } else if (step === 1) {
      text('先單擊或Tab選牌看清楚，再快速連點同一張兩次打出；Enter／空白鍵也能出牌。先在這副示範手牌試一次。');
      const hand = node('div', 'hand tutorial-hand'); hand.setAttribute('role', 'group'); hand.setAttribute('aria-label', '示範手牌，不影響正式牌局');
      const status = node('p', 'tutorial-feedback', '示範手牌17張；先選一張。'); status.setAttribute('role', 'status'); status.tabIndex = -1;
      const kinds = ['1m','3m','4m','6m','7m','1p','2p','3p','4p','5p','6p','7s','8s','9s','1z','1z','2m'];
      let last: { index: number; time: number } | null = null, played = false;
      const select = (index: number) => {
        last = null;
        for (const [i, control] of Array.from(hand.querySelectorAll('button')).entries()) { control.classList.toggle('selected', i === index); control.setAttribute('aria-pressed', String(i === index)); }
        status.textContent = `已選${tileName(kinds[index])}；雙擊同張、Enter或空白鍵才出牌。手牌仍17張。`;
      };
      const play = (index: number) => {
        if (played) return; played = true;
        hand.children[index].remove();
        for (const control of Array.from(hand.querySelectorAll<HTMLButtonElement>('button'))) control.disabled = true;
        status.textContent = `已打出${tileName(kinds[index])}，手牌16張。真正對戰接著等待其他玩家行牌；練習模式則按「摸下一張」。`;
        status.focus();
      };
      kinds.forEach((kind, index) => {
        const control = button('', `tutorial-tile-${index}`, event => {
          if (played) return;
          if (!event.detail) { play(index); return; }
          const now = performance.now();
          if (last?.index === index && now - last.time <= 450) { last = null; play(index); }
          else { select(index); last = { index, time: now }; }
        }, 'hand-tile');
        control.setAttribute('aria-label', tileName(kind)); control.setAttribute('aria-pressed', 'false'); control.append(tile(kind));
        control.addEventListener('focus', () => { if (!played) select(index); });
        control.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); if (!event.repeat) play(index); } });
        hand.append(control);
      }); body.append(hand, status);
    } else if (step === 2) {
      text('只看相關手牌134萬，上家打出2萬。可以用13吃成123，也可以用34吃成234；兩種選項都要保留。試選一種。');
      cards(['1m','3m','4m']);
      const choices = node('div', 'tutorial-choices'), example = node('div', 'tutorial-example');
      const feedback = node('p', 'tutorial-feedback', '吃只能取上家捨牌；吃後仍要捨1張。'); feedback.setAttribute('role', 'status');
      for (const [own, sequence, ban] of [[['1m','3m'],['1m','2m','3m'],'二萬'],[['3m','4m'],['2m','3m','4m'],'二萬、五萬']] as const) {
        const control = button(`吃 ${own.map(tileName).join('＋')}`, `tutorial-chi-${own.join('-')}`, () => {
          example.replaceChildren(node('p', '', '亮出的順子')); sequence.forEach(k => example.append(tile(k, 'tile-small')));
          feedback.textContent = `本次吃後不可捨${ban}；從其餘合法手牌選1張。吃碰後不能立即槓或自摸。真正牌局只顯示合法操作。`;
        }, 'button button-secondary'); choices.append(control);
      } body.append(choices, example, feedback);
      text('有人胡牌時先處理胡，再碰或明槓，最後才是吃；回應選項不保證最後取得那張牌。');
    } else if (step === 3) {
      cards(['5p','5p','5p']);
      text('碰：手中2張相同牌，加上別家捨出的1張。碰後要捨1張，本次不能捨碰牌同種，也不能立即槓或自摸。');
      text('槓：4張相同牌成槓，由遊戲補牌。暗槓用自己4張；加槓補已碰的第4張，先詢問搶槓；本桌明槓不能取上家，且補牌後本次不能一般自摸。操作以當下合法按鈕為準。');
      text('按「過」：放棄這次回應。放棄合法胡牌會過水，不是下一次摸牌就一定解除；放棄碰牌也有過碰限制。確定不胡再按過，規則詳解可在牌桌下方展開。');
    } else if (step === 4) {
      text('一般胡牌形是5組面子加1對將，共17張等效牌。這就是台灣16張，不是13張的四面子一對。副露的吃碰各算1組，槓結構也算3張，實體仍有4張。');
      const groups = node('div', 'tutorial-groups');
      for (const group of [['1m','2m','3m'],['4m','5m','6m'],['2p','3p','4p'],['3s','4s','5s'],['7s','8s','9s'],['1z','1z']]) {
        const block = node('div', 'tutorial-group'); group.forEach(k => block.append(tile(k, 'tile-small'))); block.append(node('span', '', group.length === 2 ? '一對將' : '一組面子')); groups.append(block);
      } body.append(groups);
      text('牌型完成也要符合當下胡牌資格；例如過水、吃碰後或明槓補牌可能不能一般胡。看到「胡牌／自摸」按鈕，才是此刻可以操作。特殊花胡由遊戲自動判定。');
      text('結算直接彈出，先看本局變動與總分，再展開拆法、計台明細；按「下一局」才繼續。結算重開不會再次扣分。');
    } else {
      text('向聽是距離聽牌的結構下限：0向聽就是聽牌；1向聽至少再1次有效改善可聽牌。它不是還需摸幾次，也不是胡牌承諾。拆法示例是一種最近目標分配，不保證最多搭子。');
      text('單擊手牌可比較捨牌後的向聽與有效牌。向聽相同再比較剩餘有效張數；0張表示後續未知牌估計中已無該牌，不能只看「已聽牌」；當下已有合法胡牌按鈕時仍可胡。吃碰的牌效建議也不包含台數、防守或槓後風險。');
      text('對戰比例只用公開資訊，未知牌包含別家暗手及牌尾，不是實際摸牌機率。純練習沒有對手，使用136張一般牌的不放回牌池，顯示下一張改善機率。');
      text('想慢慢熟悉操作，先進「純練習模式」；回對戰時先按「繼續牌局」。教練可收合或關閉，隨時從「新手教學」再看一遍。');
    }
    const footer = node('div', 'tutorial-footer');
    footer.append(button('上一步', 'tutorial-prev', () => { step--; render(); }, 'button button-secondary', step === 0), button(step === titles.length - 1 ? '完成，回到原畫面' : '下一步', 'tutorial-next', () => { if (step === titles.length - 1) close(); else { step++; render(); } }, 'button button-primary'));
    dialog.replaceChildren(top, heading, body, footer); heading.focus({ preventScroll: true }); dialog.scrollTop = 0;
  }
  document.body.append(dialog); render(); dialog.showModal(); dialog.querySelector<HTMLElement>('h2')!.focus();
}
