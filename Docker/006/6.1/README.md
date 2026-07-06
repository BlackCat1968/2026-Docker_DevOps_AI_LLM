## 6.1 建置的運作模型：context、指令、層

先建立心智模型再動手：

- **build context**：你在 `docker build` 最後指定的那個目錄（通常是 `.`）。整個目錄會被打包送給建置引擎，`COPY` 只能拿 context 裡面的東西——context 之外的檔案，建置過程根本看不到。
- **BuildKit**：現行的建置引擎（第 02 章五件套裡的 buildx 外掛就是它的介面），平行處理、聰明快取都是它的本事，第 07 章火力全開。
- **一條指令一層**：`RUN`、`COPY`、`ADD` 這類會改動檔案系統的指令各蓋一層；`ENV`、`LABEL`、`CMD` 這類只改中繼資料的，反映在 config 裡（第 05 章 history 中 SIZE 為 0 的那些列）。

context 的邊界感用一個小實驗建立：

```bash
# 建一個放在 context 之外的檔案,證明 COPY 拿不到它
mkdir -p ~/outside && echo "外面的世界" > ~/outside/secret.txt
mkdir -p ~/ctx-lab && cd ~/ctx-lab

cat > Dockerfile <<'EOF'
FROM alpine
COPY ../outside/secret.txt /tmp/
EOF

docker build -t lab:ctx . ; echo "結束碼: $?"
```

- 建置直接失敗：COPY 的來源路徑不准指到 context（`.`）之外，`../` 這種越界寫法會被擋下。這不是限制而是保護——build context 是建置的沙盒邊界，映像檔的內容來源被鎖定在一個可稽核的目錄裡。
- 真的要用到外部檔案，正解是調整 context 範圍（把 build 指令的最後一個參數指到更上層目錄，搭配 `-f` 指定 Dockerfile 位置），而不是搬檔案繞路。
- 收尾：`cd ~ && rm -rf ~/ctx-lab ~/outside`。

順帶一提，context 不一定是本機目錄——直接拿 Git 儲存庫當 context 也行：

```bash
# 直接建置遠端儲存庫(BuildKit 會自己 clone,#後面指定分支或標籤)
docker build -t remote-demo https://github.com/docker/getting-started.git#main 2>&1 | tail -2
```

- CI 環境與「快速試建別人專案」時特別好用，本機連 clone 都省了；私有庫則需要憑證設定，屬第 16 章的守備範圍。