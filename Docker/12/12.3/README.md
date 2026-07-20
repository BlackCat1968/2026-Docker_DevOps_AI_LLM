## 除錯工具箱：裝備、陣地與抓包

### 主力裝備：netshoot 空降工具箱

生產映像檔瘦身後（第 07 章的功勞）連 ping 都沒有——除錯工具不裝進服務映像檔，而是**需要時空降**：

```bash
# 空降姿勢一:寄生進出事容器的網路世界(第 10 章 container 共享的實戰化)
docker run --rm --network container:mesh1 nicolaka/netshoot \
  sh -c 'ss -tlnp | head -3 && nslookup mesh2 | tail -2'

# 空降姿勢二:掛上某張網,以「鄰居視角」測試服務
docker run --rm --network meshnet nicolaka/netshoot curl -s -o /dev/null -w "鄰居打 mesh1:HTTP %{http_code}\n" http://mesh1
```

- `nicolaka/netshoot` 是社群公認的網路除錯瑞士刀：ss、dig、tcpdump、curl、mtr、iperf 全員到齊。
- 姿勢一看的是「這個容器自己的世界」：它聽了哪些埠、它解析得到誰——服務容器本人不用裝任何工具。
- 姿勢二看的是「別人連它的體驗」：兩個視角一比對，「服務沒起來」與「網路不通」立刻分家。

要長時間辦案就開互動模式，武器庫先盤點一次：

```bash
# 互動空降:拿一個完整的 shell 慢慢查
docker run -it --rm --network container:mesh1 nicolaka/netshoot bash

# ↓↓ 空降艙內的常用武器與用途 ↓↓
# ss -tlnp          → 這個世界誰在聽哪個埠
# dig mesh2 +short  → 名字解析(比 nslookup 輸出更好餵腳本)
# curl -sv http://mesh2 → 連線全過程逐步吐露(TLS 交握、標頭、回應碼)
# mtr -rw mesh2     → 路徑品質報告(丟包率逐跳攤開)
# iperf3 -c 目標    → 頻寬實測(對端要先跑 iperf3 -s)
# tcpdump -i eth0   → 本世界的封包直播
exit
```

- 這份武器對照表值得印出來貼牆：每一件武器對應五站法的一站，辦案時「站別」決定「兵器」，不用每次從頭想。
- `curl -sv` 是被低估的鑑識神器：連線在哪一步卡住（解析、TCP、TLS、等回應）輸出裡看得一清二楚，比「就是連不上」四個字有用一百倍。

### 重武器：tcpdump 抓包三陣地

封包不會說謊。三個抓包位置對應三種懷疑：

```bash
# 陣地一:容器視角——寄生抓 mesh1 收到的流量
docker run --rm --network container:mesh1 nicolaka/netshoot \
  timeout 5 tcpdump -i eth0 -nn port 80 &
sleep 1 && docker exec mesh2 wget -qO /dev/null http://mesh1 && sleep 5

# 陣地二:交換器視角——在主機的 bridge 介面上抓(自訂網是 br-xxx,預設網是 docker0)
BRIF=$(ip link | grep -o "br-[a-f0-9]*" | head -1)
sudo timeout 5 tcpdump -i ${BRIF:-docker0} -nn icmp &
sleep 1 && docker run --rm --network bridge alpine ping -c 2 172.17.0.1; sleep 4

# 陣地三:國界視角——在主機對外介面抓 NAT 換臉後的流量
sudo timeout 5 tcpdump -i any -nn "host example.com" &
sleep 1 && docker run --rm alpine wget -qO /dev/null http://example.com; sleep 4
```

三陣地逐項說明：

- **陣地一（容器 eth0）**：確認「封包到底有沒有進到容器」。有進沒回，是應用問題；連進都沒進，往外圈查。
- **陣地二（bridge 介面）**：確認「封包有沒有走上交換器」。這裡看得到、容器裡看不到，中間就是 veth 或容器內防火牆的問題。
- **陣地三（對外介面）**：確認「NAT 換臉後長什麼樣」。來源已是主機 IP、目的正確卻沒有回應，問題在外部網路，可以理直氣壯把工單轉給網管。
- `-nn` 不做名稱反查（輸出快又乾淨）、`timeout 5` 讓抓包自動收工不用手殺——排錯指令要設計成「跑完自己停」，掛著忘記關的 tcpdump 是效能殺手。
- 由內而外三槍打完，封包死在哪一段就鎖定在哪一段——這比對著設定檔冥想快十倍。

### 決策地圖：五站檢查法（第 10 章旅程的除錯化）

容器連不上目標時，照這張地圖逐站排除：

1. **名字站**：`nslookup 目標` ——解析失敗就是 DNS 問題（不同網？打錯名？），跟連線無關，先修名字。
2. **路由站**：`ip route`（容器內）——有沒有通往目標網段的路？多網容器的預設路由走對了嗎（第 11 章陷阱六）？
3. **轉送站**：`sysctl net.ipv4.ip_forward` 加 `sudo iptables -L DOCKER-USER -n` ——主機轉送開了嗎？自家防火牆擋了嗎？
4. **服務站**：寄生進目標容器 `ss -tlnp` ——服務真的在聽嗎？聽的是 0.0.0.0 還是 127.0.0.1（第 06 章鐵律）？
5. **封包站**：三陣地 tcpdump ——前四站都對還不通，讓封包自己招供。

這五站不是死板順序，而是**分診地圖**：curl 逾時直接跳去二、三站（封包半路失蹤），curl 拒絕直奔第四站（沒人聽），名字打錯根本卡在第一站。讀懂症狀選對切入點，才是資深與新手的差距——新手從第一站土法煉鋼，老手看一眼症狀就空降到正確的站。