# L2-A2：公開決策快照與互斥保存

2026-10-10。L2-A第二子包完成，尚未接真人操作與通知／清除UI，因此AT-07未全部完成。

## 契約

DecisionSnapshot schemaVersion=2：保存明確白名單的決策前Observation、chosen Intent、固定桌規及分析版本。涵蓋自家暗手、花牌、各家公開牌河／面子、分數、圈風、莊連、可用張數、限制與合法選項。對手暗槓維持count遮罩；沒有牌牆、種子、對手暗手、結算及未来資料。

支援捨牌、吃碰槓、過、胡與搶槓窗口。reviewDecision嚴格驗證後重算L1證據；未知分析版本拒絕，不默默套新算法。吃碰記錄是提出的選擇，不能表示仲裁後必定取得該牌。驗證是白名單與可見一致性檢查，並非歷史認證或完整GameState動作授權；缺少私有流程背景時不能重建所有引擎前置條件。

## 保存

新鍵tw16:review:v2，封套版本2；舊v1鍵不讀改、不刪除。解碼保留最小v1記錄相容能力，但不能把它冒充完整快照。上限仍20筆／每筆32KiB／總256KiB。正式呼叫必須用appendReviewLocked／clearReviewLocked；同步函式僅供鎖內與測試。

使用原生Web Locks同來源exclusive鎖，ifAvailable失敗回REVIEW_BUSY；鎖內expectedRaw再次拒絕過期資料。需重新讀取才能重試；無Web Locks則停寫，不降級成不安全的覆蓋。單次setItem失敗保留舊檔，清除共用相同鎖且由UI先確認。

原生行為依據：[W3C Web Locks](https://www.w3.org/TR/web-locks/)、[MDN request](https://developer.mozilla.org/en-US/docs/Web/API/LockManager/request)。

## 驗證

303項全套測試、check及build通過。新增6項快照測試（含600次真實轉移的捕獲／證據重算）、3項鎖競爭測試。正式bundle未變，功能尚未進入站台。

test/review-lock-browser.html於獨立127.0.0.1:4194來源，以兩個同來源iframe視窗環境及真實navigator.locks驗證：同時追加僅一筆成功、失敗者重讀重試保留兩筆、持鎖清除回busy、清除與追加競爭僅一方成功、其他鍵保留。Codex內建瀏覽器顯示PASS。這是兩個獨立window環境，不宣稱跨瀏覽器或手機實機覆蓋。

## 下一包

真人動作成功後才捕獲決策前資料，原牌局保存優先；錯誤／重試／清除與舊存檔回歸。完成L2-A後進少量局後檢討L2-B。人格／攻守不接正式AI。
