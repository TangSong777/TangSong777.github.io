---
title: 'Python文件操作学习（已归档）'
date: '2026-08-17T16:01:44+08:00'
updated: '2026-08-24T17:12:02+08:00'
layout: page
type: siyuan-note
notebook: '学习笔记'
permalink: 'siyuan/已归档/Python文件操作学习（已归档）/'
siyuan_source: '已归档/Python文件操作学习（已归档）.md'
comments: false
categories:
  - '学习笔记'
  - '已归档'
---

# Python文件操作学习

> 目标：从不会文件操作开始，逐步掌握科研数据目录管理、文件遍历、CSV 读取和基础统计。项目连接：**批量读取受试者 PPG/rPPG 数据**、**为后续实验流水线做准备**当前能力：L0　目标能力：L2学习原则：每一步先运行，再自己修改；完成后留下运行、修改、解释三类证据。

## 阶段一：路径与文件基础

### Step 1：认识当前工作目录

### 📖 **pathlib 安装与工作目录详解**

#### **1. pathlib 安装说明**

`pathlib`​ 是 Python 3.4+ 的标准库模块，**不需要额外安装**。如果你使用的是 Python 3.4 或更高版本，可以直接使用：

```python
from pathlib import Path
```

**常见错误处理**：

- 如果看到 `ModuleNotFoundError: No module named 'pathlib'`，说明你的 Python 版本太旧（<3.4）
- 解决方案：升级 Python 到 3.4+，或者使用 `pip install pathlib`（对于旧版本）

**验证 Python 版本**：

```bash
python --version
# 或
python3 --version
```

#### **2. 工作目录详解**

工作目录是你执行 Python 脚本时所在的目录，**不是脚本文件所在的目录**。

**示例场景**：

```bash
# 假设目录结构：
# /home/yhl/Workspace/
# ├── Test1.py
# └── rknn/
#     └── some_file.txt

# 你当前在 rknn 目录下：
cd /home/yhl/Workspace/rknn

# 运行 Test1.py：
python ../Test1.py
```

**关键点**：

1. `Test1.py`​ 在 `/home/yhl/Workspace/` 目录下
2. 你在 `/home/yhl/Workspace/rknn/` 目录下运行脚本
3. **工作目录是**  **​`/home/yhl/Workspace/rknn/`​** ，不是脚本所在目录
4. `Path.cwd()`​ 返回的是工作目录：`/home/yhl/Workspace/rknn`

**验证示例**：

```python
from pathlib import Path

# 当前工作目录
print("工作目录:", Path.cwd())

# 脚本文件所在目录（如果需要）
print("脚本目录:", Path(__file__).parent)

# 使用相对路径
relative_path = Path("tmp/data/1.txt")
print("相对路径存在:", relative_path.exists())

# 使用绝对路径
absolute_path = Path("D:/WorkSpace/opencv/tmp/data/1.txt")
print("绝对路径存在:", absolute_path.exists())
```

**实际应用建议**：

1. **优先使用相对路径**：代码更灵活，便于移植
2. **理解工作目录**：调试路径问题时首先检查工作目录
3. **使用**  **​`__file__`​** ​ **获取脚本位置**：当需要相对于脚本的路径时
4. **使用** **​`Path.cwd()`​** ​ **获取工作目录**：当需要相对于当前目录的路径时

```python
from pathlib import Path

current = Path.cwd()
print(current)
print(current.exists())
print(current.is_dir())
```

**理解**：`Path.cwd()`​ 返回当前工作目录；`exists()`​ 判断路径是否存在；`is_dir()` 判断是否为目录。

**自己做**：打印当前目录的名称 `current.name`​ 和父目录 `current.parent`。

### Step 2：拼接路径

### 📖 **Path 对象属性详解**

`Path` 对象提供了许多有用的属性，用于获取路径的不同部分：

```python
from pathlib import Path

# 示例路径
path = Path("/home/yhl/Workspace/data/experiment_2026-08-18.csv")

# 属性表格
print("属性详解:")
print(f"1. name:      {path.name}")      # 文件名（包含扩展名）
print(f"2. stem:      {path.stem}")      # 文件名（不包含扩展名）
print(f"3. suffix:    {path.suffix}")    # 扩展名
print(f"4. parent:    {path.parent}")    # 父目录
print(f"5. parts:     {path.parts}")     # 路径各部分
print(f"6. anchor:    {path.anchor}")    # 根目录
print(f"7. is_absolute(): {path.is_absolute()}")  # 是否为绝对路径
print(f"8. exists():  {path.exists()}")  # 路径是否存在
print(f"9. is_file(): {path.is_file()}") # 是否为文件
print(f"10. is_dir(): {path.is_dir()}")  # 是否为目录
```

**属性详解表格**：

|属性|说明|示例值|使用场景|
| ------| ------------------------| --------| ------------------------|
|`name`|完整文件名（含扩展名）|`experiment_2026-08-18.csv`|显示文件名、文件匹配|
|`stem`|文件名（不含扩展名）|`experiment_2026-08-18`|生成新文件名、日志命名|
|`suffix`|文件扩展名|`.csv`|文件类型判断、过滤|
|`parent`|父目录路径|`/home/yhl/Workspace/data`|构建相对路径、目录导航|
|`parts`|路径各部分元组|`('/', 'home', 'yhl', 'Workspace', 'data', 'experiment_2026-08-18.csv')`|路径分析、跨平台处理|
|`anchor`|根目录|`/`|判断是否为绝对路径|
|`is_absolute()`|是否为绝对路径|`True`|路径类型判断|
|`exists()`|路径是否存在|`True/False`|文件操作前检查|
|`is_file()`|是否为文件|`True/False`|文件/目录区分|
|`is_dir()`|是否为目录|`True/False`|文件/目录区分|

**实用技巧**：

```python
# 1. 修改文件扩展名
new_path = path.with_suffix('.txt')  # 改为.txt
new_path = path.with_stem('new_name')  # 改文件名（Python 3.9+）

# 2. 构建新路径
new_file = path.parent / "processed" / path.stem + "_processed" + path.suffix

# 3. 文件类型过滤
csv_files = [f for f in path.parent.iterdir() if f.suffix == '.csv']

# 4. 批量重命名
for file in path.parent.glob("*.txt"):
    new_name = file.stem + "_backup" + file.suffix
    file.rename(file.parent / new_name)
```

### 📖 报错解析：TypeError: unsupported operand type(s) for +: 'WindowsPath' and 'str'

> Path 对象与字符串是不同类型，`+`​ 运算符未定义；更常见的是**优先级陷阱**：`/`​（除法）优先级高于 `+`​（加法），混用时 Python 先算 `/`​ 得到 `WindowsPath`​，再执行 `+`​ 就报 TypeError。路径拼接必须用 `/`​ 或 `joinpath()`。

- **报错原因**：`WindowsPath`​（pathlib 的路径对象）与 `str`​（普通字符串）是不同数据类型，`+`​（字符串相加）在 `WindowsPath + 'str'`​ 上没有定义 → TypeError。在 Windows/Linux 上分别表现为 `WindowsPath`​ / `PosixPath`。
- **为什么不能**  **​`+`​** ​：字符串拼接会破坏路径语义——`/`​ 分隔符、跨平台反斜杠、转义规则都会被污染；pathlib 刻意只支持用 `/` 运算符拼接路径。
- **正确方法**：

```python
from pathlib import Path

root = Path("numpy_file_demo")

# ❌ root + "data"                 # TypeError: unsupported operand...
# ✅ 用 / 拼接（Path 重载了 /）
f1 = root / "data" / "file.csv"
# ✅ 用 joinpath()
f2 = root.joinpath("data", "file.csv")
# ✅ 需要字符串时显式转换（如打印输出）
print(str(f1))
# ✅ 拼接字符串字面量
f3 = root / "notes.txt"
```

- **记忆要点**：拼接只能用 `/`​ 和 `joinpath()`​；只有"显示/输出"才用 `str()` 转字符串，且转换后不要再参与路径运算。

### 📌 优先级陷阱（最常触发的写法）

> 文档中这种混合写法会报错：`new_file = path.parent / "processed" / path.stem + "_processed" + path.suffix`

**报错链路（根本原因）** ：

```
Python 运算符优先级：/（除法）> +（加法）
↓
path.parent / "processed" / path.stem     ← 先执行（得到 WindowsPath）
      ↓ 再执行
WindowsPath + "_processed" + path.suffix  ← WindowsPath + str → TypeError
```

- `path.stem + "_processed" + path.suffix`​ 本意是先拼出字符串文件名的**后半段**，但因为 `+`​ 优先级低于 `/`​，它根本没有机会先执行——`/` 已经把全部路径部分算完了。
- 同理：任何"路径 `/`​ 与字符串 `+` 混写"的长表达式都有可能踩这个坑。

**正确写法**（先用括号把字符串拼接包起来，或直接用 f-string）：

```python
# ✅ 括号：让字符串先拼接，再交给 / 做路径拼接
new_file = path.parent / "processed" / (path.stem + "_processed" + path.suffix)

# ✅ f-string（推荐，更直观）
new_file = path.parent / "processed" / f"{path.stem}_processed{path.suffix}"

# ✅ 等价：joinpath
new_file = path.parent.joinpath("processed", f"{path.stem}_processed{path.suffix}")
```

**为什么推荐使用 Path 对象？**

1. **跨平台兼容**：自动处理 Windows/Linux 路径差异
2. **链式调用**：`path.parent / "subdir" / "file.txt"` 更直观
3. **类型安全**：返回的是 Path 对象，不是字符串
4. **丰富方法**：提供 `glob()`​, `rglob()`​, `stat()` 等实用方法

```python
from pathlib import Path

root = Path.cwd()
data_dir = root / "data"
file_path = data_dir / "subject_001.csv"

print(data_dir)
print(file_path)
print(file_path.suffix)   # .csv
print(file_path.stem)     # subject_001
print(file_path.name)     # subject_001.csv
print(file_path.parent)   # 所在目录
```

**重点**：使用 `Path / 子路径`，不要手动拼接字符串，也不要依赖 Windows 的反斜杠。

**自己做**：把文件名改成 `subject_002.csv`​，观察 `stem`​ 和 `name` 的变化。

### Step 3：创建目录

```python
from pathlib import Path

work_dir = Path("numpy_file_demo")
raw_dir = work_dir / "raw"
result_dir = work_dir / "results"

raw_dir.mkdir(parents=True, exist_ok=True)
result_dir.mkdir(parents=True, exist_ok=True)

print(raw_dir.exists())
print(result_dir.exists())
```

- `parents=True`：父目录不存在时一起创建
- `exist_ok=True`：目录已经存在时不报错

**自己做**：再创建 `work_dir / "logs"`，重复运行代码，确认不会报错。

### 📖 touch()：创建空文件

> `Path.touch()`​ 创建空文件（类似 Linux `touch`：文件不存在则创建，已存在则更新时间戳且不报错）。

```python
from pathlib import Path

path = Path("numpy_file_demo") / "notes.txt"
path.touch(exist_ok=True)   # 不存在则创建空文件；已存在不报错
```

- 与 `mkdir()`​ 的区别：`mkdir`​ 建**目录**，`touch`​ 建**文件**。
- 用途：占位文件、日志文件初始化、确保目标文件存在后再写入。

笔记：这个是否有像mkdir一样的parent=True，父目录不存在的时候创建父目录

## 阶段二：遍历与筛选文件

### Step 4：遍历一层目录

```python
from pathlib import Path

folder = Path("numpy_file_demo")

for item in folder.iterdir():
    print(item, "目录" if item.is_dir() else "文件")
```

`iterdir()` 只遍历当前目录，不递归进入子目录。

**自己做**：只打印文件，跳过目录：

```python
for item in folder.iterdir():
    if item.is_file():
        print(item.name)
```

### Step 5：递归查找 CSV

```python
from pathlib import Path

folder = Path("numpy_file_demo")
csv_files = list(folder.rglob("*.csv"))

for path in csv_files:
    print(path)

print(f"共找到 {len(csv_files)} 个 CSV 文件")
```

**场景**：受试者数据可能按“原始数据/受试者/日期”多层存放，`rglob("*.csv")` 可以递归查找。

### 📖 glob / rglob：通配符匹配文件（详解）

> glob 是"用通配符模式匹配文件名"的机制：`*`​、`?`​、`[]`​ 等符号描述一批文件，`rglob` 递归搜索所有子目录。

- **为什么用 glob**：不必写死文件名，用模式匹配一批文件（这正是 Step 5 用 `rglob("*.csv")` 的原因）。
- **通配符速查**：

|模式|含义|示例|
| ------| -----------------------------| --------------------------------------|
|`*`|匹配任意多个字符（含 0 个）|`*.csv` → 所有 CSV 文件|
|`?`|匹配任意**单个**字符|`subject_?.csv` → subject_1.csv、subject_a.csv|
|`[abc]`|匹配括号内任一字符|`data[12].csv` → data1.csv / data2.csv|

- **​`glob`​**​ **vs** **​`rglob`​**：

  - `folder.glob("*.csv")`：只在 folder 当前层匹配；
  - `folder.rglob("*.csv")`​：**递归**所有子目录——受试者数据按"原始数据/受试者/日期"多层存放时用这个；
- **返回**：生成器（可 `list()` 转列表）；无匹配时为空，不会报错。
- **类比**：像命令行 `ls *.csv`​ / `find . -name "*.csv"` 的 Python 版。
- **验证**：对比 `list(folder.glob("*.csv"))`​ 与 `list(folder.rglob("*.csv"))` 的结果数量，观察递归的效果。

- **​`iterdir()`​** ​ **vs** **​`glob()`​** ​：两者都只遍历**当前层**（不递归），但用途不同——

  - `iterdir()`​：返回**全部**子项（无过滤，逐个得到 Path）；"只要全部子项"时用；
  - `glob(pattern)`​：按**通配符模式过滤**（如 `*.csv`）；"只要匹配模式的一批"时用；
  - 需递归 → 用 `rglob()`（Step 5 的场景）。
- 一句话：iterdir 是"全量列表"，glob/rglob 是"按模式筛选"。

**自己做**：分别查找 `*.txt`​ 和 `*.npy`，观察没有匹配文件时返回什么。

## 阶段三：读写文本和 CSV

### Step 6：写入文本文件

```python
from pathlib import Path

path = Path("numpy_file_demo") / "notes.txt"
path.write_text("subject_001\nsubject_002\n", encoding="utf-8")

print(path.read_text(encoding="utf-8"))
```

- `write_text()`：写入文本，会覆盖原文件
- `read_text()`：读取整个文本
- 中文文本明确指定 `encoding="utf-8"`

### 📖 write_text() 与 Linux echo 重定向的对应

> `path.write_text("...")`​ ≈ Linux `echo "..." > 文件`：都是"写入/覆盖文件内容"。

- 对应关系：

  - `write_text("x")`​ ≈ `echo x > f.txt`（覆盖）；
  - 追加：`open(f, "a").write("x")`​ ≈ `echo x >> f.txt`​（`>>` 追加）。
- 差异：Python 中写入内容来自程序内存（变量/字符串/函数返回值），比 shell 拼接更可控、可编程化。
- 相关：Linux 命令行细节见 [Linux专项](/siyuan/其他笔记/命令行/Linux专项/)。

### Step 7：使用 CSV 模块写入和读取

```python
import csv
from pathlib import Path

path = Path("numpy_file_demo") / "signal.csv"

with path.open("w", newline="", encoding="utf-8") as f:
    writer = csv.writer(f)
    writer.writerow(["time", "value"])
    writer.writerows([
        [0.0, 0.10],
        [0.1, 0.20],
        [0.2, 0.15],
    ])

with path.open("r", newline="", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    for row in reader:
        print(row["time"], row["value"])
```

**重点**：`with` 会自动关闭文件，即使读取或写入过程中发生异常也更安全。

笔记：如果path对应的文件不存在，这里会自动创建一个新文件吗？是哪一行代码创建的？

### 📖 open() 与本文档用过的文件操作方法/函数速查

> `open()`​ 是内置函数，打开文件并返回**文件对象**；它是 `Path.open()`​、`write_text()`​、`csv` 读写等一切文件操作的底层基础。

- **open 是什么**：`open(path, mode, encoding=...)`​ → 文件对象；`with open(...) as f:`​ 自动关闭（异常也安全）；常用 mode：`w`​ 写（覆盖）、`r`​ 读、`a`​ 追加、`+`​ 读写、`b` 二进制。
- **本文档出现过的文件方法/函数速查**：

|名称|类型|作用|
| ------| ----------| -------------------------|
|`Path.cwd()`|类方法|当前工作目录|
|`Path.mkdir()`|方法|创建目录（`parents`​/`exist_ok`）|
|`Path.touch()`|方法|创建空文件|
|`Path / 子路径`|运算符|路径拼接|
|`Path.iterdir()`|方法|遍历当前层全部子项|
|`Path.glob()`|方法|当前层按模式匹配|
|`Path.rglob()`|方法|递归按模式匹配|
|`Path.write_text()`|方法|写入文本（覆盖）|
|`Path.read_text()`|方法|读取整个文本|
|`Path.open()`|方法|打开文件对象（配合 `with`）|
|`open()`|内置函数|通用打开文件|
|`path.stem/.suffix/.name/.parent`|属性|路径各组成部分|

- 记忆：`Path`​ 对象的方法≈"面向对象的文件操作"；`open()`≈"传统函数式"，两者都能用，推荐在前者项目里保持一致。

笔记：这个📖 open() 与本文档用过的文件操作方法/函数速查不要放这里，放更前面一点，我希望你重构这个文档的逻辑链条，让学习循序渐进

### Step 8：用 NumPy 读取数值 CSV

```python
import numpy as np
from pathlib import Path

path = Path("numpy_file_demo") / "signal.csv"
data = np.loadtxt(path, delimiter=",", skiprows=1)

time = data[:, 0]
value = data[:, 1]

print(data.shape)
print(time)
print(value)
print(np.mean(value))
```

适合格式简单、主要由数值构成的实验数据。CSV 中如果有复杂文本、缺失值或混合类型，应改用 Python 标准库的 `csv` 模块处理。

## 阶段四：批量处理实验数据

### Step 9：批量读取并计算平均值

#### 生成模拟实验数据脚本

```python
"""为 Step 9 生成模拟实验数据：多个受试者的随机信号 CSV"""
import numpy as np
from pathlib import Path


def make_signal(n=10, seed=0):
    """生成一条模拟信号：时间列 + 随机信号列（正弦 + 噪声，模拟 PPG）"""
    rng = np.random.default_rng(seed)              # 固定种子 → 每次运行结果一致
    t = np.linspace(0, 2 * np.pi, n)               # 10 个均匀时间点
    signal = np.sin(2 * np.pi * t / 50) + 0.3 * rng.normal(size=n)
    #                 ↑ 低频基线             ↑ 加高斯噪声，更像真实信号
    return t, signal


def gen_files(folder="numpy_file_demo", n_subjects=5, n_points=10):
    """生成 n_subjects 个 CSV，每个放在独立子目录（演示 rglob 递归）"""
    folder = Path(folder)
    for i in range(n_subjects):
        # 子目录：subject_001、subject_002 ...（Step 9 靠 rglob 递归找到它们）
        sub = folder / f"subject_{i + 1:03d}"
        sub.mkdir(parents=True, exist_ok=True)

        t, signal = make_signal(n_points, seed=i)  # 不同受试者用不同种子
        path = sub / f"subject_{i + 1:03d}_rest_signal.csv"
        # column_stack：把时间列和信号列并排成两列
        # header="time,value"：写入表头；comments="" 防止被加 # 注释符
        np.savetxt(path, np.column_stack((t, signal)),
                   delimiter=",", header="time,value", comments="")
        print(f"已生成：{path}，{n_points} 个采样点")


gen_files()   # 默认在 numpy_file_demo/ 下生成 5 个文件
```

#### 正式脚本

```python
from pathlib import Path
import numpy as np


def compute_average(folder: str):
    """批量读取文件夹内所有 CSV 信号，返回逐采样点的平均值"""
    folder = Path(folder)        # 字符串路径统一转成 Path 对象，方便后续操作
    signals = []                 # 收集每个文件的"第二列"（信号值），最后一起求平均

    # rglob("*.csv")：递归搜索目录（含所有子目录）下的全部 .csv 文件
    for path in folder.rglob("*.csv"):
        try:
            # np.loadtxt 读取纯数值 CSV：delimiter=',' 按逗号分隔；skiprows=1 跳过表头
            data = np.loadtxt(path, delimiter=",", skiprows=1)
            # 格式校验：必须 2 维（假设有m行n列，则为一个m个 n个数据的一维列表 组成的二维列表），且至少两列（时间列 + 信号列）
            if data.ndim != 2 or data.shape[1] < 2:
                print(f"跳过格式异常文件：{path}")
                continue
            signals.append(data[:, 1])     # 只取第 2 列（下标 1）作为信号值
            print(f"已读取：{path}，{len(data)} 个采样点")
        except (ValueError, OSError) as exc:
            # 读取出错（格式不对/文件被占用等）不中断程序，打印后跳过该文件
            print(f"跳过文件：{path}，原因：{exc}")

    # 一个有效信号都没有 → 直接报错，避免拿空列表求均值导致错误结果
    if not signals:
        raise RuntimeError("没有找到有效的 CSV 信号文件")

    # 用集合去重各文件长度：长度不止一种 → 采样点数不一致，平均没有意义
    lengths = {len(signal) for signal in signals}
    if len(lengths) != 1:
        raise ValueError("不同文件的信号长度不一致，不能直接求平均")

    # np.array(signals)：把列表堆叠成二维数组 (文件数, 采样点数)
    # np.mean(..., axis=0)：沿"文件"这一轴求平均 → 得到每个采样点位置的平均值
    return np.mean(np.array(signals), axis=0)


average = compute_average("numpy_file_demo")   # 传入数据目录名
print(average)                                 # 打印平均后的信号数组
```

项目连接：这是"**批量读取多个受试者信号** → **检查长度** → **堆叠** → **求平均**"的最小版本。

笔记：将csv表格的这套处理流程沉淀成知识点，并在numpy专项中添加np.loadtxt、np.mean等之类用到的函数的相关用法，注意要做好引用，这涉及两个库之间的联动，需要做好双链。

这里signals.append(data[:, 1])     # 只取第 2 列（下标 1）作为信号值中的data[:, 1]的用法很妙，把这一类取值的用法加入python笔记中，

|**写法**|**取的是什么**|**结果**|**维度**|
| ------| ------------------------------| ------| -------|
|`data[0, 1]`|第 0 行、第 1 列（单个值）|`20`|标量|
|`data[0, :]`|第 0 行、所有列|`[10, 20, 30]`|1D|
|`data[:, 0]`|所有行、第 0 列|`[10, 40, 70]`|1D|
|`data[:, 1]`|所有行、第 1 列|`[20, 50, 80]`|1D ✅|
|`data[1:3, 0:2]`|第 1\~2 行，第 0\~1 列|`[[40,50],[70,80]]`|2D|

使用类似于上面这样的表格的形式

### Step 10：文件名与实验元数据

```python
from pathlib import Path

# 目标：从"文件名"里解析出受试者编号、实验条件、日期等元数据
# （文件命名约定：subject_001_rest_20260817.csv）
path = Path("subject_001_rest_20260817.csv")

# .stem 是去掉扩展名的文件名主体："subject_001_rest_20260817"
# .split("_") 按下划线拆成多段：["subject", "001", "rest", "20260817"]
parts = path.stem.split("_")

subject_id = parts[0] + "_" + parts[1]   # "subject" + "_" + "001" → 受试者编号
condition = parts[2]                     # "rest" → 实验条件（静息/任务等）
date = parts[3]                          # "20260817" → 采集日期

print(subject_id, condition, date)
```

真实项目中不要过度依赖文件名解析；更稳妥的方式是配套一个 metadata CSV，记录受试者编号、条件、日期和文件路径。

笔记：这里的split是标准库的方法还是pathlib库里的方法，添加使用说明，放在python笔记的字符串相关位置

## 阶段五：错误处理与可复现

### 常见错误

- 相对路径相对于“当前工作目录”，不一定相对于 Python 文件所在目录。
- Windows 路径优先使用 `Path`，避免反斜杠转义问题。
- `write_text()` 默认覆盖文件，重要数据写入前要确认路径。
- 空目录、文件不存在、CSV 表头、缺失值和列数不一致都要处理。
- 不能假设所有 CSV 的采样率、长度和列含义相同。

## 阶段六：高级文件操作技巧

> 在掌握基础文件操作后，我们需要更多高级技巧来处理复杂的科研数据场景。

### Step 11：文件批量处理

```python
from pathlib import Path
import csv

# ========== 1. 批量读取 CSV 并合并数据 ==========
def merge_csv_files(folder: Path, output_file: Path):
    """把目录下所有 CSV 合并成一个文件（表头只保留一次）"""
    all_data = []                             # 暂存除表头外的所有数据行

    # glob("*.csv")：只匹配 folder 当前层的 .csv（不递归子目录）
    for csv_file in folder.glob("*.csv"):
        with open(csv_file, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)            # 逐行解析 CSV；每行返回一个列表
            header = next(reader)             # next() 取出第一行作为表头
            for row in reader:                # 剩余行全部收集进 all_data
                all_data.append(row)

    # 写入合并后的文件：先写一次表头，再批量写所有数据行
    with open(output_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(header)               # 表头只写一次
        writer.writerows(all_data)            # 一次写入多行（接受列表的列表）

    return len(all_data)                      # 返回数据行总数（不含表头）


# ========== 2. 批量重命名文件 ==========
def batch_rename(folder: Path, old_pattern: str, new_pattern: str):
    """把匹配 old_pattern 的文件改名（模式中 * 是通配符）"""
    renamed_count = 0

    for file in folder.glob(old_pattern):     # 先按"旧模式"选出目标文件
        # 把旧模式中 * 之前的固定前缀替换为新模式的前缀：
        # 例 old="data_*.csv"、new="raw_*.csv" → 把 "data_" 换成 "raw_"
        new_name = file.name.replace(old_pattern.split('*')[0],
                                   new_pattern.split('*')[0])
        new_path = file.parent / new_name     # 新路径 = 同目录 + 新文件名
        file.rename(new_path)                 # Path.rename 执行重命名
        renamed_count += 1

    return renamed_count                      # 返回实际改名数量


# ========== 3. 查找大文件 ==========
def find_large_files(folder: Path, size_mb: int = 100):
    """递归查找大于 size_mb 的文件，按大小从大到小返回"""
    large_files = []
    size_bytes = size_mb * 1024 * 1024        # MB 换算成字节（1MB = 1024*1024 B）

    for file in folder.rglob("*"):            # 递归遍历目录下所有条目
        if file.is_file() and file.stat().st_size > size_bytes:
            # file.stat() 获取文件元信息；st_size 是字节大小；再换算成 MB 便于阅读
            large_files.append((file, file.stat().st_size / 1024 / 1024))

    # sorted(..., key=lambda x: x[1], reverse=True)
    # 按元组第二个元素（大小，MB）降序排列 → 最大的排最前
    return sorted(large_files, key=lambda x: x[1], reverse=True)
```

### Step 12：文件监控与自动化

```python
from pathlib import Path
import time
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

# ========== 1. 模拟"轮询式"文件监控（零依赖） ==========
def monitor_folder(folder: Path, interval: int = 5):
    """通过"快照对比"找出新增/删除的文件，每 interval 秒检查一次"""
    initial_files = set(f.name for f in folder.iterdir())   # 初始快照：文件名集合

    while True:
        current_files = set(f.name for f in folder.iterdir())  # 当前快照

        new_files = current_files - initial_files          # 集合差：新有旧无
        deleted_files = initial_files - current_files      # 集合差：旧有新无

        if new_files:
            print(f"新增文件: {new_files}")
        if deleted_files:
            print(f"删除文件: {deleted_files}")

        initial_files = current_files                      # 更新快照，下轮再比
        time.sleep(interval)                               # 等待，避免忙轮询

# ========== 2. watchdog 事件驱动监控（需 pip install watchdog） ==========
class MyHandler(FileSystemEventHandler):
    """继承 watchdog 事件处理器，覆写感兴趣的回调方法"""
    def on_created(self, event):                           # 文件被创建时回调
        if not event.is_directory:                         # 只关心文件，忽略目录
            print(f"文件创建: {event.src_path}")           # src_path = 变化路径

    def on_modified(self, event):                          # 文件被修改时回调
        if not event.is_directory:
            print(f"文件修改: {event.src_path}")

def start_monitor(folder: Path):
    """事件驱动监控：操作系统主动通知，比轮询更及时省资源"""
    event_handler = MyHandler()
    observer = Observer()                                  # 观察者对象：调度事件
    observer.schedule(event_handler, str(folder), recursive=True)  # 递归监听子目录
    observer.start()                                       # 启动后台监控线程

    try:
        while True:            # 主线程保持运行（等待 Ctrl+C 结束）
            time.sleep(1)
    except KeyboardInterrupt:  # 按 Ctrl+C → 优雅停止监控
        observer.stop()
    observer.join()            # 等待监控线程真正结束再退出
```

### Step 13：数据备份与版本管理

```python
from pathlib import Path
import shutil
from datetime import datetime

# ========== 1. 完整备份：带时间戳复制，避免覆盖旧备份 ==========
def create_backup(source: Path, backup_dir: Path):
    """创建带时间戳的备份副本（目录整体复制或单文件复制）"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")   # 例：20260824_153000
    backup_name = f"{source.name}_{timestamp}"              # 原名 + 时间戳
    backup_path = backup_dir / backup_name                  # 备份目标路径

    if source.is_dir():
        shutil.copytree(source, backup_path)                # 复制整个目录树
    else:
        shutil.copy2(source, backup_path)                   # 复制单文件（保留元信息）
    return backup_path

# ========== 2. 增量备份：只备份"新增或修改过"的文件 ==========
def incremental_backup(source: Path, backup_dir: Path):
    """按相对路径镜像到备份目录，仅复制 mtime 比备份新的文件"""
    backup_dir.mkdir(exist_ok=True)                         # 备份根目录不存在时创建

    for file in source.rglob("*"):                          # 递归遍历所有条目
        if file.is_file():
            rel_path = file.relative_to(source)             # 相对源目录的路径
            backup_file = backup_dir / rel_path             # 在备份目录里镜像同结构

            # 需要更新的条件：备份还不存在，或源文件最后修改时间(mtime)比备份新
            if not backup_file.exists() or \
               file.stat().st_mtime > backup_file.stat().st_mtime:
                backup_file.parent.mkdir(parents=True, exist_ok=True)  # 先建父目录
                shutil.copy2(file, backup_file)             # 再复制
                print(f"备份: {rel_path}")

# ========== 3. 清理过期备份 ==========
def clean_old_backups(backup_dir: Path, keep_days: int = 30):
    """删除修改时间早于 keep_days 天的备份条目"""
    cutoff_time = datetime.now().timestamp() - (keep_days * 24 * 3600)
    # 当前时间戳减去 keep_days 天对应的秒数 → "多久以前算过期"的截止时间戳

    deleted_count = 0
    for item in backup_dir.iterdir():
        if item.stat().st_mtime < cutoff_time:              # 修改时间早于截止 → 过期
            if item.is_dir():
                shutil.rmtree(item)                         # 删除整个目录树
            else:
                item.unlink()                               # 删除单个文件
            deleted_count += 1

    return deleted_count                                    # 返回清理数量
```

### Step 14：配置文件处理

```python
import json
import yaml
from pathlib import Path

# ========== 1. JSON 配置文件 ==========
def load_json_config(config_path: Path):
    """读取 JSON 文件并解析为 Python 对象（dict/list）"""
    with open(config_path, 'r', encoding='utf-8') as f:
        return json.load(f)           # json.load：把 JSON 文本解析成 Python 字典

def save_json_config(config: dict, config_path: Path):
    """把 dict 保存为 JSON 文件"""
    with open(config_path, 'w', encoding='utf-8') as f:
        # indent=2：美化缩进，便于人读；ensure_ascii=False：中文不转义成 \uXXXX
        json.dump(config, f, indent=2, ensure_ascii=False)

# ========== 2. YAML 配置文件（需 pip install pyyaml） ==========
def load_yaml_config(config_path: Path):
    """读取 YAML 配置（YAML 比 JSON 更适合手写：无引号、支持注释）"""
    with open(config_path, 'r', encoding='utf-8') as f:
        return yaml.safe_load(f)      # safe_load：安全解析（不执行任意对象）

def save_yaml_config(config: dict, config_path: Path):
    """把 dict 保存为 YAML 文件"""
    with open(config_path, 'w', encoding='utf-8') as f:
        yaml.dump(config, f, default_flow_style=False, allow_unicode=True)
        # default_flow_style=False：用"块状"（多行展开）写法
        # allow_unicode=True：保留中文原文而不是转义

# ========== 3. 环境变量配置（.env 文件） ==========
def load_env_config(env_path: Path):
    """解析 .env（KEY=VALUE 每行一个）为 dict，用于存放密钥/路径等"""
    config = {}
    with open(env_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()                      # 去掉首尾空白与换行符
            if line and not line.startswith('#'):    # 跳过空行与注释行
                key, value = line.split('=', 1)      # 只按第一个 '=' 拆分（值里可含 =）
                config[key.strip()] = value.strip()  # 去空白后存入字典
    return config
```

## 阶段七：总结与进阶

> 回顾所学内容，并展望更高级的文件操作技巧。

### 📊 **学习内容总结**

|阶段|核心内容|掌握程度|
| --------| ----------------------------------| ----------|
|阶段一|pathlib 安装、工作目录、路径属性|☐ 基础|
|阶段二|目录遍历、文件筛选|☐ 基础|
|阶段三|文本和 CSV 文件读写|☐ 基础|
|阶段四|批量数据处理、平均值计算|☐ 进阶|
|阶段五|错误处理、项目结构|☐ 进阶|
|阶段六|高级文件操作、自动化|☐ 高级|

### 🚀 **进阶学习路径**

#### **1. 数据处理进阶**

```python
# Pandas 数据处理
import pandas as pd
df = pd.read_csv("data.csv")
df.groupby("subject").mean()

# 大文件处理
chunks = pd.read_csv("large_file.csv", chunksize=1000)
for chunk in chunks:
    process(chunk)
```

#### **2. 并发文件处理**

```python
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

def process_file(file_path):
    """处理单个文件"""
    # 你的处理逻辑
    pass

def parallel_process(folder: Path, max_workers=4):
    """并行处理文件夹中的所有文件"""
    files = list(folder.glob("*.csv"))
    
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        executor.map(process_file, files)
```

#### **3. 文件系统监控**

```python
# 使用 watchdog 监控文件变化
# 安装：pip install watchdog
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

class DataHandler(FileSystemEventHandler):
    def on_created(self, event):
        if event.src_path.endswith('.csv'):
            print(f"新数据文件: {event.src_path}")
            # 自动触发处理流程
```

#### **4. 云存储集成**

```python
# S3/MinIO 文件操作
import boto3
from pathlib import Path

def upload_to_s3(local_path: Path, bucket_name: str, s3_key: str):
    """上传文件到 S3"""
    s3 = boto3.client('s3')
    s3.upload_file(str(local_path), bucket_name, s3_key)

def download_from_s3(bucket_name: str, s3_key: str, local_path: Path):
    """从 S3 下载文件"""
    s3 = boto3.client('s3')
    s3.download_file(bucket_name, s3_key, str(local_path))
```

### 📚 **推荐资源**

1. **官方文档**：

   - [pathlib 官方文档](https://docs.python.org/3/library/pathlib.html)
   - [csv 模块文档](https://docs.python.org/3/library/csv.html)
2. **进阶库**：

   - `pandas`：数据分析
   - `numpy`：数值计算
   - `watchdog`：文件系统监控
   - `boto3`：云存储操作
3. **实践项目**：

   - 构建自动化数据处理流水线
   - 开发实验数据管理系统
   - 实现数据备份与版本控制

### 🎯 **下一步建议**

1. **巩固基础**：确保每个阶段的练习都独立完成
2. **项目实践**：选择一个实际项目应用所学知识
3. **代码审查**：让他人审查你的代码，学习最佳实践
4. **持续学习**：关注 Python 生态中的新工具和库

记住：**实践是学习编程的最佳方式**。不要只看代码，要动手编写、调试和优化！

### 推荐的项目目录

```text
experiment/
├── data/
│   ├── raw/
│   ├── processed/
│   └── metadata.csv
├── results/
├── logs/
└── scripts/
```

## 完成标准

- [X] 能解释相对路径、绝对路径、`Path.cwd()`​ 和 `Path.parent`
- [ ] 能创建嵌套目录并重复运行不报错
- [ ] 能遍历目录并筛选 CSV
- [ ] 能读写文本和简单 CSV
- [ ] 能用 NumPy 读取数值 CSV
- [ ] 能批量读取多个信号并检查长度
- [ ] 能处理文件不存在、格式错误和空目录

## 学习验证提交格式

完成后提交三类证据：

### 证据 1：运行输出

粘贴 Step 9 的真实输出，包括读取了几个文件、数组 shape 和平均结果。

### 证据 2：主动修改

至少完成一项：

- 增加一个 CSV 文件
- 修改一个文件的采样点数量
- 修改目录结构
- 制造一个格式错误文件并观察程序如何跳过

说明修改前后结果变化及原因。

### 证据 3：口头解释

用自己的话回答：

1. 为什么推荐 `Path / "file.csv"`，而不是字符串拼接路径？
2. `iterdir()`​ 和 `rglob()` 的区别是什么？
3. 为什么批量求平均前要检查每个信号的长度？
4. 什么时候用 `csv`​，什么时候用 `np.loadtxt`？

## 能力等级目标

**当前能力：L0（未完成、未归档，不升级）。**  本学习文档只是练习计划，完成它不等于已经掌握。完成基础步骤、在 AI 帮助下跑通，并提交三类证据归档后，才能判 L0 → L2。

若能脱离本文档，独立写出“递归查找 CSV → 读取信号 → 校验 → 汇总”的新脚本，并通过 learn-verify 验证归档后，才是 L2 → L3 候选。归档前仍按 L0 记录。

‍

<section class="siyuan-references" aria-label="文档引用">

## 文档关系

### 本文引用
- [Linux专项](/siyuan/其他笔记/命令行/Linux专项/)

### 反向引用
- [学习笔记](/siyuan/)

</section>
