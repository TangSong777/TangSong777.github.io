---
title: 'PathLib专项'
date: '2026-08-18T14:06:29+08:00'
updated: '2026-08-24T17:22:59+08:00'
layout: page
type: siyuan-note
notebook: '学习笔记'
permalink: 'siyuan/Python笔记/PathLib专项/'
siyuan_source: 'Python笔记/PathLib专项.md'
comments: false
categories:
  - '学习笔记'
  - 'Python笔记'
---

> PathLib 是 Python 标准库 `pathlib`​ 的知识点专项：用面向对象的 `Path` 统一处理路径、目录与文件，替代手写字符串路径。当前能力：L2（能独立完成目录管理、文件遍历与批量读取）。
>
> 来源：Python 文件操作学习（已归档）。本笔记按 "基础 → 拼接 → 创建 → 遍历 → 读写 → 批处理 → 高级技巧" 重构逻辑链条，循序渐进。

## 一、Path 对象与路径基础

### 1.1 pathlib 是什么

> `pathlib`​ 是 Python 3.4+ 的标准库模块，**不需要额外安装**，直接 `from pathlib import Path` 即可使用。

- **常见错误**：看到 `ModuleNotFoundError: No module named 'pathlib'`​ 说明 Python 版本太旧（<3.4），需要升级 Python，或对旧版本执行 `pip install pathlib`。
- **验证版本**：`python --version`​ 或 `python3 --version`。

### 1.2 工作目录 vs 脚本目录

> 工作目录是你**执行** Python 脚本时所在的目录，**不是脚本文件所在的目录**——这条是路径问题的第一大来源。

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
4. `Path.cwd()` 返回的就是工作目录

**验证示例**：

```python
from pathlib import Path

print("工作目录:", Path.cwd())           # 当前工作目录
print("脚本目录:", Path(__file__).parent)  # 脚本文件所在目录（如果需要）

relative_path = Path("tmp/data/1.txt")        # 相对路径
print("相对路径存在:", relative_path.exists())

absolute_path = Path("D:/WorkSpace/opencv/tmp/data/1.txt")  # 绝对路径
print("绝对路径存在:", absolute_path.exists())
```

**实际应用建议**：

1. **优先使用相对路径**：代码更灵活，便于移植
2. **理解工作目录**：调试路径问题时首先检查工作目录
3. **用**  **​`__file__`​** ​ **获取脚本位置**：当需要相对于脚本的路径时
4. **用** **​`Path.cwd()`​** ​ **获取工作目录**：当需要相对于当前目录的路径时

**常用判断**：`Path.cwd().exists()`​ 是否存在；`Path.cwd().is_dir()`​ 是否为目录；`current.name`​ 目录名；`current.parent` 父目录。

### 1.3 Path 对象核心属性

> `Path` 对象把路径拆成多个可直接访问的部分（文件名、扩展名、父目录、根等），并自带存在性/类型判断。

```python
from pathlib import Path

path = Path("/home/yhl/Workspace/data/experiment_2026-08-18.csv")

print(f"name:    {path.name}")     # 完整文件名（含扩展名）
print(f"stem:    {path.stem}")     # 文件名（不含扩展名）
print(f"suffix:  {path.suffix}")   # 扩展名
print(f"parent:  {path.parent}")   # 父目录
print(f"parts:   {path.parts}")    # 路径各部分（元组）
print(f"anchor:  {path.anchor}")   # 根目录
print(f"is_absolute(): {path.is_absolute()}")  # 是否绝对路径
print(f"exists(): {path.exists()}")   # 是否存在
print(f"is_file(): {path.is_file()}") # 是否为文件
print(f"is_dir():  {path.is_dir()}")  # 是否为目录
```

|属性|说明|示例值|使用场景|
| ------| ------------------------| --------| ------------------------|
|`name`|完整文件名（含扩展名）|`experiment_2026-08-18.csv`|显示文件名、文件匹配|
|`stem`|文件名（不含扩展名）|`experiment_2026-08-18`|生成新文件名、日志命名|
|`suffix`|文件扩展名|`.csv`|文件类型判断、过滤|
|`parent`|父目录路径|`/home/yhl/Workspace/data`|构建相对路径、目录导航|
|`parts`|路径各部分元组|`('/', 'home', 'yhl', ...)`|路径分析、跨平台处理|
|`anchor`|根目录|`/`|判断是否为绝对路径|
|`is_absolute()`|是否为绝对路径|`True`|路径类型判断|
|`exists()`|路径是否存在|`True/False`|文件操作前检查|
|`is_file()`|是否为文件|`True/False`|文件/目录区分|
|`is_dir()`|是否为目录|`True/False`|文件/目录区分|

### 1.4 为什么推荐使用 Path 对象

1. **跨平台兼容**：自动处理 Windows/Linux 路径差异（反斜杠/正斜杠、盘符、根目录）
2. **链式调用**：`path.parent / "subdir" / "file.txt"` 比字符串拼接更直观
3. **类型安全**：返回的是 Path 对象，不是字符串，天然自带各种方法
4. **丰富方法**：提供 `glob()`​、`rglob()`​、`stat()`​、`mkdir()` 等实用方法

> 一句话：**用** **​`Path / 子路径`​**​ **构建路径，不要手动拼接字符串，也不要依赖 Windows 的反斜杠。**

## 二、路径拼接与转换

### 2.1 用 / 运算符与 joinpath() 拼接

> `Path`​ 重载了 `/`​ 运算符，`Path / "子路径"`​ 是唯一推荐的路径拼接方式；`joinpath()` 是等价的方法写法。

```python
from pathlib import Path

root = Path("numpy_file_demo")
data_dir = root / "data"                 # 用 / 拼接（Path 重载了 /）
file_path = data_dir / "subject_001.csv"

print(file_path.suffix)   # .csv
print(file_path.stem)     # subject_001
print(file_path.name)     # subject_001.csv
print(file_path.parent)   # 所在目录

# joinpath() 等价写法
f2 = root.joinpath("data", "file.csv")

# 需要字符串时显式转换（仅用于打印输出）
print(str(f1))
```

### 2.2 报错解析：TypeError: unsupported operand type(s) for +: 'WindowsPath' and 'str'

> Path 对象与字符串是不同类型，`+`​ 运算符未定义；更常见的是**优先级陷阱**：`/`​（除法）优先级高于 `+`​（加法），混用时 Python 先算 `/`​ 得到 `WindowsPath`​，再执行 `+`​ 就报 TypeError。路径拼接必须用 `/`​ 或 `joinpath()`。

- **报错原因**：`WindowsPath`​（pathlib 的路径对象）与 `str`​（普通字符串）是不同数据类型，`+`​（字符串相加）在 `WindowsPath + 'str'`​ 上没有定义 → TypeError。在 Windows/Linux 上分别表现为 `WindowsPath`​ / `PosixPath`。
- **为什么不能用**  **​`+`​** ​：字符串拼接会破坏路径语义——`/`​ 分隔符、跨平台反斜杠、转义规则都会被污染；pathlib 刻意只支持用 `/` 运算符拼接路径。

```python
from pathlib import Path

root = Path("numpy_file_demo")

# ❌ root + "data"                 # TypeError: unsupported operand...
# ✅ 用 / 拼接（Path 重载了 /）
f1 = root / "data" / "file.csv"
# ✅ 用 joinpath()
f2 = root.joinpath("data", "file.csv")
# ✅ 拼接字符串字面量
f3 = root / "notes.txt"
```

- **记忆要点**：拼接只能用 `/`​ 和 `joinpath()`​；只有"显示/输出"才用 `str()` 转字符串，且转换后不要再参与路径运算。

### 2.3 优先级陷阱（最常触发的写法）

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

### 2.4 修改文件名：with_suffix / with_stem

> 不改动路径其余部分、只改扩展名或文件名主体，用 `with_suffix()`​ / `with_stem()`（后者 Python 3.9+）。

```python
path = Path("report.csv")

new_path = path.with_suffix('.txt')   # report.txt（改扩展名）
new_path = path.with_stem('final')    # final.csv（改文件名主体，3.9+）
```

### 2.5 文件操作方法/函数速查表

> `open()`​ 是内置函数，打开文件并返回**文件对象**；它是 `Path.open()`​、`write_text()`​、`csv`​ 读写等一切文件操作的底层基础。`Path`​ 对象的方法 ≈ "面向对象的文件操作"；`open()` ≈ "传统函数式"，两者都能用，推荐在项目里保持一致。

|名称|类型|作用|
| ------| ----------| ---------------------------|
|`Path.cwd()`|类方法|当前工作目录|
|`Path.mkdir()`|方法|创建目录（`parents`​/`exist_ok`）|
|`Path.touch()`|方法|创建空文件|
|`Path / 子路径`|运算符|路径拼接|
|`Path.iterdir()`|方法|遍历当前层全部子项|
|`Path.glob()`|方法|当前层按模式匹配|
|`Path.rglob()`|方法|递归按模式匹配|
|`Path.rename()`|方法|重命名/移动文件|
|`Path.stat()`|方法|文件元信息（大小、mtime）|
|`Path.write_text()`|方法|写入文本（覆盖）|
|`Path.read_text()`|方法|读取整个文本|
|`Path.open()`|方法|打开文件对象（配合 `with`）|
|`open()`|内置函数|通用打开文件|
|`path.stem/.suffix/.name/.parent`|属性|路径各组成部分|

## 三、创建目录与文件

### 3.1 mkdir 创建目录

> `Path.mkdir(parents=True, exist_ok=True)` 创建目录，两个参数让"多级目录一次创建"且"重复运行不报错"。

```python
from pathlib import Path

work_dir = Path("numpy_file_demo")
raw_dir = work_dir / "raw"
result_dir = work_dir / "results"

raw_dir.mkdir(parents=True, exist_ok=True)     # 父目录不存在时一起创建
result_dir.mkdir(parents=True, exist_ok=True)  # 已存在时不报错

print(raw_dir.exists())    # True
print(result_dir.exists()) # True
```

- `parents=True`​：父目录不存在时**递归创建**（如 `raw`​ 的父目录 `numpy_file_demo` 不存在也会一并建出）
- `exist_ok=True`​：目录已经存在时不抛 `FileExistsError`
- 缺省时：父目录不存在或已存在都会报错，所以实际代码几乎总是带上这两个参数

### 3.2 touch 创建空文件

> `Path.touch()`​ 创建空文件（类似 Linux `touch`：文件不存在则创建，已存在则更新时间戳且不报错）。

```python
from pathlib import Path

path = Path("numpy_file_demo") / "notes.txt"
path.touch(exist_ok=True)   # 不存在则创建空文件；已存在不报错
```

- 与 `mkdir()`​ 的区别：`mkdir`​ 建**目录**，`touch`​ 建**文件**
- 用途：占位文件、日志文件初始化、确保目标文件存在后再写入

**答疑：touch 有像 mkdir 一样的 parents 参数吗？**

> **没有。**  `Path.touch()`​ 不会自动创建父目录——若父目录不存在会抛 `FileNotFoundError`。需要先手动确保父目录存在：

```python
path = Path("numpy_file_demo") / "logs" / "run.log"
path.parent.mkdir(parents=True, exist_ok=True)   # 先建父目录
path.touch(exist_ok=True)                        # 再创建空文件
```

### 3.3 推荐项目目录结构

> 实验项目按"数据/结果/日志/脚本"分层，路径全部用 Path 管理，方便后续遍历与归档。

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

## 四、遍历与筛选文件

### 4.1 iterdir 遍历当前层

> `Path.iterdir()`​ 遍历目录的**当前层**全部子项，不递归进入子目录；逐项得到 Path 对象。

```python
from pathlib import Path

folder = Path("numpy_file_demo")

for item in folder.iterdir():
    print(item, "目录" if item.is_dir() else "文件")

# 只打印文件，跳过目录：
for item in folder.iterdir():
    if item.is_file():
        print(item.name)
```

### 4.2 glob / rglob：通配符匹配文件

> glob 是"用通配符模式匹配文件名"的机制：`*`​、`?`​、`[]`​ 等符号描述一批文件，`rglob` 递归搜索所有子目录。不必写死文件名，用模式匹配一批文件。

**通配符速查**：

|模式|含义|示例|
| ------| -----------------------------| --------------------------------------|
|`*`|匹配任意多个字符（含 0 个）|`*.csv` → 所有 CSV 文件|
|`?`|匹配任意**单个**字符|`subject_?.csv` → subject_1.csv、subject_a.csv|
|`[abc]`|匹配括号内任一字符|`data[12].csv` → data1.csv / data2.csv|

**​`glob`​**​ **vs** **​`rglob`​**：

- `folder.glob("*.csv")`：只在 folder 当前层匹配
- `folder.rglob("*.csv")`​：**递归**所有子目录——受试者数据按"原始数据/受试者/日期"多层存放时用这个

**其他要点**：

- 返回**生成器**（可 `list()`​ 转列表）；无匹配时为空，**不会报错**
- 类比：命令行 `ls *.csv`​ / `find . -name "*.csv"` 的 Python 版
- 验证：对比 `list(folder.glob("*.csv"))`​ 与 `list(folder.rglob("*.csv"))` 的结果数量，观察递归效果

```python
from pathlib import Path

folder = Path("numpy_file_demo")
csv_files = list(folder.rglob("*.csv"))   # 递归查找所有 CSV

for path in csv_files:
    print(path)

print(f"共找到 {len(csv_files)} 个 CSV 文件")
```

**场景**：受试者数据可能按"原始数据/受试者/日期"多层存放，`rglob("*.csv")` 可以递归查找。

### 4.3 iterdir vs glob vs rglob 对比

> 三者都只遍历**当前层**（`glob`​ 不递归），但用途不同；需要递归 → 用 `rglob()`。

- `iterdir()`​：返回**全部**子项（无过滤），"只要全部子项"时用
- `glob(pattern)`​：按**通配符模式过滤**（如 `*.csv`），"只要匹配模式的一批"时用
- `rglob(pattern)`：递归 + 模式过滤，"深层目录也要找"时用

一句话：**iterdir 是"全量列表"，glob/rglob 是"按模式筛选"。**

## 五、文本读写与 open()

### 5.1 write_text / read_text

> `Path.write_text()`​ 写入整个文本（**会覆盖原文件**）；`Path.read_text()`​ 读取整个文本；中文文本务必明确指定 `encoding="utf-8"`。

```python
from pathlib import Path

path = Path("numpy_file_demo") / "notes.txt"
path.write_text("subject_001\nsubject_002\n", encoding="utf-8")

print(path.read_text(encoding="utf-8"))
```

**与 Linux echo 重定向的对应**：

> `path.write_text("...")`​ ≈ Linux `echo "..." > 文件`：都是"写入/覆盖文件内容"。

- `write_text("x")`​ ≈ `echo x > f.txt`（覆盖）
- 追加：`open(f, "a").write("x")`​ ≈ `echo x >> f.txt`​（`>>` 追加）
- 差异：Python 中写入内容来自程序内存（变量/字符串/函数返回值），比 shell 拼接更可控、可编程化
- 相关：Linux 命令行细节见 [Linux专项](/siyuan/其他笔记/命令行/Linux专项/)

### 5.2 open() 与 with 语句

> `open(path, mode, encoding=...)`​ → 文件对象；`with open(...) as f:` 自动关闭文件，即使读写过程中发生异常也更安全。

- 常用 mode：`w`​ 写（覆盖）、`r`​ 读、`a`​ 追加、`+`​ 读写、`b` 二进制
- `with`​ 的关键作用：无论正常结束还是抛异常，都会调用 `f.close()`，避免文件句柄泄漏

## 六、CSV 读写

### 6.1 csv 模块：写入与读取

> CSV 含复杂文本、缺失值或混合类型时用标准库 `csv` 模块；纯数字实验数据可交给 NumPy（见 6.3）。

```python
import csv
from pathlib import Path

path = Path("numpy_file_demo") / "signal.csv"

# 写入：writerow 写一行，writerows 一次写多行
with path.open("w", newline="", encoding="utf-8") as f:
    writer = csv.writer(f)
    writer.writerow(["time", "value"])
    writer.writerows([
        [0.0, 0.10],
        [0.1, 0.20],
        [0.2, 0.15],
    ])

# 读取：csv.DictReader 按表头名访问列
with path.open("r", newline="", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    for row in reader:
        print(row["time"], row["value"])
```

- `newline=""`：防止 Windows 下写出的 CSV 出现多余空行
- `encoding="utf-8"`：中文/特殊字符不乱码
- **重点**：`with` 会自动关闭文件，即使读取或写入过程中发生异常也更安全

**答疑：文件不存在时会自动创建吗？是哪行代码创建的？**

> `with path.open("w", ...)`​ 的 `"w"`​ 模式**会自动创建**不存在的文件，创建动作发生在 `open()`​（这里是 `Path.open()`​，即 `open()`​ 的面向对象包装）被调用时。同理 `"a"`​（追加）也会自动创建。但 `"r"`​ 模式遇到不存在的文件会抛 `FileNotFoundError`——读取前先确认文件存在。

### 6.2 何种 CSV 用什么读

> **纯数值、格式简单**的实验数据 → `np.loadtxt`​（快，直接得数组）；**含表头文本、缺失值、混合类型** → 标准库 `csv` 模块（灵活，逐行处理）。

### <span id="20260824170913-zj11ylf" class="siyuan-block-anchor" aria-hidden="true"></span>6.3 从 CSV 读到 NumPy（联动）

>> 用 `np.loadtxt(path, delimiter=",", skiprows=1)`​ 把纯数值 CSV 直接读成二维数组：`delimiter`​ 指定分隔符，`skiprows=1`​ 跳过表头。函数详解见 [从文件读写数组（loadtxt / savetxt）](/siyuan/Python笔记/NumPy专项/#20260824171040-bu47ao1)。
>>

## <span id="20260824170927-bgv7ya3" class="siyuan-block-anchor" aria-hidden="true"></span>七、批量处理实验数据（综合案例）

> 目标：**批量读取多个受试者的信号 CSV → 校验 → 逐采样点求平均**。这是项目"批量读取 PPG/rPPG 数据"的最小版本，串起前面所有知识点（rglob 递归、loadtxt 读取、切片取列、长度校验、axis 求平均）。

### 7.1 生成模拟数据：np.savetxt

>> 用 `np.savetxt`​ 把数组落盘成 CSV：`delimiter`​ 分隔符、`header`​ 表头、`comments=""`​ 防止表头被加 `#`​ 前缀。函数详解与 `column_stack`​ 见 [从文件读写数组（loadtxt / savetxt）](/siyuan/Python笔记/NumPy专项/#20260824171040-bu47ao1)。
>>

```python
"""为批量处理生成模拟实验数据：多个受试者的随机信号 CSV"""
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
        # 子目录：subject_001、subject_002 ...（靠 rglob 递归找到它们）
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

### <span id="20260824170927-cmsi10l" class="siyuan-block-anchor" aria-hidden="true"></span>7.2 批量读取与求平均（完整脚本）

> 流程：`rglob`​ 收集全部 CSV → `loadtxt` 逐个读取 → 校验维度与列数 → 只取信号列 → 校验各文件长度一致 → 堆叠后沿文件轴求平均。每一步都有保护性检查，这是真实实验代码的骨架。

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
            # 格式校验：必须 2 维且至少两列（时间列 + 信号列）
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

三个保护性检查的意义：`try/except`​ 保证单个坏文件不中断整个流程；`not signals`​ 防空列表求均值；`lengths` 去重保证多个文件采样点一致，否则逐点平均毫无意义。

### <span id="20260824170927-w1661x4" class="siyuan-block-anchor" aria-hidden="true"></span>7.3 二维索引取行/取列速查

>> `data[:, 1]`​ 取"所有行、第 1 列"——批量处理中取某一列的标准写法。写法与结果速查（并见 [二维索引](/siyuan/Python笔记/NumPy专项/#20260817154937-jnivunu)）：
>>

|**写法**|**取的是什么**|**示例结果**|**维度**|
| ------| ----------------------------| ------| -------|
|`data[0, 1]`|第 0 行、第 1 列（单个值）|`20`|标量|
|`data[0, :]`|第 0 行、所有列|`[10, 20, 30]`|1D|
|`data[:, 0]`|所有行、第 0 列|`[10, 40, 70]`|1D|
|`data[:, 1]`|所有行、第 1 列|`[20, 50, 80]`|1D ✅|
|`data[1:3, 0:2]`|第 1<sub>2 行，第 0</sub>1 列|`[[40,50],[70,80]]`|2D|

### 7.4 从文件名解析元数据：split

> `Path.stem`​ 得到文件名主体（字符串）后，`.split("_")`​ 按下划线拆成多段，即可解析出受试者编号、实验条件、日期等元数据。**注意：**​**​`split`​**​ **是 str 标准库方法**（`path.stem` 返回的是字符串），不是 pathlib 的方法。

```python
from pathlib import Path

# 文件命名约定：subject_001_rest_20260817.csv
path = Path("subject_001_rest_20260817.csv")

# .stem 去掉扩展名："subject_001_rest_20260817"
# .split("_") 按下划线拆成多段：["subject", "001", "rest", "20260817"]
parts = path.stem.split("_")

subject_id = parts[0] + "_" + parts[1]   # "subject" + "_" + "001" → 受试者编号
condition = parts[2]                     # "rest" → 实验条件（静息/任务等）
date = parts[3]                          # "20260817" → 采集日期

print(subject_id, condition, date)
```

- **局限**：真实项目中不要过度依赖文件名解析——文件名约定一旦变更，解析逻辑全部失效
- **更稳妥**：配套一个 metadata CSV，记录受试者编号、条件、日期和文件路径

## 八、高级文件操作技巧

### 8.1 批量合并 / 重命名 / 查找大文件

> 三个实用函数：合并同层 CSV（表头只留一次）、按通配符模式批量改名、递归找大文件。分别用到 `glob`​、`rename`​、`stat().st_size`​ 与 `sorted`。

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

### 8.2 文件监控：轮询 vs watchdog

> 两种思路：**轮询**（定时快照对比，零依赖）与**事件驱动**（watchdog，操作系统主动通知，更及时省资源，需 `pip install watchdog`）。

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

- 轮询缺点：有延迟（取决于 interval）、空转耗资源；优点：零依赖、逻辑简单
- watchdog 优点：事件即时、开销小；缺点：需要安装第三方库

### 8.3 数据备份与清理（shutil）

> 三个函数：**完整备份**（带时间戳复制，避免覆盖旧备份）、**增量备份**（按相对路径镜像，只复制 mtime 更新的）、**清理过期备份**。核心是 `shutil`​ 复制 + `stat().st_mtime` 时间比较。

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

### 8.4 配置文件处理（JSON / YAML / .env）

> 三种配置格式：JSON（程序友好）、YAML（人写友好，支持注释）、.env（环境变量，存密钥/路径）。

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

- JSON：`json.load`​ 解析、`json.dump(..., indent=2, ensure_ascii=False)` 写出（中文不转义）
- YAML：用 `yaml.safe_load`​（安全解析，不执行任意对象），避免 `yaml.load` 的安全风险

## 九、常见错误与易错点

- **相对路径基准**：相对路径相对于"当前工作目录"，不一定相对于 Python 文件所在目录；路径报错先查 cwd
- **反斜杠转义**：Windows 路径优先使用 `Path`，避免手写反斜杠的转义问题
- **覆盖风险**：`write_text()` 默认覆盖文件，重要数据写入前要确认路径
-  **​`+`​** ​ **拼接**：`WindowsPath + str`​ 会报 `TypeError`​；更隐蔽的是 `/`​ 优先级高于 `+` 的混合表达式（见 2.2/2.3）
- **​`touch()`​** ​ **不建父目录**：`Path.touch()`​ 没有 `parents`​ 参数，父目录不存在会抛 `FileNotFoundError`​，先 `mkdir(parents=True)`（见 3.2）
- **空目录/文件缺失**：空目录、文件不存在、CSV 表头、缺失值和列数不一致都要处理，异常要捕获而不是让整个流程崩掉
- **不要假设数据**：不能假设所有 CSV 的采样率、长度和列含义相同——批量求平均前必须校验长度一致（见 7.2）

## 十、自测问题

1. **为什么推荐** **​`Path / "file.csv"`​** ​ **，而不是字符串拼接路径？**   
   答：`Path /` 跨平台（自动处理分隔符与转义）、返回 Path 对象可直接链式调用方法与属性、类型安全；字符串拼接既破坏路径语义，又会在 Windows/Linux 间产生差异。
2. **​`iterdir()`​** ​ **和** **​`rglob()`​** ​ **的区别是什么？**   
   答：`iterdir()`​ 只返回当前层全部子项、不过滤；`rglob(pattern)` 递归所有子目录并按通配符模式过滤。前者"全量列表"，后者"递归 + 按模式筛选"。
3. **为什么批量求平均前要检查每个信号的长度？**   
   答：`np.mean`​ 沿数组轴求平均要求所有信号对齐；长度不一致时逐点平均会把不同时间点的数据混在一起，结果毫无意义。用 `{len(signal)}` 集合去重，长度不止一种即报错。
4. **什么时候用** **​`csv`​**​ **，什么时候用** **​`np.loadtxt`​**​ **？**   
   答：纯数值、格式简单的实验数据用 `np.loadtxt`​（一步得到数组，快）；含复杂文本、缺失值、混合类型时用标准库 `csv` 模块（逐行灵活处理）。

‍

<section class="siyuan-references" aria-label="文档引用">

## 文档关系

### 本文引用
- [Linux专项](/siyuan/其他笔记/命令行/Linux专项/)
- [NumPy专项](/siyuan/Python笔记/NumPy专项/)

### 反向引用
- [NumPy专项](/siyuan/Python笔记/NumPy专项/)
- [Python笔记](/siyuan/Python笔记/)
- [学习笔记](/siyuan/)

</section>
