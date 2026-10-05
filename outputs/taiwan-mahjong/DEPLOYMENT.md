# GitHub Pages發布與回復

現行網址（2026-10-06）：https://zhai2liu.github.io/taiwan-mahjong/；repository：zhai2Liu/taiwan-mahjong。Git重導與repository API已確認owner改名，本機origin及About Website已同步。M5.3來源ff6de93，workflow37357698468 build／deploy成功，首頁與本地新版資源一致。下段M4首次發布為歷史紀錄。

帳號改名會改變github.io來源；舊網址的localStorage不能由新網址直接讀取，本次未清除舊存檔。不宣稱自動遷移成功。

2026-10-05，M4已部署並完成正式網站驗收。正式網址：https://lanyaliu521.github.io/taiwan-mahjong/。成功run：37247813100，遊戲提交29057b2。GitHub連線帳號已確認為lanyaliu521，使用者已指定帳號並授權自行命名，目標lanyaliu521/taiwan-mahjong已建立為公開repository；Pages來源已設GitHub Actions。本機main及origin已設定，Git認證及初次推送已完成，build及deploy成功。以下首次步驟保留作重新架站參考，實際驗收見HANDOFF。

## 已準備的發布流程

工作區根目錄`.github/workflows/pages.yml`為發布流程，repository根目錄採工作區相同結構：`outputs/taiwan-mahjong/`遊戲、`outputs/taiwan-mahjong-m0/`固定規則／案例，以及根目錄workflow及根目錄.gitignore。這樣保留文件既有相對連結，無須複製另一套桌規。

初始化／上傳時只明確加入上述專案來源、文件、lockfile及workflow；不加入node_modules、dist、site、work、其他專案檔案或個人資料。遊戲資料夾現有.gitignore排除三份生成目錄。若接到既有repository，先檢查內容及分支再整合，不覆寫既有歷史。

流程在main推送遊戲來源／測試／建置設定／workflow修改或手動執行時啟動；專案根目錄Markdown、JPG截圖、*SIMULATION.json證據不觸發。src／public內素材仍觸發，勿把發布素材放在被排除的根目錄證據路徑。使用GitHub原生paths依序排除，不另加判定程式；符合[官方路徑篩選](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#onpushpull_requestpull_request_targetpathspaths-ignore)。執行內容：安裝lockfile指定依賴 → 全部現行測試（M5.3為226項） → build → 上傳site產物 → 部署。測試／建置失敗時deploy不執行。只給deploy job Pages及OIDC權限，不需自訂PAT秘密值。既有build／deploy已實際跑通；本輪paths修改的雲端觸發與純文件不新增run另以HANDOFF最新證據為準。

Vite保留`base: './'`與`outDir: 'site'`，建置資源使用相對路徑，支援帶repository子路徑的首頁；沒有前端路由或深層網址。dist是測試編譯，不能誤作發布產物。

## 首次部署的剩餘步驟

1. 確認目標repository網址、現有內容及main分支；若尚未建立，確認名稱與可見性。免費方案使用公開repository的Pages；來源公開範圍須明確。
2. 依上述結構建立可追蹤Git提交並檢查選取檔案；連接遠端、推送。GitHub CLI目前未找到；可依可用connector／Git／瀏覽器操作。
3. 在repository的Settings → Pages將Source設為GitHub Actions；確認github-pages環境允許main部署。
4. 執行workflow，檢查測試、建置、artifact及部署job均成功；以實際部署輸出的網址為準，不預先宣稱網址已存在。
5. 正式網址驗收：首頁及資源載入、真人＋3電腦、雙擊與鍵盤出牌、吃碰操作、結算下一局、重載續局、手機窄畫面。測試用dev頁不應被上傳。
6. 記錄repository、正式網址、提交SHA、workflow run及驗收結果；完成後才把M4標成已完成。

## 後續更新與回復

修改src及相應文件／案例，驗證後推送main；不要直接改site產物。每次部署以提交SHA追蹤，正式驗收通過後記下該SHA。

回復先確認問題提交，使用Git revert建立反向提交、推送main並走相同驗證／部署流程；不要reset或強制推送抹掉歷史。workflow失敗時先查看失敗步驟，保持目前成功網站；不要以跳過測試修復發布。

本機與GitHub Pages為不同來源，正式網站不會自動讀取4173的localStorage。正式更新應維持存檔schema與桌規相容；未知版／壞檔仍保留並提示，不因部署清空。單一github.io來源的其他repository共用localStorage，現有鍵沒有repository隔離；若同帳號再部署第二套遊戲，需先設計隔離及遷移，不能直接覆寫。

## 證據與限制

本輪測試、build及本地子路徑資源檢查結果記入HANDOFF。這些不能取代正式網站驗收。M3.1操作與儲存證據可參考，但M4仍需在新來源驗續局。

參考：[GitHub自訂Pages流程](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)、[Vite部署](https://vite.dev/guide/static-deploy.html)、[setup-node](https://github.com/actions/setup-node)、[checkout](https://github.com/actions/checkout)。工作流程採官方已公布版本；外部Action版本及repository設定於實際部署時再核對。




## GitHub執行機故障的處理

2026-10-06的實例：run37369632079測試／build成功，但deploy零步驟、註記「The job was not acquired by Runner of type hosted even after multiple attempts」。官方Actions恢復後，重試失敗工作（Re-run failed jobs）即成功，attempt2發布來源723a898。本次無需改源碼、權限或發布架構。

遇到發布失敗先看失敗job與annotations，區分程式測試失敗、執行機未分配、Pages設定／權限或artifact問題。執行機問題查[官方狀態](https://www.githubstatus.com/)；恢復後只重試最新版失敗job，不重跑舊來源。若原artifact已過期／無法取得，才完整重跑最新版的測試／build／deploy。成功後仍需HTTP及瀏覽器確認正式資源和受影響操作，不能只靠重試請求已接受判定已上線。
