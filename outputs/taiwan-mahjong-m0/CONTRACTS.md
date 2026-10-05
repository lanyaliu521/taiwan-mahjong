# M0 資料與操作契約

版本：1｜日期：2026-10-04｜規則：TW16-CLASSIC-v1

本文件固定模組間資料；玩法、台表、互斥、過水與花胡一律以同目錄 `RULES.md` 為權威。以下是概念 schema，不是已實作程式。平台已確定為 GitHub Pages 靜態網頁，TypeScript＋Vite＋原生畫面；不需要後端、SSR、頁面路由或 LLM。

## 1. 牌與座位

- `TileKind`：`1m..9m` 萬、`1p..9p` 筒、`1s..9s` 索；`1z` 東、`2z` 南、`3z` 西、`4z` 北、`5z` 中、`6z` 發、`7z` 白；以上共 34 種，每種四張。
- `FlowerKind`：`f1` 春、`f2` 夏、`f3` 秋、`f4` 冬、`f5` 梅、`f6` 蘭、`f7` 菊、`f8` 竹，各一張。
- `TileId` 固定為 `kind#copy`：一般牌 copy 為 `0..3`，花牌僅 `#0`，合計 144 個 ID。運算可用固定順序的 34 格數量向量；花牌另列，不進一般胡牌拆解。
- `Seat = 0|1|2|3`，固定桌位依序下、右、上、左；真人為 0。逆時針下家 `next(s)=(s+1)%4`，上家 `(s+3)%4`。初莊隨機；桌位不等於門風。
- `Wind = 1z|2z|3z|4z`。門風按 `(seat-dealer+4)%4` 對應東南西北；圈風按本將已移莊次數 `floor(dealerAdvances/4)` 推進。連莊不增加移莊次數；第 16 次移莊完成本將，不產生第五圈。

## 2. GameState

```text
GameState {
  schemaVersion, rulesVersion, matchId, handId, version, eventSeq;
  initialDealer, dealer, dealerAdvances, roundWind, streak, scores[4];
  wall: { order: TileId[], head, tail, reserveCount: 16 };
  players[4]: { concealed, melds, flowers, discardHistory, restrictions };
  phase, turn, drawContext, openingContext, pending, aiRandom[3];
  acceptedOpIds, settlement;
}
```

`head/tail` 為未取區間的含端點游標；頭摸尾補各消耗一張。未取張數 `U=max(0,tail-head+1)`，可用張數 `A=max(0,U-16)`。留 16 是數量界線，不是固定 ID 死牆；每次取牌前重查 A。`order` 只是位置參照，只有未取區間中的牌仍屬牌牆。

副露含 `meldId、kind、tiles、fromSeat、sourceEvent`，kind 為吃、碰、明槓、暗槓、加槓；暗槓來源座位為空。牌河歷史記錄 `tileId、eventSeq、claimedBy`：被取走後僅是歷史引用，不再擁有該牌。每個實體 ID 同時只歸牌牆、暗手、副露、花牌、未取走捨牌或結算區其中一處。

`restrictions` 保留 RULES 定義的過水啟用／原因事件、過碰牌種與解除時點、最後自捨牌種、當回合禁打牌種／來源；不得用「日麻振聽」欄位取代。`drawContext` 保存本回合原始來源、最近一次補牌原因、連續補花鏈與末張資訊，另存 `selfDrawForbiddenThisTurn`；明槓將此旗標設真，同回合再暗槓／加槓／補花不可清除，捨牌結束該回合後重設。`openingContext` 保存各家摸打次數及中斷事件，支援天／地／人胡判定。

`phase` 為：`setup`、`initialFlowers`、`awaitDraw`、`awaitDiscard`、`awaitClaims`、`awaitRobKong`、`awaitReplacement`、`handResult`、`matchResult`。`awaitDiscard` 也涵蓋摸補後自摸／槓的自家選擇，另依進牌來源決定合法操作；起手完成的莊家直接進此階段，不能進 `awaitDraw`。`pending` 依階段保存補花輪次／佇列、補牌原因，或回應窗的 `windowId、sourceSeat、tileId、eligibleSeats、responses`；待搶槓另存原碰與第四張牌的引用，第四張仍歸暗手且鎖定，不成為第二個所有權位置。一般穩定手牌等效張數為暗手數＋3×副露組數，待摸為 16、待打為 17；過渡階段另驗證。花胡依 RULES R13/R14 判定，包含七搶一及開局花胡的 E16 例外；七／一按花牌分布判斷，不搬動花牌所有權。

## 3. Action 與純函式

```text
Action = { opId, matchId, handId, version, actor, intent }
intent = DEAL | DRAW | REPLACE | RESOLVE | NEXT_HAND
       | DISCARD(tileId)
       | CHI(windowId, ownTiles[2]) | PON(windowId, ownTiles[2])
       | KAN_OPEN(windowId, ownTiles[3]) | KAN_CLOSED(ownTiles[4])
       | KAN_ADDED(meldId, tileId)
       | WIN(source, windowId?) | PASS(windowId)
```

`actor` 為 Seat 或引擎；前五種只由流程控制器於對應階段提交。`source` 僅可為自摸、放銃、搶槓，且須符合當前窗口；強制花胡由引擎 `RESOLVE`，不提供玩家花胡／過的選項。自己回合的出牌／槓等選擇若涉及放棄胡牌，由引擎依 RULES 更新過水，不讓 UI 自填禁制。

- `legalActions(state, seat)`：回傳該家目前可選的精確意圖與可顯示理由；無合法行動時回空陣列，不改狀態。
- `applyAction(state, action)`：驗證版本、局別、操作者、牌權與完整合法性；成功回 `{state, events}` 並遞增 version，失敗回代碼及原狀態。opId 重複不再套用；舊版本回 `STALE_VERSION`，控制器重新取得動作，不自動重送舊選擇。每次提交原子完成，不存半個動作。
- 回應窗保留已回答者；各玩家以最新 version 提交同一 windowId。裁決只按 RULES 優先序及座次，不能按回應抵達順序；尚有影響結果的合法回應未收到前不得結束。
- `getObservation(state, seat)`：只回該家暗手、自己的暗槓、公開牌與局況、合法操作、自身限制及剩餘可用張數。他家暗手只給數量，暗槓只給四張蓋牌；不含牌牆順序、洗牌種子、未公開牌 ID、他家限制或未揭露回應。不得直接展開 GameState 後刪少數欄位。
- `evaluateWin(input)`：輸入暗手、副露、花牌、候選胡牌及來源／門風／圈風等事件上下文；胡牌張若不在暗手只供求解引用，不複製實體 ID。回傳結構可胡、可宣告、拒絕理由、所有合法拆解、最高合法計台、台項／排除理由及花胡種類。結構判斷不受過水反向污染；五面子一對，不能使用四面子模型。付款另依 RULES 與莊家上下文產生四家增減。

胡牌輸入必須帶來源與可空的 `winningTileId`：一般自摸時胡牌張已在 E17 暗手，不再加一張；放銃／搶槓時暗手仍 E16，以外部 ID 虛擬加入求解。天胡的暗手已 E17，沒有唯一末張時 ID 可空，枚舉可用歸屬並依 S30 排除獨聽。純花胡可沒有普通胡牌張，按 R14 分支直接產生花胡結果；不可先用一般牌數擋掉。

階段與操作的最低契約如下；所有結果都還需遵守 RULES 的花胡／尾牌終止優先序：

| 當前階段 | 允許入口 | 正常結果 |
|---|---|---|
| setup | 引擎 DEAL | 發牌完成至 initialFlowers，記錄欠補 |
| initialFlowers | 引擎 REPLACE／RESOLVE | 按補花輪次取牌；完成後檢查花胡，未結束則莊 awaitDiscard |
| awaitDraw | 引擎 DRAW | 普通牌至 awaitDiscard；花至 awaitReplacement；A0 不抽牌並結束 |
| awaitReplacement | 引擎 REPLACE／RESOLVE | 每次只抽一張；花保持此階段，補完至 awaitDiscard，無補依R12/R14終止 |
| awaitDiscard | 當事人 DISCARD／KAN_CLOSED／KAN_ADDED／WIN | 捨牌至 awaitClaims；暗槓至 awaitReplacement；加槓至 awaitRobKong；胡至 handResult |
| awaitClaims | 各有資格玩家 CHI／PON／KAN_OPEN／WIN／PASS，引擎 RESOLVE | 胡至 handResult；吃碰至該家 awaitDiscard；明槓至 awaitReplacement；無人要牌至下家 awaitDraw或流局 |
| awaitRobKong | 有資格者 WIN／PASS，引擎 RESOLVE | 搶槓至 handResult；無人胡才完成槓，至 awaitReplacement |
| handResult | 引擎 NEXT_HAND（由真人下一局按鈕觸發） | 只推進一次莊圈，再進 setup；一將結束至 matchResult |
| matchResult | 應用層開始新一將 | 新matchId及初始局面；不得沿用舊動作 |

`DEAL` 可原子發完65張；補花與行牌中的每次 `DRAW/REPLACE` 只抽一張。無合法回應的視窗由引擎結束；仍有可能影響結果的真人未答，不能RESOLVE。自家 `DISCARD` 的牌須在暗手且未鎖定、非禁打牌；每個槓／副露的 ownTiles 必須互異且實際屬於該家，不能只憑牌種數字接受。

AI 僅呼叫 `chooseAction(observation, legalActions, aiRandom)`；各家策略亂數與洗牌分離，策略不接觸 GameState。相同觀察與策略亂數必須產生相同選擇。

## 4. 存檔與部署邊界

localStorage key 使用穩定的 `tw16:TW16-CLASSIC-v1:save`，不依網址路徑或建置雜湊變更。快照保存完整 GameState、存檔格式版與規則版；每次成功轉移後整包寫入。還原時檢查型別、版本、144 張守恆、階段與 pending 一致性；未知版或壞檔保留原字串並停用覆寫，只有使用者選擇新一將才取代。寫入失敗須告知本頁可玩但無法保證續局。

等待階段保留已收回應，只喚醒尚未行動者；補牌恢復從保存的游標及補牌原因繼續。動畫與計時器不持有規則狀態，重整不得多摸或略過真人。

結算使用固定 `settlementId=matchId:handId`，台項、四家增減、套用標記與分數在同一次轉移完成；四家增減總和必須為零。`handResult` 已套用付款，重新載入只重畫；`NEXT_HAND` 只推進一次莊圈與局號，不再次付款。opId 與已結算標記隨快照保存。

Pages 專案網站使用 `/repo/` base，使用者根站用 `/`；所有圖片、音效及入口資源跟隨同一 base，不使用伺服器回退路由。GitHub Actions 僅發布通過檢查的靜態產物。

## 5. 狀態、依賴與下一步

狀態：契約已落盤，尚未實作或編譯。RULES.md 需給出過水／過碰解除事件、花胡觸發與付款、台項互斥及尾局細則；其內容與本文件衝突時先由主代理同步契約，再進入 M1。下一步用 cases.json 核對階段、觀察遮罩與續局／重複結算案例，完成 M0 一致性審查；此文件不授權引擎開發或發布。
