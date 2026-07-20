```
# 崩潰才重啟,最多重試 3 次:適合批次任務
docker run -d --name crashy --restart=on-failure:3 alpine sh -c "sleep 2; exit 1"

# 觀察它的重啟次數爬升,3 次後放棄
sleep 12 && docker inspect crashy --format '重啟次數: {{.RestartCount}} | 狀態: {{.State.Status}}'

# 永遠重啟:daemon 重啟後也會拉起來,就算你手動 stop 過
docker run -d --name diehard --restart=always nginx:alpine

# 生產首選:除非被手動停止,否則永遠重啟
docker run -d --name prod-web --restart=unless-stopped nginx:alpine

# 對照:手動 stop 兩者後重啟 daemon,觀察誰復活
docker stop diehard prod-web
sudo systemctl restart docker
docker ps --format 'table {{.Names}}\t{{.Status}}'
docker rm -f crashy diehard prod-web
```
