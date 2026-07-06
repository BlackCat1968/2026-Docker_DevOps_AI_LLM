## 5.5 commit：把容器凍成映像檔（以及為什麼別愛上它）

改動中的容器可以直接「拍快照」變成新映像檔：

```bash
# 開一個容器,手動裝個工具進去
docker run -d --name customize alpine sleep 600
docker exec customize apk add --no-cache curl

# 快照:把容器目前的可寫層凍結成新的一層,疊出新映像檔
docker commit -m "加裝 curl" -a "blackcat" customize my-alpine:curl

# 驗證:新映像檔比 alpine 多一層,而且帶著 curl
docker history my-alpine:curl | head -3
docker run --rm my-alpine:curl curl --version | head -1
docker rm -f customize
```

- `commit` 把容器可寫層的內容變成一個新的唯讀層，蓋在原映像檔上，蓋出 `my-alpine:curl`。
- `-m` 留註記、`-a` 留作者，會出現在 history 與 inspect 裡。
- commit 預設會先把容器 pause 再拍照，確保檔案系統快照的一致性；`--pause=false` 可以關掉，但拍到寫一半的檔案風險自負。
- `--change` 參數能在快照同時改寫中繼資料，例如 `docker commit --change 'CMD ["curl", "--version"]' customize my-alpine:curl` 直接換掉預設指令——語法就是下一章 Dockerfile 的指令，先混個眼熟。
- **但玄貓要當場潑冷水**：commit 出來的映像檔是個黑盒子——沒人知道裡面手動做過哪些事、無法重現、無法程式碼審查。它的正當用途只有兩個：事故現場保全（把出事容器凍起來慢慢驗屍）、互動實驗的暫存。日常產出映像檔的正道是 Dockerfile（第 06 章），每一層都有跡可循。

### save/load 與 export/import：一字之差，天差地遠

```bash
# save:保留完整的層結構與中繼資料(映像檔 → tar)
docker save my-alpine:curl -o with-layers.tar

# export:把「容器」的合成檔案系統攤平成單一層(容器 → tar)
docker run -d --name flatten my-alpine:curl sleep 60
docker export flatten -o flat.tar

# 對照大小與本質
ls -lh with-layers.tar flat.tar

# import 回來的映像檔只剩一層,history 什麼都看不到
docker import flat.tar my-alpine:flat
docker history my-alpine:flat
docker rm -f flatten
```

- `save/load` 的對象是**映像檔**，層、標籤、建置歷史全數保留——搬家用它。
- `export/import` 的對象是**容器**，輸出的是 OverlayFS 合成後的攤平視圖，所有歷史蒸發、變成單一層——第 03 章做 runc rootfs 時用的正是它。
- 攤平的副作用是雙面刃：丟掉歷史等於丟掉層共用的省空間優勢，但也抹掉了層裡可能殘留的敏感檔案（第 19 章安全課會回收這把刀）