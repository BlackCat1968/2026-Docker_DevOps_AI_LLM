程式逐項說明：

1. `image.history()`：SDK 版的 `docker history`，回傳每層的 `Size` 與產生它的指令 `CreatedBy`——肥層偵察的原料。
2. 只收 `Size > 0` 的層：中繼資料層沒有瘦身價值，直接過濾，對應 5.3 節 history 裡 SIZE 為 0 的列。
3. `(size, cmd)` 去重：層共用意味著同一個肥層會出現在多個映像檔的 history 裡，去重後清單才不會同一隻肥貓重複上榜。
4. 指令字串砍掉 `/bin/sh -c` 前綴並截 60 字：報表要給人看，雜訊先清乾淨。
5. `filters={"dangling": True}`：SDK 版的懸空過濾器，加總 `attrs["Size"]` 直接算出可回收空間，結尾附上行動建議——偵察機的產出是作戰清單，不是資料傾倒。
6. 執行前提：第 02 章裝過的 `docker` SDK 與執行中的 daemon；跑法 `python3 image_recon.py`。

跑完這支工具，你會對「哪個映像檔為什麼肥」有精準座標——第 06、07 章寫 Dockerfile 與瘦身時，打的就是這份清單上的目標。