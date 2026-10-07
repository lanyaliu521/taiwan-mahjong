# 現行交接入口

2026-10-08。M0–M5.4與前次維護已完成。本輪依使用者要求深化人性化AI研究與M6.1公開安全基礎；**未更換正式AI，不算M6.1整包完成。** 開發由6.1 Sol主導、Luna限定協助，不例行啟用Astra。

## 目前工作：牌風、牌效與保留安全張研究

[HUMAN-AI-TACTICS-RESEARCH](HUMAN-AI-TACTICS-RESEARCH.md)整理來源、留退路／安全進聽／欺敵的區別、現二字牌單吊反例、四軸映射與消融方案。3組17張案例：同一步牌效保留、少4張有效進張的代價、安全打北進聽；RESERVE-EXAMPLES.json與research-reserve.mjs可重現，腳本含5組人工期望斷言。

src/safety.ts只用公開牌池排除普通放槍的將／刻／順子路徑，未接ai.ts、Session或教練。5個新測試含4,314組局部容量與完整五面子一對見證交叉核對；不是完整對手分布或放槍率模型。268項全套／check／build通過；正式bundle仍index-BEUwn2va.js／index-CmJt2tzJ.css，研究模組未入站。來源0968d43，Actions37660636097的build／deploy皆成功；正式首頁仍載入相同JS／CSS，兩資源HTTP200。工作已完成，工作樹提交後保持乾淨。

下一包：公開相對風險證據、反例與有代價的選擇情境；尚未校準威脅、危險排序或人格權重。保留牌偏好不能越過合法WIN、現在捨牌風險及禁捨；欺敵加分仍停用。人格策略接線前需公平、續局升版與對局評估，不直接將口訣上線。

前次來源e0a703b、交接62e633d，2026-10-08重新確認Actions37577872254成功。前階段完整驗收已落盤，本輪沒有重做UI或更動其行為，也未開瀏覽器／伺服器。

## 前一階段：全專案維護（已收尾）

前次處理兩個具體改善：展開教練或顯示儲存警告時不擠壓中央牌桌；對戰、結算和練習儲存失敗可按「重試儲存」，不必推進遊戲，跨分頁衝突仍禁止覆寫。263項完整測試／check／build、依賴audit與獨立4193瀏覽器驗收通過；已發布來源e0a703b，Actions37577872254的build／deploy皆成功；正式首頁與資源index-BEUwn2va.js／index-CmJt2tzJ.css均驗過，兩資源HTTP200、瀏覽器無error／warn。下一步依試玩回饋維護。詳細範圍、證據與限制見[AUDIT-2026-10-07](AUDIT-2026-10-07.md)。

本檔只保留現況與接續事項；舊工作證據從README連往各驗收文件，不沿用舊資源名稱或額度當現況。

## 不變的實作界線

- TW16-CLASSIC-v1：144張含花、台灣16張五面子一對，1真人＋3本地公平AI。RULES與cases凍結；不套日麻振聽、日麻或港麻計台。
- AI與教練只讀getObservation的自家／公開資訊；不接完整GameState、對手暗手、暗槓種、牌牆或種子。公開K/N不是實際摸牌機率，拆法不是最大互斥搭數，現行建議不含防守評分。
- 對戰Session／GameState及練習仍schemaVersion=1。讀檔必須驗證；失敗保留原檔，跨分頁競爭停止操作。結算已付款，重載／重開結算不可再付款。
- 對戰鍵`tw16:TW16-CLASSIC-v1:save`、練習鍵`tw16:practice:v1`、教練偏好`tw16:coach:v1`各自獨立。教學先保存暫停，示範不改正式牌局。
- 練習136張一般牌、不放回；無花、計台或吃碰槓。正向回饋只是同頁提示，逐條牌型只格式化已結算ScoreResult，不另算台。

## 擴充入口

[README](README.md)為總入口；[MAINTENANCE](MAINTENANCE.md)記修改位置、資料流及驗證；[ROADMAP](ROADMAP.md)記階段；[DEPLOYMENT](DEPLOYMENT.md)記發布／回復。按需讀[凍結桌規](../taiwan-mahjong-m0/RULES.md)，不要重新研究或另抄規則。

人性化AI的[設計](HUMAN-AI-DESIGN.md)、[決策／保存規格](HUMAN-AI-DECISION-SPEC.md)、[驗證方案](HUMAN-AI-VALIDATION.md)已完成，包含四軸、三個試驗模板、資訊邊界及Session升版要求。[牌風研究](AI-STYLE-DESIGN.md)的768副E16起手基準不可直接套莊E17；研究腳本可讀fixture真值，正式策略不可照搬。本輪已啟動研究與公開安全基礎；三模板、保存升版及正式策略仍未開始。

## 正式站與工作環境

- 網站：https://zhai2liu.github.io/taiwan-mahjong/
- origin：https://github.com/zhai2Liu/taiwan-mahjong.git；main來源推送自動test／build／Pages。Vite base為`./`，無CNAME或舊owner綁定。
- 更早來源8152b91，Actions37555396794成功、259測試；證據見[TABLE-LAYOUT-VALIDATION](TABLE-LAYOUT-VALIDATION.md)。這是歷史證據。
- 純Markdown／JPG／SIMULATION報告被workflow路徑排除；文件提交不須skip-ci或手動部署。不要直接改site／dist。
- 驗收必用獨立port，本輪4193已停止、測試頁已關閉；不可覆寫使用者4173或正式存檔。原生confirm只在確實要換題／新局時操作；測試工具提供獨立情境。尺寸驗收不等於手機實機／Safari驗收。
- Scratch放work/、交付放outputs/。每包完成立即更新交接。帳戶比例不是精確對話剩餘token；額度低時優先落盤，不自行重設或新增自動續跑。前次最後98%為舊窗口；本輪起始3%、測試檢查24%、收尾43%（剩57%）。帳戶用量包含其他並行工作。
