## 完整實戰：三服務系統（Web + 資料庫 + 快取）

把 Redis 加進來，湊成一套真實常見的三件套，看 Compose 怎麼優雅擴充。先讓應用會用 Redis：

```python
# app.py（擴充版）：加入 Redis 計數功能
import os

import redis
from fastapi import FastAPI

app = FastAPI(title="玄貓三服務示範")

DATABASE_URL = os.environ.get("DATABASE_URL", "未設定")
# 從環境變數取 Redis 位址，host 一樣寫服務名 cache
REDIS_HOST = os.environ.get("REDIS_HOST", "cache")

# 建立 Redis 連線用戶端，decode_responses=True 讓回傳值是字串而非 bytes
r = redis.Redis(host=REDIS_HOST, port=6379, decode_responses=True)


@app.get("/")
def read_root() -> dict:
    # 每次訪問把計數器加一，示範快取服務的實際使用
    count = r.incr("visit_count")
    return {"message": "三服務系統運作中", "訪問次數": count}


@app.get("/healthz")
def health() -> dict:
    return {"status": "ok"}
```

程式逐行說明：

1. `import redis`：引入 redis 用戶端套件，記得加進 requirements.txt。
2. `REDIS_HOST = os.environ.get("REDIS_HOST", "cache")`：Redis 主機名同樣走環境變數，預設值 `cache` 就是等下 compose.yaml 裡的服務名。
3. `redis.Redis(host=REDIS_HOST, port=6379, decode_responses=True)`：建立連線用戶端，`decode_responses=True` 讓回傳值自動解碼成字串，省去每次手動 decode。
4. `r.incr("visit_count")`：對名為 visit_count 的鍵原子性加一並回傳新值——這是 Redis 最經典的計數器用法，多個 web 副本同時打也不會算錯（原子操作）。

對應的三服務 compose.yaml：

```yaml
# compose.yaml：三服務完整版
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - pgdata:/var/lib/postgresql/data
    networks: [backend]

  cache:                              # 新增：Redis 快取服務
    image: redis:7-alpine
    volumes:
      - cachedata:/data               # Redis 持久化資料也掛 volume
    networks: [backend]

  web:
    build: .
    ports:
      - "${WEB_PORT}:8000"
    environment:
      DATABASE_URL: postgresql://postgres:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}
      REDIS_HOST: cache               # 指向 cache 服務名
    depends_on:
      - db
      - cache                         # web 依賴 db 與 cache 兩者
    networks: [backend]

networks:
  backend:
    driver: bridge

volumes:
  pgdata:
  cachedata:                          # 新增 volume 宣告
```

擴充要點逐項說明：

1. 加一個服務只是多一個 `services` 底下的鍵——`cache` 用 redis 官方映像檔，三行搞定，這就是 Compose 的擴充成本。
2. `REDIS_HOST: cache` 讓 web 用服務名找到 Redis，跟連 db 完全同一套 DNS 機制——服務越多，宣告式的省力越明顯。
3. `depends_on` 列兩個依賴，web 會等 db 與 cache 都啟動後才起。
4. 底部 `volumes:` 記得補上 `cachedata`——每個新掛的具名 volume 都要在這裡宣告，漏了就 up 失敗（陷阱二）。

驗證三服務協作：

```bash
# 記得先把 redis 加進 requirements.txt 再起
echo "redis==5.2.1" >> requirements.txt

docker compose up -d --build

# 連打三次首頁，看 Redis 計數器遞增(證明三服務串起來了)
for i in 1 2 3; do curl -s http://localhost:8000/ | python3 -m json.tool | grep 訪問; done

# 直接進 cache 服務確認鍵值(用服務名 exec)
docker compose exec cache redis-cli GET visit_count

docker compose down
```

- 三次 curl 的訪問次數逐次遞增，證明 web 真的把資料寫進了 Redis、而且是同一個 Redis 實例——三服務的資料流完整跑通。
- 最後直接進 cache 容器用 redis-cli 讀鍵值，與 web 回報的數字對得上，端到端驗證閉環。