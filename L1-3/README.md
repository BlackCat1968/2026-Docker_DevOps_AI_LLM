## 1-3　把最小的 Python 腳本容器化

詳細解釋：

1. `FROM python:3.13-slim`：指定基底映像檔。官方的 `python:3.13-slim` 已經幫你裝好 Python 3.13，`slim` 版本把不必要的東西砍掉，體積小很多。**這一行等於決定了容器裡的 Python 版本**，不是看你自己主機的版本。
2. `WORKDIR /app`：把容器內的工作目錄設成 `/app`（不存在會自動建立）。之後的 `COPY`、`CMD` 都以這裡為基準，路徑比較乾淨。
3. `COPY app.py .`：把你主機上的 `app.py` 複製進容器的 `/app/`（`.` 就是目前的 `WORKDIR`）。build 出來的映像檔就內含這支程式了。
4. `CMD ["python", "app.py"]`：設定容器「開機預設要跑的指令」。這裡用的是陣列寫法（exec form），Docker 會直接執行 `python app.py`，不經過額外的 shell，訊號處理比較乾淨。

現在 build 並執行：

```bash
docker build -t hello-py:1.0 .
docker run --rm hello-py:1.0
```

詳細解釋：

1. `docker build`：啟動建置流程，讀取當前資料夾裡的 `Dockerfile`。
2. `-t hello-py:1.0`：幫這個映像檔取名字（tag）。冒號前面是名稱 `hello-py`、後面是版本 `1.0`。取好名字之後才方便 run、方便管理。
3. 結尾那個 `.`：指定「建置情境（build context）」是當前目錄，也就是告訴 Docker「要複製的檔案從這裡找」。很多人漏掉這個點，記得它一定要有。
4. `docker run --rm hello-py:1.0`：拿剛 build 好的映像檔跑一個容器，跑完自動刪除。你會在螢幕上看到那三行輸出。

> Tip：tag 千萬不要只寫名字不寫版本。不寫版本時 Docker 會自動補成 `:latest`，而 `latest` 會隨著你每次重 build 一直被覆蓋，日後根本分不清哪個是哪個。養成 `名稱:版本` 的習慣，未來的你會感謝現在的你。