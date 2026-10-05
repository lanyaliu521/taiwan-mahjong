# 2026-10-06 維護驗證

## 工作包一：鍵盤操作入口

問題：Enter 出牌或按過後，重繪移除原按鈕，焦點回到頁面頂端；下一次操作需重新走過整頁控制項。

修正：可存續的手牌標題成為程式化焦點入口（tabIndex=-1），以 aria-describedby 連結當前操作提示；原手牌／回應按鈕消失或禁用時才退回入口。再按 Tab 直接到合法手牌，焦點本身不會出牌。金色外框顯示鍵盤焦點，輪到真人時文字列出 Tab、Enter、空白鍵與雙擊操作。練習模式切換焦點會清除先前點擊，避免跨控制項誤判雙擊。

驗證：226 既有測試及 build 通過；獨立來源 4191 的吃牌情境按過後，下一次真人決策維持手牌入口、17 張，再按 Tab 選第一張。Enter 出牌後為16張，焦點回入口；再次 Enter 未出第二張。未模擬實體鍵盤長按。練習點牌→Tab→Shift+Tab→單擊不出牌；雙擊僅捨一張，摸牌後空白鍵正常捨牌。

證據：MAINTENANCE-KEYBOARD-desktop.jpg、MAINTENANCE-KEYBOARD-practice.jpg。建置 index-CtOVT2Yr.js／index-Fanank-l.css；來源188465baf4e1cbedf9684619e3ebbca7888d6ba1已推送，workflow37364743153排隊中；待正式發布核對。320×740無橫向溢出，出牌後手牌入口外框可見，證據MAINTENANCE-KEYBOARD-320.jpg。

## 工作包二：結算存檔核對

修正前新回歸中4項失敗，證實成對改動付款、付款人錯置及末局狀態可通過原零和檢查。validation.ts沿用scoring.ts的settlePayments，以來源付款人與本桌底30／台10、莊連台重算完整差額；RON與搶槓另驗來源捨牌／碰牌關聯。8項新回歸包含正常自摸、放槍、搶槓、七花、八花、連莊後終將、末局未涉莊家付款及不一致來源。無存檔鍵／版本或桌規改動。

舊schemaVersion=1終將已移莊且歸零連莊，沒有上一局付款上下文。採前莊與合法奇數加台回推，保留正常舊檔相容性；不能驗證被一併修改的歷史連莊／台項／總分，未聲稱防偽。可信歷史需要另設版本化上下文／事件紀錄，已留下ponytail限制。

234/234測試與build通過；3完整將74局9121動作、912真人決策、317次序列化還原通過，資料見MAINTENANCE-2026-10-06-SIMULATION.json。正式策略採既有固定種子；花牌特殊付款由單獨回歸覆蓋。建置index-C-ItP4CY.js／index-Fanank-l.css。發布結果待補。

## 工作包三：維護文件校正

MAINTENANCE原入口仍寫M5.2、分析段寫教練尚未串接，已校正為已完成。修改位置地圖區分分析、練習與教練，補鍵盤入口、同頁面板與結算驗證邊界。ROADMAP將226標成歷史交付數，新增試玩回饋歸入後續維護，README連至本輪集中證據，避免維護者被過時階段或測試數誤導。

## 工作包四：模式切換的鍵盤入口

鍵盤進入練習後，焦點放在主區介紹，再按Tab即到繼續練習／開始練習（有進度則到手牌或摸牌）。返回對戰聚焦手牌標題；尚未載入對戰時聚焦首頁主標題。入口tabIndex=-1、有可見外框，不自動出牌或開新題；返回對戰仍暫停。4191已驗首頁→練習→首頁、對戰→續練習→返回；返回時17張未變，暫停提示及焦點正確。證據MAINTENANCE-MODE-FOCUS.jpg，23控制器測試及build通過。

## 工作包五：一般胡牌拆法必填

重現：將正常自摸存檔的score.decomposition刪成null，舊驗證仍接受，繞過五面子一對與實際牌的核對。已要求自摸／放槍／搶槓必有拆法；花牌特殊胡可沒有一般胡形，也保留同時有一般胡形的花胡。新增回歸覆蓋三種一般胡與花胡相容性。235/235及build通過；不改引擎行牌／桌規，不重跑相同完整將模擬。新版index-yKRTwBRT.js／index-DBHXIdOt.css，正式發布待核對。

## 工作包六：純維護證據不重複發布

原workflow以outputs/taiwan-mahjong/**觸發，每份Markdown／截圖交接會重跑整套部署，前次與本輪曾造成排隊。改用GitHub原生paths負向排除專案根Markdown、JPG證據與*SIMULATION.json；程式、測試fixture、lockfile、src／public素材與workflow仍觸發。手動執行、全套測試、權限與部署並行設定保留，沒有跳過程式交付的驗證。

本地依11個正／負路徑例驗證設定（Node內建glob，只作一次輔助檢查，不冒稱GitHub雲端matcher實測）。workflow修改需實際雲端跑通；下一次純文件提交不加skip-ci並觀察是否不新增run。若根目錄未來放發布素材，須移入src／public或調整篩選。

## 工作包七：開題／續局／下一局的鍵盤入口

首次開練習題時，同名practice-start按鈕被移入收合details，原程式嘗試聚焦隱藏按鈕而回BODY。已重現；現在排除disabled及收合details中的目標，聚焦可見practice-status（保留focus key），Tab直接到第一張手牌，17張未變。展開設定後換題仍保留可見控制項。對戰首頁續局與結算下一局若原按鈕消失，回手牌入口；終將仍優先聚焦結算標題。

4191 practice-browser可見確認替代開關驗首次開題：收合設定、焦點practice-status、Tab第一張未出牌。普通續局→hand-heading；handResult下一局終將結算標題正常；lateHandResult下一局經自動發牌後17張、手牌入口及操作提示正確。23控制器測試及build通過，證據MAINTENANCE-PRACTICE-START.jpg、MAINTENANCE-NEXT-HAND.jpg。未宣稱原生確認或實體長按已自動驗證。

## 工作包八：練習面板往返保留

重現：候選best與棄牌river展開後，返回對戰再進練習均變收合。將view.ts既有單頁WeakMap面板保存抽成preserveDetails，練習直接沿用；沒有新增依賴、設定或存檔鍵。面板不存在時保留其開／關值，移除的舊面板toggle不得覆寫；選牌預覽仍按現有流程重新選擇，不持久保存題目預覽。

4191驗best／river展開往返仍開，best手動收合後往返保持關；切到對戰，教練展開→暫停／繼續仍開，回練習best關／river開維持。235測試及build通過，證據MAINTENANCE-PRACTICE-PANELS.jpg。重新載入仍回預設面板狀態，不是持久偏好。

## 工作包九：終將顯示末局莊家與風位

重現：handResult第16次移莊後進matchResult，引擎保留末局結算但dealer已移回初始位；畫面使用此dealer導致你原南風變東、原莊家左席變北，與末局付款／台項不一致。view.ts僅在matchResult以dealer-1顯示末局風位，標「一將完成・最後莊家」及「末局莊」；不更動GameState或積分計算。

4191 matchResult固定情境確認：結算你南+50、左席東-50；關彈窗後最後莊家左席且末局莊標記正確。一般牌局仍使用當前dealer。32項受影響控制器／結算測試及build通過，證據MAINTENANCE-LAST-DEALER.jpg，新bundle index-CDcpWka5.js，待正式發布。

## 工作包十：新手操作教學

使用者指定優先加入新手操作教學，M5.4採六步原生dialog、獨立17張出牌與134兩吃法示範；不接Session、不改正式手牌或存檔。三入口、暫停保存、鍵盤／雙擊、焦點返回及320／390尺寸已驗。Luna限定補controller回歸與只讀桌規審查，補花文字已加七搶一立即結算例外。完整證據TUTORIAL-VALIDATION.md。

## 工作包十一：結算台項基本一致性

重現：一般自摸存檔插入莊家／花胡台項，連同付款與積分一起修改仍可還原。現在拒絕重複台項ID、把S31／S32莊連台放入基礎台數、一般胡誤帶S24／S25、花胡錯來源或不是8台及互斥S06／S11。花胡沒有一般拆法時只能有對應花胡台項。有一般拆法的合法花胡保留正常加台；未新增schema、未聲稱全部歷史台項可防偽。settlement-integrity.test補篡改回歸。

## 工作包十二：耗盡等待提示

教練向聽0仍依結構顯示已聽牌；當有效牌種有列出但公開剩餘總數0，明示後續等待已耗盡、可考慮換等待，同時強調當下合法胡牌仍可按。只補view文案，不改向聽或胡牌資格。測試覆蓋等待東已公開4張，以及最後一張東當下可胡但後續估計0的區別。exhaustedWait固定場景4191確認0／116、東0張、碰／槓／過維持，證據MAINTENANCE-EXHAUSTED-WAIT.jpg。

本包242/242測試、TypeScript與build通過；最新bundle index-BJVs4oOv.js／index-E3veXjre.css。GitHub官方Actions degraded_performance，舊部署因hosted runner未取得而失敗、build成功；最新來源正式發布仍待驗，不把外部排隊當程式測試失敗。帳戶五小時最新已用77%（剩23%），非精確對話token。

## 工作包十三：教學入口的資料保護驗證

Luna僅補controller測試：練習捨牌保存失敗後不開教學、原存檔與記憶體進度保留；壞對戰JSON及對戰跨頁變更可唯讀教學，零覆寫。29控制器／244全套通過，無src或規則修改，最近來源bundle維持index-BJVs4oOv.js。教學最後一步320鍵盤操作與背景模式未切換已驗；Escape／Enter完成回入口，對戰仍暫停。HANDOFF收斂歷史段落到現行入口，詳細歷史留既有報告。

發布檢查點：純文件提交259594e不加skip-ci，API前後最新run仍37369632079（來源723a898），根Markdown路徑篩選已雲端實測不新增run。舊aa3d25c排隊run37369330243確認為最新版祖先後取消；最新run仍完整build queued。官方Actions事故investigating，正式首頁仍舊bundle index-yKRTwBRT.js可用，不把本地完成等同正式發布。
