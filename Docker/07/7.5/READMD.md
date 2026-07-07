### buildx：一次建置，多架構通吃

```bash
# 確認 buildx 就緒(第 02 章五件套之一)
docker buildx version

# 建立並啟用一個支援多平台的建置器(container 驅動才能同時處理多架構)
docker buildx create --name multibuilder --driver docker-container --use

# 開機並檢視這個建置器支援的平台清單
docker buildx inspect --bootstrap | grep -A1 Platforms

# 多架構建置:一條指令、兩個架構,--load 只能單架構,多架構要 --push 進 Registry
docker buildx build --platform linux/amd64,linux/arm64 \
  -t localhost:5000/webapp:multi --push . 2>/dev/null || \
docker buildx build --platform linux/amd64,linux/arm64 -t webapp:multi .

# 單一架構要放回本機 daemon 時,用 --load
docker buildx build --platform linux/arm64 -t webapp:arm64 --load .
docker inspect webapp:arm64 --format '架構: {{.Architecture}}'
```

buildx 逐項說明：

1. `--driver docker-container`：建置在一個專用容器裡進行，這是同時建多架構的必要條件；預設的 docker 驅動只能建本機架構。
2. 非本機架構的建置靠 QEMU 模擬（第 05 章跨架構執行的同一套機制）：RUN 裡的指令真的會在模擬環境裡執行，所以多架構建置比單架構慢，是拿時間換覆蓋率。
3. `--platform` 逗號串接多架構，buildx 各建一份、自動組成一張 manifest list——第 05 章 Apple Silicon 同事的痛，從此在你手上根治。
4. 產出去向的三選一：`--push` 直接推 Registry（多架構的正規出口，第 08 章接手）、`--load` 放回本機 daemon（限單架構）、都不加則留在建置快取裡等你後續處理。
5. 用完的建置器可以 `docker buildx rm multibuilder` 收掉；日常單架構建置回預設建置器即可，不必常駐。

CI 情境還有最後一塊拼圖——**建置快取的異地存取**。CI 的建置機常常是用完即毀的拋棄式環境，本機快取每次歸零；BuildKit 允許把快取本身推到 Registry 寄放：

```bash
# 建置時把快取推去 Registry 寄放(registry 型快取,max 模式含中間層)
docker buildx build   --cache-to type=registry,ref=registry.mycorp.com/webapp:buildcache,mode=max   --cache-from type=registry,ref=registry.mycorp.com/webapp:buildcache   -t registry.mycorp.com/webapp:ci .
```

- `--cache-to` 建置完把快取層打包上傳；`--cache-from` 下次建置（哪怕在另一台全新機器）先去把快取拉回來——拋棄式建置機也能享受熱快取。
- `mode=max` 連中間階段的層都收錄，多階段建置的快取命中率最高；預設的 min 模式只存最終階段。
- 這招與 cache mount 相輔相成：cache mount 管同一台機器的下載快取，registry 快取管跨機器的層快取，CI 兩者都上才是完全體。