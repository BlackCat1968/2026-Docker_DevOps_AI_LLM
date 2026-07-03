import sys
import platform

print("哈囉，我是在容器裡跑的 Python！")
print(f"Python 版本：{sys.version.split()[0]}")
print(f"作業系統平台：{platform.platform()}")