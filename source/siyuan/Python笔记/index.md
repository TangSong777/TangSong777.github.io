---
title: 'Python笔记'
date: '2026-08-02T00:01:29+08:00'
updated: '2026-08-31T16:29:27+08:00'
layout: page
type: siyuan-note
notebook: '学习笔记'
permalink: 'siyuan/Python笔记/'
siyuan_source: 'Python笔记.md'
comments: false
categories:
  - '学习笔记'
  - 'Python笔记'
---

- 📄 [数据结构专项](/siyuan/Python笔记/数据结构专项/)
- 📄 [算法专项](/siyuan/Python笔记/算法专项/)
- 📄 [PathLib专项](/siyuan/Python笔记/PathLib专项/)
- 📄 [NumPy专项](/siyuan/Python笔记/NumPy专项/)
- 📄 [subprocess专项](/siyuan/Python笔记/subprocess专项/)

## 学习索引

|主题|一句话要点|
| --------------------------| ---------------------------------------------------------------------|
|[一、基础：输入输出与运算](#20260803024557-b279qkz)|变量、print/input、随机数、算术与逻辑运算。|
|[二、控制流：if、while、for](#20260803024557-cgjgptb)|条件分支、循环、break / for-else，以及 for 循环中 try/except 容错。|
|[三、字符串](#20260803024557-dodt0wy)|不可变序列，支持切片、拼接、替换、split/join 分割。|
|[四、函数与参数](#20260803024557-dwyep6d)|封装逻辑，支持默认参数、*args、**kwargs；含入口守卫 `if __name__ == "__main__":`。|
|[五、贯穿案例：猜数字游戏](#20260803024557-yzoa4y4)|用随机数、输入、循环、列表、函数串起全文。|
|[六、常用内置函数与方法](#20260803024557-fu0etwl)|len、max/min/sorted，以及列表和字符串方法。|
|[七、类、对象与方法](#20260803024557-hfbzhhl)|用 class 定义模板，实例化对象并调用方法；类属性 vs 实例属性。|
|[八、方法与函数的区别 & import 的对象（模块/包）](#20260824152757-jbz9nhd)|函数 vs 方法；import 导入的是模块/包（含 `__init__.py`）。|
|[九、as 的用途汇总（导入、异常、with、match）](#20260824163542-fbw233e)|`import...as`​、`except...as`​、`with...as`​、`match...as` 四大用途。|
|[易错点速查](#20260803024557-er3szel)|常见错误与正确写法。|
|[自测问题](#20260803024557-unz1j8z)|用于复习的关键问题（附答案）。|
|列表、元组、集合、字典等|详见 [数据结构专项](/siyuan/Python笔记/数据结构专项/)。|

## <span id="20260803024557-b279qkz" class="siyuan-block-anchor" aria-hidden="true"></span>一、基础：输入输出与运算

> Python 程序从“变量 + 输入 + 输出 + 运算”开始：变量保存值，`input()`​ 拿到字符串，`print()` 输出结果。

### 最小示例

```python
a = 12
print(f"hello {a}")          # 输出变量值
name = input("请输入：")       # 输入默认是字符串
score = int(input("请输入分数："))  # 用 int() 转换类型
```

### 随机数

```python
import random
a = random.randint(1, 100)   # [1, 100] 的整数
b = random.uniform(1, 100)   # [1, 100] 的小数
c = random.random()          # [0, 1) 的小数
```

### 运算速记

- 算术：`+ - * /`​、`**`​ 次方、`%` 求余。
- 比较：`==`​ 相等、`!=` 不等，结果是布尔值。
- 逻辑：`not`​、`and`​、`or`。

### 边界与易错

- `input()` 永远返回字符串；需要数字时先转换。
- `a += 1`​ 等价于 `a = a + 1`。
- Python 变量名背后也是“对象 + 地址”，与 C 的内存模型对应：[内存与地址基础](/siyuan/4-小时彻底掌握-C-指针/#20260626194149-wst5a8w)。

## <span id="20260803024557-cgjgptb" class="siyuan-block-anchor" aria-hidden="true"></span>二、控制流：if、while、for

> 控制流决定程序“按什么顺序执行”：条件分支用 `if`​，重复执行用 `while`​ 和 `for`。

### if 语句

```python
score = int(input("请输入你的分数："))
if score < 0 or score > 100:
    print("分数不合法")
elif score < 60:
    print("不合格")
elif score < 80:
    print("合格")
else:
    print("优秀")
```

### while 与 break

```python
a = 0
while a < 10:
    a += 1
    print(a)
    if a == 5:
        break          # 提前结束循环
print("end")
```

注意：`while True:` 若没有退出条件会变成死循环。

### for 与 range

```python
for i in range(10):      # 左闭右开：[0, 10)
    print(i)

arr = [1, 3, 5, 7, 8]
for i in arr:            # 可以直接遍历列表
    print(i)
```

- `range(10)`​ 表示 `[0, 1, ..., 9]`​；`range(-1, 4)`​ 表示 `[-1, 0, 1, 2, 3]`。
- `for`​ 下方的 `else`​ 只在循环“正常结束”时执行；被 `break` 退出则不执行。

### 边界与易错

- `if`​、`while`​、`for` 的代码块必须缩进。
- 用 `break`​ 时想清楚 `else` 是否还会触发。

### for 循环中的 try/except（容错处理）

> 在 for 循环里对每次迭代做异常捕获：单个数据出错时**跳过继续**，避免一处错误中断整个循环。

- **为什么需要**：批量处理文件/数据时，个别条目可能格式错误（缺列、非数字、编码问题）；不捕获异常的话，一个坏文件就会让整个循环终止。
- **基本写法**：

```python
for path in folder.rglob("*.csv"):
    try:
        # ① 正常逻辑：读取、处理、累加
        data = np.loadtxt(path, delimiter=",", skiprows=1)
        results.append(data.mean(axis=0))
    except (ValueError, OError) as exc:   # ② 捕获可能出的两类错误
        # ③ 出错分支：打印原因，跳过这一个文件，继续下一个
        print(f"跳过 {path}: {exc}")
        continue                          # 显式跳到下一轮迭代（可省略）
```

- **常见模式**：

  1. **出错即跳过**（上面写法）：适合"大部分文件正常，个别坏文件可放弃"；
  2. **收集失败清单**：把失败路径记入 `failed.append(path)`，循环结束后统一报告；
  3. **结果与错误分离**：正常结果进 `results`​，错误原因进 `errors` 字典——便于事后审计。
- **except 写法要点**：

  - `except 异常类型 as e:`​ 捕获并把异常对象命名为 `e` 访问信息；
  - 多种异常用元组：`except (TypeError, ValueError, OSError) as e:`；
  - **不推荐裸** **​`except:`​** ​（吞掉所有异常如 `KeyboardInterrupt`，问题难排查）。
- **易错点**：

  - `try`​ 只包**可能出错的那几行**，不要包住整个大段无关逻辑（否则出错定位困难）；
  - `except`​ 分支必须有动作（打印/记录/continue），不要只写 `pass`；
  - 与 **for-else** 的关系：循环**正常结束**才执行 `else`​；若 try 内 `break`​ 或异常没有被捕获导致退出循环，`else` 不执行（呼应本章 for-else 小节）。
- **验证**：故意造一个坏文件（缺一列或含非数字文本），跑批量循环，观察程序"跳过该文件但继续处理其余文件"的效果。

## <span id="20260803024557-dodt0wy" class="siyuan-block-anchor" aria-hidden="true"></span>三、字符串

> 字符串是不可变序列：可以切片、拼接、查找替换，但不能原地修改某个字符。

### 切片

```python
a = "my name is xxx"
a[1:5]      # "y na"，含头不含尾
a[:5]       # "my na"
a[1:]       # "y name is xxx"
a[1:5:2]    # "y n"
a[::-1]     # 反转字符串
a[-5:-1]    # 从倒数第 5 到倒数第 1
```

### 常用操作

```python
a = "hello".capitalize()      # 首字母大写
a = "hello world".title()     # 每个单词首字母大写
a = "HELLO".lower()           # 转小写
a = "hello".upper()           # 转大写
b = "  hello  ".strip()       # 去掉两侧空白
a = "my name is xxx".replace("xxx", "pig")
arr = "my name is xxx".split(" ")   # ['my', 'name', 'is', 'xxx']
s = "-".join(arr)                   # 'my-name-is-xxx'
```

### 运算与取字符

```python
s = "0" + "H"     # 拼接，结果是 "0H"
s = "H" * 2       # 重复，结果是 "HH"
string = "app"
string[0]         # 'a'
```

### 边界与易错

- `string[0] = 'b'` 会报错，因为字符串不可变。
- `upper()`​、`lower()` 返回新字符串，不会修改原字符串。

## <span id="20260803024557-dwyep6d" class="siyuan-block-anchor" aria-hidden="true"></span>四、函数与参数

> 函数把一段可复用逻辑包起来；参数分位置参数、默认参数、`*args（位置参数）`​、`**kwargs（关键字参数）`。

### 最小示例

```python
def isDouble(n: int) -> bool:
    return n % 2 == 0

num = int(input("输入一个数字："))
if isDouble(num):
    print(f"{num} 是偶数")
else:
    print(f"{num} 不是偶数")
```

### 参数速记

```python
def f(n, age=18, *args, **kwargs):
    print(n, age, args, kwargs)

f(1, 19, 2, 3, 6, 9, ns=15, nt=16)
# n=1, age=19, args=(2, 3, 6, 9), kwargs={'ns': 15, 'nt': 16}
```

- `*args`：收集多余的位置参数，得到元组。
- `**kwargs`：收集多余的关键字参数，得到字典。

### 全局变量

```python
DAY = 0

def day():
    global DAY
    DAY += 1
```

### 入口守卫：if **name** == "__main__":

> 当文件被直接运行时，`__name__`​ 的值是字符串 `"__main__"`​；当文件被 `import`​ 导入时，`__name__`​ 是模块名。所以这段代码只在“直接运行本文件”时执行 `main()`，被导入时不会执行。

```python
def main():
    print("程序从这里开始")

if __name__ == "__main__":
    main()
```

要点：

- `__name__` 是 Python 自动维护的内置变量。
- 把入口逻辑放进 `main()`，再用这个判断调用，程序结构更清晰。
- 被其他脚本 `import` 时，只加载定义，不会误执行。

### 特殊变量（dunder）：__name__、__main__、__file__、__doc__

> 双下划线包裹的"魔法变量"由 Python 解释器自动维护，用来暴露脚本/模块的运行时信息。最常用的是 `__name__`​（判断运行方式）、`__file__`​（脚本路径）、`__doc__`（文档字符串）。

 **​`__name__`​** ​ **与**  **​`__main__`​** ​ **：判断"谁在运行"**

- `__name__` 是解释器自动赋值的变量：

  - **直接运行**本文件时 → 值等于 `"__main__"`；
  - **被** **​`import`​**​ 时 → 值等于模块名（如 `"script"`）。
- **为什么有**：让同一个文件既能"直接运行"又能"被导入复用"，并区分两种场景的行为——入口守卫 `if __name__ == "__main__":` 正是利用这个差异（联动 8.4 从其他脚本导入函数）。

```python
print(__name__)   # 直接运行 → __main__；被 import → 模块名

if __name__ == "__main__":
    main()        # 直接运行时才执行；被导入时不执行
```

 **​`__file__`​** ​ **：当前脚本/模块的路径**

- 值为当前文件的路径（相对还是绝对，取决于你如何启动）。
- **为什么有**：脚本可能从任意目录被运行，"当前工作目录"不可靠；`__file__` 让你定位"自己"所在位置，从而找到同目录的数据/配置文件。
- **怎么用**：

```python
from pathlib import Path
base = Path(__file__).resolve().parent   # 脚本所在目录（解析为绝对路径）
data_path = base / "data" / "config.csv" # 与"从哪启动"解耦
```

- **注意**：在交互式解释器/REPL 或 `python -c`​ 中运行代码时 `__file__`​ **不存在**（直接 `NameError`），应先判断或只在脚本文件中使用。

 **​`__doc__`​** ​ **：文档字符串**

- 模块/函数/类**开头第一处字符串字面量**就是它的文档字符串，可通过 `__doc__`​ 访问（`help()` 也会显示）。

```python
def add(a, b):
    """返回 a 与 b 的和"""
    return a + b

print(add.__doc__)   # 返回 a 与 b 的和
```

 **（了解）其它常用特殊变量**

- `__all__`​：`from module import *` 时默认导出的名字清单；
- `__version__`：模块约定俗成的版本号属性。

### 多返回值与拆包

```python
def g():
    return 1, 2

b = g()       # (1, 2)
a, b = g()    # 元组拆包
```

### 边界与易错

- 默认参数不要用可变对象（详见 [可变与不可变类型](/siyuan/Python笔记/数据结构专项/#20260817191520-5epv779) ）：`def f(x=[]):`​ 是经典坑，应写为 `def f(x=None):`。

## <span id="20260803024557-yzoa4y4" class="siyuan-block-anchor" aria-hidden="true"></span>五、贯穿案例：猜数字游戏

> 把随机数、输入、if、while、列表、函数串起来。

```python
import random

def check(guess, target):
    if guess > target:
        return "大了"
    if guess < target:
        return "小了"
    return "猜中"

target = random.randint(1, 100)
history = []

while True:
    guess = int(input("请输入 1~100 的数字："))
    history.append(guess)
    result = check(guess, target)
    print(result)
    if result == "猜中":
        break

print(f"共猜了 {len(history)} 次：{history}")
```

## <span id="20260803024557-fu0etwl" class="siyuan-block-anchor" aria-hidden="true"></span>六、常用内置函数与方法

> 函数独立调用，方法属于某个对象：`len(x)`​ 是函数，`x.append(...)` 是列表的方法。

### 内置函数速记

```python
shopping = ["键盘", "键帽", "音响", "电竞椅"]
print(len(shopping))       # 4
print(max([3, 7, 2]))      # 7
print(min([3, 7, 2]))      # 2
print(sorted([3, 1, 2]))   # [1, 2, 3]
```

### 列表方法

- `append(x)`：末尾添加。
- `insert(i, x)`：在下标 i 前插入。
- `remove(x)`：删除第一个值等于 x 的元素。
- `pop(i)`：删除并返回下标 i 的元素。
- `clear()`：清空。
- `copy()`：复制出新列表。
- `sort()`：原地排序。

### 字符串方法

- `capitalize()`​、`title()`​、`lower()`​、`upper()`：大小写转换。
- `strip()`​、`lstrip()`​、`rstrip()`：去除空白。
- `replace(old, new)`：替换。
- `split(sep)`：按分隔符拆成列表。
- `join(iterable)`：用字符串拼接列表元素。

### 边界与易错

- 字符串方法返回新字符串，不会原地修改原字符串。
- `sort()`​ 是原地修改；`sorted()` 返回新列表。
- `len()` 对字符串、列表、元组、字典都可用。

## <span id="20260803024557-hfbzhhl" class="siyuan-block-anchor" aria-hidden="true"></span>七、类、对象与方法

> 类是“模板”，对象（实例）是“按模板创建的具体个体”；方法就是定义在类里、由对象调用的函数。

### 最小示例

```python
class Dog:
    def __init__(self, name, age):
        self.name = name
        self.age = age

    def bark(self):
        return f"{self.name} 在叫"

    def grow_up(self):
        self.age += 1

d = Dog("旺财", 3)      # 实例化：自动调用 __init__
print(d.name)           # 旺财
print(d.bark())         # 旺财 在叫
d.grow_up()
print(d.age)            # 4
```

### 要点速记

- `class Dog:` 定义类，类名通常用大驼峰写法。
- `__init__` 是构造方法，创建对象时自动执行，用于初始化实例属性。
- `self`​ 代表“当前这个对象”，方法的第一参数必须写 `self`。
- 通过 `对象.方法()`​ 调用方法，通过 `对象.属性` 访问实例属性。

### 类属性与实例属性

- 写在类体里的变量是类属性，所有实例共享。
- 在 `__init__`​ 里用 `self.xxx` 创建的是实例属性，每个实例各自独立。

```python
class Counter:
    total = 0           # 类属性：所有实例共享

    def __init__(self):
        self.count = 0  # 实例属性：每个实例独立

Counter.total += 1
print(Counter.total)    # 1
```

### 让对象更易读：__str__

```python
class Dog:
    def __init__(self, name):
        self.name = name

    def __str__(self):
        return f"Dog({self.name})"

print(Dog("旺财"))      # Dog(旺财)
```

### 边界与易错

- 方法少了 `self` 会报错或行为异常。
- 实例化要加括号：`Dog(...)`​，不能只写 `Dog`。
- `__init__`​ 里也不要使用可变默认参数：`def __init__(self, items=[]):`​ 是坑，应写 `items=None`。
- 不要混淆类属性和实例属性：类属性用 `类名.属性`​ 访问，实例属性用 `self.属性`。
- 相关知识点：[函数与参数](#20260803024557-dwyep6d)、详见 [可变与不可变类型](/siyuan/Python笔记/数据结构专项/#20260817191520-5epv779)。

## <span id="20260824152757-jbz9nhd" class="siyuan-block-anchor" aria-hidden="true"></span>八、方法与函数的区别 & import 的对象（模块/包）

> 函数是可独立调用的命名代码块（`len()`​、`sorted()`​）；方法是绑定在对象上、由对象调用的函数（`list.append()`​）；`import`​ 导入的是"模块"或"包"（含 `__init__.py` 的模块目录）。

### 8.1 方法 vs 函数

|维度|函数|方法|
| ----------| -----------------------| ----------------------------------------------------------------|
|定义位置|模块顶层（`def` 直接写）|类的内部（`def`​ 写在 `class` 里）|
|调用方式|直接 `f(...)`|`对象.方法(...)`|
|绑定对象|不绑定|隐含绑定（实例方法自动传 `self`​；类方法传 `cls`）|
|典型例子|`len()`​、`max()`​、`sorted()`​、`print()`|`"abc".upper()`​、`list.append()`​、`dict.get()`|
|本质|普通函数对象|本质也是函数对象，只是作为属性挂在对象/类上，自动注入 self/cls|

- 检查类型：`type(len)`​ 与 `type("abc".upper)`​ 都返回 function/method 相关类型，但一个重要区别是**方法携带所属对象**。
- 三种方法：实例方法（`self`​，最常见）、类方法（`@classmethod`​ → `cls`​）、静态方法（`@staticmethod`，与类无关但放类里方便组织）。

### 8.2 import 的到底是包、模块还是库？

- **模块（module）** ：一个 `.py`​ 文件。`import math`​ → 导入的就是模块 `math`。
- **包（package）** ：一个**目录 +**   **​`__init__.py`​**​，是"模块的容器"，里面可有多个子模块/子包。`import numpy`​ → `numpy` 是包。
- **import 导入的是一个对象**：`import numpy`​ 后变量 `numpy`​ 绑定的是**包对象**；`from . import`​ / `from pkg import mod` 则是从包中取出子模块或名字。
-  **"库（library）"是泛称**：泛指可复用的模块/包集合（如"Python 标准库" = 一堆模块 + 包），不是 Python 的语言概念。
- 一句话：**import 的一定是模块（或包——包是特殊的模块集合）；"库"只是日常叫法。**

### 8.3 边界与易错

- Python 3 普通包目录**必须有**  **​`__init__.py`​**（否则只是"命名空间"目录，无法按包导入）。
- `from math import sqrt`​：`math`​ 是模块，`sqrt` 是模块里的函数——两者层级别混。
- 与第 4 章"入口守卫"联动：`import`​ 过某文件时，其 `__name__`​ 是模块名而非 `"__main__"`​，所以 `if __name__ == "__main__":` 里的代码不会在导入时执行。

### <span id="20260827115231-aynpyzs" class="siyuan-block-anchor" aria-hidden="true"></span>8.4 从其他脚本导入函数（模块复用）

> 把函数写在一个 `.py`​ 文件（模块）里，其他脚本 `import` 后即可复用——这是模块化复用的最基本形式。配合 8.2"import 导入的是模块/包"理解最顺。

**同目录导入**：

```python
# script.py：定义函数 + 入口守卫
def run_sync():
    print("执行同步")

if __name__ == "__main__":
    run_sync()
```

```python
# main.py：两种导入方式
import script                # 方式一：import 整个模块
script.run_sync()            # 用 模块名.函数名 调用

from script import run_sync  # 方式二：from 模块 import 具体名字
run_sync()                   # 直接调用
```

**入口守卫与导入的关系**：

- `import script`​ 时，`__name__`​ 是模块名 `"script"`​，`if __name__ == "__main__":`​ **不会执行**——导入只加载定义，不会误触发入口；
- 但函数定义本身**照常可用**：`script.run_sync()`​ 或 `from script import run_sync` 后再调用。

**不同目录 / 包**：

- **包** = 目录 + `__init__.py`​（见 8.2），跨包导入：`from pkg.mod import func`；
- 工具脚本在别的目录时：把目录加入 `sys.path`​（`sys.path.append("/path/to")`​），或在包内用相对导入（`from . import sibling`）。

**常见问题**：

- 文件名**以数字开头或含连字符**（如 `2file.py`​、`my-script.py`）→ 不是合法标识符，无法 import；
- **循环导入**（A 导入 B 且 B 导入 A）→ 尽量解耦，或把其中一个 import 移到函数内部推迟执行；
- **名字冲突** → 用别名：`from a import func as afunc`。

**联动**：实际案例——"在其他文件复用自动执行命令的函数"见 [Python 调用系统命令学习方案：从其他文件复用函数](/siyuan/已归档/Python-调用系统命令学习方案（已归档）/#20260827114934-rqcm21z)。

## <span id="20260824163542-fbw233e" class="siyuan-block-anchor" aria-hidden="true"></span>九、`as` 的用途汇总（导入、异常、with、match）

> `as`​ 核心作用：**给对象起个别名 / 绑定到变量**。Python 中常见四大用途：`import...as`​、`except...as`​、`with...as`​、`match...case...as`。

### 9.1 `import ... as`：导入别名

```python
import numpy as np                  # 给模块/包起短别名
from math import sqrt as s          # 从模块中取对象并改名
from pathlib import Path as P       # 专属别名，避免与环境变量 Path 冲突
```

- 为什么用：短、好打；避免命名冲突（两个库导出同名函数）；统一风格。
- 本质：`import X as Y`​ ≈ `import X; Y = X`（把模块对象绑定到新名字 Y）。

### 9.2 `except ... as e`：捕获异常对象

```python
try:
    x = int(user_input)
except ValueError as e:               # 把异常实例绑定到 e，可读取信息
    print(f"转换失败: {e}")           # str(e) = 异常描述文本
```

- `e`​ 只在 except 块内可用，常见别名 `e`​ / `exc`​ / `error`。
- `e.args` 保存异常构造时的参数元组（有些异常信息在 args 里）。

### 9.3 `with ... as f`：上下文管理器返回值

```python
with open("data.txt", "r", encoding="utf-8") as f:   # f = 文件对象
    print(f.read())                                  # with 退出时自动关闭 f
```

- `with 表达式 as 变量`​：进入时把上下文管理器的 `__enter__()`​ 返回值绑定到变量；退出时自动调用 `__exit__()`（文件自动关闭、锁自动释放）。

### 9.4 `match / case ... as`（Python 3.10+，了解即可）

```python
match point:
    case (x, y) as whole:      # as 把"匹配到的整个对象"绑定到变量 whole
        print(whole, x, y)
```

- 语法：`case 模式 as 变量:`，把匹配结果整体绑定；较新、用得少。

### 9.5 易错与速记

- `import a as b`​ 之后：`b`​ 是别名，**​`a`​**​ **原名也仍可用**（原名仍绑定在命名空间）；
- `except ... as e:`​ 的 `e`​ 在 except 块结束后**自动失效**（Python 3 会释放），不要在块外使用；
- `as` 不改变对象本身，只改变"叫它的名字"；同名缩写（np/pd/os）是社区惯例。

## <span id="20260803024557-er3szel" class="siyuan-block-anchor" aria-hidden="true"></span>易错点速查

- `input()`​ 返回字符串，先 `int()` 再比较或运算。
- `range(10)` 是左闭右开，不包含 10。
- 字符串不可变：不能 `s[0] = 'x'`​；要用 `replace()` 或重新赋值。
- 对列表 `b = a`​ 是两个名字指向同一对象；要复制用 `a.copy()`。
- `a.sort()`​ 原地排序，`sorted(a)` 返回新列表。
- 字典键必须可哈希（不可变），列表不能当键。
- 默认参数不要写成 `def f(x=[]):`。
- 函数内修改列表会直接影响函数外；修改整数不会。
- `if __name__ == "__main__":`​ 是入口守卫，被导入时不应触发 `main()`。
- 类方法第一参数写 `self`​，实例化要写 `Dog()`。
- `__init__` 的默认参数同样不能用可变对象。
- 类属性用 `类名.属性`​，实例属性用 `self.属性`。

## <span id="20260803024557-unz1j8z" class="siyuan-block-anchor" aria-hidden="true"></span>自测问题

1. `range(10)` 输出 0 到几？

   [0,10]左闭右开这个区间中的整数，即[0, 1, 2, 3 ,4, 5, 6, 7, 8, 9]
2. `s = "abc"; s[0] = "x"` 为什么报错？

   字符串为不可变对象，想要对其进行赋值操作只能新建一片内存区域，再让字符串的变量名-即指针指向新的内存区域
3. `b = a`​ 和 `b = a.copy()` 对列表有什么区别？

   从指针的角度来看，前者意味着b和a都指向同一片内存区域，当修改a/b其中任意一个列表的元素时，另一个列表的元素也是变化的。

   而后者意味着将a这个列表中的元素全部复制给b，二者的内存区域互相独立，当对一方进行修改时，不会影响另一方
4. 为什么 `def f(x=[]):` 是经典坑？

   默认参数不要用可变对象，应写为 `def f(x=None):`。
5. `*args`​ 和 `**kwargs` 分别收集什么？

   *args 收集多余的位置参数，放进一个 元组 tuple  
   **kwargs 收集多余的关键字参数，放进一个 字典 dict

   举例：

   ```python
   def show(*args, **kwargs):
       print(args)
       print(kwargs)
   show(1, 2, 3, name="Tom", age=18)

   """
   输出为：
   (1, 2, 3)
   {'name': 'Tom', 'age': 18}
   """
   ```
6. `self` 在类方法里代表什么？

   当前正在操作的那个实例对象。
7. `__init__` 什么时候执行？

   创建实例时自动执行，用来初始化实例属性。
8. `len()`​ 和 `list.append()` 有什么区别？

   `len()`​ 是独立函数；`append()`​ 是列表对象的方法，必须通过 `列表.append()` 调用。
9. `if __name__ == "__main__":` 有什么用？

   只在文件被直接运行时执行 `main()`；被其他文件 import 时不会执行。

‍

<section class="siyuan-references" aria-label="文档引用">

## 文档关系

### 本文引用
- [4 小时彻底掌握 C 指针](/siyuan/4-小时彻底掌握-C-指针/)
- [NumPy专项](/siyuan/Python笔记/NumPy专项/)
- [PathLib专项](/siyuan/Python笔记/PathLib专项/)
- [Python 调用系统命令学习方案（已归档）](/siyuan/已归档/Python-调用系统命令学习方案（已归档）/)
- [subprocess专项](/siyuan/Python笔记/subprocess专项/)
- [数据结构专项](/siyuan/Python笔记/数据结构专项/)
- [算法专项](/siyuan/Python笔记/算法专项/)

### 反向引用
- [Python 调用系统命令学习方案（已归档）](/siyuan/已归档/Python-调用系统命令学习方案（已归档）/)
- [subprocess专项](/siyuan/Python笔记/subprocess专项/)
- [学习笔记](/siyuan/)

</section>
