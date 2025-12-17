import sys
import os

# 打印当前使用的 Python 路径
print(f"当前 Python 解释器路径: {sys.executable}")

# 尝试导入我们安装的库
try:
    import fastapi
    print("FastAPI 库导入成功！")
except ImportError:
    print("FastAPI 库导入失败！请检查环境。")