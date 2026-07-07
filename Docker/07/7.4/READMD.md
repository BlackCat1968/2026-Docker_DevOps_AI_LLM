### --target：一份 Dockerfile 養出開發、測試、正式三胞胎

多階段還有第二個殺手用途：**把階段當成建置目標**，一份檔案產出多種用途的映像檔：

```bash
FROM python:3.13-slim AS base
WORKDIR /app
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH" PYTHONUNBUFFERED=1
COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install -r requirements.txt

FROM base AS dev
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install pytest==8.3.4 httpx==0.28.1
COPY . .
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

FROM base AS test
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install pytest==8.3.4 httpx==0.28.1
COPY . .
CMD ["pytest", "-q"]

FROM python:3.13-slim AS prod
RUN useradd --create-home --shell /usr/sbin/nologin appuser
COPY --from=base /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH" PYTHONUNBUFFERED=1
WORKDIR /app
COPY --chown=appuser:appuser app.py .
USER appuser
EXPOSE 8000
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]

# 各取所需:--target 指定要建到哪個階段為止
docker build -f Dockerfile.multi --target dev  -t webapp:dev .
docker build -f Dockerfile.multi --target prod -t webapp:prod .

# 三胞胎體檢:開發版有 pytest、正式版沒有
docker run --rm --entrypoint pip webapp:dev  list 2>/dev/null | grep -i pytest || true
docker run --rm --entrypoint pip webapp:prod list 2>/dev/null | grep -i pytest || echo "正式版查無 pytest,乾淨"
docker images --format 'table {{.Repository}}:{{.Tag}}\t{{.Size}}' | grep -E "webapp:(dev|prod)"
```

三胞胎架構逐項說明：

1. `FROM ... AS base`：共同地基——venv 與正式相依套件裝一次，dev 與 test 都 `FROM base` 繼承，套件不重複安裝、快取共用。
2. dev 階段加測試工具與 `--reload`（改檔自動重載，開發體驗），test 階段的 CMD 直接是 pytest——CI 跑測試就 build --target test 然後 run，映像檔即測試環境。
3. prod 階段回到 7.2 節的精實路線：從 base 只搬 venv、換乾淨基底、非特權使用者。
4. `--target` 只建到指定階段，不會多做後面的工。沒指定時預設建到最後一個階段——**把 prod 放最後**是刻意的：手滑忘了 --target，拿到的至少是正式版而不是帶著滿身測試工具的開發版。
5. 一份檔案三種產出的維護紅利：地基改一次、三胞胎同步生效，不會出現「開發版修了、正式版忘了」的分家慘劇。