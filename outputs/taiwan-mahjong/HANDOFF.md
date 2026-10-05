# 現行交接入口

2026-10-05。**M0–M3.2已完成；M4 GitHub Pages發布已啟動，準備完成、遠端部署未完成。** 先讀本檔 → README → ROADMAP；按修改範圍讀MAINTENANCE，不需遍讀歷史對話。

## 現況與本輪成果

- 可玩台灣16張對戰，1真人＋3本地公平AI；雙擊／鍵盤出牌、傳統向量牌面、中央牌河、結算dialog。
- M3.1驗收基線185項測試及build通過，詳見M3.1-VALIDATION；本輪文件修改沒有重跑遊戲測試。
- M3.2整理README、新增MAINTENANCE，統一當前／歷史入口；規則、遊戲程式與存檔格式未變更。
- 純練習與新手提示只完成TRAINING-DESIGN；順序M4 → M5.1分析 → M5.2練習 → M5.3對戰教練。
- 文件驗收：命令對照package.json／vite設定／測試入口，存檔對照main及session；15份Markdown的本地連結全部可解析，15個維護指南必要路徑均存在。

## 後續注意

M4已授權；使用者指定lanyaliu521、名稱自行決定，選定taiwan-mahjong。GitHub connector確認登入帳號，尚未建立／查驗目標repo，不要宣稱有正式網址。本機已建立main分支；根目錄.gitignore只允許本專案、M0文件、AGENTS及workflow。GitHub CLI未安裝，connector現有工具未提供建立repository；後續可使用登入的瀏覽器或可用官方工具建立，並確認Pages設為Actions。詳見DEPLOYMENT.md；不需要再次問repository名稱。發布不會搬移本機來源存檔。

134遇上家2的兩種吃法已做指定回歸，原漏項事件快照未留存，當時原因未確認。AI距離估算未納入副露牌種容量；M5.1須補四張上限並與winningTiles核對，不能直接當教學真值。對戰提示只使用getObservation。

## 模型與用量

使用者指定6.1 Sol主導，需要時Luna子代理協助；常規不啟用Astra。本輪文件工作由主代理完成，未增加子代理。

啟動查得五小時已用82%（剩18%），交付前已用84%（剩16%），同一窗口增加2個百分點。接近專案剩15%收斂策略，因此完成M3.2後交接。這是帳戶共同額度，不是精確對話token；下次開始重查。未使用重設額度或自動續跑。


## M4本輪發布準備

- 根目錄.github/workflows/pages.yml：main修改或手動觸發，Node24.12.0、npm ci、test、build，部署site；最小job權限，官方Action版本已查。
- DEPLOYMENT.md：來源選取、首次發布、驗收、更新／revert與存檔來源限制。
- 本輪重跑npm test：185通過、0失敗；npm run build成功。臨時子路徑伺服器驗首頁及2個JS/CSS資源皆成功，沒有根路徑資源引用。工具在work/m4，不納入發布。這不是正式瀏覽器／GitHub網址驗收。
- 下一步：查目標repo是否存在／建立 → 審閱並推送版本 → Pages Actions設定與執行 → 正式網址行牌／結算／續局及窄畫面驗收。M4尚未完成，不進M5。
- 本輪開始五小時已用84%，檢查點86%（剩14%）；已進入交接區間，本次收斂發布準備，不使用重設額度。交付前已用87%（剩13%），同窗口增加3個百分點；下次開始重查。


