# 現行交接入口

2026-10-06。M0–M5.3已完成並發布，後續按使用者試玩回饋維護；沒有待啟動的新功能階段。先讀README、ROADMAP，再按需查MAINTENANCE／TRAINING-DESIGN。開發由6.1 Sol主導，需要時Luna限定協助，不例行使用Astra。

## 本輪選牌流程修正

已重現四萬選牌外觀與Tab到一筒的預覽不一致。view.ts統一focus／單擊選牌，同步外觀、aria-pressed、main selectedTile及教練摘要；跨焦點清除雙擊計時。禁捨與合法胡牌必要提醒放在教練之前。226項測試及build通過，4191獨立來源驗Tab／Shift+Tab、收合摘要、Enter、雙擊、暫停及320畫面。已發布來源b28ea5e909e745a8dfea754bbcf1e47104d5d916，workflow37361750072 build／deploy成功，首頁及index-lkeRHReb.js HTTP200，線上JS與本地build完全相同。正式續局17張，Tab四萬→六萬時外觀／預覽／摘要一致為六萬5向聽且未出牌。證據COACH-FLOW-VALIDATION與桌面／窄畫面／正式截圖。

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

本輪起始帳戶五小時已用11%，交付檢查點16%（剩84%），不是精確對話剩餘token；下次啟動再查。工作包與驗收文件落盤，不重設額度或建自動續跑。介面修正不需要重跑整將長模擬；只有AI／回合／續局改動才擴充相應驗證。
