```
docker build -q -f Dockerfile.cmd -t lab:cmd . && \
docker build -q -f Dockerfile.entry -t lab:entry . && \
docker build -q -f Dockerfile.both -t lab:both .

# 矩陣實測:每個映像檔各跑「不帶參數」與「帶參數」兩次
docker run --rm lab:cmd
docker run --rm lab:cmd 我是覆寫指令 || true
docker run --rm lab:entry
docker run --rm lab:entry 我是附加參數
docker run --rm lab:both
docker run --rm lab:both 我換掉了預設參數
```

實測結果整理成矩陣：

|宣告方式|`docker run 映像檔`|`docker run 映像檔 參數`|
|---|---|---|
|只有 CMD|執行 CMD|**整個 CMD 被丟棄**，執行你給的參數|
|只有 ENTRYPOINT|執行 ENTRYPOINT|參數**附加**在 ENTRYPOINT 後面|
|兩者都有|ENTRYPOINT + CMD 串接執行|ENTRYPOINT 不動，**CMD 被你的參數取代**|

- 第二條實測會出錯（alpine 裡沒有「我是覆寫指令」這個執行檔）——這正是重點：run 後面接的字串取代了整個 CMD、被當成指令執行，`|| true` 只是讓示範不中斷。
- 設計哲學一句話：**ENTRYPOINT 定義「這個容器是什麼工具」，CMD 定義「不指定時的預設用法」**。像 6.3 節的寫法，換連接埠只要 `docker run webapp:full --port 9000`，主體指令動都不用動。