```
# 好寫法:6.2 節的排序——相依先行、程式碼殿後
# (就是原本的 Dockerfile,不用重寫)

# 實驗:先各建一次讓快取就位
docker build -q -f Dockerfile.bad -t webapp:bad .
docker build -q -t webapp:good .

# 改一行程式碼,模擬日常開發
sed -i 's/1.0.0/1.0.1/' app.py

# 重建兩者,計時比較
time docker build -q -f Dockerfile.bad -t webapp:bad .
time docker build -q -t webapp:good .
```

對照結果逐項解讀：

- 爛寫法：`COPY . .` 把程式碼與 requirements.txt 綁在同一層，改任何一個字都讓這層失效，**pip install 整層陪葬重跑**——改一行字等一分多鐘，開發體驗直接毀滅。
- 好寫法：requirements.txt 沒變，`COPY requirements.txt` 與 `pip install` 兩層快取命中（建置輸出顯示 CACHED），只有 `COPY app.py` 之後重做——重建以秒計。
- 排序心法：**變動頻率低的往上放、變動頻率高的往下放**。基底 → 系統套件 → 語言相依 → 程式碼，是 Python 專案的標準疊法。
- 快取失效是「內容」導向：檔案時間戳記變了但內容沒變，快取照樣命中——BuildKit 看的是雜湊，不是 mtime。

快取判定的三個扳機，背下來就能預測任何一次建置的行為：

- **指令字串變了**：Dockerfile 該行改了任何一個字元（包含註解以外的空白），該層重做。
- **COPY/ADD 的來源內容變了**：BuildKit 對來源檔案算雜湊，內容不同即失效；改權限模式也算。
- **上一層變了**：連鎖反應——前面任何一層重做，後面全部跟著重做，沒有例外。

反過來說，RUN 的快取有個要人命的盲點：**指令字串沒變，就算外部世界變了也照樣命中**。`RUN pip install requests`（不鎖版本）第一次建置裝到 2.31、半年後重建快取命中還是 2.31，你以為拿到新版其實沒有；反之 `--no-cache` 重建又突然跳版。鎖版本的 requirements.txt 讓「該不該重裝」由檔案內容決定，這正是 6.2 節排序的深層理由。

```
docker build --no-cache -q -t webapp:good . 2>&1 | head -1
```

- `.dockerignore` 的角色等同版本控制的忽略清單：`.git`、虛擬環境、快取檔不進 context，**上傳變快、快取更穩（垃圾檔變動不再誤傷 COPY 層）、機密不入鏡**。
- `.env` 一定要列進去——本機的環境變數檔一旦被 `COPY . .` 撈進映像檔，等於把密碼刻進每一層發行出去，第 19 章會示範這種洩漏怎麼被挖出來。
- 順序雷點：`.dockerignore` 放在 **context 根目錄**，跟 Dockerfile 同層，放錯位置整份靜默失效。