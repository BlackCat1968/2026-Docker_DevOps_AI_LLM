5.6 多架構映像檔：一個名字、多種 CPU

第 02 章 Apple Silicon 的 `no matching manifest` 之謎，root cause 在這：

```bash
# 看 manifest list:同一個標籤底下,各架構各有一份 manifest
docker manifest inspect python:3.13-alpine | python3 -c "
import json, sys
data = json.load(sys.stdin)
for m in data.get('manifests', []):
    p = m['platform']
    print(f\"{p['os']}/{p['architecture']}{'/' + p.get('variant','') if p.get('variant') else ''}\")"

# 平常 pull 會自動挑符合本機架構的那份;要跨架構就明講
docker pull --platform linux/amd64 python:3.13-alpine
docker pull --platform linux/arm64 python:3.13-alpine

# 確認拉下來的架構
docker inspect python:3.13-alpine --format '架構: {{.Architecture}}'
```

- 標籤指向的可以不是單一 manifest，而是一張 **manifest list**（多架構索引）：daemon 拉取時比對本機 `os/architecture`，自動挑對的那份下載——這就是同一條 `docker pull` 在 Mac 與 x86 伺服器上各拉各的原因。
- 清單裡沒有你的架構時，就是第 02 章那個出錯訊息；`--platform` 可以強拉別的架構靠轉譯硬跑，但那是急救不是常態。
- 第 07 章 buildx 會教你「一次建置、產出整張 manifest list」，讓自家映像檔也能 Mac 與伺服器通吃。

跨架構不只能拉、還能直接跑，親測體感差異：

```bash
# 在本機執行「非本機架構」的容器,印出容器眼中的架構
docker run --rm --platform linux/amd64 alpine uname -m
docker run --rm --platform linux/arm64 alpine uname -m

# 對照主機本尊的架構
uname -m
```

- 兩條輸出分別是 x86_64 與 aarch64——同一台機器、兩種架構的容器都跑得動。非原生的那份靠模擬層轉譯：macOS 的 Docker Desktop 內建 Rosetta 或 QEMU；Ubuntu 主機要先裝好 binfmt 模擬支援才跑得起非原生架構。
- 轉譯執行的代價是效能（CPU 密集工作可能慢數倍）與相容性（少數系統呼叫行為有差），定位是「應急與測試」，不是常態部署。
- 它真正的價值在第 07 章：buildx 靠同一套模擬機制，讓一台建置機吐出多架構映像檔。