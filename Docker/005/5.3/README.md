## 5.3 分層：映像檔省空間的魔法本體

### 實驗一：把層攤開看

```bash
# history:這個映像檔是被哪些指令一層層蓋出來的
docker history python:3.13-alpine

# inspect:每一層的內容雜湊(diff ID)清單
docker inspect python:3.13-alpine --format '{{range .RootFS.Layers}}{{println .}}{{end}}'
```

- `history` 由下往上讀是建置順序：最底是基底檔案系統，往上每列對應一條建置指令；SIZE 為 0 的列是「不產生檔案變動」的中繼資料指令（例如設定環境變數）。
- `RootFS.Layers` 列出的 sha256 就是各層解壓內容的指紋——Docker 的儲存是**內容定址**：層的身分由內容決定，跟名字無關。

### 實驗二：親眼看見「層共用」省下的空間

內容定址帶來的殺手級好處：內容相同的層，全機只存一份。用兩個同家族映像檔驗證：

```bash
# 記下拉取前的映像檔磁碟用量
docker system df --format '{{.Type}}: {{.Size}}' | head -1

# 拉 python:3.13-alpine 的兄弟版本:多數底層與它相同
docker pull python:3.13.1-alpine

# 觀察拉取過程:大量層顯示 Already exists——一個位元組都沒重新下載

# 再看磁碟:兩個「一百多 MB」的映像檔,總用量只多了一點點
docker system df --format '{{.Type}}: {{.Size}}' | head -1
docker images --format 'table {{.Repository}}\t{{.Tag}}\t{{.Size}}' | grep python
```

- 拉取畫面裡的 `Already exists` 是本實驗的靈魂：daemon 比對層指紋，發現本機已有同內容的層，直接跳過下載。
- `docker images` 顯示每個映像檔「各自」的完整大小，但那是邏輯大小；實體磁碟上共用層只有一份，所以 `system df` 的總量遠小於兩者相加。
- 這也是第 01 章 Tips 的完整版答案：一百個容器共用同一組唯讀層，磁碟與拉取流量都只付一次錢。

### 實驗三：容器層疊在最上面

```bash
# 開一個容器,在裡面寫一個檔案
docker run -d --name writer python:3.13-alpine sleep 600
docker exec writer sh -c 'echo "容器層的資料" > /tmp/note.txt'

# 映像檔的層數 vs 容器的層數:容器多了一層可寫層
docker inspect python:3.13-alpine --format '映像檔層數: {{len .RootFS.Layers}}'
docker inspect writer --format '容器可寫層驅動: {{.GraphDriver.Name}}'

# 可寫層在主機上的實際位置(UpperDir 就是第 01 章 OverlayFS 的 upper)
sudo ls $(docker inspect writer --format '{{.GraphDriver.Data.UpperDir}}')/tmp/
docker rm -f writer
```

- `GraphDriver.Data.UpperDir`：這個容器可寫層的主機路徑，`ls` 下去直接看到剛寫的 `note.txt`——第 01 章徒手 mount 的 upper 目錄，Docker 每開一個容器就自動幫你配一個。
- 映像檔恆為唯讀、容器層恆為獨享，這條鐵律撐起「同映像檔多容器互不污染」的整個世界觀。

順帶拆一個常見的困惑：同一層為什麼會看到兩種不一樣的 sha256？

- `RootFS.Layers` 列的是 **diff ID**——層「解壓後內容」的雜湊，本機儲存用它當身分證。
- 拉取進度條與 manifest 裡看到的是 **壓縮 digest**——層「壓縮傳輸檔」的雜湊，Registry 收發用它對帳。
- 同一層、兩個階段、兩枚指紋，各管各的場子；除錯「本機層跟遠端對不上」時，先確認自己拿的是哪一種，九成疑案當場破。