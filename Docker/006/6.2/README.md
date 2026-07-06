1. `FROM python:3.13-slim`：站上第 05 章選型結論的甜蜜點基底——glibc 相容、體積可控。每份 Dockerfile 的第一條有效指令必是 FROM。
2. `WORKDIR /app`：設定之後所有指令的工作目錄，目錄不存在會自動建立。用它取代滿地的 `cd`，路徑心智負擔歸零。
3. `COPY requirements.txt .`：先只複製相依清單——**這行的位置是本章最重要的一行**，理由在 6.5 節的快取法則揭曉。
4. `RUN pip install --no-cache-dir -r requirements.txt`：在建置期執行安裝，產出一個「裝好所有套件」的層。`--no-cache-dir` 叫 pip 不要留下載快取，映像檔直接瘦一圈——容器層裡的 pip 快取只會佔空間，永遠用不到。
5. `COPY app.py .`：程式碼最後才進來，天天改的東西放最下層。
6. `EXPOSE 8000`：純文件性質的中繼資料，向使用者宣告「本服務聽 8000」；它**不會**真的開放連接埠，對外開門是 `docker run -p` 的工作（第 10 章詳解）。
7. `CMD [...]`：容器的預設啟動指令。**必須綁 `--host 0.0.0.0`**——預設的 127.0.0.1 只聽容器自己的迴環介面，主機轉進來的流量會被拒於門外，這是容器化 Web 服務的第一大雷。
8. CMD 用的是**中括號 JSON 陣列寫法（exec form）**：行程直接成為 PID 1、訊號直達。第 04 章的訊號黑洞就是 shell form 惹的禍，本章給根治寫法，6.4 節專門對照。


# 建置:-t 貼名字,最後的 . 就是 build context
docker build -t webapp:1.0 .

# 執行:把主機 8000 轉進容器 8000
docker run -d --name web --rm -p 8000:8000 webapp:1.0

# 驗收三連:根路徑、健康端點、容器日誌
curl -s http://localhost:8000/
curl -s http://localhost:8000/healthz
docker logs web | tail -3

# 回收第 05 章技能:看看這份映像檔被蓋了幾層、各層多大
docker history webapp:1.0