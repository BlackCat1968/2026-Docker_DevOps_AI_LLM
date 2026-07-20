## 另外三種網路模式：host、none、container 共享

```bash
# host 模式:不隔離,容器直接用主機的網路世界(注意:沒有 -p,也不需要)
docker run -d --name hostweb --network host nginx:alpine
curl -s -o /dev/null -w "host 模式直連主機 80:HTTP %{http_code}\n" http://localhost:80
docker exec hostweb ip addr show | grep -c inet | xargs echo "容器看到的介面數(等於主機):"

# none 模式:只有迴環,與世隔絕
docker run --rm --network none alpine ip addr show

# container 共享:寄生在另一個容器的網路世界裡
docker run -d --name main alpine sleep 600
docker run --rm --network container:main alpine ip addr show eth0
```

三種模式逐項說明：

- **host**：容器不建自己的 NET namespace，直接活在主機的網路世界——零 NAT 損耗、埠就是主機的埠。代價是隔離歸零、埠衝突自己管。適用：極致網路效能需求、要監聽大量埠的網路工具。判準一句話：**當你發現自己要 -p 幾十個埠、或延遲每一微秒都在計較時**，才是 host 出場的時機；一般 Web 服務用它是拿隔離換不到什麼的虧本生意。macOS 注意（第 02 章差異的回收）：host 模式接的是「VM 的網路」不是 Mac 的，行為與 Linux 不同，開發時別依賴它。
- **none**：只有 lo，一條對外的路都沒有。適用：純計算批次、安全沙盒、之後交給自訂網路外掛接管的場合。判準一句話：**這個工作負載被駭了也不准打電話回家**——處理敏感資料的離線轉檔、跑不可信的批次程式，none 是最便宜的斷網保險。
- **container:名稱**：與目標容器共享同一個網路世界——兩個容器看到同一組介面、同一個 IP，互相用 localhost 就打得到。這是 Kubernetes Pod「多容器同網」的原型（第 24 章回收），也是網路除錯神器的地基：往出事容器旁邊掛一個裝滿工具的除錯容器（第 12 章正式登場）。localhost 直通的現場證明：

```bash
# 在 nginx 旁邊寄生一個容器,用 localhost 打它的 80
docker run -d --name webmain nginx:alpine
docker run --rm --network container:webmain alpine   wget -qO- -T 3 http://localhost:80/ | grep -o "<title>.*</title>"
docker rm -f webmain
```

- 寄生容器沒有自己的 IP、沒開任何門，卻用 localhost 打到了 nginx——同一個網路世界的兩個行程，跟主機上兩支程式互連沒有兩樣。
- 收尾清理：`docker rm -f c1 c2 web1 web2 web3 hostweb main`。