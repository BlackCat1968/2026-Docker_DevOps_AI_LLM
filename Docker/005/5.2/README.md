## 5.2 拉取、貼標與盤點

```bash
# 拉指定標籤
docker pull python:3.13-alpine

# 一份映像檔可以貼多張便利貼:替它加上自家 Registry 的名字與版本
docker tag python:3.13-alpine registry.mycorp.com/base/python:3.13
docker tag python:3.13-alpine registry.mycorp.com/base/python:stable

# 盤點:三個名字、同一個 IMAGE ID
docker images --format 'table {{.Repository}}\t{{.Tag}}\t{{.ID}}\t{{.Size}}' | grep -E "python|REPOSITORY"

# 只拉中繼資料不落地整包:確認遠端有哪些架構版本(下一節主角)
docker manifest inspect python:3.13-alpine | head -20
```

指令逐項說明：

- `docker tag 來源 新名字`：零複製動作，只是在同一個映像檔 ID 上多掛一個名字。三個名字共用同一份層資料，磁碟只佔一份。
- `--format 'table ...'`：延續第 04 章的 Go 樣板技巧，欄位自己挑，眼睛不用在雜訊裡游泳。
- `manifest inspect` 不下載映像檔本體，只抓遠端的清單（manifest），適合部署前先「隔空驗貨」。
- SIZE 欄位是「解壓後」的大小；拉取時看到的進度條是「壓縮傳輸」的大小，兩者對不上是正常的。

映像檔的「出廠設定」全部寫在中繼資料裡，開跑前先驗明正身：

```bash
# 一口氣精讀四項出廠設定
docker inspect python:3.13-alpine --format '預設指令: {{.Config.Cmd}}
進入點: {{.Config.Entrypoint}}
環境變數: {{range .Config.Env}}{{println .}}{{end}}工作目錄: {{.Config.WorkingDir}}'

# 重複 pull 已存在的標籤:daemon 只比對遠端 digest,有差才下載差異層
docker pull python:3.13-alpine
```

- `Cmd` 與 `Entrypoint` 決定「不給參數時容器跑什麼」，兩者的分工與互動是第 06 章的重頭戲，這裡先學會查。
- 重複 pull 的輸出若是 `Image is up to date`，代表本機 digest 與遠端一致、零下載；tag 被重貼過才會觸發差異層下載——pull 永遠是增量的，不會傻傻重抓整包。