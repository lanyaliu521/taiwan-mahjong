# 現行交接入口

2026-10-05。M0–M5.1完成；下一階段M5.2純練習模式，待使用者啟動。先讀README、ROADMAP、TRAINING-DESIGN及MAINTENANCE。6.1 Sol主導，必要時Luna限定協助；本輪Luna只做唯讀案例檢查。

## M5.1完成內容

src/analysis.ts是正式AI與後續教練／練習的共用分析。距離採容量合法五面子一對目標的最少缺張數減1，副露槓扣4張容量；有距離、有效牌／張數、精確或公開估計比例、示例分配、合法捨牌及吃碰後比較。hand.prepareHand與engine.discardBan共用原驗證／禁捨，不另寫桌規。

200項測試及build通過；正式策略3完整將、74局、9,121步、317次存檔還原通過。證據見M5.1-VALIDATION.md與M5.1-SIMULATION.json。對戰桌規、存檔格式及介面未改；練習與對戰教練尚未實作。AI仍只估一張進牌效率，不估防守／台數／搶槓風險。

## 下一步M5.2

按TRAINING-DESIGN做136張一般牌不放回練習，16→17→16捨牌預覽／回饋、摸下一張、同種子重練。practice.ts保持獨立狀態及版本化存檔，不覆寫對戰。exactPool必須只含剩餘牌池，自家牌不可重疊；摸牌減池，捨牌不回池。完成手機／鍵盤流程、牌權、機率、重載與對戰存檔保留驗收後發布。不提前啟動M5.3。

示例是一種最近目標分配，非唯一或最多搭子的拆法；E17需逐個合法捨牌比較，初始發牌／補花未完成時不要分析。公開比例的未知牌包含他家暗手與牌尾，不能稱真實牌牆機率；有效牌0張仍保留作耗盡提示。

## 網站與發布

正式網站：https://lanyaliu521.github.io/taiwan-mahjong/
Repository：https://github.com/lanyaliu521/taiwan-mahjong（Public）。main追蹤origin/main，認證已完成；推送main自動測試、build及Pages部署。發布／回復見DEPLOYMENT.md，使用revert正常提交，不強推。本輪遊戲來源提交08f7ad8b10ef103ebecabcbc588c5e5e66c163e7已發布，workflow 37320813153的build及deploy均成功。正式首頁／新版JS皆HTTP200，線上JS與本地build內容完全相同。

網址修正：先前About Website誤設zhaizhaiLiu.github.io而404；實際owner仍lanyaliu521，已恢復Use your GitHub Pages website。沒有帳號改名、修改遠端或桌規。

M4介面驗收及截圖保留；本輪未改介面，未重做實機手機／Safari驗收。134遇2原漏項快照未留存，當時原因未確認；指定回歸及本輪兩吃法分析通過。

## 用量與交接

M5.1起始五小時已用2%，交付檢查點14%（剩86%）；帳戶共用額度，非精確對話token。工作與證據已落盤；不重設額度、不建立自動續跑。下次先重查。
