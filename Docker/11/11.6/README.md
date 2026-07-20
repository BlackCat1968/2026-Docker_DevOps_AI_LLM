## 精準控制：靜態 IP、自訂 DNS、主機名

```bash
# 靜態 IP:發號範圍(11.1 的 --ip-range)之外手動指定,適合「必須是固定位址」的老系統對接
docker run -d --name legacy --network appnet --ip 10.20.0.10 alpine sleep 600
docker inspect legacy --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}'

# 自訂上游 DNS 與搜尋網域:公司內部 DNS 的標準接法
docker run --rm --dns 10.0.0.53 --dns-search corp.internal alpine cat /etc/resolv.conf

# 自訂容器的主機名與額外 hosts 記錄
docker run --rm --hostname api-01 --add-host legacy-erp:10.0.0.99 alpine \
  sh -c 'hostname && grep legacy-erp /etc/hosts'
```

精準控制逐項說明：

- `--ip` 只在**自訂網路**上有效（預設 bridge 不支援），且要落在 subnet 內、避開自動發號的 ip-range——11.1 節動靜分區的規劃在此兌現。能用名字就別用靜態 IP，它的正當場景只剩「對接只認 IP 白名單的老系統」。
- `--dns` 蓋掉的是「外部查詢的上游」；容器名解析照樣走 127.0.0.11，兩者分工不衝突。
- `--add-host` 第 10 章用它接主機（host-gateway），這裡是通用形：把不在任何 DNS 裡的老古董（機房那台 ERP）寫進 hosts，容器裡的程式照樣喊名字。
- 這三招都是「例外處理」性質——正規路是自訂網路加名字解析，例外才動用它們，比例反過來就是架構有病。
- 順帶一提排查利器：懷疑容器解析行為怪異時，`docker exec 容器 cat /etc/resolv.conf` 加 `cat /etc/hosts` 兩條看完，就能分辨問題出在「上游 DNS 設錯」「hosts 被塞了怪記錄」還是「根本不在對的網上」——三種病、三種藥，先分診再開方。

---
