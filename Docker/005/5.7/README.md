## 5.7 清理與盤點：對映像檔做斷捨離

```bash
# 盤點:大小排序找肥貓(sort 以人類可讀單位排序)
docker images --format '{{.Size}}\t{{.Repository}}:{{.Tag}}' | sort -hr | head -5

# 懸空映像檔:被新建置擠掉標籤的孤兒(<none>:<none>)
docker images --filter dangling=true

# 刪除單一映像檔:有容器引用時會被擋下,-f 別亂加
docker rmi my-alpine:flat

# 只刪懸空:日常保養
docker image prune -f

# 連「沒有任何容器使用」的映像檔一起刪:大掃除,下次要用得重拉
docker image prune -a -f

# 全域盤點收尾
docker system df
```

指令逐項說明：

- 懸空（dangling）映像檔的成因：重複建置同名標籤時，舊映像檔的標籤被搶走、變成 `<none>`，日積月累吃掉可觀磁碟。
- `rmi` 被「container is using it」擋下時，正解是先處理容器，不是 `-f` 硬拆——硬拆會留下引用斷裂的爛攤子。
- `image prune` 不加 `-a` 只清懸空，安全性高、適合排程；`-a` 是大掃除，清完首次啟動服務都要重新拉取，生產主機慎用。
- 記住 tag 是便利貼的推論：`rmi` 一個還有其他標籤的映像檔，其實只是撕掉一張便利貼，層還在；最後一張撕掉才會真正釋放空間。

過濾器再進階兩招，大型主機盤點必備：

```bash
# 只列某個時間點之前建立的映像檔(搭配另一個映像檔當基準)
docker images --filter before=python:3.13-alpine --format '{{.Repository}}:{{.Tag}}'

# 依標籤(label)過濾:配合第 04 章的標籤治理,映像檔也吃同一套
docker images --filter label=maintainer --format '{{.Repository}}:{{.Tag}}'
```

- `before` 與對應的 `since` 用「相對於某映像檔的建立時間」圈範圍，清理「比某基準還老的舊貨」時一條指令圈完。
- 映像檔的 label 來自建置時的宣告（第 06 章的 LABEL 指令），先知道盤點端怎麼用，寫 Dockerfile 時就知道為什麼要好好貼標。