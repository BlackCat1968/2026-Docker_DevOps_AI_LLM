docker build -q -f Dockerfile.run-bad -t lab:run-bad .
docker build -q -f Dockerfile.run-good -t lab:run-good .

# 成績單:比較兩者大小與層結構
docker images --format 'table {{.Repository}}:{{.Tag}}	{{.Size}}' | grep run-
docker history lab:run-bad | head 

對照逐項解讀：

- 層是唯讀且只增不減的（第 05 章鐵律）：爛寫法第三條 RUN 的 `rm -rf` 只是在新層「標記刪除」，apt 索引檔實體仍躺在第一層裡，**體積一克都沒少**——images 的大小對比就是鐵證。
- 好寫法在**同一層內**下載、安裝、清理，垃圾從未落地成層，映像檔實實在在瘦下來。
- `--no-install-recommends`：叫 apt 別順手裝一堆「建議套件」，Debian 系瘦身的固定招式。
- `update` 與 `install` 同層還躲開第 04 章陷阱四的過期索引問題，一石二鳥。
- 續行的 `&& \` 寫法讓每個動作獨立一行、好讀好審查；任一步失敗整條 RUN 失敗，不會出現「裝到一半的層」。