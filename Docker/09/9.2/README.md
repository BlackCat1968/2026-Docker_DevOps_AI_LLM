## 具名 volume 實戰：資料的生老病死

### 步驟一：建立與盤點

```bash
# 建立一個具名 volume
docker volume create appdata

# 盤點所有 volume
docker volume ls

# 身家調查:實際落在主機哪裡、什麼驅動
docker volume inspect appdata
```

- `volume create` 只是登記一個名字加開一個目錄，成本趨近於零。
- `inspect` 的 `Mountpoint` 指向 `/var/lib/docker/volumes/appdata/_data`——本質是主機上一個普通目錄，Docker 只是幫你管理它的生命週期與掛載。
- `Driver: local` 是預設驅動（存本機磁碟）；驅動可抽換成 NFS、雲端儲存等而介面不變——跟第 03 章 runtime 可抽換是同一種設計哲學，9.7 節會實掛一次 NFS 型態的參數。

### 步驟二：「資料比容器長壽」三代同堂實驗

```bash
# 第一代:把 appdata 掛到 /data,寫入一筆資料後死去(--rm)
docker run --rm -v appdata:/data alpine \
  sh -c 'echo "第一代容器寫的資料" > /data/note.txt'

# 第二代:全新容器讀取,資料還在
docker run --rm -v appdata:/data alpine cat /data/note.txt

# 第三代:連映像檔都換掉,資料照樣在
docker run --rm -v appdata:/data python:3.13-alpine \
  python -c "print(open('/data/note.txt').read().strip() + ' ← 第三代讀到了')"
```

- `-v 名稱:容器路徑`：名稱不含 `/` 就被當成 volume（含 `/` 則是 bind mount，9.4 節），這是 `-v` 語法的分流規則。
- 三代容器全數死透、映像檔都換過，note.txt 屹立不搖——volume 的生命週期與容器完全脫鉤，這就是「保險箱」的意思。
- 沒有先 `volume create` 也行：掛載一個不存在的名稱時 Docker 自動建立，但顯式建立更利於腳本的可讀性。

### 步驟三：--mount 語法——同一件事的囉嗦但精確版

```bash
# --mount 長語法:每個參數有名有姓,拼錯會直接噴錯而不是默默做錯事
docker run --rm \
  --mount type=volume,source=appdata,target=/data,readonly \
  alpine sh -c 'cat /data/note.txt && (echo 測試寫入 > /data/x.txt 2>&1 || echo "唯讀掛載,寫入被拒")'
```

- `--mount` 與 `-v` 功能等價，差在明確性：type、source、target 逐項具名，手誤直接出錯，不像 `-v` 拼錯名稱會「幫你建一個新 volume」默默吞掉錯誤。
- `readonly`（或 `-v` 的 `:ro` 尾綴）：這個容器對這箱資料只准看不准動——備份容器、報表容器都該用唯讀掛載，最小權限原則落到儲存層。
- 玄貓的慣例：教學與日常快手用 `-v`，正式腳本與 Compose 檔用長語法（Compose 的寫法第 13 章登場）。

### 步驟四：初始填充——一個能救命的冷知識

**空的 volume 首次掛到「映像檔內已有檔案的路徑」時，Docker 會把映像檔該路徑的既有內容複製進 volume**：

```bash
# nginx 映像檔的 /usr/share/nginx/html 裡本來就有預設首頁
docker volume create webroot
docker run -d --rm --name seed -v webroot:/usr/share/nginx/html nginx:alpine

# 驗證:volume 裡自動出現了映像檔的預設檔案
docker run --rm -v webroot:/check alpine ls /check
docker stop seed
```

- 這個「初始填充」只發生在 **volume 為空** 的首掛時刻；volume 已有內容就完全不動。
- 它是雙面刃：好處是資料庫映像檔的初始結構會自動長進 volume；壞處是你以為掛上去會是空目錄，結果冒出一堆映像檔的檔案——bind mount **沒有**這個行為（主機目錄蓋過去，映像檔內容被遮住），兩者行為相反，是排錯時的高頻考點。

### 步驟五：Dockerfile 的 VOLUME 指令——善意的隱形地雷

映像檔作者可以在 Dockerfile 宣告 VOLUME，強制某路徑一定外掛：

```bash
# 查一下 postgres 映像檔有沒有宣告 VOLUME
docker inspect postgres:16-alpine --format '{{.Config.Volumes}}'

# 實驗:跑一個宣告了 VOLUME 的映像檔,完全不給 -v
docker run -d --name novol postgres:16-alpine -c 'sleep 300' 2>/dev/null || docker run -d --name novol -e POSTGRES_PASSWORD=x postgres:16-alpine
sleep 3

# 看看發生什麼事:一個匿名 volume 被自動生了出來
docker inspect novol --format '{{range .Mounts}}{{.Type}} {{.Name}} → {{.Destination}}{{println}}{{end}}'
docker rm -f -v novol
```

- `Config.Volumes` 顯示 `/var/lib/postgresql/data` 已被映像檔宣告——所以就算你忘了 -v，資料也不會寫進可寫層，Docker 自動配一個**匿名 volume** 接住。
- 善意在此：資料至少與容器脫鉤了。地雷也在此：匿名 volume 名字是亂數，容器刪掉（沒帶 -v）後它變孤魂，你以為的「資料不見了」常常是「資料在某個匿名箱裡找不到」。
- 救援指令：`docker volume ls -q | xargs -I{} sh -c 'echo {}; docker run --rm -v {}:/x alpine ls /x | head -3'` 逐箱開箱找資料——狼狽但有效，更好的做法是打從一開始就具名掛載，讓這個指令永遠用不到。
- 寫自家 Dockerfile 時玄貓建議**少用 VOLUME**：它剝奪使用者「要不要外掛」的選擇權，還讓 dev 環境長出一堆匿名箱；資料路徑寫進文件、由部署端具名掛載，權責更清楚。

