# 台灣16張麻將

1真人＋3位本地公平電腦，採固定桌規TW16-CLASSIC-v1。可在本機網頁遊玩完整牌局；M0–M5.1已完成，正式網站已上線：[立即遊玩](https://lanyaliu521.github.io/taiwan-mahjong/)。下一階段M5.2純練習模式。練習與教練提示已規劃，尚未實作。

## 入口

- [目前交接與下一步](HANDOFF.md)
- [階段順序與完成條件](ROADMAP.md)
- [發布設定、更新與回復](DEPLOYMENT.md)
- [維護指南：修改位置、資料流、存檔與驗證](MAINTENANCE.md)
- [固定桌規與完整台表](../taiwan-mahjong-m0/RULES.md)
- [概念契約](../taiwan-mahjong-m0/CONTRACTS.md)：實際欄位以src/model.ts為準。
- [純練習與新手提示設計](TRAINING-DESIGN.md)：M5設計及Sol／Luna分工。
- [最近分析與遊戲驗收](M5.1-VALIDATION.md)：200項測試、建置及正式策略整場模擬；介面歷史驗收見M3.1及M4。

## 安裝與遊玩

在此資料夾開啟終端機，使用Node.js與npm。前次驗證環境為Node 24.12.0、npm 11.6.2；安裝版本以package-lock.json為準，無執行時套件。

```powershell
npm ci
npm run build
npm run preview -- --port 4173
```

開啟[本機牌桌](http://127.0.0.1:4173/)。單擊選牌、快速連點同張兩次出牌；鍵盤Tab選牌、Enter或空白鍵出牌。合法吃碰槓胡直接選操作。結算彈窗可看明細、返回牌桌或進下一局；重載可選「繼續上次牌局」。本機伺服器是否仍在執行須當次確認。

存檔屬於目前網站來源及瀏覽器；換網址、連接埠、瀏覽器或清除網站資料，可能讀不到同一存檔。網站部署不會自動搬移本機牌局。

## 開發與驗證

```powershell
npm run dev -- --port 4183
npm test
npm run build
```

`npm test`編譯後執行Node內建測試；`npm run build`先編譯再產生正式site/。dist/供測試匯入，test/頁面與fixture不屬正式遊玩入口。依改動選擇驗證範圍，詳見維護指南，不為文件或CSS細節重跑長模擬。

## 歷史證據

[M0驗收](../taiwan-mahjong-m0/VALIDATION.md)、[M1驗收](VALIDATION.md)、[M2驗收](M2-VALIDATION.md)、[M3驗收](M3-VALIDATION.md)、[吃牌專項](M3.1-CHI-VALIDATION.md)保留原始結果。歷史交接只用來查背景；目前狀態以HANDOFF及ROADMAP為準。


