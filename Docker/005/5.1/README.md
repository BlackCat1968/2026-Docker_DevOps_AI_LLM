### 選基底就是選體質：同一個 Python 的三種身材

映像檔名字看懂了，接著看同一套軟體的不同「體質」。以 Python 官方映像檔為例：

```bash
# 拉三種體質,比大小
docker pull python:3.13
docker pull python:3.13-slim
docker pull python:3.13-alpine
docker images --format 'table {{.Repository}}	{{.Tag}}	{{.Size}}' | grep -E "python|REPOSITORY"

# 看看它們各自站在哪個基底上(history 最底層見真章)
docker history python:3.13-slim | tail -2
docker history python:3.13-alpine | tail -2
```

三種體質的取捨，玄貓直接給結論：

- **完整版（`3.13`）**：站在 Debian 完整系統上，體積約 1GB。工具齊全、相容性最好，但生產環境揹著一堆用不到的東西，攻擊面也大。
- **slim 版**：同樣是 Debian 血統但砍掉非必要套件，體積縮到約五分之一。**多數 Python 生產服務的甜蜜點**——glibc 相容性完整、體積可接受。
- **alpine 版**：站在約 5MB 的 Alpine Linux 上，最瘦。但它用 musl 取代 glibc，部分需要編譯的 Python 套件（科學運算類尤其）會裝不起來或跑得慢，選它前要先驗證相依套件。
- 本課程教學統一用 alpine 求快；你的正式專案請按上面的取捨自行選型，第 07 章瘦身術會再深入。