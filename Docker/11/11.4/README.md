## connect 與 disconnect：動態搬家與雙重國籍

網路歸屬不是出生就定終身，隨時能改：

```bash
# 開第二個社區
docker network create --subnet 10.21.0.0/24 othernet

# 把 worker 動態接上第二張網:它現在有兩張網卡、兩個 IP
docker network connect othernet worker
docker exec worker ip addr show | grep "inet 10\."

# 雙重國籍的威力:兩個社區的住戶它都喊得到
docker run -d --name other-svc --network othernet nginx:alpine
docker exec worker ping -c 1 api > /dev/null && echo "appnet 的 api:通"
docker exec worker ping -c 1 other-svc > /dev/null && echo "othernet 的 other-svc:通"

# 反向驗證隔離:api 與 other-svc 彼此不同網,互相查無此人
docker exec api ping -c 1 -W 1 other-svc 2>&1 | tail -1

# 斷開一張網
docker network disconnect othernet worker
docker exec worker ip addr show | grep -c "inet 10\." | xargs echo "剩餘網卡數:"
```

動態網路逐項說明：

- `network connect` 對**執行中**的容器生效：Docker 現場生一對 veth、插上目標交換器、發 IP、更新 DNS 名冊——第 10 章徒手做的那套工事，熱插拔版。
- 雙重國籍的容器是天然的「跨網橋樑」：反向代理站前台網與後台網、監控代理站業務網與監控網，都是這個型。
- 隔離的反向驗證必做：架構圖上畫的「不相通」，要用一次失敗的 ping 蓋章確認——資安上「證明不通」跟「證明會通」一樣重要。
- `network connect` 還能在掛網當下附加身分與位址：

```bash
# 掛第二張網時,順便給別名與靜態 IP
docker network connect --alias backup-target --ip 10.21.0.50 othernet worker
docker run --rm --network othernet alpine nslookup backup-target 2>/dev/null | tail -2
docker network disconnect othernet worker
```

- `--alias` 讓同一個容器在不同網上以不同名字服役——前台網叫 app、後台網叫 report-source，名字跟著業務語境走。
- run 時只能 `--network` 掛一張網；要多網就是「先 run 一張、再 connect 其餘」，或交給第 13 章的 Compose 宣告式一次到位。