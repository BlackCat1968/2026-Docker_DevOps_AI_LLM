## HEALTHCHECK：幫容器裝體溫計

Compose 的 `healthcheck` 讓 daemon 定期對容器做體檢，結果反映在容器狀態上。先看語法全貌：

```yaml
# compose.yaml：帶健康檢查的資料庫服務
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      # 用 postgres 官方工具 pg_isready 檢查資料庫是否可接受連線
      test: ["CMD-SHELL", "pg_isready -U postgres -d ${POSTGRES_DB}"]
      interval: 5s        # 每 5 秒檢查一次
      timeout: 3s         # 單次檢查逾 3 秒算失敗
      retries: 5          # 連續失敗 5 次才判定 unhealthy
      start_period: 10s   # 啟動後給 10 秒寬限期,期間失敗不計次
    networks: [backend]

networks:
  backend:
    driver: bridge

volumes:
  pgdata:
```

healthcheck 五個欄位逐項說明：

1. `test`：實際的檢查指令。`CMD-SHELL` 表示用 shell 執行後面的字串（可用變數、管線）；另一種 `CMD` 是直接執行不經 shell。回傳碼 0 為健康、非 0 為不健康——沿用第 04 章的結束碼哲學。
2. `pg_isready`：PostgreSQL 官方附的就緒探測工具，專門回答「資料庫現在能不能接受連線」——比自己寫 `socket.connect` 精準，因為它問的是資料庫本身而非只是埠有沒有開。
3. `interval: 5s`：兩次檢查之間隔多久。太密集浪費資源、太稀疏反應慢，資料庫類 5 到 10 秒是常見值。
4. `timeout: 3s`：單次檢查的耐心上限，超過視為這次失敗。
5. `retries: 5`：連續失敗幾次才把容器打上 unhealthy 標記——避免偶發抖動就誤判。
6. `start_period: 10s`：**啟動寬限期**，這段時間內的失敗不計入 retries。它專門對付 14.1 節的問題——給資料庫足夠時間初始化，期間連不上是正常的、不該累積成 unhealthy。

健康檢查有兩個定義位置，先釐清分工：

```dockerfile
# 位置一:寫在 Dockerfile 裡(第 06 章掛過號),映像檔自帶體溫計
HEALTHCHECK --interval=10s --timeout=3s --retries=3   CMD curl -f http://localhost:8000/healthz || exit 1
```

```yaml
# 位置二:寫在 compose.yaml 裡,可覆寫映像檔內建的定義
services:
  web:
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:8000/healthz || exit 1"]
```

兩個位置的取捨逐項說明：

1. 寫在 **Dockerfile**：映像檔走到哪、體溫計帶到哪,不依賴 Compose——適合「這個服務的健康標準是固定的」情況。
2. 寫在 **compose.yaml**:同一個映像檔在不同編排裡可以有不同的健康標準,且能用 `${變數}`(第 13 章)——適合「健康標準隨環境變」的情況。
3. compose 的定義**覆寫** Dockerfile 的定義:兩處都有時以 compose 為準。想在某個環境關掉繼承來的健康檢查,寫 `test: ["NONE"]` 即可。

實測健康狀態的變化：

```bash
# 只起 db,盯著它的健康狀態從 starting → healthy
docker compose up -d db

# 連續觀察狀態欄(STATUS 會顯示 health: starting → healthy)
for i in 1 2 3 4; do
  docker compose ps db --format 'table {{.Name}}\t{{.Status}}'
  sleep 3
done

# 用 inspect 看健康檢查的詳細記錄(最近幾次探測的結果與輸出)
docker inspect $(docker compose ps -q db) \
  --format '{{json .State.Health}}' | python3 -m json.tool | head -15
```

觀察重點逐項說明：

1. `docker compose ps` 的 STATUS 欄會經歷 `health: starting`（寬限期內）→ `healthy`（探測通過）的變化——體溫計的讀數看得見。
2. `inspect .State.Health`：拉出健康檢查的完整病歷——`Status`（當前健康狀態）、`FailingStreak`（連續失敗次數）、`Log`（最近幾次探測的輸出與結束碼）。除錯健康檢查為什麼不過，這裡是第一現場。
3. 每一種資料庫、快取、應用都有各自合適的探測指令，整理成對照表隨查隨用：

|服務|探測指令|問的是什麼|
|---|---|---|
|PostgreSQL|`pg_isready -U 使用者 -d 資料庫`|資料庫可否接受連線|
|MySQL|`mysqladmin ping -h localhost`|資料庫是否回應|
|Redis|`redis-cli ping`（回 PONG）|快取是否就緒|
|Web（有 curl）|`curl -f http://localhost:PORT/healthz`|端點是否回 2xx|
|Web（無 curl）|`python -c "import urllib.request; urllib.request.urlopen('...')"`|同上,零外部相依|

共通原則一句話：**探測要問到服務的核心能力，不能只看行程活著**——這是健康檢查有沒有價值的分水嶺。