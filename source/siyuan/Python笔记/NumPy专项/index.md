---
title: 'NumPy专项'
date: '2026-08-17T11:40:56+08:00'
updated: '2026-08-24T17:23:00+08:00'
layout: page
type: siyuan-note
notebook: '学习笔记'
permalink: 'siyuan/Python笔记/NumPy专项/'
siyuan_source: 'Python笔记/NumPy专项.md'
comments: false
categories:
  - '学习笔记'
  - 'Python笔记'
---

# NumPy 专项

> NumPy 是 Python 科学计算的基础库。当前学习目标：从“能看懂数组”进入“能独立完成数组与信号处理任务”。
>
> 参考来源：NumPy 基础练习、练习中的运行笔记，以及 Python 基础笔记的"概念 → 示例 → 场景 → 易错点 → 自测"架构。

## 一、安装与导入

### 安装与导入

```bash
pip install numpy
```

```python
import numpy as np

print(np.__version__)
```

项目代码统一使用 `import numpy as np`，便于阅读和调用。

### 使用场景

- 数组与矩阵计算
- 图像、视频、传感器数据的批量运算
- PPG/rPPG 时间序列处理
- FFT、统计分析和实验数据预处理

## 二、数组创建

### 常用创建函数

|函数|作用|常见场景|
| ------| --------------------------------------| --------------------------------|
|`np.array(obj)`|从列表或嵌套列表创建数组|将已有数据转成 NumPy 数组|
|`np.arange(start, stop, step)`|按步长生成，左闭右开|生成索引、时间轴、整数序列|
|`np.linspace(start, stop, num)`|生成固定数量的等间隔点，默认包含终点|生成实验采样点、连续区间|
|`np.zeros(shape)`|创建全 0 浮点数组|初始化 buffer、掩码|
|`np.ones(shape)`|创建全 1 浮点数组|初始化权重、测试数据|
|`np.empty(shape)`|创建未初始化数组|追求性能且随后会完整覆盖时使用|

```python
import numpy as np

a = np.array([1, 2, 3])
b = np.arange(0, 10, 2)       # [0 2 4 6 8]，不包含 10
c = np.linspace(0, 1, 5)      # [0.   0.25 0.5  0.75 1.  ]
d = np.zeros((2, 3))
e = np.ones(4)
```

### <span id="20260824171040-bu47ao1" class="siyuan-block-anchor" aria-hidden="true"></span>从文件读写数组（loadtxt / savetxt）

> `np.loadtxt`​ 把纯数值 CSV/文本文件读成数组（`delimiter`​ 分隔符、`skiprows`​ 跳行）；`np.savetxt`​ 把数组写入文件（`header`​ 表头、`comments` 注释符）。纯数值实验数据读写首选。

```python
import numpy as np

# 读取：signal.csv 形如 [time, value] 两列带表头
data = np.loadtxt("signal.csv", delimiter=",", skiprows=1)
time = data[:, 0]      # 时间列（二维索引详见下方"四、索引、切片"）
value = data[:, 1]     # 信号列

# 写入：时间列 + 信号列并排成两列，写表头且不加 # 前缀
np.savetxt("out.csv", np.column_stack((time, value)),
           delimiter=",", header="time,value", comments="")
```

- `np.column_stack((t, signal))`：把两个一维数组按"列"并排成二维数组
- `comments=""`​：必须设置，否则 `header`​ 会被默认加 `#`​ 前缀（`np.loadtxt` 读到时会当作注释）
- **局限**：`loadtxt`​ 只适合纯数字文件；含复杂文本/缺失值/混合类型改用 Python 标准库 `csv`​ 模块（见 [6.3 从 CSV 读到 NumPy（联动）](/siyuan/Python笔记/PathLib专项/#20260824170913-zj11ylf)）
- **联动案例**：批量生成多受试者信号文件并逐个读取求平均 → [七、批量处理实验数据（综合案例）](/siyuan/Python笔记/PathLib专项/#20260824170927-bgv7ya3)

### `arange`​ 与 `linspace` 的区别

- `arange` 指定步长，终点通常不包含，适合整数索引和时间轴。
- `linspace` 指定元素数量，默认包含终点，适合需要固定采样点数量的场景。

### 数组类型

```python
a = np.array([1, 2, 3])
b = np.zeros(3)

print(a.dtype)   # 整数类型，如 int64
print(b.dtype)   # 浮点类型，如 float64
```

输出中的 `0.`​、`1.` 表示浮点数；NumPy 信号处理通常使用浮点数组。

## 三、数组属性与形状

### 常用属性

|属性|含义|
| ------| ----------------------|
|`arr.ndim`|维度数量|
|`arr.shape`|每个维度的长度|
|`arr.size`|元素总数|
|`arr.dtype`|元素数据类型|
|`arr.itemsize`|单个元素占用的字节数|

```python
a = np.arange(30)
print(a.ndim)     # 1
print(a.shape)    # (30,)
print(a.size)     # 30
print(a.dtype)    # int64
```

### `reshape` 改变形状

```python
a = np.arange(30)

matrix = a.reshape(5, 6)       # 5 行 6 列
volume = a.reshape(2, 3, 5)    # 2 个 3×5 的二维数组

print(matrix.shape)            # (5, 6)
print(volume.shape)            # (2, 3, 5)
```

`reshape`​ 前后元素总数必须相同：30 个元素不能 reshape 成 `(4, 8)`。

### 使用场景

- 检查模型输入是否为 `(batch, channel, length)`
- 将一维时间序列整理为窗口
- 将图像整理为 `(height, width, channel)`
- 调试时优先打印 `shape`，不要凭感觉判断维度

## 四、索引、切片与布尔索引

### 一维索引与切片

```python
a = np.arange(10)

print(a[0])       # 第一个元素
print(a[-1])      # 最后一个元素
print(a[2:5])     # 下标 2、3、4，不包含 5
print(a[:3])      # 前 3 个
print(a[::2])     # 每隔一个取一个
print(a[-2:])     # 后两个
```

### <span id="20260817154937-jnivunu" class="siyuan-block-anchor" aria-hidden="true"></span>二维索引

```python
matrix = np.arange(12).reshape(3, 4)

print(matrix[1, 2])    # 第 2 行第 3 列
print(matrix[0, :])    # 第 1 行
print(matrix[:, 1])    # 第 2 列
print(matrix[:, 1:3])  # 第 2、3 列
```

**二维索引取行/取列速查**：

|**写法**|**取的是什么**|**示例结果**|**维度**|
| ------| ----------------------------| ------| -------|
|`data[0, 1]`|第 0 行、第 1 列（单个值）|`20`|标量|
|`data[0, :]`|第 0 行、所有列|`[10, 20, 30]`|1D|
|`data[:, 0]`|所有行、第 0 列|`[10, 40, 70]`|1D|
|`data[:, 1]`|所有行、第 1 列|`[20, 50, 80]`|1D ✅|
|`data[1:3, 0:2]`|第 1<sub>2 行，第 0</sub>1 列|`[[40,50],[70,80]]`|2D|

批量处理中 `data[:, 1]`​ 是"取某一列"的标准写法（联动：[7.3 二维索引取行/取列速查](/siyuan/Python笔记/PathLib专项/#20260824170927-w1661x4)）。

### 布尔索引

```python
a = np.array([1, 5, 2, 8, 3])
mask = a > 3
print(mask)       # [False  True False  True False]
print(a[mask])    # [5 8]
```

多个条件使用 `&`​、`|`，每个条件要加括号：

```python
freqs = np.array([0.1, 0.8, 1.2, 5.0])
mask = (freqs >= 0.5) & (freqs <= 4.0)
selected = freqs[mask]
```

- `&` 是逐元素逻辑与，适用于 NumPy 数组。
- Python 的 `and` 不能直接用于数组条件。
- `~mask` 表示布尔取反。

## 五、向量化运算与广播

### 基本运算

```python
a = np.array([1, 2, 3])

print(a + 10)       # 每个元素加 10
print(a * 2)        # 每个元素乘 2
print(a ** 2)       # 每个元素平方
print(np.sin(a))    # 对每个元素求 sin
```

NumPy 会对数组整体进行批量运算，通常不需要手写 `for` 循环。

### 广播

```python
x = np.array([[1, 2, 3], [4, 5, 6]])
mean = np.array([1, 2, 3])
print(x - mean)      # mean 自动广播到每一行
```

**使用场景**：批量减均值、归一化、RGB 通道校正、模型输入标准化。

### 与 Python 列表的区别

```python
list_a = [1, 2, 3]
# list_a + 10  # 报错

array_a = np.array(list_a)
print(array_a + 10)  # [11 12 13]
```

列表的 `+`​ 通常表示拼接，NumPy 数组的 `+` 表示逐元素加法。

## 六、统计与聚合

```python
a = np.array([3, 1, 4, 1, 5, 9, 2, 6])

np.sum(a)       # 总和
np.mean(a)      # 平均值
np.max(a)       # 最大值
np.min(a)       # 最小值
np.std(a)       # 标准差
np.argmax(a)    # 最大值下标
np.argmin(a)    # 最小值下标
```

二维数组可以指定 `axis`：

```python
matrix = np.array([[1, 2, 3], [4, 5, 6]])
print(np.sum(matrix, axis=0))   # 按列聚合
print(np.sum(matrix, axis=1))   # 按行聚合
```

### 在信号处理中的场景

- `mean`：估计直流分量、计算基线
- `std`：衡量波动程度和噪声水平
- `argmax`：找到 FFT 幅值最大的频率位置
- `min/max`：检查信号范围和异常值

**批量实验平均值**：`np.mean(np.array(signals), axis=0)`​ 把多个文件堆叠成 (文件数, 采样点数) 后沿"文件轴"求平均，得到每个采样点位置的平均值——多受试者信号批量处理的骨架（联动：[7.2 批量读取与求平均（完整脚本）](/siyuan/Python笔记/PathLib专项/#20260824170927-cmsi10l)）。

## 七、随机数与可复现

### 推荐写法

```python
rng = np.random.default_rng(42)
noise = rng.standard_normal(5)      # 标准正态分布
uniform = rng.uniform(0, 1, 5)      # 均匀分布
integers = rng.integers(0, 10, 5)   # 随机整数
normal = rng.normal(0, 0.5, 5)     # 指定均值和标准差
```

固定种子后，同一段代码会产生相同结果，便于科研复现和调试。

### 与 Python `random` 的区别

- `random` 适合少量普通 Python 对象的随机操作。
- `np.random`​/`Generator` 面向数组和数值计算，适合批量生成实验数据、噪声和训练样本。
- 新代码优先使用 `np.random.default_rng(seed)`，不建议依赖旧式全局随机状态。

## 八、时间轴与信号构造

### 采样率与时间轴

```python
fs = 30                         # 每秒 30 个采样点
duration = 10
t = np.arange(0, duration, 1 / fs)
```

`fs`​ 是采样频率，采样间隔为 `1/fs`。

### 构造正弦信号

```python
f = 1.2                         # 频率 1.2 Hz
sig = np.sin(2 * np.pi * f * t)
print(f * 60)                   # 72 BPM
```

使用场景：模拟周期信号、测试滤波器、验证心率检测流程。

## 九、FFT 与频域分析

### 基本流程

```python
fft_vals = np.fft.rfft(sig)             # 时域 → 正频率部分
freqs = np.fft.rfftfreq(len(sig), 1 / fs)
magnitude = np.abs(fft_vals)            # 频率强度

peak_idx = np.argmax(magnitude)
peak_freq = freqs[peak_idx]
heart_rate = peak_freq * 60
```

### 函数说明

|函数|作用|
| ------| ----------------------------------|
|`np.fft.fft`|完整 FFT，包含正负频率|
|`np.fft.rfft`|实数信号的正频率部分，结果更紧凑|
|`np.fft.fftfreq`|与 `fft` 对应的频率轴|
|`np.fft.rfftfreq`|与 `rfft` 对应的频率轴|
|`np.abs`|复数幅值|
|`np.argmax`|找最大幅值下标|
|`np.fft.irfft`|正频率结果逆变换回时域|

### 关键概念

- 采样率为 `fs`​ 时，最高可分析频率约为 `fs/2`，这是奈奎斯特频率。
- 频率分辨率约为 `fs/N`​，其中 `N` 是采样点数；采样时间越长，频率分辨率越高。
- `rfft`​ 输出复数，通常先用 `np.abs` 转成幅值再分析。

## 十、频域带通滤波

```python
fft_vals = np.fft.rfft(noisy)
freqs = np.fft.rfftfreq(len(noisy), 1 / fs)

mask = (freqs >= 0.5) & (freqs <= 4.0)
fft_filtered = fft_vals.copy()
fft_filtered[~mask] = 0
filtered = np.fft.irfft(fft_filtered, n=len(noisy))
```

### 为什么使用 `.copy()`

`fft_filtered = fft_vals`​ 只创建别名，修改 `fft_filtered`​ 会同时修改原数组。使用 `.copy()` 才能保留原始频谱，方便比较滤波前后结果。

### 场景与边界

- `0.5–4 Hz`​ 大致对应 `30–240 BPM`，适合演示心率范围。
- 范围过窄会误删目标信号；范围过高或过低也可能保留错误成分。
- 频域置零是教学和快速验证方法；真实项目还需考虑滤波器边界、相位、运动伪影和信号质量。

## 十一、噪声与 SNR

### 添加噪声

```python
rng = np.random.default_rng(42)
noise = rng.standard_normal(len(sig))
noisy = sig + 0.5 * noise
```

噪声系数越大，通常信号质量越差；但主频是否检测失败还取决于信号长度、频率分辨率和噪声分布。

### SNR 计算

```python
signal_power = np.mean(clean ** 2)
noise_power = np.mean((processed - clean) ** 2)
snr_db = 10 * np.log10(signal_power / noise_power)
```

SNR 越高，表示信号功率相对于噪声功率越大，通常代表信号质量更好。实验中要明确“信号”和“噪声”的定义，不能只看一个数字就宣称算法有效。

## 十二、常见错误与边界

- `np.arange`​ 的终点通常不包含；`linspace` 默认包含终点。
- `zeros`​、`ones`​ 默认生成浮点数组；需要整数时显式指定 `dtype=int`。
- `shape`​ 是元组，例如一维数组是 `(30,)`​，不是 `30`。
- `reshape` 前后元素总数必须一致。
- 数组多条件筛选要用 `(条件1) & (条件2)`​，不能用 `and`。
- `argmax` 返回位置，不是最大值本身。
- `a / 0`​、`np.sqrt(-1)`​ 可能产生 `inf`​、`nan`​ 和 `RuntimeWarning`；警告不等于程序一定停止，但结果需要检查。
- 不要把 NumPy 数组简单称为“列表”；数组支持维度、dtype、广播和向量化运算。

## 十三、当前学习证据与能力评估

### 已有证据

- 运行输出：成功安装 NumPy、打印版本号；完成数组创建、shape/dtype/size、运算、聚合、FFT、滤波和 SNR 练习。
- 参数修改：修改噪声系数，观察标准差和检测结果变化；噪声系数为 2.0 时仍能检测，5.0 时检测失败。
- 原理解释：能解释 SNR 越高代表信号相对噪声更强；能记录采样率、时间轴、正弦波构造和 FFT 主频检测。

### 当前等级

**NumPy：L2（能够使用）** 。

依据：已在练习和 AI 辅助下完成一套从数组创建到信号分析的任务，并提交了运行和参数修改证据。暂不升级到 L3，因为目前证据主要来自跟随分步练习，尚缺一个脱离教程、独立设计并完成的新任务。

### L3 晋级任务

独立写一个 `analyze_signal(signal, fs)` 函数，输入任意一维信号和采样率，返回：

- 信号长度、均值、标准差
- FFT 主频和对应 BPM
- 是否存在空值或非有限值
- 对输入长度不足、`fs <= 0` 等情况给出合理处理

完成后提交：运行输出、至少两组参数/输入变化结果、用自己的话解释 `fs`​、频率分辨率和 `argmax` 的关系。

## 十四、自测问题

1. `arange`​ 和 `linspace` 的主要区别是什么？
2. `(30,)`​ 和 `(5, 6)` 分别表示什么？
3. 为什么 NumPy 数组可以直接执行 `a + 10`？
4. `argmax` 返回什么？
5. `rfft`​、频率轴和 `abs` 三者如何配合找主频？
6. 为什么多个数组条件要用 `&`​ 而不是 `and`？
7. 为什么修改 FFT 结果前通常需要 `.copy()`？
8. 采样率和最高可分析频率有什么关系？

<section class="siyuan-references" aria-label="文档引用">

## 文档关系

### 本文引用
- [PathLib专项](/siyuan/Python笔记/PathLib专项/)

### 反向引用
- [PathLib专项](/siyuan/Python笔记/PathLib专项/)
- [Python笔记](/siyuan/Python笔记/)
- [学习笔记](/siyuan/)

</section>
