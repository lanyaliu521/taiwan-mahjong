# 現行交接入口

2026-10-05。M0–M4已完成；下一階段M5.1共用牌效分析，待使用者啟動。先讀README、ROADMAP及TRAINING-DESIGN；修改位置／驗證見MAINTENANCE。6.1 Sol主導，需要時Luna協助。

## 正式網站與版本

- 網站：https://lanyaliu521.github.io/taiwan-mahjong/
- Repository：https://github.com/lanyaliu521/taiwan-mahjong（Public）。本機main追蹤origin/main，Git認證已由使用者完成，初次推送成功。
- 已驗收遊戲提交：29057b26bcc2a6cba1106c0552ffd7648f1271f6。
- 成功workflow：https://github.com/lanyaliu521/taiwan-mahjong/actions/runs/37247813100，build及deploy成功；Pages Source為GitHub Actions。
- 本輪文件／截圖更新需提交推送；若觸發新run，只是同遊戲來源的文件更新，下一次查其成功狀態。

## M4驗收

本地185項測試、build及子路徑首頁／兩資源通過；GitHub首次workflow亦成功。正式網站以正常介面驗開局、補花、三電腦行牌、七八索吃九索及禁捨、雙擊與Enter出牌。暫停後重載，繼續牌局手牌一致。第1局右席胡3台，+70／對席-70，結算彈窗正常；390×844頁寬390無橫溢，下一局按鈕在視窗內；點下一局進第2局並暫停。

Brave正式網站tab已保留作交付，停在第2局暫停；viewport override已重設。M4-live-result.png、M4-live-mobile.png、M4-repository.png與M4-pages-settings.png為證據。未宣稱實體手機／Safari驗收。原本4173來源存檔未修改。

## 後續與限制

M5尚未實作。先做共享分析與副露四張容量驗證，再做練習／對戰教練，不直接用AI估算當教學真值。134遇2原漏項快照未留存，指定回歸已通過，當時原因未確認。桌規TW16-CLASSIC-v1不變。

更新推送main自動部署，回復使用revert正常提交，不強推。首次成功run有官方Pages actions的Node20轉24棄用警告及ubuntu-latest未來迁移公告，未阻擋部署；後續升級時查官方版本，不本輪增加無關修改。

## 用量

本輪起始五小時已用87%，交付前98%（剩2%），是帳戶共用額度，非精確對話token。已完成網站驗收，立即落盤收斂；不啟動M5，不使用重設額度或自動續跑。下次先重查。
