```
# 記憶體上限 200MB,swap 一併鎖死(兩值相同 = 禁用 swap)
docker run -d --name limited --memory=200m --memory-swap=200m \
  python:3.13-alpine python -c "import time
while True: time.sleep(1)"

# CPU 上限 1.5 顆核心的運算量
docker update --cpus=1.5 limited

# 行程數量上限 50,防 fork 炸彈
docker update --pids-limit=50 limited

# 驗證一:docker stats 的 MEM 上限欄位顯示 200MiB
docker stats --no-stream limited

# 驗證二:直搗 cgroup 檔案,和第 01 章看到的是同一套介面
CID=$(docker inspect limited --format '{{.Id}}')
cat /sys/fs/cgroup/system.slice/docker-$CID.scope/memory.max
cat /sys/fs/cgroup/system.slice/docker-$CID.scope/pids.max
```
