## restart 與自癒：讓服務自己爬起來

第 04 章的重啟策略在 Compose 裡是宣告式的一行，配合健康檢查形成完整的自癒機制：

```yaml
# compose.yaml（片段）：重啟策略 + 健康檢查 = 自癒
services:
  web:
    build: .
    restart: unless-stopped        # 除非手動停止,否則掛了就重啟(第 04 章)
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8000/healthz')"]
      interval: 10s
      timeout: 3s
      retries: 3
      start_period: 5s
    ports:
      - "${WEB_PORT:-8000}:8000"
    networks: [backend]
```

自癒機制逐項說明：

1. `restart: unless-stopped`：容器程序崩潰時 daemon 自動重啟，但尊重你的手動停止——生產單機服務的標配，第 04 章詳解過四種策略的差異。
2. web 的健康檢查用 Python 內建的 `urllib.request` 打自己的 `/healthz` 端點——不依賴外部工具（連 curl 都不用裝），瘦身映像檔（第 07 章）也適用。
3. **restart 與 healthcheck 的分工**：restart 救「程序崩潰死掉」（行程不見了就拉起來）；healthcheck 偵測「程序活著但服務壞了」（死結、卡住、相依斷線）。兩者合起來才覆蓋完整的故障光譜——這正是第 04 章 Tips 說「重啟策略救不了活著但服務死了的病」的解藥。

實測自癒：

```bash
docker compose up -d web

# 模擬程序崩潰:直接 kill 容器內的主程序
docker compose exec web sh -c 'kill 1' 2>/dev/null || true

# 幾秒後觀察:容器被 daemon 自動重啟,RESTARTS 計數 +1
sleep 5
docker compose ps web --format 'table {{.Name}}\t{{.Status}}'
docker inspect $(docker compose ps -q web) --format '重啟次數: {{.RestartCount}}'

docker compose down
```

- `kill 1` 打掉容器的主程序（PID 1），容器隨之退出——模擬應用崩潰。
- `restart: unless-stopped` 讓 daemon 立刻把它拉起來，`RestartCount` 加一為證——服務在你沒察覺的情況下已經自我復原。
- 生產環境把這個機制配上第 21 章的監控告警：容器自癒的同時發一則通知，讓你知道「它剛剛自己救活過一次」，才不會漏掉頻繁重啟背後的根因。