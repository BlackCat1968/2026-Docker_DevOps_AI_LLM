## network-alias：一個名字、多個分身

名字還能更進一步——多個容器掛**同一個別名**，DNS 輪流報出不同 IP，天生自帶陽春版負載分擔：

```bash
# 三個 web 容器,全部掛上 web-pool 這個別名
for i in 1 2 3; do
  docker run -d --name web$i --network appnet \
    --network-alias web-pool nginx:alpine
done

# 從 worker 連續解析同一個名字:三個 IP 輪番上陣
for i in 1 2 3 4 5 6; do
  docker exec worker nslookup web-pool 2>/dev/null | grep -A1 "web-pool" | grep Address | head -1
done

# 收掉一個分身,名冊即時縮編
docker rm -f web2
docker exec worker nslookup web-pool 2>/dev/null | grep Address | tail -3
```

分身機制逐項說明：

- `--network-alias`：別名疊加在容器名之上——web1 同時回應「web1」與「web-pool」兩個名字，前者點名、後者叫號。
- DNS 回應的順序會輪替（round-robin），不同用戶端的連線自然散到不同分身——這是**最陽春的負載分擔**：沒有健康檢查、沒有權重、靠 DNS 快取的緣分吃飯。
- 它的正確定位是「開發與小場面」；正式的流量分配交給第 22 章的反向代理、大場面交給第 23 章 Swarm 的內建虛擬 IP。知道它的極限，才不會錯用。
- 別名還有一個常被忽略的正經用途——**平滑改名與相容舊稱**：服務從 payment-v1 演進到 payment-v2 時，新容器同時掛上舊別名，還沒改設定的舊用戶端照常連得到，遷移窗口內兩個名字並存，改名不再是斷崖。
- 縮編實驗證明名冊即時性：分身死了，DNS 立刻除名，不會把流量導向屍體——但「行程活著、服務死了」的殭屍它照樣報名，這正是它沒有健康檢查的軟肋。

DNS 之外，再用真實的 HTTP 請求看分擔效果：

```bash
# 讓三個分身自報身分:各自把首頁改成自己的名字
for i in 1 3; do
  docker exec web$i sh -c 'echo "由 web'$i' 服務" > /usr/share/nginx/html/index.html'
done

# 從觀測容器連打六發,看誰接單(wget 每次新連線,避開 keep-alive 黏著)
for i in 1 2 3 4 5 6; do
  docker run --rm --network appnet alpine wget -qO- http://web-pool/
done
```

- 每一發都是全新容器發起的全新連線，DNS 輪替的效果最乾淨；同一個長連線用戶端則會黏在第一次解析到的分身上——「分擔粒度是連線不是請求」這句話，看過輸出就懂了。