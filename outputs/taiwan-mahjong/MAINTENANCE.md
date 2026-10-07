# 維護指南

2026-10-06，M5.3及後續維護更新。此文件說明現有實作與修改路徑；目前進度見[HANDOFF](HANDOFF.md)，新增玩法規格見[TRAINING-DESIGN](TRAINING-DESIGN.md)。

## 文件各自負責什麼

README是使用與開發總入口；HANDOFF只記目前進度、風險與下一步；ROADMAP只記階段。RULES是凍結桌規唯一來源，cases.json是人工牌例；CONTRACTS為概念契約，實際型別以src/model.ts為準。各階段VALIDATION保留歷史證據，不能把舊測試數量當現況。

## 修改位置

| 需求 | 先看位置 | 必要驗證 |
|---|---|---|
| 出牌、吃碰槓胡、過水、連莊、回合推進 | src/engine.ts、model.ts、validation.ts；先對照RULES | engine、chi、claims-integrity、validation相關案例；必要時補人工規則案例 |
| 五面子一對、聽口、拆法 | src/hand.ts | engine／scoring相關案例；第五張容量與副露邊界 |
| 計台、互斥、付款 | src/scoring.ts、validation.ts | scoring、settlement-integrity；來源付款人、金額、末局連莊相容性與結算續局 |
| 電腦選牌 | src/ai.ts、analysis.ts、session.ts | ai、session；資訊遮罩及正常完整牌局 |
| 點擊、鍵盤、吃牌選項、結算彈窗 | src/view.ts、main.ts | controller、chi；瀏覽器受影響流程及焦點 |
| 牌面、牌河、手機排版 | src/tile-face.ts、style.css、view.ts | 桌面／320及390寬畫面、長牌河；不替純配色寫單元測試 |
| 暫停、速度、自動回合、跨分頁 | src/main.ts、session.ts | controller、session、resume；舊計時器與版本拒絕 |
| 儲存、讀檔、格式變更 | main.ts、session.ts、engine.ts、validation.ts | 壞檔、未知版、保存失敗、重載、不可重付結算 |
| 建置與發布路徑 | package.json、vite.config.js、index.html | build及正式子路徑資源；M4正式網址驗收 |
| 新手教學文字、示範、視窗 | src/tutorial-view.ts、view.ts、practice-view.ts、main.ts、style.css | controller：存檔／跨頁／暫停；瀏覽器單擊、雙擊、鍵盤、關閉與320／390 |
| 共用牌效分析 | src/analysis.ts、hand.ts；TRAINING-DESIGN.md | analysis：容量、獨立枚舉、比例、合法吃碰及資訊公平 |
| 純練習流程與預覽 | src/practice.ts、practice-view.ts、main.ts | practice、controller；不放回牌池、重播、模式切換與焦點 |
| 對戰新手教練 | src/coach.ts、view.ts、main.ts | coach、controller；遮罩資訊、合法決策、偏好保存及預覽同步 |
| 正向回饋、進步里程碑與得分／牌型卡 | src/feedback.ts、main.ts、view.ts、practice-view.ts、style.css | feedback、controller、score-display；仲裁成立、耗盡等待、錯過WIN、分析失敗保存、計台替代及窄畫面；見POSITIVE-FEEDBACK-VALIDATION |

## 資料流與責任

view送UICommand → main核對畫面代次及當前狀態 → session.advance → engine.applyAction核對opId、matchId、handId、version、actor與合法動作 → 新Session → 保存及畫面更新。

main只安排一個自動計時器；暫停／重繪會使舊代次失效。session.automaticAction先處理引擎流程，再選電腦操作；真人有合法回應時等待真人。AI只收該座位getObservation及其合法候選，亂數只於成功轉移後提交。

getObservation遮蔽其他玩家暗手、暗槓牌種、牌牆順序、洗牌種子與未揭露回應；不得把完整GameState交給策略或教練。合法動作由引擎決定，畫面、AI或提示不得另開放操作。手牌結構可聽不代表目前合法可胡。

牌種如1m，實體ID如1m#0；需要牌權、公開張數與去重時使用實體ID。E＝暗手張數＋3×副露面子數，台灣胡牌形為E17五面子一對；槓的結構算3張，實體仍有4張。

計台evaluateHand的暗手參數須符合等效E17；外來胡牌只加入一次。decomposition.groups含既有副露且共5組；score.tai不含按付款對象而異的莊連台，最終分數變動見settlement.delta。handResult已付款，下一局只能在真人選擇後送NEXT_HAND，不在重載或重開結算時付款。

## 共用牌效分析（M5.1）

研究擴充：`src/safety.ts`只回傳普通放槍的充分安全證明與尚未排除的局部成形路徑，輸入為自家publicPool與持有牌種，不接正式AI。不能將possibleUses數量當放槍率。驗證用`test/safety.test.mjs`；保留安全張的牌效案例用`node scripts/research-reserve.mjs`，先check。正式接線前仍須相對風險及策略／保存驗收。

src/analysis.ts是AI、練習與教練的共用來源；不要解析AI的reason字串。createAnalyzer接牌池，analyze接自家暗手牌種與完整副露；只分析等效E16／E17。E17捨牌比較先走discards，傳入實際合法牌種；analyzeObservation只接引擎產生的單一玩家觀察，吃碰採該觀察合法候選及engine共用discardBan。

距離是到容量合法的五面子一對目標所缺張數減1。容量扣除副露實體張數，槓扣4；完成=-1、聽牌=0。示例拆法是通往某個最近目標的一種不重疊分配，不是唯一拆法，也不保證顯示最多搭子。effectiveTiles保留結構有效但剩餘0張的牌種，以便介面區分距離與實際可用性。

exactPool只接剩餘一般牌的唯一實體ID；publicPool扣自家牌、公開河牌／副露與搶槓亮牌，以ID去重，不猜對手暗槓。機率為有效張數／牌池總數，空池為null；公開未知牌含對手暗手與牌尾，不能稱真實牌牆機率。牌池不可與自家牌重疊。

每次決策建立一個analyzer，內部快取共用於各候選；不跨牌局永久保留。介面只在真人可決策時分析，重繪可沿觀察版本重用結果；AI關閉示例生成。M5.2由practice.ts、practice-view.ts與main.ts整合，M5.3由coach.ts、view.ts與main.ts整合。型別以analysis.ts為準，驗證見M5.1-VALIDATION。

## 存檔與相容性

2026-10-07維護：main.ts以saveFailed／practiceSaveFailed記最近一次保存失敗，透過canRetrySave顯示「重試儲存」。retry-save只保存目前模式並paint，不advance或refresh；保留選牌、暫停、速度及既有timer。成功清除提示；失敗仍保留進度。failed／practiceBlocked時禁止重試，不能覆蓋他頁。結算modal內也要有按鈕，成功移除後回焦點入口。見[AUDIT-2026-10-07](AUDIT-2026-10-07.md)。

本機鍵：`tw16:TW16-CLASSIC-v1:save`，位於main.ts。Session schemaVersion=1，內容為GameState與3位AI的亂數；GameState另有schemaVersion=1及rulesVersion。UI選牌、暫停與速度不是持久牌局格式。

讀取必須走session.decodeSession → engine.restore。只JSON.parse或直接呼叫validation.restore不足以取代引擎還原；engine還會重算待回應候選。寫入前encodeSession驗證資料；壞檔及未知版本保留，開始新一將前確認覆寫。保存失敗保留上一份可用存檔並提醒保持頁面；跨分頁競爭停止操作，要求重載。

修改格式前先決定遷移／拒絕策略，補舊版、未知版與壞檔案例，不能以清空localStorage當修復。練習另用版本化鍵，不覆寫對戰；詳細設計見TRAINING-DESIGN。Pages網址與本機來源不同，現有續局不包含跨來源匯入功能。

## 驗證工具

下列命令在遊戲資料夾執行，package.json是可執行命令的依據。

| 命令 | 作用與限制 |
|---|---|
| npm ci | 依lockfile安裝開發依賴；已有可用安裝時不必每次重裝 |
| npm run check | TypeScript檢查並產生dist/，不是僅無輸出檢查 |
| npm test | check後跑test/*.test.mjs；涵蓋規則、存檔、AI及控制器 |
| npm run build | check後由Vite產生site/；base目前為./ |
| npm run dev -- --port 4183 | 獨立開發／fixture來源，避免覆寫實際遊玩的4173存檔 |
| npm run preview -- --port 4173 | 預覽已建置site/，修改後須重新build |
| npm run simulate -- --hands 1000 --matches 3 --seed 20261004 | M1測試策略長模擬，輸出SIMULATION.json；不是正式AI策略驗收 |
| node scripts/verify-m3.mjs M5.1-SIMULATION.json | 正式策略3完整將驗證，需先check；指定輸出檔名以保留歷史；省略時更新M3-SIMULATION.json，非每次修改必跑 |

test/browser.html與test/runner.html為開發來源工具；browser-fixtures、chi-fixtures、layout-fixtures提供續局、吃法、長牌河與結算場景。使用前先看對應test及scripts，不把測試頁上線；fixture會寫測試來源存檔，測試完成後關閉該來源頁面／伺服器。

純文件修改檢查連結、路徑、命令與現況一致性。行為修改跑受影響測試，跨模組或正式交付再跑全套及build；只有AI／回合／續局改動需要相應完整牌局驗證，不反覆長模擬消耗額度。測試失敗先保存重現資料；simulate會把seed、狀態與動作記至工作區work/taiwan-mahjong/。

## 提交工作包與發布

每個工作包完成後更新受影響說明、測試證據及HANDOFF；已知限制以ponytail註解寫清上限與升級條件。優先平台與現有依賴，不新增通用玩法框架。開發由6.1 Sol主導，需要時Luna協助限定任務；遊戲內AI不呼叫模型。

main推送後由GitHub Actions發布，正式網址與回復步驟見DEPLOYMENT；確認該次workflow成功。site/是發布產物，src/才是修改來源；不要直接編輯site/或dist/。


## 純練習模式（M5.2）

src/practice.ts維護136張一般牌、種子、手牌、池、棄牌、摸入牌及階段。初始16加摸入1張；discardPractice將17變16且棄牌不回池；drawPractice只在draw階段取池首。牌池耗盡或五面子一對完成即結束。

存檔鍵tw16:practice:v1、schemaVersion=1，與對戰分開。restorePractice重播種子與捨牌日誌，核對完整狀態，拒絕篡改、重複ID、非法牌權／階段及未知版本；不能只JSON.parse。若改洗牌／重播演算法須先決定存檔遷移策略。

src/practice-view.ts沿用view.ts牌面、牌名及原生button／details；單擊／Tab局部預覽，450ms內雙擊、Enter／空白鍵出牌。main.ts處理模式、儲存及跨分頁：切入先保存並暫停對戰，返回後手動繼續；保存失敗保留舊檔與記憶體並阻止離開；他頁修改後停止練習。

practice.test.mjs驗證整題完成及耗盡、重播、牌權、比例與存檔邊界；controller.test.mjs驗證模式切換、壞檔取消、保存失敗與跨分頁。test/practice-browser.html以可見核取方塊替代confirm，用於獨立來源的瀏覽器驗收，不納入正式建置；正式程式仍使用原生confirm。

### M5.2易用性補充

practice-view.ts採practice-workspace主區／側欄，手機單欄。stats分距離聽牌及下一張改善機率，有效牌單列overflow-x:auto且tabIndex=0；候選button只局部select，不能送practice-discard。候選點擊清除lastTap，避免跨控制項雙擊；選牌保留已展開拆法。捨牌後聚焦practice-draw，摸牌後聚焦practice-status，不自動選牌。style.css僅最後practice區段控制此版面，詳見M5.2-UX-VALIDATION。

## 對戰教練（M5.3）

src/coach.ts只接getObservation遮罩資訊；awaitDiscard／awaitClaims／awaitRobKong且完整E16／E17真人有合法回應時，才呼叫共用analyzeObservation。view.ts再排除忙碌、暫停與已關閉提示；不讀Session、暗牌、牌牆或AI reason，也不另算向聽。

view.ts的coachPanel使用原生details，body最大24dvh／220px局部捲動；吃碰比較排在有效牌列表之前，合法胡牌先提醒。單擊及鍵盤focus只更新預覽，保留手牌DOM以支援450ms雙擊；只有原有合法操作送intent。E17以合法捨牌後E16比較，不把E17有效進張0當摸牌比例；距成胡至少S+1次改善不是回合數。拆法是最近目標分配示例，非最多搭子；零剩餘張數保留提醒。

main.ts的教練設定使用獨立鍵tw16:coach:v1，on／off、預設開啟，未知值用預設；保存失敗仍在記憶體套用並顯示提醒。不改對戰或練習schemaVersion=1。設定只在重新載入讀取，不另做跨分頁偏好同步；牌局原有跨分頁保護不變。

公開比例為K／N：N含其他玩家暗手與牌尾，不是可摸牌牆。吃碰只比較向聽、有效張數並提示失去門清，沒有台數、防守及槓風險評分。若擴充需先定義資訊邊界與測試，不能把純牌效說成總體最佳策略。

coach.test.mjs驗決策邊界、兩吃法、碰牌、過水及輸入不變；controller.test.mjs驗獨立設定、重載、寫入故障與不更動牌局。瀏覽器證據見M5.3-VALIDATION。局部文字／配色修改做相關畫面驗收即可，不重跑長模擬。

2026-10-06選牌流程修正：handAndActions的focus／單擊共用select，同步視覺／aria-pressed／main選牌及coach.select；焦點切換清除lastTap。coach.select同步收合摘要，胡牌摘要優先；禁捨及胡牌提醒先於教練。仍不重畫整副手牌或保存選牌，沒有新增設定。驗收見COACH-FLOW-VALIDATION。

2026-10-06面板狀態維護：view.ts的detailStates以WeakMap按root記data-persist的boolean。render捕捉目前面板、toggle記使用者選擇；僅root內元素可寫狀態。面板暫時消失（忙碌、暫停、關提示或模式切換）時保留，重現時恢復。只記本次頁面，重載預設收合，不改任何存檔鍵。驗收見PANEL-STATE-VALIDATION。

## 維護補充：鍵盤與結算核對

手牌標題以 data-focus=hand-heading 作程式化焦點入口，不加入一般 Tab 順序。重繪先還原同一可操作控制項，練習排除收合details中的隱藏按鈕；開題回步驟提示、續局／下一局回手牌入口；手牌／回應按鈕消失或禁用才退回入口，aria-describedby 連結當前操作提示。焦點及單擊僅選牌，不可繞過合法動作；練習手牌焦點變更清除 lastTap，避免跨控制項誤判雙擊。模式切換聚焦新模式的非操作入口：練習介紹、對戰手牌標題或首頁標題；不能自動開題或出牌，返回對戰仍暫停。view.preserveDetails供對戰及練習共用：details 的 data-persist只保存同頁各面板開／關狀態，模式暫時移除仍保留；舊面板事件不得覆蓋現行狀態。

一般自摸／放槍／搶槓存檔必有五面子一對拆法，並與實際牌核對；花牌特殊胡不強求一般胡形。validation.ts 在既有牌權、來源及零和核對之上，以 settlePayments 重新核對完整差額。RON／搶槓付款人為保留的 turn；七花為持有另一花的玩家；自摸／八花為其餘三人。RON核對來源最後被胡捨牌，搶槓核對來源同種碰牌。壞檔仍保留並拒絕載入，不能清除資料當修復。

view.tableDealer僅於matchResult顯示末局莊家及風位，與保留的末局結算對齊，不改GameState。schemaVersion=1 終將已移莊並歸零連莊，沒有保存上一局付款上下文。因此舊莊由 currentDealer-1 還原；若舊莊付款，只能從其金額推回合法奇數加台並核對其他付款。這維持正常舊檔相容性，不能驗證被一併改動的歷史連莊、台項或完整累計分數；若需可信歷史，另設版本化上下文／可驗證事件紀錄。最新證據見 MAINTENANCE-2026-10-06.md，歷史報告不作現況入口。

## 新手操作教學

src/tutorial-view.ts只接root，不接Session、getObservation、localStorage或遊戲命令；17張與吃法示範為私有資料，只改自己的dialog。main收到tutorial，先保存當前模式，成功才暫停並作廢舊timer/UI；寫入失敗不開教學，跨頁已阻擋者可看但不可覆寫新存檔。關閉移除視窗並聚焦現行教學入口，對戰仍暫停。無新存檔版本／鍵。

教學用原生dialog，固定高度、內容區捲動、底部操作列保留；不要讓選牌提示改變dialog位置而破壞雙擊。示範單擊／focus僅選牌，450ms同張雙擊或Enter／空白鍵只出1張。文字依RULES校正，不在教學重寫計台或完整引擎；示範吃法為134遇2的13／34，禁捨分別2與2／5。擴充教學若要用實際行牌，另定引擎隔離及存檔驗證，不混用正式Session。

教學資料保護回歸在controller.test：對戰與練習保存失敗均不得開窗或丟進度；讀取壞檔／跨頁已阻擋時只准看教學，不寫回原存檔。讀取／保存失敗與跨頁競爭不是同一情況，不要以統一「可看教學」流程省略保存保護。示範互動和窄視窗則以瀏覽器驗收，不為固定文案加字串鏡像測試。
