## 應用層重試：健壯性的另一半

健康檢查解決「啟動時的等待」，但執行期依賴隨時可能短暫斷線（資料庫重啟、網路抖動）。健壯的應用要在程式碼裡做連線重試：

```python
# db.py：帶指數退避重試的資料庫連線
import os
import time

import psycopg


def connect_with_retry(max_retries: int = 5, base_delay: float = 1.0):
    """建立資料庫連線,失敗時以指數退避重試"""
    dsn = os.environ["DATABASE_URL"]  # 從環境變數取連線字串(第 13 章的鐵律)

    for attempt in range(1, max_retries + 1):
        try:
            # 嘗試建立連線,成功就回傳
            conn = psycopg.connect(dsn, connect_timeout=3)
            print(f"第 {attempt} 次嘗試:連線成功")
            return conn
        except psycopg.OperationalError as e:
            # 連線類錯誤才重試,其他錯誤(如密碼錯)直接拋出不浪費重試次數
            if attempt == max_retries:
                print(f"重試 {max_retries} 次仍失敗,放棄")
                raise
            # 指數退避:等待時間隨次數翻倍(1、2、4、8 秒),避免瘋狂重連打爆對方
            delay = base_delay * (2 ** (attempt - 1))
            print(f"第 {attempt} 次失敗({e}),{delay} 秒後重試")
            time.sleep(delay)


if __name__ == "__main__":
    conn = connect_with_retry()
    # 連上後做一次簡單查詢驗證
    with conn.cursor() as cur:
        cur.execute("SELECT version()")
        print("資料庫版本:", cur.fetchone()[0][:30])
    conn.close()
```

程式逐行說明：

1. `connect_with_retry(max_retries, base_delay)`：把重試邏輯包成函式，參數化重試次數與基礎延遲，方便不同場景調整。
2. `os.environ["DATABASE_URL"]`：連線字串走環境變數，與 Compose 注入的環境無縫接軌（第 13 章）。
3. `for attempt in range(1, max_retries + 1)`：最多嘗試 max_retries 次，attempt 從 1 數起讓訊息好讀。
4. `psycopg.connect(dsn, connect_timeout=3)`：實際連線，`connect_timeout=3` 避免單次連線卡死拖垮整個重試節奏。
5. `except psycopg.OperationalError`：**只攔連線類錯誤**——密碼錯、SQL 錯這類非連線問題不該重試（重試也沒用），直接讓它拋出，省下重試次數。
6. `delay = base_delay * (2 ** (attempt - 1))`：**指數退避**的核心——等待時間 1、2、4、8 秒逐次翻倍。若每次都固定間隔猛連，反而會在對方恢復的瞬間被一堆重連打垮（驚群效應），退避讓壓力平滑。
7. `if attempt == max_retries: raise`：用盡重試仍失敗就拋出例外，讓上層決定怎麼處理（記錄、告警、放棄啟動）——不吞掉錯誤是負責任的作法。

驗證重試機制的威力：

```bash
# 需要 psycopg,加進 requirements.txt
echo "psycopg[binary]==3.2.3" >> requirements.txt

# 場景:db 還沒起,web 的重試邏輯撐過空窗期
docker compose up -d db
# 立刻在 web 容器裡跑重試腳本(db 可能還在初始化,正好考驗重試)
docker compose run --rm web python db.py
```

- 你會看到腳本印出「第 1 次失敗、2 秒後重試 → 第 2 次成功」之類的過程——重試邏輯把「啟動空窗」這種暫時性故障吸收掉了。
- **健康檢查 + 應用重試的雙保險**：前者讓 Compose 盡量在依賴就緒後才啟動，後者讓應用在依賴突然消失時能自己撐過去。兩者都不是備胎、而是互補——這是玄貓看待「服務健壯性」的完整框架。