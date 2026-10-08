> 2026-10-09進度：L1-A已完成，見[L1A-EVIDENCE-VALIDATION](L1A-EVIDENCE-VALIDATION.md)；L1-B亦已完成，見[L1B-EVIDENCE-CONTRACT](L1B-EVIDENCE-CONTRACT.md)，下一包L2-A。以下保留L0基準與方案，舊下一步已更新於HANDOFF。

# L0基準查核與L1最小技術方案

2026-10-09。遵循[方向決議](PRODUCT-DIRECTION.md)。標示「現有實作／證據支持／設計／待確認」，不將概念契約當成已存在的API。

## 1. L0版本及驗證基準

本輪開始工作樹乾淨，本機HEAD為fe909ee；遠端main即時查得57a09210c74f2dd7f92f54392e7c645f8f0becaf。本機多出14870ee離線策略比較與fe909ee現況文件兩個提交，未推送。此次另改文件，不改src、桌規、存檔或正式AI。

GitHub API核對最近工作流程：來源f94429217123677874767bd9bc956f9e3b211de5，Actions [37662675210](https://github.com/zhai2Liu/taiwan-mahjong/actions/runs/37662675210)為completed／success。遠端57a0921是後續交接文件提交，文件路徑被CI排除，沒有新產物是預期行為。

正式首頁及其引用的index-BEUwn2va.js／index-CmJt2tzJ.css本次HTTP皆200。資源名稱吻合本機建置；站台未內嵌來源提交，此項是CI來源與資源名稱的對照，不是單靠HTTP證明精確commit。沒有新部署，不拿前次成功替本輪發布背書。

本輪重跑npm test及npm run build以建立新基準：278項全通過、check與production build成功，資源名稱不變。本輪僅文件，未重做瀏覽器互動／實機驗收；原功能的互動證據仍屬歷史。L0確認了可交付基線與缺口，不代表所有AT／LT通過。

## 2. 實際型別與呼叫關係（現有實作）

| 邊界 | 實際API／型別 | 注意 |
|---|---|---|
| 合法性 | engine.legalActions(GameState, Seat或engine) → Intent[] | Intent是動作聯集，沒有報告範例的actionId API |
| 動作提交 | applyAction(GameState, Action) → 成功state/events或失敗error | Action含opId、matchId、handId、version、actor、intent |
| 玩家觀察 | getObservation(GameState, Seat)的推導回傳型別 | analysis與coach用ReturnType，不存在另匯出的Observation介面 |
| 牌效 | createAnalyzer(TilePool)；analyzeObservation(Observation, withExample) | current/discards/best/claims/canWin；吃碰帶後續合法捨牌 |
| 指標 | Analysis：shanten/effective/improving/total/probability/source/effectiveTiles/example | probability需依source解釋；public不是可摸牆概率 |
| 教練 | coachAnalysis(Observation) → 分析或null | 限可決策階段、E16/E17及相關合法選項 |
| 電腦 | chooseAction(Observation, Intent[], randomState) | 共用analysis，不能當獨立標準答案 |
| 保存 | Session={schemaVersion:1,game:GameState,aiRandom:number[]} | encodeSession驗證；decodeSession再經engine.restore重驗回應候選 |

```text
view命令 → main核對版本 → session.advance → engine.applyAction
                                        → 新Session → 保存／重繪
engine.getObservation → coachAnalysis → analyzeObservation → view
session.automaticAction → getObservation → chooseAction → advance
```

getObservation現有白名單：seat、matchId、handId、version、phase、turn、dealer、roundWind、streak、scores、available；self暗手／面子／花／限制；各家暗手張數／花／捨牌歷史／遮罩面子；legalActions、lastDiscard、offeredKong、settlement。不含rulesVersion，不能假定觀察已有此欄。對手暗槓只有meldId／kind／count，不含牌種。

現有main在真人advance前取得before觀察；成功後才回饋／保存。新快照可利用此時點，但不能在點牌預覽或失敗提交時記為完成決策。吃碰回應獲接受不等於仲裁取得；檢討要分開「玩家選擇」與「最後成立」。

M0 CONTRACTS是概念schema，例如其中aiRandom曾置於GameState，而現行是在Session。新方案不覆寫凍結概念文件、不照抄其過時欄位；以model/session/engine型別為準。

## 3. 證據分類與最少檔案（設計）

| 等級 | 現有來源 | 首版待遇 |
|---|---|---|
| E1確定計算 | 合法候選、analysis向聽／K／N | 先獨立驗算，再包裝為有版本、分母與限制的證據 |
| E2條件安全 | safety／risk-evidence離線模組 | 複核對象及普通放槍範圍後才接顯示；未知不等於危險 |
| E3目標偏好 | strategy-comparison、牌效排序 | 標明目標與代價；不當唯一正解／整體最優 |
| E4未校準推估 | 放槍率、長期收益、威脅 | 不進正式評分，不造百分比 |

L1-A先重用test/analysis、safety、risk-evidence、coach測試與fixture；新增一份小型驗收案例清單及必要反例，不另建通用題庫框架。L1-B才考慮src/decision-evidence.ts和對應測試作薄型整理層，重用分析器，不複製牌理算法、不匯入chooseAction判分。L2需要時才新增快照模組與局後UI；現階段不先建立空檔或資料服務。

預定證據記錄含rulesVersion、analyzerVersion、候選的明確Intent／穩定索引、level、status、metric、value、scope、assumptions與限制說明。數值缺失用unknown及原因，不用零補值；同牌種實體候選可合併呈現但必保留合法Intent映射。穩定順序依既有牌種／動作排序，並列不硬選冠軍。

## 4. 獨立驗收案例與追溯

| 案例／規則 | 既有證據 | L1新增完成條件 |
|---|---|---|
| R06五面子一對、第五張容量 | analysis.test：E16/E17、副露四張、80組獨立目標枚舉、60組字牌目標 | 保存人工可核對預期；不只與AI結果相等 |
| K/N及分母 | analysis.test精確牌池手算、空池、公開實體去重 | 證據標示source與分母；有效0張仍保留結構聽口 |
| R08兩種吃法 | chi／coach／analysis：134遇2、13與34，禁捨 | 列明各選項後捨，不以是否最終被攔截判原選擇非法 |
| R11過水 | coach／analysis：牌型聽牌與合法胡分離 | 不因結構0向聽而推薦非法WIN |
| 字牌安全反例 | safety.test：現二加自有一張仍可能單吊；第四張字牌 | 人工列明剩餘容量，標示普通放槍範圍 |
| 數牌四見反例 | safety.test：四張三萬仍可補12萬順子 | 列出所有可能順路，不能借日麻筋／現物作保證 |
| 單家與全桌差異 | risk-evidence：五副露莊，3m只對莊安全；1p全桌但退出聽牌 | 不評唯一全局答案；證據摘要與原數值一致 |
| R17續莊 | 凍結規則：莊胡或流局都N+1 | 情境題要求辨識安全與阻莊不同，不輸出虛構勝率 |
| R18資訊公平 | analysis／risk-evidence隱藏牌交換不改公開輸出 | 對新證據格式做同樣測試，含暗槓遮罩及未知欄位 |
| R16結算 | 既有settlement／controller測試 | L2檢討不可再次advance/NEXT_HAND/付款 |

已存在測試僅支持所覆蓋範圍；尚無新證據格式／題目評分的驗收。人工推導與獨立枚舉需記錄方法，不能單純重呼同一analysis當oracle。

## 5. 快照公平與保存方案（L2設計，未實作）

- 用獨立嚴格白名單DTO，從決策前Observation轉換；不保存完整GameState或任意unknown物件。排除settlement、種子、牌牆、AI亂數、後來揭露的資訊；保留自家牌、當時公開資訊、限制與合法選項。
- rulesVersion從已確認固定規則的控制邊界傳入並核對；analyzerVersion是明確演算法版本，不只記網站commit。保存原證據版本；不支援舊算法時提示無法按原版本重算，不能靜默覆蓋成新結論。
- 決策識別可由matchId／handId／version／seat組成；Intent結構及候選索引需一致驗證，並保留選擇。序號不是授權證明：存入前驗牌ID、容量、階段、遮罩形狀及合法候選歸屬。外部匯入暫不支援。
- 初版候選儲存鍵tw16:review:v1，最多20筆、總UTF-8序列化256KiB、每筆32KiB；這是待L2實測調整的工程上限，不保證localStorage可用配額。檢討UI每局摘要3–5筆，不能宣稱找出最大錯誤。
- 遊戲存檔成功優先；研究／檢討存檔失敗不回滾合法動作、不覆蓋既有牌局，顯示本次未保存。採單一新鍵寫入，失敗保留原值；容量淘汰先在記憶體計算，寫入成功前不移除舊紀錄。
- 壞檔或未知版停用檢討保存並保留原始資料，提供明確清除檢討入口且確認；不得清除對戰／練習鍵。跨分頁沿既有停用邏輯保守停止紀錄，不宣稱localStorage具交易鎖。重新讀取確認新版本後才恢復。
- 抽樣規則先明示為固定類型／順序，避免用真實輸贏選「錯誤」。更新UI不額外推進牌局；決策後解釋不跳過真人等待，也不每步強制彈窗。

## 6. 第一版題庫與評量（設計）

先涵蓋同向聽有效進張、公開容量安全範圍、副露後捨代價、莊／閒續莊資訊。每題需caseId、規則／分析版本、能力、條件、可見局況、合法選項、可接受答案集合或理由規準、獨立推導來源、審核狀態、題族ID及用途。

訓練與測驗按題族隔離，不只換題序、換花色或亂數種子便稱陌生題。未審核及有策略歧義題不得納單一正確率；理由題先用可核對的要點，不加LLM自動判卷。能力分項與樣本限制一起呈現。60題與6–10人先導保留建議，L3再按能力覆蓋決定，不在L1灌滿題量。

## 7. 下一個可獨立驗收的包

**L1-A：核心證據驗收。** 將上表核心牌例轉成可核對清單，補新缺口測試，完成每個結論的E1/E2/E3範圍與禁止表述。輸出案例清單、測試與驗收結果；候選必合法、對不可見牌變化不敏感、並列答案不判錯、未知不數值化。

不包含：正式教練改版、決策快照保存、題庫UI、人格／攻守切換、風險概率、雲端、部署研究包。完成後才進L1-B證據封裝；不必為報告中的「待核准」反覆詢問已採納的方向。
