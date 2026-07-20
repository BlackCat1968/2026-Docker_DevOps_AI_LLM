## 盤點與清理：網路的斷捨離

```bash
# 全機網路盤點:名稱、驅動、範圍
docker network ls --format 'table {{.Name}}	{{.Driver}}	{{.Scope}}'

# 主機介面對帳:每張自訂 bridge 對應一個 br- 介面,ID 前綴對得起來
docker network ls --filter driver=bridge -q | head -3
ip link | grep -o "br-[a-f0-9]*" | sort -u

# 誰住在哪張網:一條指令攤開全機的網路住戶總表
for net in $(docker network ls -q); do
  docker network inspect $net --format '{{.Name}}: {{range .Containers}}{{.Name}} {{end}}'
done

# 清理:先確認再動手——prune 只清「零住戶」的自訂網路
docker network prune -f
docker network ls
```

盤點清理逐項說明：

- br- 後面接的是網路 ID 的前十二碼——主機上看到不認識的 br- 介面時，拿這串碼回 `docker network ls --no-trunc` 對號，馬上知道是哪張網的交換器。
- 住戶總表那個迴圈是接手舊主機的第一板斧：誰跟誰同網、哪張網是空城，一眼盡收。
- `network prune` 不會動內建三張網（bridge、host、none），也不會動有住戶的網——但「今晚零住戶」不代表「明天用不到」，排程化 prune 之前，網路請一律貼 label 供過濾。
- 單刪指定網用 `docker network rm 名稱`，有住戶會被擋下——拆除順序永遠是先遷走或移除容器、再拆網。