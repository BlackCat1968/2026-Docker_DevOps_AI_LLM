## 三塊積木：netns、veth、bridge

Docker 網路的地基只有三塊 Linux 積木：

- **network namespace**：一個獨立的網路世界——自己的介面、路由表、防火牆規則（第 01 章的老朋友）。
- **veth pair**：一條虛擬網路線，天生成對，一端塞進 A 世界、一端塞進 B 世界，兩個世界就通了。
- **bridge**：一台虛擬交換器（二層設備），多條網路線插上來，插在同一台上的彼此互通。

三塊積木的生活化對照，先建畫面再動手：netns 是三間彼此隔音的房間、veth 是一條條網路線、bridge 是放在走廊上的集線器。Docker 的所有網路魔法，就是「開房間、拉線、插集線器」的自動化——所以玄貓堅持你先徒手做一次：做過的人看 Docker 網路是透明的，沒做過的人看它是玄學。

### 徒手實驗：不用 Docker，搭出兩個容器的網路

在 Ubuntu（或 Multipass 的 lab 機）上，用原生指令重演 Docker 開兩個容器時做的網路工事：

```bash
# 步驟一:建兩個網路世界(模擬兩個容器的 NET namespace)
sudo ip netns add box1
sudo ip netns add box2
ip netns list

# 步驟二:建一台虛擬交換器並開機
sudo ip link add mybr0 type bridge
sudo ip link set mybr0 up
sudo ip addr add 10.10.0.1/24 dev mybr0

# 步驟三:拉兩條虛擬網路線,各自一端插世界、一端插交換器
sudo ip link add veth1 type veth peer name veth1-br
sudo ip link add veth2 type veth peer name veth2-br
sudo ip link set veth1 netns box1
sudo ip link set veth2 netns box2
sudo ip link set veth1-br master mybr0
sudo ip link set veth2-br master mybr0
sudo ip link set veth1-br up
sudo ip link set veth2-br up

# 步驟四:進到兩個世界裡,把各自那端的線開機並配 IP
sudo ip netns exec box1 ip addr add 10.10.0.11/24 dev veth1
sudo ip netns exec box1 ip link set veth1 up
sudo ip netns exec box1 ip link set lo up
sudo ip netns exec box2 ip addr add 10.10.0.12/24 dev veth2
sudo ip netns exec box2 ip link set veth2 up
sudo ip netns exec box2 ip link set lo up

# 步驟五:驗收——box1 打得到 box2,兩個世界經交換器互通
sudo ip netns exec box1 ping -c 2 10.10.0.12
```

徒手工事逐項說明：

- `ip netns add`：建一個具名的網路世界；`ip netns exec 名稱 指令` 是「進到那個世界裡執行指令」的萬用句型，本章與第 12 章除錯都重度依賴它。
- `type veth peer name`：一次生出一對線頭。線的物理特性是「一端進、另一端出」，把它想成一條真的網路線就對了。
- `master mybr0`：把線頭插進交換器的插槽（術語是把介面掛到 bridge 底下）。
- 每個世界裡的介面要各自 `up`，連 `lo`（迴環）也要——新世界裡什麼都預設關著。
- ping 通的那一刻，你完成的正是 Docker 的日常：**Docker 每開一個容器，就是自動化地重複這五步**。
- 收尾：`sudo ip netns del box1 && sudo ip netns del box2 && sudo ip link del mybr0`（netns 刪除時裡面的 veth 端會自動消滅，交換器端的孤兒線頭跟著 bridge 一起刪）。