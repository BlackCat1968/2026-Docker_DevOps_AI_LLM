## 第一份 compose.yaml：把手工流程翻譯過來

沿用第 06、07 章的 webapp 專案，加上資料庫。先看應用程式怎麼讀資料庫連線：

```python
# app.py：讀環境變數連資料庫的 FastAPI 服務
import os

from fastapi import FastAPI

app = FastAPI(title="玄貓 Compose 示範")

# 從環境變數取資料庫連線字串，這是容器化應用的鐵律：設定走環境變數，不寫死在程式裡
DATABASE_URL = os.environ.get("DATABASE_URL", "未設定")


@app.get("/")
def read_root() -> dict:
    return {"message": "Compose 啟動成功"}


@app.get("/config")
def show_config() -> dict:
    # 把讀到的連線字串回傳，方便驗證環境變數有沒有正確注入
    return {"database_url": DATABASE_URL}


@app.get("/healthz")
def health() -> dict:
    return {"status": "ok"}
```

程式逐行說明：

1. `import os`：要讀環境變數，先引入標準函式庫的 os 模組。
2. `os.environ.get("DATABASE_URL", "未設定")`：讀名為 DATABASE_URL 的環境變數，讀不到就回傳「未設定」當預設值——這個防呆讓程式在缺設定時給出人話而不是當掉。
3. `/config` 端點：把連線字串原樣吐出，等下用它驗證 Compose 的環境變數注入有沒有成功。
4. `/healthz`：健康端點，第 14 章的健康檢查會打它。

接著是本章主角——`compose.yaml`：

```yaml
# compose.yaml：一份檔案描述整套系統
services:
  db:                                      # 服務一：資料庫
    image: postgres:16-alpine              # 用官方映像檔
    environment:                           # 注入環境變數
      POSTGRES_PASSWORD: devpass
      POSTGRES_DB: appdb
    volumes:                               # 掛具名 volume，資料持久化
      - pgdata:/var/lib/postgresql/data
    networks:                              # 加入專案網路
      - backend

  web:                                     # 服務二：Web 應用
    build: .                               # 用當前目錄的 Dockerfile 建置
    ports:                                 # 對外埠對映
      - "8000:8000"
    environment:
      # 連線字串裡的 host 直接寫服務名 db，靠 Compose 的內建 DNS 解析
      DATABASE_URL: postgresql://postgres:devpass@db:5432/appdb
    depends_on:                            # 宣告啟動順序：先起 db 再起 web
      - db
    networks:
      - backend

networks:                                  # 定義專案專屬網路
  backend:
    driver: bridge

volumes:                                   # 定義具名 volume
  pgdata:
```

YAML 逐區塊說明：

1. `services:` 底下每個鍵就是一個服務。`db` 與 `web` 對應 13.1 節手工起的兩個容器。
2. `image: postgres:16-alpine` 對「用現成映像檔」；`build: .` 對「用本地 Dockerfile 現建」——第 06 章的 Dockerfile 在這裡被 Compose 呼叫。
3. `environment:` 就是一堆 `docker run -e`；密碼這樣寫只適合開發，正式環境走第 14 章的機密管理。
4. `volumes:` 服務層寫的是「掛哪個 volume 到哪個路徑」，檔案底部的 `volumes:` 區塊則是「宣告這個 volume 存在」——兩處要對得上。
5. `networks:` 同理，服務層宣告「我加入哪張網」，底部區塊定義「這張網長怎樣」。
6. `depends_on: [db]`：告訴 Compose web 要在 db **之後**啟動——但這裡有個大坑，14 章會補上「等 db 真的就緒」的正解，本章先埋伏筆。
7. 最關鍵的一行是 `DATABASE_URL` 裡的 `@db:5432`：**host 直接寫服務名 db**，這就是第 11 章內建 DNS 的宣告式版本——Compose 自動建網、自動讓服務名可解析。