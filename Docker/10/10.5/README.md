## 預設 bridge 的殘缺：容器找同伴只能背 IP

```bash
# c1 ping c2 的 IP:通
C2IP=$(docker inspect c2 --format '{{.NetworkSettings.IPAddress}}')
docker exec c1 ping -c 2 $C2IP

# c1 ping c2 的名字:失敗——預設 bridge 沒有名稱解析
docker exec c1 ping -c 2 c2 2>&1 | tail -1
```

- 預設 bridge 網路**沒有內建 DNS**：容器互找只能靠 IP，而容器 IP 每次重啟都可能換——寫死 IP 的架構脆得像餅乾。
- 老教材的解法是 `--link`（素材裡整節在教它），完整交代一次以便讀懂舊腳本：`docker run --link c2:db app` 會做兩件事——把 c2 的當下 IP 用別名 db 寫進新容器的 hosts 檔、把 c2 的環境變數以 DB_ 前綴注入新容器。三個致命傷判它出局：**單向**（c2 看不到你）、**不隨重啟更新**（c2 重啟換 IP，你的 hosts 檔還是舊的，連線斷）、**環境變數注入把設定與拓撲攪在一起**。官方早已標記 legacy，新專案禁用，本課程列出純為考古。
- 正解是下一章的**自訂 bridge 網路**：自帶 DNS、容器名直接互通——這也是為什麼實務上幾乎不直接用預設 bridge。本章先把地基打穩，第 11 章蓋房子。

### 反向需求：容器要連「主機上」的服務

開發時常見的反向題：容器裡的應用要連主機上跑的資料庫或除錯工具。容器裡的 localhost 是容器自己，不是主機——正解如下：

```bash
# 主機上開一個示範服務(用 Python 內建 HTTP 伺服器聽 9000)
python3 -m http.server 9000 --bind 0.0.0.0 >/dev/null 2>&1 &
HOSTSVC=$!

# 正解:host-gateway 別名——把 host.docker.internal 指向主機
docker run --rm --add-host=host.docker.internal:host-gateway alpine   wget -qO- -T 3 http://host.docker.internal:9000/ | head -3

# 收攤
kill $HOSTSVC
```

- `--add-host=host.docker.internal:host-gateway`：在容器的 hosts 檔寫入一筆「這個名字指向主機閘道 IP」。Docker Desktop（macOS）內建這個名字免加參數；**Ubuntu 上要自己加**這個參數——跨平台專案把它寫進啟動腳本，兩邊行為就一致了。
- 主機端的服務記得綁 0.0.0.0 或 docker0 的 IP：只綁 127.0.0.1 的主機服務，容器經閘道進來一樣被拒收——第 06 章那條鐵律的相反方向版，方向相反、道理相同。
- 硬寫 172.17.0.1 也能通，但網段可自訂（10.2 節剛改過），寫死 IP 的腳本換一台主機就斷，用名字才是可攜的解。