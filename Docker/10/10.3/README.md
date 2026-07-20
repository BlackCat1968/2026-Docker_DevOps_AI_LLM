## 出門的路：NAT 假面

容器的 172.17.0.x 是私有位址，外面的世界不認得。容器連外時主機做了「出門換臉」：

```bash
# 容器連外測試:打得到外網
docker exec c1 wget -qO- -T 5 https://ifconfig.me && echo " ← 容器看到的對外 IP"

# 這個 IP 是主機的對外 IP,不是 172.17.0.2:出門時被 NAT 換過臉
curl -s https://ifconfig.me && echo " ← 主機自己的對外 IP,兩者相同"

# 看看換臉規則本人:iptables 的 MASQUERADE
sudo iptables -t nat -L POSTROUTING -n | grep -E "MASQUERADE|Chain"
```

- `MASQUERADE` 規則的意思：來源是 172.17.0.0/16、要從實體介面出門的封包，來源位址一律改寫成主機 IP——這就是所有容器共用主機身分上網的機制。
- 回程封包到達主機時，NAT 的連線追蹤表記得「這是誰的包裹」，自動改回容器 IP 送進去。
- 方向感很重要：**出門（容器連外）預設就通；進門（外界連容器）預設全關**——進門的鑰匙就是下一節的 `-p`。

把一顆封包從容器到外網的完整旅程走一遍，之後除錯就有地圖：

1. 容器內：目的地不在本網段，送給預設閘道 172.17.0.1（docker0）。
2. 封包經 veth 線到主機，主機發現目的地不是自己，需要**轉送**——這依賴核心開關 `net.ipv4.ip_forward=1`（Docker 啟動時自動打開）。
3. 轉送前經過 iptables FORWARD 鏈的放行檢查（Docker 佈好的規則）。
4. 出實體介面前，POSTROUTING 的 MASQUERADE 換臉，連線登記進追蹤表。
5. 回程封包比對追蹤表、換回容器 IP、原路送返。

現場驗證第 2 步與第 4 步的登記簿：

```bash
# 轉送開關:必須是 1,某些精簡系統或被安全腳本關掉時,容器全體斷網
sysctl net.ipv4.ip_forward

# 連線追蹤表:容器對外的每一條連線都有登記(裝 conntrack 工具查看)
sudo apt-get install -y conntrack >/dev/null 2>&1
docker exec c1 wget -qO /dev/null -T 5 https://example.com &
sudo conntrack -L 2>/dev/null | grep 172.17 | head -3
```

- `ip_forward` 是被玩壞頻率最高的開關：主機加固腳本把它關掉，全機容器瞬間斷外網，症狀像網路故障、病灶在一個 sysctl——除錯清單第一條。
- conntrack 表裡看得到「172.17.0.x 對外某 IP 的連線、以及換臉後的樣子」，NAT 不再是黑魔法。
- 這五步旅程也是效能對話的基礎：bridge 模式每顆封包都要過 veth、過轉送、過 NAT，高流量下這些微小成本會累積——這正是 10.6 節 host 模式存在的理由，以及第 22 章負載平衡選型時「代理放哪一層」的討論起點。除錯時的用法更直接：連線不通就沿五步逐站檢查——容器內路由對不對、ip_forward 開沒開、FORWARD 鏈擋沒擋、NAT 規則在不在、回程追蹤有沒有記錄，五站走完病灶必現形。