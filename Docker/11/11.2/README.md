## 內建 DNS：喊名字就找得到人

自訂網路與預設 bridge 的最大分水嶺——**內建 DNS 伺服器**。實測：

```bash
# 兩個住戶搬進 appnet
docker run -d --name api --network appnet nginx:alpine
docker run -d --name worker --network appnet alpine sleep 600

# 見證奇蹟:直接喊名字,通了(第 10 章在預設 bridge 上做同樣的事是失敗的)
docker exec worker ping -c 2 api

# DNS 伺服器本人:每個住戶的 resolv.conf 都指向 127.0.0.11
docker exec worker cat /etc/resolv.conf

# 用 DNS 查詢工具問個明白:api 這個名字解析到誰
docker exec worker nslookup api 2>/dev/null | tail -3
```

DNS 機制逐項說明：

- `127.0.0.11` 是 Docker 埋在**每個容器裡**的 DNS 服務位址（實際由 daemon 代答）：查詢容器名 → 回同網段住戶的 IP；查詢外部網域 → 轉發給主機設定的上游 DNS。一個位址、兩種業務。
- 名冊是**活的**：容器重啟換了 IP，DNS 記錄即時跟上——第 10 章 --link 的「hosts 檔過期」死穴，在這裡從機制上根除。
- 解析範圍以「網」為界：worker 只查得到同網段的住戶，別的網的容器名查不到——DNS 同時是服務發現與隔離邊界，一魚兩吃。
- 應用程式的連線設定從此寫名字不寫 IP：`DB_HOST=db`、`API_URL=http://api:80`——這一行習慣直通第 13 章 Compose 與第 24 章 Kubernetes 的 Service，整條容器生涯都靠它。

內外兩條業務線各驗一次，順便看清楚名冊不是寫在 hosts 檔裡：

```bash
# 外部網域照樣解析:127.0.0.11 把查詢轉發給上游 DNS
docker exec worker nslookup example.com 2>/dev/null | tail -3

# 名冊不在 hosts 檔:hosts 乾乾淨淨,解析全靠 DNS 動態回答
docker exec worker cat /etc/hosts
```

- 對外查詢通了，證明容器不需要任何額外設定就有完整的網域解析能力；上游用誰，跟著主機或 --dns 參數走（11.6 節）。
- hosts 檔裡查無其他容器——這就是與 --link 時代的本質差異：**動態問答取代靜態抄寫**，名冊永遠是即時的。