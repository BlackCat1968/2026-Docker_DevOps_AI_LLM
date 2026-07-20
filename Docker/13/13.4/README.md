## 三個核心指令：up、ps、down

```bash
# 進到專案目錄
cd ~/webapp

# 起整套系統：-d 背景執行，第一次會自動 build web 的映像檔
docker compose up -d

# 看這個專案的服務狀態(注意 NAME 欄的 專案名-服務名-序號 命名規則)
docker compose ps

# 看所有服務的日誌，-f 跟隨，可指定單一服務
docker compose logs web | tail -5

# 驗收：打 web 的端點，確認環境變數注入成功
curl -s http://localhost:8000/config

# 停止並移除整套系統(容器、網路都清掉，但 volume 預設保留)
docker compose down
```

指令逐項說明：

1. `docker compose up -d`：讀 compose.yaml，把裡面描述的網路、volume、容器**全部建出來**。`-d` 丟背景；不加 `-d` 則所有服務的日誌會即時串流在你的終端機（開發時很好用，Ctrl-C 一起停）。
2. `docker compose ps`：只列**這個專案**的服務——這是與 `docker ps`（列全機容器）的關鍵差異。容器名是 `webapp-web-1` 格式（專案-服務-序號），序號為之後擴充副本預留。
3. `docker compose logs`：一次看整套系統的日誌，或指定服務。除錯多容器應用時，比一個個 `docker logs` 高效太多。
4. `docker compose down`：把整套系統拆乾淨——容器與專案網路都移除。**注意 volume 預設不刪**（資料是命根子，第 09 章的謹慎），要連 volume 一起清得加 `--volumes` 旗標。

驗證資料庫真的通了：

```bash
# 重新起系統
docker compose up -d

# 進 web 容器，用 Python 實際連一次資料庫，證明服務名解析與連線都成立
docker compose exec web python -c "
import os, socket
# 從連線字串解析出 host 與 port
url = os.environ['DATABASE_URL']
host = url.split('@')[1].split(':')[0]   # 取出 db
port = int(url.split(':')[-1].split('/')[0])  # 取出 5432
# 實際建立 TCP 連線，通了就代表服務名解析 + 網路 + 資料庫監聽三者全對
socket.create_connection((host, port), timeout=3)
print(f'web 成功連到 {host}:{port}')
"
```

程式逐行說明：

0. 先看 Compose 自動幫你建了什麼——網路與 volume 都被冠上專案名前綴、自動隔離：

```bash
# 看 Compose 自動建立的資源(都帶 webapp 專案前綴)
docker network ls | grep webapp
docker volume ls | grep webapp
```

這兩條指令證明 13.2 節「一個專案一個命名空間」不是空話：`webapp_backend` 網路、`webapp_pgdata` volume 全自動生成並隔離，你完全不必手動 `network create`、`volume create`——第 11 章手工做的那兩步，Compose 讀 YAML 時順手包辦。

1. `docker compose exec web`：在**執行中**的 web 服務容器裡執行指令，等同 `docker exec`，但用服務名指定而非容器名。
2. `url.split('@')[1].split(':')[0]`：從 `postgresql://postgres:devpass@db:5432/appdb` 拆出 host 部分 `db`——不靠額外套件，純字串處理示範解析邏輯。
3. `socket.create_connection((host, port), timeout=3)`：真的建立一條 TCP 連線，三秒連不上就丟例外。這一步同時驗證了「DNS 解析 db」「網路互通」「資料庫在聽 5432」三件事。

### 完整指令盤點：日常維運會用到的其餘動作

三大指令之外，這幾個高頻動作也一次練齊：

```bash
# 只重建某一個服務的映像檔(改了 Dockerfile 或程式碼後)
docker compose build web

# 拉取所有 image 型服務的最新映像檔(不含 build 型)
docker compose pull

# 重啟單一服務(不重建,只重啟容器)
docker compose restart web

# 只把某個服務停掉(其餘照跑)
docker compose stop db && docker compose start db

# 即時資源儀表板(等同 docker stats,但只看本專案)
docker compose top

# 一鍵擴充副本數(第 14 章主題,這裡先見一面)
docker compose up -d --scale web=3
docker compose ps
docker compose up -d --scale web=1
```

指令逐項說明：

1. `docker compose build web`：只重建指定服務的映像檔，改一個服務時不必全部重建；不指定服務名則全部 build 型服務一起重建。
2. `docker compose pull`：把 image 型服務（如 postgres）的映像檔更新到最新，配合鎖定的標籤（第 05 章）控制更新範圍。
3. `restart` 與 `stop`/`start` 的差異：restart 是「重啟」單一動作，stop 後 start 則讓你在中間插入檢查或維護動作——維運手法的粗細之分。
4. `docker compose top` 一眼看完整套系統的資源用量，抓「哪個服務在吃 CPU」比逐容器查快。
5. `--scale web=3` 把 web 服務擴充成三個容器副本——這行預告了第 14 章的水平擴充，Compose 的 service 抽象在這裡展現威力：一個宣告、多個實體。