## 多環境設定：override 檔的疊加

同一套系統在開發與正式環境設定不同（開發要熱重載、正式要唯讀），Compose 用「基礎檔 + 覆寫檔」疊加解決：

```yaml
# compose.override.yaml：開發專用覆寫，docker compose up 會自動疊加它
services:
  web:
    build:
      target: dev              # 用第 07 章的 dev 目標映像檔
    volumes:
      - .:/app                 # bind mount 程式碼，開發熱重載(第 09 章)
    command:                   # 覆寫啟動指令，加 --reload
      - uvicorn
      - app:app
      - --host
      - 0.0.0.0
      - --port
      - "8000"
      - --reload
    environment:
      APP_ENV: development
```

疊加機制的實測：

```bash
# 預設行為：up 會自動把 compose.yaml 與 compose.override.yaml 疊加
docker compose config | grep -A3 "command:"

# 只用基礎檔(正式環境模擬)：明確指定 -f 就不會自動抓 override
docker compose -f compose.yaml config | grep -A1 "web:" | head -3

# 開發環境啟動：兩檔疊加，web 帶著 --reload 與 bind mount
docker compose up -d
docker compose exec web sh -c 'echo $APP_ENV'
docker compose down
```

把 override 疊加的實際結果攤開來看，眼見為憑：

```bash
# 對照:基礎檔的 web 沒有 --reload,疊上 override 後有了
echo "=== 只讀基礎檔 ==="
docker compose -f compose.yaml config | grep -A6 "web:" | grep -E "command|reload" || echo "(基礎檔無 command 覆寫)"
echo "=== 自動疊加 override ==="
docker compose config | grep -i reload
```

- 兩段輸出的差異，就是 override 檔加進來的那些欄位——這是「一份基礎、多份覆寫」最直觀的證明。

疊加邏輯逐項說明：

1. `compose.override.yaml` 是 Compose 的**約定檔名**：執行 `docker compose up` 時，它會自動疊在 `compose.yaml` 上，同名欄位覆寫、新欄位新增。
2. 疊加不是取代整個服務，而是**深層合併**：override 只寫要改的部分（這裡加了 volumes、command、target），沒寫的欄位（image、networks）沿用基礎檔。
3. 正式環境部署時用 `-f compose.yaml` 明確只讀基礎檔，把開發專用的 override 排除在外——一份基礎檔通吃多環境，差異隔離在 override 裡。
4. 更多環境（staging）用 `-f compose.yaml -f compose.staging.yaml` 手動疊指定檔，疊加順序由左至右、後者優先。