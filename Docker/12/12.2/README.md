## IPv6：把容器接上下一代位址

IPv4 位址早已見底，容器平台遲早要面對 IPv6。Docker 的 IPv6 是「手動開啟」的功能：

```bash
# 步驟一:daemon.json 開總開關,並給預設 bridge 一段 v6 網段
sudo python3 - <<'EOF'
import json
path = "/etc/docker/daemon.json"
cfg = json.load(open(path))
cfg["ipv6"] = True
cfg["fixed-cidr-v6"] = "fd00:dead:beef::/48"
json.dump(cfg, open(path, "w"), indent=2, ensure_ascii=False)
EOF
sudo systemctl restart docker

# 步驟二:確認 docker0 已領到 v6 位址
ip addr show docker0 | grep inet6

# 步驟三:開一張雙棧(v4 與 v6 同時服役)的自訂網路
docker network create --ipv6 --subnet fd00:cafe::/64 dualnet

# 步驟四:實測 v6 互通與雙位址並存
docker run -d --name v6a --network dualnet nginx:alpine
docker run -d --name v6b --network dualnet alpine sleep 600
docker exec v6b ping6 -c 2 v6a
docker inspect v6a --format 'v4: {{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}} | v6: {{range .NetworkSettings.Networks}}{{.GlobalIPv6Address}}{{end}}'
```

IPv6 佈建逐項說明：

- `ipv6: true` 是總開關；`fixed-cidr-v6` 是預設 bridge 的 v6 網段。`fd00::/8` 開頭是 ULA（私有 v6 位址），角色等同 v4 的 192.168 家族——內網實驗的標準選擇，不與公網位址打架。
- 自訂網路要各自帶 `--ipv6`：開了總開關不代表每張網自動雙棧，一張一張明確宣告。
- 雙棧即 v4 與 v6 同時服役：inspect 看到兩個位址並存、名稱解析兩種記錄都回，應用想走哪條走哪條。
- `ping6`（或 `ping -6`）強制走 v6——驗收雙棧一定要分開測，v4 通不代表 v6 通，反之亦然。
- 容器對外的 v6 連線與被連（NAT66 或直路由）依機房網路而定，素材聚焦容器間 v6 互通與雙棧佈建，公網段規劃屬網路層的守備範圍。

埠對映在雙棧下的行為也驗一輪：

```bash
# 雙棧網上的服務照常 -p,主機的 v4 與 v6 入口同時開門
docker run -d --name dualweb --network dualnet -p 8088:80 nginx:alpine

# 分別走兩種協定打同一個門
curl -4 -s -o /dev/null -w "IPv4 入口:HTTP %{http_code}
" http://127.0.0.1:8088
curl -6 -s -o /dev/null -w "IPv6 入口:HTTP %{http_code}
" http://[::1]:8088

# 主機端看兩個協定的監聽並存
ss -tln | grep 8088
docker rm -f dualweb
```

- v6 位址在 URL 裡要用中括號包住（`[::1]`）再接埠號——語法規定，忘了會被解析成一串冒號災難。
- `ss` 輸出裡 v4 與 v6 各一行監聽，證明 -p 在雙棧下是「一次開兩扇門」；只想開單邊就在 -p 前綴綁定位址（如 `-p [::1]:8088:80`）。