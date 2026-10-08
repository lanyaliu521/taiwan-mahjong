# 現行交接入口

2026-10-09。產品轉向「台灣16張麻將進階玩家決策訓練」。已採納報告主方向及D-01～08規劃預設；詳見[PRODUCT-DIRECTION](PRODUCT-DIRECTION.md)。主線是可信證據、少量局後檢討、無提示陌生題測驗；既有對戰保留，正式人格／攻守整合暫緩。

## 最新完成：L1-B最小決策證據封裝

新增src/decision-evidence.ts與7項測試；[契約與驗收](L1B-EVIDENCE-CONTRACT.md)記schemaVersion=1、analyzerVersion=tw16-evidence-1、候選Intent／穩定id、E1牌效、E2對手別proven／unknown、E3限定牌效偏好。E17改善數／比例不適用，輸出null；不讀事後結算或私有資料。288全套測試、check／build通過，正式bundle仍index-BEUwn2va.js／index-CmJt2tzJ.css，未接UI／AI／存檔，未推送／部署。

L1-B帳戶五小時起始已用46%、收尾66%（剩34%），非精確token。L1-A／B限定內部證據工作完成，非新訓練MVP上線或學習效果驗證。輸入只限引擎新產生Observation；基本防呆不取代L2外部／存檔嚴格驗證。L1-B不得被當成任意JSON安全載入器。

## 前包：L1-A核心證據驗收

[驗收清單與結論](L1A-EVIDENCE-VALIDATION.md)含12類案例的條件、預期、推導與限制。新增test/evidence-boundaries.test.mjs三項測試：16種手算牌池及並列集合、可見資訊相同但實際可胡不同的兩個世界、普通放槍安全後莊仍自摸／流局續莊兩分支。281全套測試、check／build通過；src、正式AI、桌規、存檔及bundle不變。未推送／部署。

L1-A本輪帳戶五小時起始已用26%、收尾41%（剩59%），非精確token；未重設。L1-A底層驗收完成；G1及L1整包尚未完成，正式證據格式、版本、unknown及穩定呈現仍需L1-B。並列集合可重現，不等於已驗UI排序；局部安全不代表防止自摸／流局續莊。

## 前包：L0與方向調整（歷史證據）

- 原始報告完整複製入專案，SHA256與Downloads原檔一致；保留提案原文，本次決議另記。
- 更新ROADMAP、訓練設計、README、啟動AGENTS及研究／發布註記；PROJECT-REVIEW保留歷史快照。
- [L0-L1-PLAN](L0-L1-PLAN.md)已查核實際API／呼叫鏈、資訊邊界、證據案例、最少檔案與快照／存檔風險；方案未實作。
- 本輪重新278項測試全過、check／build成功。bundle仍index-BEUwn2va.js／index-CmJt2tzJ.css。未更動src、桌規、現行AI或存檔。

## 版本基準與證據界線

開工本機fe909ee，遠端main即時查為57a0921；14870ee研究及fe909ee文件未推送。本包另作本機文件提交，未推送／部署。最新Actions37662675210來源f944292仍成功；正式首頁與JS／CSS本輪HTTP200。不含本輪瀏覽器互動或手機實機驗收；無新部署，不能宣稱新訓練已上線。

## 下一個工作包

L2-A決策快照與獨立保存：先建立受控DTO／驗證、版本／大小限制、選擇對應、保存失敗／跨分頁與舊檔相容。詳見L0-L1-PLAN及L1B-EVIDENCE-CONTRACT。L2-B再接局後UI；不改正式AI或引入研究權重。

不接人格／阻莊權重至正式AI，不先蓋快照框架，不做全面風險概率或收益。60題及6–10人不是固定交期或統計充分門檻；本輪未招募試用者。既有研究保留供通過驗收後選用。

## 固定界線

- TW16-CLASSIC-v1，144張含花、16張五面子一對；莊胡及流局續莊。RULES唯一權威，不套日麻振聽。
- AI／教練只讀指定getObservation；新快照要額外白名單，排除settlement及事後資料，不讀暗牌／牆／種子。
- 現行Session、GameState、練習皆v1；對戰tw16:TW16-CLASSIC-v1:save、練習tw16:practice:v1、偏好tw16:coach:v1。新review鍵僅設計，尚不存在。
- 舊檔完整驗證，失敗保留；跨分頁停止，結算不重付。未知不等於危險，公開K/N不是實際摸牌率，研究權重不是概率。
- Sol主導，Luna僅必要限定協助；本輪無子代理。帳戶五小時起始已用1%、收尾檢查21%（剩79%），不是精確token。保持最少程式與依賴，scratch放work/，輸出放outputs/；額度為帳戶比例，非精確token。

正式站：https://zhai2liu.github.io/taiwan-mahjong/；origin：https://github.com/zhai2Liu/taiwan-mahjong.git。未啟動本機伺服器，未動使用者存檔。

原M0–M5.4、M6三個離線包與歷史部署證據保留於[2026-10-08交接](HANDOFF-20261008.md)，舊「下一步」已被本文件取代。
