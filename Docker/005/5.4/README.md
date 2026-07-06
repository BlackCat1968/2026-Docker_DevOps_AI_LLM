## 5.4 開膛剖肚：把映像檔存成 tar 拆開看

映像檔在傳輸與備份時就是一個 tar 包。拆開它，第 01 章 OCI image-spec 講的 manifest、config、層通通現形：

```bash
# 建立解剖室
mkdir -p ~/image-lab && cd ~/image-lab

# 把映像檔完整打包(含所有層與中繼資料)
docker save python:3.13-alpine -o python.tar

# 拆開包裹
mkdir unpacked && tar -xf python.tar -C unpacked && ls unpacked

# 讀 OCI 佈局的入口:index.json 指向 manifest
python3 -m json.tool unpacked/index.json

# blobs 目錄:manifest、config、層通通以「內容雜湊」為檔名躺在這
ls unpacked/blobs/sha256/ | head -8

# 挑最大的一個 blob 看內容:層就是一個 tar,裡面是檔案系統片段
LARGEST=$(ls -S unpacked/blobs/sha256/ | head -1)
tar -tf unpacked/blobs/sha256/$LARGEST | head -8
```

解剖報告逐項說明：

- `docker save`：以現行的 OCI 佈局輸出——`index.json` 入口、`oci-layout` 版本宣告、`blobs/sha256/` 內容庫，正是第 01 章 image-spec 與 distribution-spec 定義的格式。
- `blobs/sha256/` 裡每個檔案的檔名就是自身內容的雜湊：manifest 是一份 JSON（列出 config 與各層的雜湊）、config 是一份 JSON（環境變數、啟動指令、層的 diff ID 清單）、層是一個 tar。
- 對層 blob 執行 `tar -tf`，列出來的是 `usr/local/bin/...` 這類路徑——**層的本質就是「檔案系統變更的 tar 存檔」**，Registry 之間推來拉去的就是這些 tar。