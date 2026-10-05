# 現行交接入口

2026-10-05。M0–M5.2完成；下一階段M5.3對戰教練，待使用者啟動。先讀README、ROADMAP、TRAINING-DESIGN及MAINTENANCE。6.1 Sol主導，Luna本輪只補限定practice.test.mjs，不例行使用Astra。

## M5.2完成

practice.ts維護136張一般牌、不放回牌池、16→17→16、五面子一對完成／牌池耗盡；practice-view.ts提供單擊預覽、雙擊／Enter／空白鍵捨牌、有效牌比例、示例拆法、較佳候選／回饋、同題重練。模式切換先保存並暫停對戰，返回需手動繼續；獨立存檔鍵tw16:practice:v1、schemaVersion=1，重播種子與日誌完整核對；對戰桌規與存檔不變。

217項測試、build通過；種子42走45次捨牌到完成，77走120次到耗盡。瀏覽器驗單擊／雙擊／鍵盤、重載續練、原始與下一張重播、取消保留、往返對戰完整手牌保留及暫停。320／390寬無橫溢。證據M5.2-VALIDATION.md及M5.2-practice.jpg。沒有新增依賴。

## 下一步M5.3

只在真人決策時顯示可關閉／收合提示：牌型拆法、向聽、公開有效牌估計及每種合法吃碰後捨牌比較。只能接真人getObservation，使用analysis.ts／引擎合法候選及共用discardBan；不得讀暗牌、牌牆、種子，也不解析AI reason。E17先比較合法捨牌回E16，初始發牌／補花未完成時不分析。提示不阻擋操作，不替玩家行牌。

示例是一種最近合法目標分配，非唯一／最多搭子；公開未知牌包含他家暗手與牌尾，不能稱真實牌牆機率。結構有效而剩0張仍保留作耗盡提醒；牌型聽牌與實際合法胡分開。槓首版不提供未計補牌／搶槓風險的策略評分。

## 網站、發布與測試工具

正式網站：https://lanyaliu521.github.io/taiwan-mahjong/
Repository：https://github.com/lanyaliu521/taiwan-mahjong（Public）。main追蹤origin/main，認證已完成；push自動測試、build、Pages部署。發布／revert回復見DEPLOYMENT。M5.2來源提交b7aafc6edfcd8504122ae57bb47cd631ed80d51f已發布；workflow 37324560829的build及deploy成功，正式首頁／JS均HTTP200，線上JS與本地build完全相同。正常網站已驗純練習入口、17張／119池、捨西預覽27／119＝22.7%、雙擊後16張／池119及回饋。線上截圖M5.2-live.jpg。

前次About Website誤設zhaizhaiLiu.github.io，owner未改名，已恢復正確Pages網址；不要改遠端。TW16-CLASSIC-v1凍結不變。

瀏覽器原生confirm令IAB／Brave自動化焦點處理卡住，使用者已關閉；重練接受／拒絕用test/practice-browser.html可見開關驗證，正式頁面仍原生confirm。未宣稱工具直接控制原生視窗成功或實機手機／Safari驗收。測試只用4185／4187，與正式存檔分開。正常4187練習tab保留作預覽；伺服器是否存活下次查。不要再次點原生重練確認作自動化。

## 用量

本輪五小時起始已用15%，交付檢查點37%（剩63%），帳戶共用估計，非精確對話剩餘token。程式、文件及驗收落盤；不重設、不建自動續跑。下次先重查。

## M5.2試玩後易用性調整（2026-10-05）

完成手牌／預覽集中、距離／機率分卡、有效牌單列左右捲動、候選只預覽、簡短分步流程、回饋解釋及換題／重練收合。摸牌後不再自動選第一張。217測試及build通過，4189獨立來源驗桌面、320／390、候選不出牌、保留拆法展開、雙擊與鍵盤、焦點及進牌捲動；無控制台錯誤。證據M5.2-UX-VALIDATION及兩張UX截圖。已發布來源4cd85163b93423c7e80471fbfdcf458854f6b156，workflow 37328145859的build／deploy成功；正式首頁HTTP200，載入index-DyesrdcM.js，與本地build完全相同。M5.3仍未啟動。

本輪起始五小時已用38%，交付檢查點47%（剩53%），下次啟動重查；不是精確對話token。程式及文件落盤，不需重跑整場長模擬；本輪只改練習呈現層。
