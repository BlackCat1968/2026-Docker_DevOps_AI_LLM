## Dockerfile.cached

1. `RUN --mount=type=cache,target=/root/.cache/pip`：在**這條 RUN 執行期間**，把一塊由 BuildKit 管理的持久快取目錄掛到 pip 的預設快取位置。
2. 關鍵性質：這塊快取**不屬於任何層**——它活在建置引擎的口袋裡，跨建置、跨映像檔共用，但絕不會被打進映像檔。所以這裡的 pip 不需要（也不應該）加 `--no-cache-dir`：我們要 pip 盡量用快取，反正快取不會進貨。
3. 層快取與 cache mount 的分工：層快取管「這一層要不要重做」，cache mount 管「重做的時候，下載這種重複苦工能不能跳過」。兩者疊加，改需求清單的重建從「全部重下載」變成「只下載新增的」。
4. 同樣的招式適用所有套件管理器：apt 掛 `/var/cache/apt`、npm 掛 `/root/.npm`，目標路徑換成該工具的快取位置即可。
5. 快取本體的管理：`docker builder du` 看佔用、`docker builder prune` 清空——它不在 images 清單裡，別找錯地方。

**盤點與清理建置快取(cache mount 與層快取都在這)**

docker builder du | tail -3

## Dockerfile.bindmount

1. `type=bind`：把 context 的檔案唯讀掛進這條 RUN 的執行環境，用完即還——映像檔裡**不會**留下這個檔案，連 COPY 那一層都省了。適合「只在安裝當下需要、之後不需要」的檔案，requirements.txt 正是典型。
2. 驗證那條指令證明了借用的本質：容器裡查無此檔，但套件確實裝好了。
3. `type=secret`：建置期臨時掛入機密（私有套件庫的憑證之類），同樣不落層、連 history 都不留痕——它是第 19 章供應鏈安全的主角之一，這裡先認得名字，別再用 ARG 傳密碼了。