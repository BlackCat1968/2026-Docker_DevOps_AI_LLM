## 開一個自己的社區：docker network create

先回答「為什麼幾乎永遠該開自訂網路而不是用預設 bridge」，四個理由：

- **有 DNS**：名字互通，設定檔不再綁 IP（本章主軸）。
- **隔離可設計**：一主機多網，社區之間天然不相通；預設 bridge 是所有人擠一間大通舖。
- **可熱插拔**：connect／disconnect 隨時調整歸屬；預設 bridge 的容器要換網得砍掉重練。
- **參數可治理**：網段、發號範圍、標籤全在你手上，跟公司網路規劃對得起來。

一句話總結：預設 bridge 是「相容老行為的遺產」，自訂網路才是日常正解——連官方文件都這麼建議。

```bash
# 最簡開法:一條指令,其餘全自動
docker network create mynet

# 講究開法:自訂網段、閘道、發號範圍,並貼標籤治理
docker network create \
  --driver bridge \
  --subnet 10.20.0.0/24 \
  --gateway 10.20.0.1 \
  --ip-range 10.20.0.128/25 \
  --label team=backend \
  appnet

# 盤點與體檢
docker network ls
docker network inspect appnet --format '網段: {{range .IPAM.Config}}{{.Subnet}} 閘道: {{.Gateway}}{{end}}'

# 主機端看得到:每張自訂網路就是一台新的虛擬交換器
ip link | grep br- 
```

指令逐項說明：

- `--driver bridge` 是預設值，寫出來是為了讓你知道：自訂網路與 docker0 同一種血統，只是**每張網一台獨立交換器**（主機上那些 `br-` 開頭的介面就是它們本人）。
- `--subnet` 自訂網段：跟公司內網錯開（第 10 章 VPN 血案的預防針）；不指定就從 default-address-pools 的池子裡自動切。
- `--ip-range` 把「自動發號」限縮在網段的一半（10.20.0.128 起），前半段留給 11.6 節的靜態 IP 使用，動靜分區、永不撞號。
- `--label`：第 04 章的標籤治理延伸到網路層，`docker network ls --filter label=team=backend` 就能分組盤點。
- `--gateway` 通常不必指定，Docker 自動取網段第一個位址；明寫是讓網路規劃文件與實況一字不差。