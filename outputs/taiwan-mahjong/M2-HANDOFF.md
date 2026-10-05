**歷史交接：目前M3.2已完成，下一階段M4；請先讀[現行HANDOFF](HANDOFF.md)。以下記錄保留當時狀態，不作目前啟動指示。**

# M2 已完成：下次啟動入口

M3現已完成，請先讀 [M3-HANDOFF.md](M3-HANDOFF.md)。173項測試、正式AI三將與瀏覽器專項通過；下一階段為M4。以下保留M2歷史紀錄。

2026-10-04，使用者授權M2並於遇用量限制後要求接著作業。本輪已完成牌桌＋真人＋三位本地公平AI，下一階段為M3穩定與續局深化；未進入M4部署。

## 最短接續

讀本檔 → README.md → M2-VALIDATION.md。凍結桌規仍在../taiwan-mahjong-m0/RULES.md，不重做M0研究。M1-HANDOFF.md保留核心接口背景；實際型別見src/model.ts。

## 已落盤

- src/ai.ts：只收masked observation、legalActions、nonzero uint32策略種子；五面子向聽與可見牌進張，胡優先，合法吃碰槓效率比較。
- src/session.ts：三份獨立AI亂數與GameState整包保存；automaticAction等真人、停結算；advance驗版本、immutable；decode委派engine.restore重算所有候選。
- src/main.ts：單一timer＋generation防舊回呼；localStorage穩定key tw16:TW16-CLASSIC-v1:save；壞檔保留不自動覆寫、寫入失敗提示、新局confirm、跨分頁變更停止且清掉舊saved。
- src/view.ts/style.css：原生繁體首頁/四席/牌河花副露/暗牌遮罩/手牌選後確認/合法回應/完整拆解與台分結算/桌規/速度暫停/手機縱排。無外部圖像與前端框架。
- index.html、vite.config.js：base './'；site/為正式靜態產物，dist/為測試用編譯。Vite8.3.2鎖版，無執行時套件。
- test/ai.test.mjs、session.test.mjs、controller.test.mjs；M2-preview.jpg及M2-VALIDATION.md。

## 最終驗證

npm test：149/149。npm run build成功。AI100次約148ms；正式session6局、78真人/260AI動作、865逐步還原。原M1的1000局/42將仍是舊測試策略，不冒充新AI測量。
真實IAB已完成一局、真人吃牌禁打、reload續局及結算不重付、下一局連莊。390手機無橫溢、1280桌面正常；正式preview無console error。見M2-VALIDATION。

## 可玩入口與程序

http://127.0.0.1:4173/ 正式preview（PTY session65689）；dev http://127.0.0.1:5173/（PTY session2491）。程序ID僅本輪紀錄，重啟須檢查是否還活著。IAB tab1已用正式preview作交付，停在可繼續的測試牌局。重啟命令：npm ci，npm run build，npm run preview -- --port 4173；開發用npm run dev。

## M3 建議工作包

使用者啟動後先跑npm test。再驗正式AI跨完整將的長時間對局、儲存空間不足/禁用/壞檔的瀏覽器提示、reload於各等待窗、鍵盤與手機操作、速度/暫停與新局交互作用。不要重造引擎或前端框架。選擇必要修補，保留Ponytail簡單實作；部署留M4。M2已實作基本續存，但不是已完成所有M3專項。

## 用量與交接

精確對話剩餘token不可讀，只能查帳戶額度。中途兩代理限額失敗前已落盤，續作讀現有檔並修NodeList編譯；必要產物沒有遺失。最新檢查點5小時已用72%/剩28%、每週44%/剩56%，不是下次即時值。代理未執行額度重設、購買或自動續跑。新階段開始及檢查點查額度，每包完成即存檔；短期剩餘近15%優先交接不新增包。

本輪m2_ai、m2_view、m2_validation皆已完成並整合，不必重新啟動舊代理。沒有尚未落盤的必要設計或已知阻斷M2的錯誤。

