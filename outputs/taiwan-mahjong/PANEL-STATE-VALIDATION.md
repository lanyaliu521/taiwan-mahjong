# 提示展開狀態維護

2026-10-06，M5.3後續易用性維護，6.1 Sol完成。

## 重現與修正

4191獨立來源chi134-m，展開教練→暫停→繼續：舊版教練open為false。原render只複製當下可見的details[open]，提示在暫停／電腦回合被移除後，下一次render沒有可恢復的狀態。

view.ts以原生WeakMap按root保留data-persist細節的開／關狀態。render捕捉可見面板；toggle事件即時更新，但只接受仍在root內的面板，避免已移除的舊畫面覆寫。目前不存在的面板不刪除狀態，重新顯示時恢復。僅記本次頁面生命週期，重新整理回預設收合；沒有新增localStorage鍵、依賴或存檔格式。

## 驗收

226／226測試及build通過。實際瀏覽器驗證展開後暫停／繼續、教練關／開、往返練習／返回對戰再繼續，都維持open=true；按過進入引擎裁決與摸牌，下一次真人17張決策仍open=true。手動收合後暫停／繼續及教練關／開都保持false，不強迫展開。

390×844仍無橫溢（scrollWidth=390），手牌底部535px；提示內容局部捲動，操作仍可達。控制台無錯誤，viewport已還原。證據：[桌面](PANEL-STATE-desktop.jpg)、[窄畫面](PANEL-STATE-mobile.jpg)。未宣稱實機手機或Safari驗收。規則、牌效、AI及存檔未改，不重跑長模擬，也不為原生DOM行為新增測試框架。

## 發布

待本次來源推送／Pages確認，完成後補入此節及HANDOFF。
