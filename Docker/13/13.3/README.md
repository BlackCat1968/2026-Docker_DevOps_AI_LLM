## compose.yaml 語法精讀：常用欄位一次講清

同一個設定常有長短兩種寫法，看得懂才不會被別人的 compose.yaml 搞混。逐項對照：

```yaml
# 語法精讀範例：同一批設定的完整寫法
services:
  web:
    build:
      context: .              # 建置 context 路徑(第 06 章)
      dockerfile: Dockerfile  # 指定 Dockerfile 檔名
      args:                   # 建置期參數，對應 Dockerfile 的 ARG
        PY_VERSION: "3.13"
    image: webapp:local       # build 出來後貼的標籤
    ports:
      - "8000:8000"           # 長寫：主機埠:容器埠
      - "127.0.0.1:9000:9000" # 綁定位址(第 10 章的安全開關)
    environment:
      - APP_ENV=production     # 陣列寫法(KEY=VALUE)
    env_file:
      - .env.web               # 從檔案整批載入環境變數
    volumes:
      - pgdata:/data           # 具名 volume
      - ./config:/etc/app:ro   # bind mount(相對路徑)且唯讀
    restart: unless-stopped    # 重啟策略(第 04 章)
    deploy:
      resources:
        limits:
          cpus: "1.5"          # CPU 上限(第 04 章的 --cpus)
          memory: 512M         # 記憶體上限
    networks: [backend]
```

欄位逐項說明：

1. `build` 展開成物件時可細指定 context、dockerfile、args——`args` 就是 `docker build --build-arg`（第 06 章的參數化建置）的 Compose 版。
2. `ports` 的每種寫法都對應第 10 章的 `-p` 形式：純 `8000:8000`、綁定位址 `127.0.0.1:9000:9000` 一字不差搬過來。
3. `environment` 有兩種寫法——物件式（`KEY: VALUE`）與陣列式（`- KEY=VALUE`），效果相同，選一種風格一致就好。
4. `env_file` 從外部檔案整批載入環境變數，比一條條列在 environment 裡乾淨，適合變數多的服務。
5. `volumes` 同時示範具名 volume 與 bind mount：**冒號前有 `/` 或 `.` 就是 bind、否則是具名 volume**——第 09 章的 `-v` 分流規則在 YAML 裡照樣成立。
6. `restart: unless-stopped` 就是第 04 章的重啟策略，生產服務的標配。
7. `deploy.resources.limits` 是第 04 章 `--cpus`、`--memory` 的宣告式版本——資源限制寫進設定檔，每次 up 自動生效，不會忘記加。