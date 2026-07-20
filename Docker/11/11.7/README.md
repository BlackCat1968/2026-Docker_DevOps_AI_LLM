## macvlan 一瞥：讓容器領到「真的」內網 IP

有些場景（網路設備模擬、老舊系統要求同網段直連）需要容器直接以區網成員的身分現身：

```bash
# 建一張 macvlan 網:掛在主機實體介面上,網段用「真實區網」的(參數換成你環境的)
docker network create -d macvlan \
  --subnet 192.168.0.0/24 \
  --gateway 192.168.0.254 \
  lannet

# 容器直接領一個區網 IP,區網上其他機器可直連它,不經 NAT 不用 -p
docker run -d --name lan-svc --network lannet --ip 192.168.0.168 nginx:alpine
docker inspect lan-svc --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}'
```

- macvlan 讓容器的網卡直接掛在實體介面上、以獨立 MAC 現身區網——路由器眼中它就是一台新機器。
- 兩個先天限制背起來：**主機本人預設連不到自家 macvlan 容器**（核心的迴避設計，需另建 macvlan 子介面繞道）；**macOS 不支援**（容器在 VM 裡，掛不到 Mac 的實體網卡），實驗請在 Multipass 或實體 Ubuntu 做。
- 定位是特例工具：一般服務走 bridge 加 -p 就好，macvlan 留給「必須被當成實體機」的場面。
- 素材裡同場加映的還有 ipvlan（同介面共用 MAC 的變體，適合交換埠限制 MAC 數量的環境）——概念與 macvlan 同族，選型時記得這條備案存在即可，用到再查參數。決策口訣：**容器需要「區網身分證」才考慮這一族，否則一律回 bridge 的懷抱**。