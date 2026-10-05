# 現行交接入口

2026-10-05 M5.2工作檢查點：練習狀態、獨立存檔、介面及模式切換已實作，217項測試及build通過，瀏覽器單擊預覽／雙擊／鍵盤出牌、390窄畫面與續練通過；原生確認視窗阻擋自動化，已請使用者關閉。最後重練及返回對戰的實際瀏覽器尾項待完成。詳見M5.2-VALIDATION.md。尚未啟動M5.3。先讀README、ROADMAP、TRAINING-DESIGN及MAINTENANCE。6.1 Sol主導，必要時Luna限定協助；本輪Luna只做唯讀案例檢查。

## M5.1完成內容

src/analysis.ts是正式AI與後續教練／練習的共用分析。距離採容量合法五面子一對目標的最少缺張數減1，副露槓扣4張容量；有距離、有效牌／張數、精確或公開估計比例、示例分配、合法捨牌及吃碰後比較。hand.prepareHand與engine.discardBan共用原驗證／禁捨，不另寫桌規。

200項測試及build通過；正式策略3完整將、74局、9,121步、317次存檔還原通過。證據見M5.1-VALIDATION.md與M5.1-SIMULATION.json。對戰桌規、存檔格式及介面未改；練習與對戰教練尚未實作。AI仍只估一張進牌效率，不估防守／台數／搶槓風險。

## M5.2最後驗收與交付

M5.2實作及217項測試已完成，尚未發布。最後任務：解除IAB／Brave原生重練confirm（工具accept／dismiss均被焦點處理阻擋），核對同題重練原始手牌與牌序、確認／取消、返回對戰仍暫停且存檔保留，再完成320寬排版及可分享截圖。390寬、單擊／雙擊／鍵盤、重載續練已驗。可以使用4187/test/practice-browser.html可見確認開關；測試來源與正式存檔分開。正常頁面4185曾留下原生視窗，請先關閉。兩個dev伺服器4185／4187在本輪啟動，是否存活下次查。正式網站仍為M5.1。

完成尾項後更新M5.2-VALIDATION、HANDOFF、ROADMAP及AGENTS，提交推送main、確認workflow與線上資源。未改對戰核心，不再跑M5.1三完整將；全套六局對戰回歸已通過。未啟動M5.3。

示例是一種最近目標分配，非唯一或最多搭子的拆法；E17需逐個合法捨牌比較，初始發牌／補花未完成時不要分析。公開比例的未知牌包含他家暗手與牌尾，不能稱真實牌牆機率；有效牌0張仍保留作耗盡提示。

## 網站與發布

正式網站：https://lanyaliu521.github.io/taiwan-mahjong/
Repository：https://github.com/lanyaliu521/taiwan-mahjong（Public）。main追蹤origin/main，認證已完成；推送main自動測試、build及Pages部署。發布／回復見DEPLOYMENT.md，使用revert正常提交，不強推。本輪遊戲來源提交08f7ad8b10ef103ebecabcbc588c5e5e66c163e7已發布，workflow 37320813153的build及deploy均成功。正式首頁／新版JS皆HTTP200，線上JS與本地build內容完全相同。

網址修正：先前About Website誤設zhaizhaiLiu.github.io而404；實際owner仍lanyaliu521，已恢復Use your GitHub Pages website。沒有帳號改名、修改遠端或桌規。

M4介面驗收及截圖保留；本輪未改介面，未重做實機手機／Safari驗收。134遇2原漏項快照未留存，當時原因未確認；指定回歸及本輪兩吃法分析通過。

## 用量與交接

M5.1起始五小時已用2%，交付檢查點14%（剩86%）；帳戶共用額度，非精確對話token。工作與證據已落盤；不重設額度、不建立自動續跑。下次先重查。

M5.2新增檔案：src/practice.ts、practice-view.ts、test/practice.test.mjs與practice-browser.html。本輪起始五小時已用15%，檢查點21%（剩79%）；不是精確對話token。不要重跑M5.1三完整將，對戰核心未改，全套已有六局回歸。
