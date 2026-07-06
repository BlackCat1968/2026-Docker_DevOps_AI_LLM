# 準備一個長駐容器
docker run -d --name web2 nginx:alpine

# exec:在容器裡「另開」一個行程,最常用來拿 shell
docker exec -it web2 sh

# ↓↓ 容器內看行程,你的 sh 與 nginx 並存,離開不影響 nginx ↓↓
ps aux
exit

# exec 也能單發指令不進 shell
docker exec web2 nginx -v

# 以 root 與指定工作目錄執行(除錯權限問題時常用)
docker exec -u root -w /etc/nginx web2 ls

# attach:接管容器「主行程」的輸入輸出
docker attach --sig-proxy=false web2