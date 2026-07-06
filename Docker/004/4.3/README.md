# 溫柔停止:先送 SIGTERM,寬限期後仍不走才補 SIGKILL(預設寬限 10 秒)
docker stop web1

# 指定寬限期為 30 秒,給應用更多收尾時間
docker start web1 && docker stop -t 30 web1

# 粗暴終結:直接送 SIGKILL,行程沒有任何反應機會
docker start web1 && docker kill web1

# kill 也能送自訂訊號,例如要 nginx 重新載入設定
docker start web1 && docker kill --signal=HUP web1

# 驗屍:看結束碼判斷死法
docker stop web1
docker inspect web1 --format '結束碼: {{.State.ExitCode}}'