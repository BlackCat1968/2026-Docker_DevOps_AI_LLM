## CNM 三大物件:給第 17 章的積木正式掛牌

CNM 規格定義三個核心物件,一個不多一個不少:

- **Sandbox**:容器的**整個網路棧**——介面清單、路由表、DNS 設定、iptables 規則,全部裝在裡面。規格書明講:sandbox 的一種實作方式就是 **Linux network namespace**(另一種是 FreeBSD jail,但 Docker 在 Linux 上一律用 netns)。**第 17 章你手工 `ip netns add` 建的每一個世界,就是一個 sandbox。**一個容器永遠恰好對應一個 sandbox——這是規格書裡少數不容妥協的一對一關係,你不會遇到「一個容器兩個 sandbox」這種情況。
- **Endpoint**:把 sandbox **接上**某個網路的那個連接點——規格書講得很白:endpoint 的實作方式之一就是 **veth pair**。**第 17 章你手工建的每一對 veth,就是一個 endpoint 的實體形態。**endpoint 有個關鍵限制:一個 endpoint 只能屬於一個網路,但一個 sandbox 可以擁有多個 endpoint(範例二會實地演練)。這條「一對多」的關係正是本章要拆解的核心彈性——它讓一個容器同時活在好幾張網路裡成為可能。
- **Network**:一群**能夠直接互相通訊**的 endpoint 集合——規格書的舉例是 Linux bridge 或 VLAN。**第 17 章你手工建的 mybr0,就是一個 network 的實體形態。**network 物件本身不屬於任何容器,它是獨立存在的基礎設施——這條性質在 18.4 節會被明確驗證:容器來來去去,network 物件可以活得比任何一個掛在它上面的容器都久。

三個物件的關係用一句話串起來就是全部:**endpoint 把 sandbox 接進 network**——沒有 endpoint,sandbox 是斷網的孤島;沒有 network,endpoint 無處可接。這句話對照第 17 章範例三你搭的拓撲:兩個 netns(sandbox)、四條 veth 半邊(兩對 endpoint)、一座 bridge(network)——CNM 的三大物件,你在動手實作那一刻已經全部建過一輪,只是當時還沒有名字。

> **NOTE** 延伸知識:CNM 規格書裡還定義了一個常被忽略的角色——**network controller**,它是 libnetwork 內部的調度中樞,負責管理所有已註冊的驅動、記錄所有 network 與 sandbox 物件、並在使用者呼叫 `docker network create` 這類指令時,決定要把這個請求轉交給哪個驅動處理。你可以把它想成郵局的分信窗口:信(操作請求)進來,依地址(驅動名稱)分到對的信差(驅動)手上處理——三大物件是規格書的主角,network controller 是幕後那個讓角色們各安其位的導演。

> **NOTE** 常見誤解:「CNM 是 Docker 專屬的技術規格,只在 Docker 裡有效。」CNM 是**設計文件**,不是某段程式碼——libnetwork 是它的參考實作,但規格本身刻意保持與底層技術無關(sandbox 可以是 netns 也可以是 jail、network 可以是 bridge 也可以是 VLAN)。這正是為什麼 CNM 能同時撐起 bridge 驅動與 overlay 驅動:兩者的**規格介面**相同(都要生出可運作的 sandbox/endpoint/network),**底層實作**天差地遠——第 21 章的 overlay 網路會證明這件事。可以把 CNM 想成一份介面定義(interface),各家驅動則是實作這份介面的不同類別(class)——物件導向設計裡「面向介面編程」的精神,原封不動搬進了容器網路的世界。

### 範例一:觀察與查詢——在 `docker network` 家族裡認出三大物件

**Step 1:列出主機上現有的網路——這是 network 物件的清單。**

```bash
docker network ls
```

```
NETWORK ID     NAME      DRIVER    SCOPE
6f60ea0df1ba   bridge    bridge    local
b3143542e9ed   none      null      local
323e5e3be7e4   host      host      local
```

每一行都是一個 network 物件:有自己的 ID、名字、由哪個驅動實作(DRIVER 欄)、作用範圍(SCOPE——local 表示只在這台主機有效,第 21 章你會看到 swarm scope)。這三個網路是 daemon 啟動時就自動建好的「開箱即用」網路,對應下一節表格裡三種最基本的驅動(bridge、none、host)——你在第 17 章手工重建的正是第一個(bridge),第 18.3 節會把另外兩個的用途補齊。

**Step 2:深入預設的 bridge 網路,看它記錄了哪些 endpoint。**

```bash
docker network inspect bridge --format '{{json .Containers}}' | python3 -m json.tool
```

這條指令的 `--format` 搭配 `.Containers` 是刻意的取巧:完整的 `docker network inspect bridge` 輸出動輒上百行,把感興趣的欄位單獨抽出來,才看得清楚這一節真正想講的東西——這個習慣本身也值得抄走,任何 inspect 類指令面對龐大輸出時,先想清楚要看哪個欄位,再決定要不要整份印出來。

```json
{
    "e8a05afba623...": {
        "Name": "web1",
        "EndpointID": "9c2c3a...",
        "MacAddress": "02:42:ac:11:00:02",
        "IPv4Address": "172.17.0.2/16"
    }
}
```

每一個容器在這裡都是一條 endpoint 紀錄——**EndpointID 是這個 endpoint 物件自己的身分證**,與容器 ID 是兩個不同的東西(一個容器可以有多個 endpoint,第五節就會證明)。

**Step 3:回頭看容器自己的視角——它記得自己接在哪個 sandbox、有哪些 endpoint。**

```bash
docker inspect web1 --format '{{.NetworkSettings.SandboxID}}'
# 712f8a477cce...(第 17 章你已經用過這串,只是那次叫 SandboxKey 的檔案路徑)
docker inspect web1 --format '{{json .NetworkSettings.Networks}}' | python3 -m json.tool
```

```json
{
    "bridge": {
        "EndpointID": "9c2c3a...",
        "Gateway": "172.17.0.1",
        "IPAddress": "172.17.0.2",
        "MacAddress": "02:42:ac:11:00:02",
        "NetworkID": "6f60ea0df1ba..."
    }
}
```

三個 ID 同時出現在這份輸出裡:SandboxID(這個容器的網路世界)、EndpointID(它與 bridge 網路之間的那條線)、NetworkID(它接的是哪張網)——**CNM 的三大物件,在這一份 JSON 裡三個身分證同框**。

**Step 4:對照第 17 章——用同一把鑰匙開同一扇門。**

```bash
docker inspect web1 --format '{{.NetworkSettings.SandboxKey}}'
# /var/run/docker/netns/712f8a477cce
sudo ip netns exec 712f8a477cce ip addr show eth0
```

**逐項詳解:**

- `docker network ls` 的 SCOPE 欄位是本章埋下的第一顆種子:local 網路的 endpoint 只能給同一台主機的容器用;第 21 章的 overlay 網路 SCOPE 是 swarm——**同一套三物件模型,SCOPE 換了,就能撐起跨主機的網路**,這是 CNM 抽象層次夠高的證明。
- `NetworkSettings.Networks` 是個**字典**而非陣列:鍵是網路名稱——這個資料結構本身就在暗示「一個容器可以同時接多個網路」,每接一個就多一個鍵、多一個 endpoint,範例二會把這件事做出來給你看。
- SandboxID 與 SandboxKey 是兩個不同概念不要混淆:**ID** 是這個 sandbox 物件在 libnetwork 帳本裡的身分證(一串雜湊),**Key** 是它在檔案系統上的實際路徑(給 `ip netns exec` 用的)——一個是給程式辨識用的抽象識別碼,一個是給系統呼叫用的具體位址,分工與第 04 章映像檔的 digest(身分)跟 layer 路徑(實體位置)是同一種二元性。
- Step 4 證明的事情最關鍵:**CNM 不是額外多蓋的一層抽象、蓋住了第 17 章的機制**——它就是那些機制本身,只是換了規範化的名字。你在第 17 章用 `ip netns exec` 開的門,與 Docker daemon 內部開的是同一扇門。
- 這裡也解答了一個常被問到的問題:「為什麼 `docker inspect` 裡容器的網路資訊要拆成兩處看(NetworkSettings.Networks 與 network inspect 的 Containers)?」答案在 CNM 的物件關係裡——**endpoint 同時被 sandbox 與 network 兩邊記錄**,容器視角看到的是「我加入了哪些網路」,網路視角看到的是「誰加入了我」,兩份帳本各自維護、互相參照,任何一邊出問題都能拿另一邊對帳。