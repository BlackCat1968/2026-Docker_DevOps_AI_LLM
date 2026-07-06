## 建置除錯：食譜寫壞了怎麼查

```bash
# 故意寫壞一行,體驗建置失敗的判讀
docker build -f Dockerfile.broken -t webapp:broken . ; echo "建置結束碼: $?"

# 檢視完整建置過程(BuildKit 預設摺疊輸出,--progress=plain 全展開)
docker build --progress=plain -f Dockerfile.broken -t webapp:broken . 2>&1 | tail -8

# 修好之後,強制全部重做一次(懷疑快取汙染時的殺手鐧)
docker build --no-cache -q -t webapp:good .
```

- 失敗訊息會指名「第幾條指令、什麼錯誤」——上例是 requirement.txt 打錯字（少個 s），pip 噴找不到檔案，建置結束碼非 0，CI 流水線靠這個結束碼亮紅燈。
- `--progress=plain`：把 BuildKit 摺疊起來的每一行輸出攤開，RUN 裡指令的完整輸出都在，除錯必開。
- `--no-cache`：無視所有快取從頭蓋。用在「懷疑快取殘留舊狀態」的場合，例如 RUN 裡有 `apt-get update` 這種結果會隨時間變的指令。
- 進階技巧：建置在某一層失敗時，把 Dockerfile 暫時截到失敗行之前建出映像檔，`docker run -it` 進去手動執行失敗的指令，現場重現、現場修——比反覆改檔重建快得多。

### 建置完的驗收五步：交件前的固定儀式

每次建置完成，玄貓固定跑這五步再交件：

```bash
# 一:大小與層數體檢
docker images webapp:1.0 --format '大小: {{.Size}}'
docker history webapp:1.0 --format '{{.Size}}	{{.CreatedBy}}' | head -6

# 二:出廠設定核對(指令、使用者、工作目錄)
docker inspect webapp:1.0 --format 'Cmd: {{.Config.Cmd}} | User: {{.Config.User}} | WorkDir: {{.Config.WorkingDir}}'

# 三:冒煙啟動與端點驗證
docker run -d --rm --name smoke -p 8000:8000 webapp:1.0
sleep 2 && curl -sf http://localhost:8000/healthz && echo " ← 健康檢查通過"

# 四:訊號體檢(該秒停的就要秒停)
time docker stop smoke

# 五:垃圾掃描(可寫層不該有東西被寫入)
docker run -d --name diffcheck webapp:1.0 && sleep 2
docker diff diffcheck | head -5
docker rm -f diffcheck
```

- 五步各對應本章一個知識點：層結構（快取排序）、config（指令精讀）、0.0.0.0（連線雷）、exec form（訊號）、可寫層潔癖（第 04 章 diff 的回收）。
- 把這五步寫成 shell 腳本放進專案，就是最陽春的映像檔驗收關卡——第 16 章 CI/CD 會把它升級成自動閘門。