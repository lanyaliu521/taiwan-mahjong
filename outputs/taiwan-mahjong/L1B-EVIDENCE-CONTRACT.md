# L1-B：決策證據格式與驗收

2026-10-09。完成`src/decision-evidence.ts`及7項新測試；全套288項、check與build通過。此模組尚未接正式UI／AI／存檔。L1的底層證據與格式已完成，真人理解及學習成效尚待後續驗收。

## 使用邊界

`decisionEvidence(observation, rulesVersion)`只接**本引擎剛產生的指定玩家getObservation**，規則參數必為TW16-CLASSIC-v1。控制層須取實際規則版本傳入，不能為了通過檢查替未知版本硬填常數。回傳普通資料，不執行操作、不抽亂數、不保存，也不呼叫正式AI。

有基本防呆：錯桌規、完整GameState／牌牆、他家暗手／已揭露暗槓、錯誤DISCARD牌權拒絕。**這不是外部輸入或讀檔驗證器**；合法性標記依賴引擎來源，不能以任意自造legalActions取得合法認證。L2須先以嚴格白名單與結構／容量／階段驗證還原資料，不能JSON.parse後直接呼叫本函式。完整未知欄位拒絕／保存相容是L2工作。

觀察內settlement及額外欄位不進輸出；Intent採明示欄位重建，最後深複製，避免附帶資料或引用洩漏。暗槓只使用遮罩資訊。相同觀察下，未知牌配置、後來結算與任意額外欄位不影響結果。

## 版本與輸出

| 欄位 | 契約 |
|---|---|
| schemaVersion | 1，格式版本 |
| rulesVersion | TW16-CLASSIC-v1，不從Observation虛構規則欄位 |
| analyzerVersion | tw16-evidence-1；涵蓋本封裝依賴的牌效／安全語義，變動時須評估升版 |
| decision | matchId、handId、version、seat；只有識別用途，不是授權憑證 |
| status/current | 可決策階段且E16／E17時available；否則unavailable/current=null，不捏造計算 |
| canWin | 當次合法候選是否含WIN；獨立於結構向聽與有效牌數 |
| candidates | 所有引擎候選的正規化Intent及id，完全相同動作去重；不刪除同種牌的不同實體操作 |
| discardPreference | E3：向聽較低、同向聽公開K較多的全部並列牌種；不代表防守／總收益最佳 |
| overallStrategy | 固定unknown及原因：尚無校準放槍率與完整收益模型 |

候選id是正規化Intent的JSON字串，只在decision範圍內識別；不是雜湊、跨局授權或外部API。欄位順序固定，ownTiles排序但保留全部實體ID；按id字串穩定排序，不依語系或原始候選到達順序。吃碰後捨與偏好牌種按KINDS順序。UI可另按類別分組，但不能從順序推論高低分。

每個candidate包含：

- `legality`：E1，該觀察的引擎合法候選；真正執行仍重查版本與合法性。
- `efficiency`：捨牌後E16的E1指標；其他動作為null。
- `postClaim`：吃／碰才提供全部合法後捨、各自牌效、並列較佳牌種、門清損失及條件。最佳後捨屬E3；未保證能通過仲裁。沒有將後捨牌種偽造為當前可執行DISCARD Intent。
- `safety`：只為當次DISCARD提供E2，各對手`proven`或`unknown`、尚未排除的局部成形路徑、範圍與說明。路徑數不是風險排序。
- `unknownReason`：吃碰缺安全／收益模型，槓／PASS／WIN等未做牌效安全比較的原因；null不是零風險。合法WIN仍由canWin明示，不因缺比較而忽略。

## 數值與文字界線

E1牌效指標含shanten、effective、improving、publicPoolTotal、publicImprovingRatio、effectiveTiles與範圍。分母為公開未知一般牌，包含他家暗手及牌尾；比例不得稱實際牌牆摸牌率。

E17的下一張改善數與比例為null、improvementStatus=notApplicable，須先選捨牌看E16。E16空池比例null；有分母且有效張數零則為0，兩者不可混淆。有效0張的結構聽口仍保留。這個封裝只處理對戰公開池，沒有將練習exactPool混用成公開資料。

安全只證當時、指定對手、本次普通放槍；不涵蓋花胡、未來自摸或續莊。unknown只表示缺充分安全證明。對莊安全不能外推三家安全；更不能外推一定阻莊。未輸出零台付款底線、危險率或研究權重，避免將研究數值誤讀為收益估計。

輸出限定E1計算、E2充分證明及E3牌效目標比較；E4未校準模型只以整體unknown說明，沒有精確分數。正式呈現須保留scope／條件／unknown，不可只拿數字顯示「最佳」。

## 驗證對照

| 新測試 | 驗證內容 |
|---|---|
| 五副露東南 | 獨立手算S0/K3/N119，兩種捨牌並列；E17不顯示0摸牌率，版本固定 |
| 134遇2 | 13與34兩法完整保留，各自禁捨；正規化Intent可由引擎實際接受；PASS未知 |
| 五副露莊例 | 3m僅對莊proven、其餘unknown；1p三家proven但退聽；不輸出唯一整體答案 |
| 隱藏資訊及引用 | 兩個相容世界結果相同、忽略事後結算與額外欄位；不改輸入也不共用輸出引用 |
| 合法WIN／不可分析 | WIN存在獨立標示；發牌未齊不捏造指標 |
| 拒絕錯誤輸入 | 錯桌規、完整狀態、洩露暗槓、他人牌冒充捨牌 |
| PON與三種KAN | 碰後合法捨牌；明／暗／加槓完整映射且可由引擎接受，但不假造補牌收益或安全 |

候選清單及ownTiles反序後，整份輸出仍深度相同；所有測試沿用L1-A反例／人工預期，不用AI作標準答案。AT-03～06在此內部封裝範圍通過，AT-01～02由全套與L1-A支撐；這不等於未開發的檢討UI、外部快照驗證或玩家理解已通過。

## 交付與接續

正式bundle仍index-BEUwn2va.js／index-CmJt2tzJ.css，模組未入正式入口。未推送／部署，無本輪瀏覽器或手機驗收。重現：`npm test`、`npm run build`；指定測試先check再`node --test test/decision-evidence.test.mjs`。

下一包L2-A：受控快照DTO及獨立存檔，先處理版本、合法選擇、公開資訊、容量上限、失敗／跨頁回退與舊檔相容；不直接把整份Observation或任意證據JSON當可載入資料。正式接入教練／局後畫面另做L2-B驗收，不自動更換AI。
