## 環境變數的三層來源與 .env 檔

Compose 讀環境變數有明確的優先順序，搞懂它才不會被「為什麼我的設定沒生效」搞瘋：

```bash
# 建立 .env 檔：Compose 會自動讀取，用來參數化 compose.yaml
cat > .env <<'EOF'
POSTGRES_PASSWORD=devpass
POSTGRES_DB=appdb
WEB_PORT=8000
EOF
```

改寫 compose.yaml 用變數代入，避免密碼與埠號寫死：

```yaml
# compose.yaml（片段）：用 ${變數} 代入 .env 的值
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}   # 代入 .env 的值
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - pgdata:/var/lib/postgresql/data
    networks: [backend]

  web:
    build: .
    ports:
      - "${WEB_PORT}:8000"                       # 埠號也參數化
    environment:
      DATABASE_URL: postgresql://postgres:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}
    depends_on: [db]
    networks: [backend]

networks:
  backend:
    driver: bridge

volumes:
  pgdata:
```

驗證變數代入正確：

```bash
# config 指令：把 compose.yaml 的變數全部代入後印出「最終生效版本」，不啟動任何東西
docker compose config | grep -E "POSTGRES_PASSWORD|DATABASE_URL|8000"

# 臨時覆寫：指令列的環境變數優先於 .env
WEB_PORT=9000 docker compose config | grep -E "9000:8000"
```

指令逐項說明：

1. `.env` 檔會被 Compose **自動讀取**（檔名必須就叫 `.env`、放在專案根目錄），裡面的值填進 `${...}` 佔位符。
2. `docker compose config`：這是本節的靈魂指令——它把所有變數代入、所有簡寫展開，印出「Compose 實際看到的完整設定」。「設定沒生效」的疑案，跑一次 config 九成當場破。
3. 優先順序由高到低：**指令列環境變數 > .env 檔 > compose.yaml 裡的預設值**。上例 `WEB_PORT=9000 docker compose` 就是用指令列的值蓋掉 .env 的 8000。
4. `.env` 一定要進 `.dockerignore` 與 `.gitignore`（第 06 章的教訓）——它常裝著密碼，絕不能進版本控制或映像檔。

> **Tips**：改完 compose.yaml 或 .env，先跑 `docker compose config` 檢查再 `up`。YAML 縮排錯、變數沒代入、埠號打錯，config 會直接攤在你眼前，省下「起了才發現不對再拆掉」的來回。

補一個常被忽略但很實用的用法——**變數帶預設值**。`.env` 沒設某個變數時，可以在 YAML 裡就地給預設，避免 up 失敗：

```yaml
# 變數預設值語法：冒號減號給預設,問號則是「沒設就中止並噴錯」
services:
  web:
    ports:
      - "${WEB_PORT:-8000}:8000"        # WEB_PORT 沒設就用 8000
    environment:
      LOG_LEVEL: ${LOG_LEVEL:-info}     # 沒設就 info
      SECRET_KEY: ${SECRET_KEY:?必須設定 SECRET_KEY}  # 沒設直接中止並提示
```

- `${VAR:-預設值}`：VAR 未設定時用預設值，讓非必要設定有合理的退路。
- `${VAR:?錯誤訊息}`：VAR 未設定時直接讓 up 失敗並印出訊息——用在「一定要有、否則系統不該啟動」的關鍵機密上，比起動後才發現漏設安全得多。
- 這兩個語法讓 compose.yaml 自帶防呆，新人少設一個變數時得到的是清楚提示，而不是莫名其妙的執行期錯誤。