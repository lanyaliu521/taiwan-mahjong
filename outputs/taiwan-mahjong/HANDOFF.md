# 現行交接入口

2026-10-06。M0–M5.4已完成並發布，後續按使用者試玩回饋維護。先讀README、ROADMAP，再按需查MAINTENANCE／TRAINING-DESIGN。開發由6.1 Sol主導，需要時Luna限定協助，不例行使用Astra。

## 最新維護：窄視窗頂列（本地完成，發布待驗）

320首頁垂直捲軸扣寬後client305、scroll318，品牌與header-tools最小寬溢出；舊驗收只比innerWidth而漏判。760px媒體條件加site-header換行、工具列靠右。修後首頁305／305、教學265／265、練習入口／續練及對戰320／390均無橫溢，無error；build過。證據HEADER-320.jpg／MAINTENANCE-2026-10-06工作包十四。預期index-WkiKqWo8.js／index-DIlVjIQw.css；提交推送後查完整CI／正式首頁client與scroll，再記發布完成。不改規則／存檔，不重跑長模擬。

本輪帳戶五小時起始0%（剩100%）；工具快照不同於精確對話token，前輪87%為歷史。下一功能優先順序已向使用者詢問，尚未取得選項時先完成本包，不增加題庫／自測功能。

## 本輪最新工作與接續

M5.4新手教學已完成本地驗收並推送首版c4ce080：六步原生dialog，首頁／對戰／練習入口；先保存暫停，私有17張出牌及134兩吃法示範不接Session／存檔／遊戲命令。三入口、雙擊／Enter／空白鍵、吃後禁捨、完成／Escape回焦點、320／390無橫溢已驗，正式17張不變，返回對戰仍暫停。Luna限定6 controller回歸、只讀規則審查；已補花胡立即結算例外。詳TUTORIAL-VALIDATION與四張TUTORIAL截圖。

最新包另補結算台項ID唯一、S31／S32不混基礎台、花胡來源8台與互斥檢查；保留合法一般拆法花胡加台。v1不驗證全部歷史台項／連莊，不聲稱防偽。教練已提示有效牌剩0但不取消當下合法胡，coach測試與exhaustedWait瀏覽器場景覆蓋。244全套測試與build通過，正式資源已核對index-BJVs4oOv.js／index-E3veXjre.css，最新來源723a898已推送，含29 controller／244全套測試。各包細節集中MAINTENANCE-2026-10-06及SIMULATION.json；核心付款曾3完整將74局317次還原通過。

GitHub發布阻擋已解除：Actions官方公告恢復後，重試run37369632079失敗的發布工作，attempt2成功。來源723a898，HTTP200的JS／CSS與本地build逐byte一致。正式瀏覽器實際載入index-BJVs4oOv.js；首頁教學開啟、示範雙擊三萬17→16、13吃2顯123與禁捨2、Escape移除dialog並回教學按鈕，無error，證據TUTORIAL-LIVE.jpg。未開新局或恢復使用者正式牌局，未覆寫存檔。M5.4正式完成。

workflow原生paths已排除根Markdown／JPG／SIMULATION文件；來源CI37365714924已成功，純文件提交259594e未加skip-ci，推送前後最新run均37369632079，已實測不新增run；未跳過任何來源測試。普通源碼／fixture推送仍全套測試發布。

本輪另完成鍵盤出牌／回應／續局／下一局入口、練習開題排除收合details隱藏按鈕、模式切換焦點及手動續牌、共用preserveDetails面板開／關、末局莊與風位顯示、一般胡拆法必填與來源完整付款驗證、維護文件校正。所有包均已落盤／逐包提交，無需重讀對話。帳戶最新87%（剩13%），非精確對話token；低額度先交接，不重設或自動續跑。

4191獨立測試來源，不覆寫使用者4173等存檔。原生confirm會卡工具，重練用practice-browser可見替代開關；不宣稱實機手機／Safari或原生confirm已驗。viewport已還原。

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

帳戶五小時最新已用87%（剩13%），不能換算精確對話剩餘token。每包先落盤再推進，不重設額度、不建自動續跑。目前沒有待完成的發布或功能階段；後續依可重現回饋維護。最新發布來源723a898c7db8c246e3d2863ad3752db5e70b14ec、run37369632079 attempt2成功；bundle index-BJVs4oOv.js／index-E3veXjre.css。不要重新研究桌規或重跑已過長模擬。純文件正常推送，不用skip-ci。
