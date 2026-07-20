## 一次性任務：資料庫遷移的正確編排

真實系統啟動前常要跑「資料庫遷移」（建表、改結構），這是典型的一次性任務，用 `service_completed_successfully` 編排：

```yaml
# compose.yaml（片段）：遷移任務跑完才起 web
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d ${POSTGRES_DB}"]
      interval: 5s
      timeout: 3s
      retries: 5
      start_period: 10s
    networks: [backend]

  migrate:                              # 一次性遷移任務
    build: .
    command: ["python", "migrate.py"]   # 跑完就結束的腳本
    environment:
      DATABASE_URL: postgresql://postgres:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}
    depends_on:
      db:
        condition: service_healthy       # 等 db 健康才開始遷移
    restart: "no"                        # 一次性任務不要重啟
    networks: [backend]

  web:
    build: .
    depends_on:
      migrate:
        condition: service_completed_successfully   # 等遷移成功跑完才起 web
    ports:
      - "${WEB_PORT:-8000}:8000"
    environment:
      DATABASE_URL: postgresql://postgres:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}
    networks: [backend]

networks:
  backend:
    driver: bridge
```

搭配一個最小遷移腳本：

```python
# migrate.py：最小資料庫遷移範例
import os

import psycopg

dsn = os.environ["DATABASE_URL"]

# 連上資料庫(此時 db 已被 service_healthy 保證就緒)
with psycopg.connect(dsn) as conn:
    with conn.cursor() as cur:
        # 建立資料表(IF NOT EXISTS 讓腳本可重複執行不出錯,這是遷移腳本的好習慣)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS orders (
                id SERIAL PRIMARY KEY,
                item TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT NOW()
            )
        """)
    conn.commit()  # 提交變更
    print("遷移完成:orders 表已就緒")
```

編排邏輯逐項說明：

1. 三段式相依鏈：db（健康）→ migrate（成功完成）→ web（啟動）——每一環用對應的 condition 串起來，Compose 嚴格按這個順序執行。
2. `migrate` 服務的 `restart: "no"`：一次性任務跑完就該結束，設 no 避免它被當成常駐服務反覆重啟。
3. `condition: service_completed_successfully`：web 等 migrate **以結束碼 0 成功退出**才啟動——遷移失敗（非 0 退出）則 web 根本不會起，避免「拿著沒遷移好的資料庫硬跑」的災難。
4. `CREATE TABLE IF NOT EXISTS`：遷移腳本的冪等性設計——重複執行不出錯，讓 `docker compose up` 可以安心重跑。

實測完整編排：

```bash
docker compose up -d

# 看啟動順序:migrate 跑完退出(Exited 0)、web 才 Up
docker compose ps -a --format 'table {{.Name}}\t{{.Status}}'

# 驗證遷移確實執行:orders 表存在
docker compose exec db psql -U postgres -d appdb -c '\dt orders'

docker compose down
```

- `docker compose ps -a` 的輸出裡 migrate 是 `Exited (0)`、web 是 `Up`——一次性任務功成身退、主服務接棒，編排如設計般運作。
- 這套三段式編排是生產部署的常見骨架：任何「起服務前要先做某事」的需求（遷移、快取預熱、設定檢查）都套這個模板。

> **Tips**：一次性任務容器跑完是 `Exited (0)`,`docker compose ps` 預設不顯示已退出的容器,要加 `-a` 才看得到。部署後發現 web 沒起、又找不到 migrate 容器時,先 `docker compose ps -a` 看它是不是 Exited 非 0——遷移失敗是 web 起不來的頭號嫌疑。

### 收官檢核：編排能力盤點

離開本章前逐項自測，每項都要能不看筆記做出來：

- 重現「容器啟動不等於服務就緒」的崩潰，並用健康檢查 + service_healthy 修好。
- 說出 healthcheck 五個欄位各管什麼，特別是 start_period 的作用。
- 為 PostgreSQL、Redis、Web 各寫一個問到核心能力的探測指令。
- 講清楚 restart 與 healthcheck 分別覆蓋哪類故障。
- 用 db → migrate → web 三段式編排，三種 condition 各用對地方。
- 寫出帶指數退避、只攔連線類錯誤的重試函式。
- 用 `docker compose up --wait` 把「系統就緒」變成可判斷的部署事件。