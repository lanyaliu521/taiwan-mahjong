# 現行交接入口

2026-10-06。M0–M5.4已完成並發布；M6.0牌風研究完成。**人性化AI目前只做後續擴充設計，未實裝。** 先讀README／ROADMAP，再按工作內容讀對應文件。開發6.1 Sol主導，Luna限定協助，不例行使用Astra。

## 最新工作：胡牌牌型逐條呈現（本機完成，待發布核對）

使用者追加台灣慣用逐條報台，已將牌型／每項台數／合計移出折疊區，得分卡加「＋」串接組合。S03依既有胡牌拆法分紅中／發財／白板，S06顯示n正花；只格式化已結算項目，不重新計台、不改規則或存檔。門清一摸三／大三元／花槓的替代關係維持。259全套及patternResult本地桌面／窄版驗收通過；詳細見POSITIVE-FEEDBACK-VALIDATION追加段。下一步提交推送、核對CI與正式資源，再按試玩回饋維護。人性化AI仍未實裝。本輪起始五小時已用50%（剩50%）。

## 前次：正向遊玩回饋（已完成並發布）

使用者審查人性化AI設計前，要求加強現有遊戲的正向回饋。已加入公平真人觀察下的牌效／進步／聽牌提示、仲裁完成後的吃碰提示、結算實際得分與練習鼓勵；不改AI策略、桌規或保存格式。詳見[POSITIVE-FEEDBACK-VALIDATION](POSITIVE-FEEDBACK-VALIDATION.md)。來源91c01a9；本機254項全套及新增場景後17項resume通過，最終255項由發布CI完整重驗，build／deploy成功，run37401183051。4193瀏覽器已驗聽牌雙擊、暫停去重、關閉教練、吃牌成立、練習肯定、結算／排名與窄畫面。正式首頁載入index-CdDM5XHR.js／index-BQS6FW6H.css，兩資源HTTP200；沒有操作正式存檔。下一步按使用者試玩回饋維護，仍不啟動人性化AI實作。本輪起始五小時已用33%，結束檢查49%（增加約16百分點、剩51%）；不能得知精確對話剩餘token。

## 前次：人性化AI設計已完成（未實裝）

使用者要求以五小時額度70%完善概念與最佳實踐；此前明確指定不實裝於目前版本。三份設計與交叉審查已完成，草案提交e457e7e；最終純文件提交見git log。只改文件，src、規則、存檔格式與正式AI均未改。

- [HUMAN-AI-DESIGN](HUMAN-AI-DESIGN.md)：玩法、四軸、模板、方法選擇與未來工作包。
- [HUMAN-AI-DECISION-SPEC](HUMAN-AI-DECISION-SPEC.md)：安全／特徵、分層比較、吃碰上下文、三槓、亂數與Session升版。
- [HUMAN-AI-VALIDATION](HUMAN-AI-VALIDATION.md)：證據分級、可重現代數、回歸／配對／盲測與指標口徑。

四軸為冒險容忍、副露偏好、價值企圖、調整意願；最小未來試驗先快攻門清、積極副露、謹慎應變三模板，同能力／預算。價值代理及槓模型未驗則不啟用，舊槓+0.1只作legacy對照。合法WIN、公平Observation與引擎合法性為硬限制；個性／能力／局況／節奏分開。三位Luna限定審查已整合，筆記在忽略的work/，必要資訊均已轉入正式文件。

本輪13,700組數牌局部容量＋28組字牌量檢查通過；固定尺度、單軸、切換慣性及防守界線合成例通過。不是完整手牌枚舉／新AI試打／勝率或真人辨認證據。重現要點存VALIDATION；work/human-ai-design-checks.py及JSON只是scratch。

另完成既有引擎13吃2／34吃2／碰2三例公開牌池與禁捨檢查；尚未答／自家已提交待仲裁／取得副露三等待點共9快照編解碼一致，CHI被他家WIN攔下也通過。npm run check過，未跑244全套；未驗未實裝的callContext。正文已含輸入與重現步驟，work/human-ai-call-checks.mjs只作scratch。7份Markdown的43個本地連結、圍欄／UTF-8與diff檢查通過；相對7701f37只變8份Markdown（含AGENTS），無源碼／配置改動。

後續泛稱繼續時，按試玩回饋維護；**只有使用者明確啟動人性化AI實作，才按M6.1公開安全→M6.2最小試驗／保存→M6.3評估→M6.4介面發布推進。** 不把設計完成當功能發布、不新增模型服務／依賴／通用框架。

## 牌風研究入口與重要界線

[AI-STYLE-DESIGN](AI-STYLE-DESIGN.md)及AI-STYLE-BASELINE.json保存前期證據。256混合固定種子、768副閒家補花後E16，平均向聽4.198，≥6為78副約10.16%；候選門檻不是最佳值或最大互斥搭數。莊E17與首次摸牌後最佳捨法須另校準，不能套E16基準；原始起手需getObservation擷取自家摘要並保存。

本案沒有日麻振聽：曾捨東仍可胡東、捨1仍可嵌4、四張3萬全可見仍能被12萬胡3，三例已由引擎驗過。publicPool按唯一實體去重；U[t]=0排除將刻，數牌再排除全部同門順路徑才證普通放槍安全。未證只能給相對風險，不能稱放槍百分比／全局零損失。不可讀對手過水、暗手、暗槓種、牆序或種子，不能把AI私人reason給教練。

前期研究重現：專案目錄npm run check後node scripts/research-ai-style.mjs。該離線腳本可讀fixture真值，不得把全局讀取接正式策略。本次設計驗證不重新跑已過長模擬。

## 現行正式遊戲與保存

TW16-CLASSIC-v1：144張含花、台灣16張五面子一對、1真人＋3本地公平AI。RULES／cases凍結；GameState與對戰Session仍schemaVersion=1。Session僅game＋aiRandom[3]，decode丟額外欄位；未來個性／記憶必須明確升版及舊版接續／回復方案。現行快照不是完整事件回放。

對戰存檔tw16:TW16-CLASSIC-v1:save、練習tw16:practice:v1分開；教練tw16:coach:v1獨立。保存失敗與跨分頁衝突保護不得省略。練習136張一般牌、不放回，無吃碰槓／花／計台；對戰切練習先保存暫停，返回需手動繼續。

analysis.ts共用牌效；coach.ts只接真人Observation。向聽與實際胡資格分開；展示拆法不是最大搭數。對戰K/N含他家暗手及保留牌，不稱真實摸牌機率，耗盡等待仍顯0；目前不評防守、價值與槓風險。六步新手教學獨立示範，先保存暫停，不修改正式牌局；完成與Escape回焦點。

## 最近來源驗收與發布

正式網站：https://zhai2liu.github.io/taiwan-mahjong/
Repository：https://github.com/zhai2Liu/taiwan-mahjong.git（API大小寫；網站小寫同帳號）。origin已配合改名，Vite base ./，沒有CNAME或舊owner綁定。Git認證已完成，main推送來源自動測試／build／Pages。網址來源不同不搬移localStorage，不刪舊資料。

現行遊戲最新為上述正向回饋來源91c01a9及255測試。歷史窄視窗修正來源05d0122、run37389916026成功；前期研究來源d37b3d2、run37390666564成功。前次runtime為index-WkiKqWo8.js／index-DIlVjIQw.css，首頁320證據HEADER-LIVE-320.jpg；這是歷史驗收，不代表本次資源。

M5.4正式教學及先前鍵盤／付款維護證據見TUTORIAL-VALIDATION、MAINTENANCE-2026-10-06、PANEL-STATE-VALIDATION、COACH-FLOW-VALIDATION。Actions前次阻擋已解除，run37369632079 attempt2成功為歷史教學發布證據，非待辦。

workflow paths排除專案根Markdown／JPG／SIMULATION文件，純文件正常提交推送，不用skip-ci或手動部署。來源／fixture改動仍完整CI。發布與回復依DEPLOYMENT，不直接改site／dist。

## 工作環境與用量

測試port必須獨立，不覆寫使用者4173等來源存檔。本輪4193獨立開發伺服器驗收後停止；4191等歷史程序存活下次確認。原生confirm曾卡IAB／Brave，勿自動點已有存檔的新局／重練。改用controller或practice-browser可見開關，不宣稱原生對話框或實機手機／Safari已驗。scratch放work/、交付在outputs/。

前次人性化AI設計額度由12%到32%，未用滿70%預算；本輪正向回饋用量見頂部49%。帳戶比例不是精確對話剩餘token；每包落盤交接，不自行重設額度或新增自動續跑。舊交接的87%屬更早一輪，不再當本次剩餘量。
