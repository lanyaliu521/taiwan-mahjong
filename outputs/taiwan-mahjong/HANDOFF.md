# 現行交接入口

2026-10-06。M0–M5.3已完成並發布，後續按使用者試玩回饋維護；沒有待啟動的新功能階段。先讀README、ROADMAP，再按需查MAINTENANCE／TRAINING-DESIGN。開發由6.1 Sol主導，需要時Luna限定協助，不例行使用Astra。

## 新手操作教學（本地完成，正式發布待驗）

使用者已選「加入新手操作教學」。M5.4六步原生dialog在tutorial-view.ts，首頁／對戰／練習入口；先保存與暫停，私有示範不接Session／存檔／遊戲命令，不改正式手牌。239全套／build過，Luna新增4 controller保護回歸。三入口、雙擊／Enter／空白鍵、134兩吃法及禁捨、完成／Escape回焦點、320／390無橫溢均驗。原對戰及練習17張不變，對戰返回仍暫停。viewport已還原，瀏覽器無error。首版雙擊因dialog隨提示高度移位而誤選，固定視窗＋內容區捲動已修正。詳TUTORIAL-VALIDATION及四張TUTORIAL截圖。

預期bundle index-BFn46ZQ0.js／index-E3veXjre.css，來源即將推送；接續確認最新CI build／deploy及正式實際資源、教學開關與焦點，再把ROADMAP的M5.4正式待驗更新。不要為測試覆寫正式進度；原生confirm會卡工具，使用獨立4191場景及練習可見確認替代工具。帳戶檢查點70%（剩30%），非精確對話token。

## 本輪維護（正式發布核對進行中）

最新來源ed9a448，已推送main；正式bundle預期index-CDcpWka5.js／index-DBHXIdOt.css，需先確認workflow，再驗正式頁實際document.scripts。235全套測試／build已過；最新純顯示修正32受影響測試／build已過。核心付款改動3完整將74局317次還原已過，無需重跑相同長模擬。集中歷史證據MAINTENANCE-2026-10-06.md及同名SIMULATION.json。

已完成：鍵盤出牌／回應／續局／下一局回手牌入口；開練習題排除收合設定的隱藏按鈕，回步驟提示再Tab選牌；模式切換聚焦入口且返回對戰仍暫停；對戰／練習共用preserveDetails保留面板開或關，不新增設定／存檔。終將僅在view顯示末局莊家與風位，未改GameState／分數。

存檔驗證補一般胡拆法必填、來源付款人、完整差額及RON／搶槓來源引用；花胡相容性保留。v1終將缺舊連莊上下文，只回推合法付款，不聲稱歷史連莊／台項／總分可防偽。Luna限定新增9項結算回歸並只讀審查UX／現行文件，未使用Astra。

MAINTENANCE／ROADMAP校正已完成練習與教練的過時說法，README連本輪集中證據。workflow用GitHub原生paths排除專案根Markdown／JPG／SIMULATION證據，源碼、fixture、素材與workflow仍觸發，手動執行保留。11路徑例已本地核對；雲端來源CI成功及下一次純文件推送不新增run需實測，不用skip-ci取代這項驗證。舊queued祖先run因新版完全包含其程式而取消，最新來源仍須全套CI。

接續：完成最新版雲端build／deploy及正式資源／介面驗證，將結果集中更新本節；其餘按可重現回饋維護，不為耗額度新增未要求功能。所有來源、測試及驗收證據已逐包提交，不需重讀整段對話。

## 前次提示狀態修正

已重現教練展開後暫停／繼續被迫收合。view.ts按root保留data-persist的開／關狀態，面板暫時不存在仍保留；toggle只接受仍在root的面板，避免舊事件覆寫。只記本次頁面，重載回預設收合，未新增存檔鍵或設定。226測試及build通過；4191驗暫停、教練關／開、往返練習、按過進入下一次真人17張決策，展開均保留；手動收合亦保留。390無橫溢，證據PANEL-STATE-VALIDATION及兩張截圖。已發布來源e01c210b45a0365c3ef87e2a51c1bb6f9d63fe1c，workflow37362434882 build／deploy成功，index-fRXH5__G.js HTTP200且與本地build相同。正式頁重整確認新版後，17張展開→暫停／繼續仍展開且未出牌，截圖PANEL-STATE-live.jpg。首次新tab可能沿用快取舊HTML，核對實際document.scripts版本並重新整理再驗，不能把快取舊版當程式回歸。

前次選牌外觀／Tab預覽／摘要同步、禁捨提醒修正已發布；來源b28ea5e，workflow37361750072成功。歷史證據COACH-FLOW-VALIDATION，不需重讀對話。

## 現行程式與邊界

TW16-CLASSIC-v1桌規仍凍結，台灣16張五面子一對、144張含花、1真人＋3本地公平AI。RULES／cases不隨介面維護改動。對戰存檔tw16:TW16-CLASSIC-v1:save、純練習tw16:practice:v1，各schemaVersion=1；教練偏好tw16:coach:v1獨立，不讀寫牌局進度。

analysis.ts為AI／練習／教練共用分析；coach.ts只接getObservation遮罩資訊，完整E16／E17且真人有合法決策才分析，忙碌／暫停／關閉提示不顯示。E17比較合法捨牌後E16；吃碰後沿用合法候選與discardBan，不能偷看暗手、牌牆、種子或解析AI reason。向聽與實際胡牌資格分開；拆法只是一種最近目標分配，非最多搭子。公開K／N含他家暗牌及牌尾，不能稱真實摸牌機率；耗盡等待仍顯示0張。不評估台數、防守及槓後風險。

practice.ts為136張一般牌不放回池、17→16捨牌／16→17摸牌，存檔核對種子和完整重播；模式切換先保存並暫停對戰，返回需手動繼續。保存失敗及跨分頁變更保護不得省略。歷史驗收見M5.1／M5.2／M5.2-UX／M5.3-VALIDATION，不須重讀全段對話。

## 發布與驗收工具

正式網站：https://zhai2liu.github.io/taiwan-mahjong/
Repository：https://github.com/zhai2liu/taiwan-mahjong（Public）。使用者已確認帳號改名；API顯示大小寫zhai2Liu，為同一帳號。origin採API回傳的大小寫避免Git重導提示；文件網站網址小寫可用。About Website已同步新網址。Vite base為./，沒有CNAME或舊owner綁定。新github.io來源不會自動讀取舊來源localStorage，未刪除舊資料。

main推送自動測試、build、Pages發布；Git認證已完成。發布／revert見DEPLOYMENT，不直接改site／dist。M5.3已發布來源ff6de93，workflow37357698468成功，index-DoUDaANw.js曾驗與本地build相同；新修改以本輪發布證據為準。

測試固定情境test/browser.html會寫來源存檔，務必用獨立測試port，不覆寫使用者正在玩的來源。原生confirm曾令IAB／Brave工具卡住，不要再自動點已有存檔的新局／重練；接受／拒絕用controller測試或practice-browser可見替代開關驗。不宣稱原生對話框或實機手機／Safari已自動驗證。4191 dev本輪使用，是否存活下次查。

## 用量與接續

本輪起始帳戶五小時已用26%，工作包二／三檢查點55%（剩45%），不是精確對話剩餘token；下次啟動再查。工作包與驗收文件落盤，不重設額度或建自動續跑。介面修正不需要重跑整將長模擬；只有AI／回合／續局改動才擴充相應驗證。

前次純文件run37361965343尚未開始而擋住本次，已取消；本次來源CI完整通過。最後純文件／截圖證據提交用[skip ci]，避免重複建置阻塞後續；若包含程式修改，不能用此方式省略應有測試發布。
