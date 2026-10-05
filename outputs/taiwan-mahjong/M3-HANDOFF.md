**歷史交接：目前M3.2已完成，下一階段M4；請先讀[現行HANDOFF](HANDOFF.md)。以下記錄保留當時狀態，不作目前啟動指示。**

# M3 已完成：下次啟動入口

**最新：M3.1操作與美術修正已完成，185項測試及建置通過。現在先讀[M3.1-HANDOFF.md](M3.1-HANDOFF.md)，下一階段M3.2文件整理。以下保留M3歷史紀錄。**

2026-10-05（Asia/Taipei）。使用者授權的M3穩定性、續局與操作驗收已完成。使用者試玩後反映操作／美術問題，並要求完善維護文件；**後續順序調整為M3.1試玩修正 → M3.2文件整理 → M4 GitHub Pages發布，均待使用者啟動。** 詳見[ROADMAP.md](ROADMAP.md)，本次只更新規劃。不重建引擎或重研凍結桌規。

## 最短接續

本檔 → [README.md](README.md) → [M3-VALIDATION.md](M3-VALIDATION.md)。TW16-CLASSIC-v1桌規在../taiwan-mahjong-m0/RULES.md。M1/M2交接保留核心與前端背景，實際型別見src/model.ts。

## 已完成並落盤

- src/main.ts：空字串判壞檔；讀取失敗仍要求覆寫確認；render代次拒絕舊UI。保留單一計時器、版本與跨分頁保護及儲存重試。
- src/view.ts：結算文案不再誤稱已儲存。src/style.css：移除body固定最小寬度，320px含捲軸不橫溢。
- test/controller.test.mjs共12項；test/resume.test.mjs共15項；scripts/browser-fixtures.mjs及test/browser-fixtures.json提供9合法場景。
- test/browser.html與runner.html是獨立來源測試工具，不進正式site。reload只重載，不重寫fixture。
- scripts/verify-m3.mjs、M3-SIMULATION.json、M3-VALIDATION.md、M3-preview.jpg、M3-mobile.jpg。
- 無新依賴；引擎、session、桌規與AI策略未改。

## 最終驗證

- npm test：173/173、0失敗。其後只修CSS與文件，正式build再次通過。
- 正式AI：3完整將、74局、9121步、912真人席代答、317還原檢查；57放銃、16自摸、1流局，每將16次移莊，牌權及零和皆通過。
- 瀏覽器獨立4183驗壞JSON／空字串／未知版保留、禁止讀取提示、空間不足保留舊檔及恢復後重試。
- 9等待場景reload續行；實際搶槓胡+60/-60後reload不重付，已答真人不重問，將末無下一局。
- Enter/Space/Tab、焦點、速度、暫停／繼續、320/390/1280視窗通過。未宣稱實體手機或Safari實測。
- 原生confirm取消未作瀏覽器證據；取消、跨分頁競態及過期計時器以可控controller測試驗證。無待修的已知M3阻塞。

## 可玩入口與產物

工作目錄：C:\Users\USER\Documents\Codex\2026-10-03\new-chat\outputs\taiwan-mahjong。

正式本機 http://127.0.0.1:4173/ 已更新，首頁仍有「繼續上次牌局」，本階段未覆寫4173原檔。程序關閉後用 `npm run preview -- --port 4173` 重啟。開發用 `npm run dev`，測試工具用獨立4183。瀏覽器尺寸已還原，已停止4183測試伺服器；再次驗收需重啟。

site/為正式靜態產物，dist/為TypeScript測試編譯，Vite base為 `./`。目前沒有Git repository、遠端或已發布網址。

## M4 啟動時

1. 查額度，確認本機檔案與Git狀態，沿用173項測試及build。
2. 確認GitHub帳號、目標repository及公開性；先準備可審查的Git／Pages設定，不猜目的地。
3. 處理Pages發布及專案子路徑，勿把node_modules、測試fixture或scratch當網站產物。
4. 正式網址驗資源、開局、三AI行牌、續局與窄畫面，完成M4交接。

## 用量紀律

本階段曾在5小時剩9%時先落盤，續作曾查得98%、32%。最新2026-10-05快照：5小時已用18%／剩82%，每週已用67%／剩33%；重設額度仍3次，未使用，未設自動續跑。

這是帳戶共用額度，**不是精確對話剩餘token**，不推論百分比變化原因。下次開始重查；每包落盤，接近15%不擴新工作，優先交接。本檔足以在新上下文接續。

