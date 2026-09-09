# GitHub 與 Vercel 部署

此專案使用 Vercel 提供前端，另以單一持續執行的 Node.js 程序提供多人世界。不要將多人伺服器改成每次請求建立的 Function，或開啟多副本自動擴展：目前世界狀態尚未跨程序共享。

## 1. GitHub

將本機 main 分支推到你自己的 GitHub 儲存庫。不要上傳 node_modules、dist 或 .env 檔案；.gitignore 已排除它們。

## 2. 多人後端

可在支援常駐 Node.js 或 Docker 的主機上部署此儲存庫。

- Node.js：22.12 以上，建議 22 LTS。
- 安裝：npm ci --omit=dev
- 啟動：npm run server
- 副本數：1
- PORT：由主機提供，預設 8787。
- ALLOWED_ORIGINS：Vercel 前端完整來源，例如 https://little-leaf-adventure.vercel.app；多個來源以逗號分隔，不加尾端斜線。
- 網路：公開 HTTPS，允許 WebSocket upgrade；GET / 可檢查服務是否存活。
- Docker：儲存庫根目錄已有 Dockerfile，主機需將服務流量導到 PORT 指定的埠。

目前角色、物品與金幣只保存在記憶體，部署或重啟後會清空，尚無正式帳號和資料庫。這份設定適合目前版本的連線測試。

## 3. Vercel

在 Vercel 選 Add New → Project，匯入上述 GitHub 儲存庫。根目錄的 vercel.json 已指定 Vite、npm ci、npm run build 及 dist。

部署前設定前端環境變數：

```text
VITE_GAME_SERVER=wss://你的後端網域/multiplayer
```

這是公開連線網址，不能放入密碼或 Token。設定值於建置時寫入前端，變更後必須重新部署。後端 ALLOWED_ORIGINS 必須包含實際前端網域；Preview 網址也須個別加入才可連線。

將 Vercel 專案的 Production Branch 設為 main。GitHub 整合完成後，推送 main 即會觸發前端部署。後端需另外啟用所選主機的 Git 自動部署，或手動重新部署。

## 4. 上線驗證

先執行 npm test 與 npm run build。部署後用兩個獨立分頁進入正式網址，確認能在村莊看見彼此、組隊進入同一副本，並驗證金幣遊戲的同步與派彩。
