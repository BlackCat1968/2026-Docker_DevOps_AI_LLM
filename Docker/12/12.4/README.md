## 三幕排錯劇本：照著演一遍

排錯的第一守則玄貓先給：**不要憑感覺改東西**。連不上時最糟的反應是「重啟看看」「換個埠試試」——瞎改可能碰巧好了，但你永遠不知道為什麼，下次還是抓瞎。正確姿勢是拿五站檢查法當地圖，一站一站排除，讓病灶自己現形。三幕劇本就是這套心法的實戰演練。

### 第一幕：名字解析失敗

```bash
# 造案:兩個容器故意放在不同網
docker network create neta && docker network create netb
docker run -d --name svc-a --network neta nginx:alpine
docker run -d --name svc-b --network netb alpine sleep 600

# 症狀:svc-b 喊不到 svc-a
docker exec svc-b nslookup svc-a 2>&1 | tail -1

# 辦案:第一站就中——查兩造的網路歸屬
docker inspect svc-a svc-b --format '{{.Name}} 住在 {{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{end}}'

# 結案:同網才有互相解析的資格,connect 補一張網或搬家
docker network connect neta svc-b
docker exec svc-b nslookup svc-a 2>/dev/null | tail -2
```

- 病歷重點：**解析失敗優先查「同不同網」而不是查 DNS 服務**——127.0.0.11 幾乎不會壞，壞的是你對拓撲的想像。
- inspect 那條 range 語法一次列出容器的所有網路歸屬，是本幕的破案指令。

### 第二幕：埠打不通

```bash
# 造案:服務綁錯位址(第 06 章的經典病,這裡從除錯視角再殺一次)
docker run -d --name badbind -p 8090:9000 python:3.13-alpine \
  python -c "
import http.server
http.server.HTTPServer(('127.0.0.1', 9000), http.server.SimpleHTTPRequestHandler).serve_forever()"

# 症狀:主機打 8090 被重置
curl -s -m 3 http://localhost:8090/ || echo "→ 連線失敗"

# 辦案:第四站——寄生看它到底聽哪裡
docker run --rm --network container:badbind nicolaka/netshoot \
  ss -tlnp | grep 9000

# 結案:Local Address 是 127.0.0.1:9000——DNAT 送進來的封包目的位址對不上,拒收
docker rm -f badbind
```

- 辦案關鍵一行輸出：`127.0.0.1:9000`——五站法第四站的標準戰果。改綁 0.0.0.0 收工。
- 同幕變形題的鑑別：`curl` 若是**逾時**而非拒絕，嫌犯換成防火牆或路由（第三站）；**立即拒絕**才是沒人在聽或綁錯位址。逾時與拒絕是兩種病，症狀讀準能少查一半。

### 第三幕：時好時壞的連線

```bash
# 造案:別名池裡混進一個壞分身(聽錯埠的服務)
docker network create pool-net
docker run -d --name good1 --network pool-net --network-alias api-pool nginx:alpine
docker run -d --name good2 --network pool-net --network-alias api-pool nginx:alpine
docker run -d --name bad1  --network pool-net --network-alias api-pool alpine sleep 600

# 症狀:同一個名字,有時通有時不通
for i in 1 2 3 4 5 6; do
  docker run --rm --network pool-net alpine \
    wget -qO /dev/null -T 2 http://api-pool && echo "第 $i 發:通" || echo "第 $i 發:不通"
done

# 辦案:名字解析到誰?把整個池子攤開逐一體檢
docker run --rm --network pool-net nicolaka/netshoot dig +short api-pool

# 對每個 IP 單獨戳一槍,揪出壞分身
for ip in $(docker run --rm --network pool-net nicolaka/netshoot dig +short api-pool); do
  docker run --rm --network pool-net alpine \
    wget -qO /dev/null -T 2 http://$ip && echo "$ip 健康" || echo "$ip ← 壞分身在此"
done
docker rm -f good1 good2 bad1 svc-a svc-b mesh1 mesh2 v6a v6b
```

- 「時好時壞」的鑑識學：**間歇性故障九成是「多個後端裡混了壞蛋」**——DNS 輪替、負載平衡池、多副本，都是這個病的溫床（第 11 章 network-alias 沒有健康檢查的軟肋，正式發作）。
- 辦案手法固定兩步：先 `dig +short` 攤開名字背後的所有 IP，再逐一單點測試——把「機率問題」還原成「名單問題」。
- 這一幕的根治方案在第 14 章（健康檢查）與第 22 章（會踢除壞後端的負載平衡）——除錯找得到病，架構才治得了病。

三幕演完，你手上已有一套可複用的資產：五站地圖、三陣地抓包、攤名單獵壞蛋。把它們串成一句心法——**先看症狀分診、切到正確的站、讓工具吐證據、留下案底**——這就是玄貓在生產環境十年不變的網路除錯 SOP。