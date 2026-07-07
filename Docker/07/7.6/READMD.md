### 瘦身偵察：層級分析工具

瘦身要打得準，先看清楚肥肉長在哪一層：

```bash
# 內建武器:history 配自訂格式,大小與指令並排
docker history webapp:fat --format 'table {{.Size}}\t{{.CreatedBy}}' | head -8

# 第三方神器 dive:互動式逐層檢視,連「哪些檔案在浪費空間」都指給你看
# Ubuntu 安裝
DIVE_VERSION=$(curl -s https://api.github.com/repos/wagoodman/dive/releases/latest | grep tag_name | cut -d '"' -f4)
curl -fsSL "https://github.com/wagoodman/dive/releases/download/${DIVE_VERSION}/dive_${DIVE_VERSION#v}_linux_amd64.deb" -o /tmp/dive.deb
sudo apt install -y /tmp/dive.deb

# macOS 安裝
brew install dive

# 逐層解剖:左側層清單、右側該層檔案樹,PageUp/Down 換層、Tab 切窗、Ctrl-C 離開
dive webapp:fat

# CI 模式:不開介面,直接給效率評分與浪費空間,低於門檻回傳非零
CI=true dive webapp:slim
```

工具逐項說明：

1. `history` 是快篩：十秒鎖定「哪條指令蓋出最肥的層」，配第 05 章的偵察機腳本可以全機掃描。
2. dive 是精查：它把每一層的檔案樹攤開，還會標出「這一層改了哪些檔案」與「重複或被覆蓋而浪費的空間」——例如你會親眼看到 fat 版裡 gcc 工具鏈佔掉的那一大坨。
3. `CI=true` 模式輸出映像檔效率百分比與浪費位元組數，可設定門檻讓不及格的映像檔直接擋在流水線——瘦身從美德變成制度。
4. 判讀重點兩個：單層特別肥的，回 Dockerfile 找那條指令動刀；「wasted space」很高的，通常是同一路徑在多層被反覆寫入（先 COPY 再 chown 的老毛病就會在這現形）。

### 刀法優先順序：一張決策表治選擇困難

面對一個肥映像檔，下刀順序照這張表走，投報率由高到低：

|順位|刀法|典型收益|出手時機|
|---|---|---|---|
|1|多階段建置|砍五到七成|映像檔含任何建置工具或中間產物|
|2|基底換 slim|砍數百 MB|還站在完整版基底上|
|3|合併 RUN 與同層清理|砍數十到數百 MB|history 出現「下載後另層刪除」|
|4|.dockerignore 補洞|視垃圾量|context 明顯肥大或快取常誤失效|
|5|cache mount|省時間不省空間|重建頻繁、下載重複|
|6|小刀戰術包|各省幾個百分點|前五刀都下完之後|

- 第五刀特別標注：cache mount 的收益是**建置時間**而非映像檔體積，別放錯期待。
- 換 alpine 沒有進榜——它的收益要跟 musl 相容性風險對沖（第 05 章的選型結論），屬於「評估後選用」而不是「無腦照做」的刀。

**Tips and Tricks（秘訣）**

> 決策表不必背，抓住主軸即可：先多階段、基底選 slim 或 distroless、apt 快取用 cache mount、機密用 secret mount。九成的瘦身需求這四招就解決。

### 收官檢核：瘦身戰力盤點

離開本章前逐項自測：

- 把單階段 Dockerfile 改造成多階段，並用 images 大小與 which gcc 兩項證據驗收。
- 說出 venv 在多階段裡的真正角色（自包含搬運單位）。
- 寫出 pip 的 cache mount 語法，並設計三輪計時實驗證明它生效。
- 分辨層快取、cache mount、bind mount 三者各解決什麼問題。
- 用 --target 從同一份 Dockerfile 建出 dev 與 prod，驗證測試工具只在 dev。
- 用 buildx 建出雙架構映像檔並各自驗證 uname -m。
- 用 dive 指出一個映像檔的最肥層與 wasted space 來源，並提出對應刀法。