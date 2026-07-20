## 為什麼「容器啟動」不等於「服務就緒」

先把痛點演出來。用一個「故意慢啟動」的資料庫模擬真實情況：

```bash
cd ~/webapp

# 寫一個會噴錯的最小 compose：web 一起來就連 db,但 db 要幾秒才就緒
cat > compose.broken.yaml <<'EOF'
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_PASSWORD: devpass
      POSTGRES_DB: appdb
  web:
    image: python:3.13-alpine
    depends_on:
      - db
    command:
      - python
      - -c
      - |
        import socket, sys
        # 容器一啟動就立刻試連 db,不等它就緒
        try:
            socket.create_connection(("db", 5432), timeout=2)
            print("連上 db 了")
        except Exception as e:
            print(f"連 db 失敗: {e}", file=sys.stderr)
            sys.exit(1)
EOF

# 起系統,看 web 的下場
docker compose -f compose.broken.yaml up
```

程式與現象逐項說明：

1. `depends_on: [db]` 讓 db 容器先啟動、web 後啟動——這是第 13 章學到的順序保證。
2. 但 web 的 command 一執行就 `socket.create_connection(("db", 5432))` 硬連——問題就在這：db 容器**啟動了**，可是 PostgreSQL 這支程序還在做初始化（建資料目錄、載入設定），5432 埠還沒開始聽。
3. 結果 web 連線被拒、以 `sys.exit(1)` 結束——`depends_on` 的順序保證在這裡幫不上忙，因為它管的是「容器啟動順序」不是「服務就緒狀態」。
4. 這不是假想題：資料庫、訊息佇列、快取這類有狀態服務，容器起來到真正可連之間有一段空窗，正式環境的啟動風暴天天上演。