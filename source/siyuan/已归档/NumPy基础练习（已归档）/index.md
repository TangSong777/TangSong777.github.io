---
title: 'NumPy基础练习（已归档）'
date: '2026-08-15T17:16:31+08:00'
updated: '2026-08-17T19:11:25+08:00'
layout: page
type: siyuan-note
notebook: '学习笔记'
permalink: 'siyuan/已归档/NumPy基础练习（已归档）/'
siyuan_source: '已归档/NumPy基础练习（已归档）.md'
comments: false
categories:
  - '学习笔记'
  - '已归档'
---

# NumPy 基础练习

> 目标：从零学会 NumPy，最后自然拼出一个"模拟 PPG 信号并找心率"的小程序。
>
> 方式：**先学零件，再拼机器**。一共 14 小步，每步 5-10 分钟，每步都有"运行看什么"和"自己做"。
>
> 要求：每步都**亲自敲代码**（不要复制粘贴），运行看结果，然后再进入下一步。卡住可以问，但先自己试 5 分钟。

---

## 阶段一：认识 NumPy（第 1-7 步）

### Step 1：装好环境，跑第一行 NumPy

**目标**：确认 numpy 装好了。

```python
import numpy as np

print(np.__version__)
```

**运行看什么**：打印出版本号（比如 1.26.x / 2.x）。

**自己做**：如果报错 `ModuleNotFoundError`​，就 `pip install numpy` 再试。

笔记：已成功，成功打印版本号

---

### Step 2：创建数组

**目标**：知道 4 种创建数组的方法。

```python
import numpy as np

a = np.array([1, 2, 3, 4, 5])      # 从列表创建
b = np.arange(0, 10, 2)            # 从 0 到 10，步长 2 → [0 2 4 6 8]
c = np.zeros(5)                    # 5 个 0
d = np.ones(3)                     # 3 个 1

print(a)
print(b)
print(c)
print(d)
```

**运行看什么**：

- `b`​ 的结果是 `[0 2 4 6 8]`​，注意**不包含 10**（和 range 一样，左闭右开）
- `c`​ 是 `[0. 0. 0. 0. 0.]`，注意带小数点——zeros/ones 默认是浮点数

**自己做**：

1. 用 `np.arange` 造一个 1 到 100 步长为 1 的数组
2. 用 `np.linspace(0, 1, 5)` 试试，看看和 arange 有什么区别（提示：看结果有几个数，最后一个数是不是 1）

‍

笔记：认识到np.arange()与range()一致，都是左闭右开返回列表

注意zeros与ones函数返回的列表里的数都是浮点数

使用np.linspace(a, b, c)可以创建一个从a到b的列表，包括a和b，其列表共有c个元素，步长为(b - a)/c

---

### Step 3：查看数组

**目标**：学会 3 个最重要的属性：`shape`​、`dtype`​、`size`。

```python
import numpy as np

a = np.arange(0, 30, 1)   # 30 个数
print(a.shape)   # (30,)  一维，30 个元素
print(a.dtype)   # int64   整数类型
print(a.size)    # 30
```

**运行看什么**：三行输出，理解 shape 就是"这个数组长什么样"。

**自己做**：

1. `np.arange(0, 30, 1).reshape(5, 6)` 然后打印 shape——看看变成什么了
2. `np.arange(0, 30, 1).reshape(2, 3, 5)` 然后打印 shape——三维呢？

‍

笔记：使用shape方法，可以看到对象的维度数量以及对应维度的元素数量

使用dtype方法可以看到对象的数据类型是整数类型还是浮点类型等类型

使用size可以查看数据的大小

使用reshape方法可以改变数据的维度，例如`np.arange(0, 30, 1).reshape(5, 6)`意思为将一个含有30个数的一维数组变形到一个五行六列的二维数组

而例如`np.arange(0, 30, 1).reshape(2, 3, 5)`即为变形到一个三维数组中，这个三维数组含有两个三行五列的二维数组

---

### Step 4：索引和切片

**目标**：会取数组里的某几个元素。这是整个 NumPy 最常用的操作。

```python
import numpy as np

a = np.arange(0, 10, 1)   # [0 1 2 3 4 5 6 7 8 9]

print(a[0])      # 第一个元素 → 0
print(a[-1])     # 最后一个 → 9
print(a[2:5])    # 第 2 到第 4 个 → [2 3 4]（不含 5）
print(a[:3])     # 前 3 个 → [0 1 2]
print(a[::2])    # 隔一个取一个 → [0 2 4 6 8]
```

**运行看什么**：对照注释理解每个结果。

**自己做**：

1. 取数组 `[10, 20, 30, 40, 50]`​ 的中间三个元素 `[20, 30, 40]`
2. 取它的后两个元素（用负索引）

‍

笔记：取数字，本质为python列表操作。在打印方面比较常用，仅打印前五个值后五个值等操作很方便

---

### Step 5：数学运算

**目标**：数组可以直接做数学运算，不需要写循环。

```python
import numpy as np

a = np.array([1, 2, 3])

print(a + 10)        # [11 12 13]   数组 + 数字
print(a * 2)         # [2 4 6]      数组 × 数字
print(a + a)         # [2 4 6]      数组 + 数组
print(np.sin(a))     # 对每个元素求 sin
print(a ** 2)        # [1 4 9]      平方
```

**运行看什么**：每个操作都是"对数组里每个元素做一遍"，不需要 for 循环。

**自己做**：

1. 造一个 `np.arange(0, 6.2832, 0.01)`，对它取 sin，打印前 5 个值——你应该会看到从 0 附近开始
2. 试一次 `a / 0`​ 或 `np.sqrt(-1)`——看看会发生什么，这也是了解数组的一部分

‍

笔记：与普通列表不同的是，使用np函数创造出的列表，可以直接使用运算符进行运算，运算结果为np数组中的每个元素进行运算得到的结果组成的np数组

进行a/0和np.sqrt(-1)操作后，终端报警告：RuntimeWarning: invalid value encountered in divide，print值为nan/inf，

‍

---

### Step 6：聚合运算

**目标**：会算总和、平均、最大、最大位置。这 4 个在信号处理里天天用。

```python
import numpy as np

a = np.array([3, 1, 4, 1, 5, 9, 2, 6])

print(np.sum(a))     # 总和 → 31
print(np.mean(a))    # 平均 → 3.875
print(np.max(a))     # 最大 → 9
print(np.argmax(a))  # 最大值的**位置**（下标）→ 5
print(np.std(a))     # 标准差
```

**运行看什么**：特别注意 `argmax`​ 返回的是**下标**而不是值——后面找心率主频就靠它。

**自己做**：

1. 造 `a = np.arange(0, 100, 1)`，算它的总和、平均、最大值和最大值位置
2. 想一想：如果最大值位置是 99，说明最大值是最后一个元素，对吗？

‍

笔记：各种函数的使用，求和，求平均，找最大，找最大值对应的下标，计算标准差  
想一想：如果最大值位置是 99，说明最大值是最后一个元素，对吗？

这个不是吗？没搞懂，把答案自动整理好

---

### Step 7：随机数

**目标**：会生成随机数，并且能固定随机种子让结果可复现。

```python
import numpy as np

rng = np.random.default_rng(42)   # 42 是种子，固定它结果就固定

noise = rng.standard_normal(5)    # 5 个标准正态分布随机数
print(noise)

# 再运行一次整个文件，对比输出——应该一模一样（因为种子固定了）
```

**运行看什么**：5 个接近 0 的随机数，有正有负。

**自己做**：

1. 把种子从 42 改成别的数，输出变了吗？
2. 把种子改回 42，输出回来了吗？——这就是"可复现"的意义：**别人跑你的代码能得到同样的结果**，这在科研里非常重要。

‍

笔记：np的函数random与python自带的函数random的区别是什么？如何去生成一个随机数列表？如何生成更多其他分布上市的随机数？上述代码的rng意思就是种子吗？

---

## 阶段二：把零件拼起来（第 8-14 步）

### Step 8：造一条正弦波

**目标**：用前面学的零件，造出一条周期信号。

```python
import numpy as np

fs = 30                        # 采样率：每秒 30 个点（视频帧率）
t = np.arange(0, 10, 1/fs)     # 0 到 10 秒的时间轴，共 300 个点
print(len(t))                  # 300

sig = np.sin(2 * np.pi * 1.2 * t)   # 频率 1.2 Hz 的正弦波
print(sig[:5])                 # 前 5 个值

# print(np.max(sig))
# print(np.argmax(sig))
# print(sig[np.argmax(sig)])
# 这三行代码中第一行与第三行打印出的内容一致
```

**运行看什么**：

- `t` 有 300 个点，每个点代表 1/30 秒
- `sig`​ 是频率 1.2 Hz 的正弦——**1.2 Hz = 72 次/分钟 = 心率**

**自己做**：

1. 打印 `sig.max()`​ 和 `sig.min()`——正弦波的范围应该是什么？
2. 把频率改成 0.5 和 2.0，看看数值变化（只是观察，不用画图）

‍

笔记：使用numpy去模拟信号进行分析时，常使用常量去定义频率，如`fs = 30`来表示采样率

使用`t = np.arange(0, 10, 1/fs)`来构建与表达一个时间轴，表示从0s到10s，其步长即为频率的倒数，即周期

构建正弦信号使用np.sin函数，使用公式sin(2 * np.pi * f * t)来构建正弦波，注意f为正弦波的频率，t的采样率为fs

---

### Step 9：给信号加噪声

**目标**：用 Step 7 的随机数，给信号"污染"一下。

```python
import numpy as np

fs = 30
t = np.arange(0, 10, 1/fs)
sig = np.sin(2 * np.pi * 1.2 * t)

rng = np.random.default_rng(42)
noise = rng.standard_normal(len(t))   # 和信号一样长的噪声，300个点
noisy = sig + 0.5 * noise             # 噪声放大 0.5 倍

print(f"干净信号标准差: {np.std(sig):.3f}")
print(f"加噪信号标准差: {np.std(noisy):.3f}")
# 打印结果：
# 干净信号标准差: 0.707
# 加噪信号标准差: 0.833
```

**运行看什么**：加噪后标准差变大了——噪声让信号"变乱"了。

**自己做**：

1. 把 `0.5`​ 改成 `0.1`​ 和 `2.0`，看标准差怎么变——这就是信噪比的意思

标准差增大

1. 思考：如果噪声太大，信号会被"淹没"，你能用什么办法找回来？——留到 Step 10

‍

笔记：信噪比如何计算？

---

### Step 10：FFT——把信号翻到频域

**目标**：学会 FFT 的"输入输出"。这是找心率的关键工具，但你先别慌，只需要记住两件事：**输入是什么，输出是什么**。

```python
import numpy as np

fs = 30
t = np.arange(0, 10, 1/fs)
sig = np.sin(2 * np.pi * 1.2 * t)

fft_vals = np.fft.rfft(sig)      # 输入：时域信号 → 输出：频域（复数）
freqs = np.fft.rfftfreq(len(t), 1/fs)   # 和 fft_vals 配对的"频率轴"

print(f"信号长度: {len(sig)}")    # 300，等于np.size(sig)
print(f"FFT 长度: {len(fft_vals)}")  # 151
print(f"频率轴前 5 个: {freqs[:5]}")   # 0, 1, 2, 3, 4 Hz...
print(f"最后一个频率/奈奎斯特频率：{freqs[-1]}")    # 15.0
print(f"每个频率的强度：{abs(fft_vals)}")
```

**运行看什么**：

- 300 个时域点 → 151 个频域点（只保留了一半，因为另一半是镜像）
- 频率轴从 0 Hz 开始，每个点代表"这个频率有多强"

**自己做**：

1. 打印 `freqs[-1]`——最后一个频率是多少？应该是采样率的一半（15 Hz，奈奎斯特频率）
2. 先别管为什么，记住：`np.abs(fft_vals)` 就是"每个频率的强度"

---

### Step 11：从频域找心率

**目标**：用 Step 6 的 `argmax`，找到信号最强的频率——这就是心率检测。

```python
import numpy as np

fs = 30
t = np.arange(0, 10, 1/fs)
sig = np.sin(2 * np.pi * 1.2 * t)

fft_vals = np.fft.rfft(sig)
freqs = np.fft.rfftfreq(len(t), 1/fs)
magnitude = np.abs(fft_vals)          # 每个频率的强度

peak_idx = np.argmax(magnitude)       # 最强频率的位置
peak_freq = freqs[peak_idx]           # 换算成 Hz

print(f"检测到最强频率: {peak_freq:.2f} Hz")
print(f"换算成心率: {peak_freq * 60:.0f} BPM")
```

**运行看什么**：应该打印 `1.20 Hz`​ 和 `72 BPM`​——**你刚刚完成了一次"心率检测"** ，用的就是 rPPG 设备在用的同一套数学（FFT 找主频）。

**自己做**：

1. 把频率改成 1.0（60 BPM），重新检测——应该输出 60 BPM
2. 把频率改成 0.5 和 3.0，再试试

---

### Step 12：加噪声后还能找到吗？

**目标**：把 Step 9 的噪声和 Step 11 的检测合起来——这就是真实世界的挑战。

```python
import numpy as np

fs = 30
t = np.arange(0, 10, 1/fs)
sig = np.sin(2 * np.pi * 1.2 * t)

rng = np.random.default_rng(42)
noise = rng.standard_normal(len(t))
noisy = sig + 0.5 * noise

fft_vals = np.fft.rfft(noisy)
freqs = np.fft.rfftfreq(len(t), 1/fs)
magnitude = np.abs(fft_vals)

peak_idx = np.argmax(magnitude)
print(f"加噪后检测到: {freqs[peak_idx] * 60:.0f} BPM")
```

**运行看什么**：大概率还是 72 BPM——因为噪声是均匀铺在所有频率上的，而信号集中在 1.2 Hz，所以主频依然能找到。

**自己做**：

1. 把噪声放大到 `2.0 * noise`，还能找到 72 吗？能
2. 把噪声放大到 `5.0 * noise` 呢？——这就是 Step 9 说的"信号被淹没"。不能

---

### Step 13：带通滤波——把噪声挡在门外

**目标**：学会布尔索引（Step 4 的延伸），把不想要的频率直接删掉。

```python
import numpy as np

fs = 30
t = np.arange(0, 10, 1/fs)
sig = np.sin(2 * np.pi * 1.2 * t)

rng = np.random.default_rng(42)
noisy = sig + 2.0 * rng.standard_normal(len(t))   # 强噪声

fft_vals = np.fft.rfft(noisy)
freqs = np.fft.rfftfreq(len(t), 1/fs)

# 布尔索引：只保留 0.5-4 Hz 的频率（对应 30-240 BPM，心率的合理范围）
mask = (freqs >= 0.5) & (freqs <= 4.0)
print(mask)          # 一串 True/False，长度和 freqs 一样

fft_clean = fft_vals.copy()
fft_clean[~mask] = 0        # 把范围外的频率全部置 0
filtered = np.fft.irfft(fft_clean, n=len(t))   # 逆变换回时域

# 再检测一次
mag2 = np.abs(np.fft.rfft(filtered))
print(f"滤波后检测到: {freqs[np.argmax(mag2)] * 60:.0f} BPM")
```

**运行看什么**：

- `mask` 是一长串 True/False——这就是布尔索引
- 滤波后依然能检测到 72 BPM，即使噪声是 2.0 倍

**自己做**：

1. 把滤波范围改成 `0.8-1.0`（很小很窄），会发生什么？为什么？（提示：1.2 Hz 不在这个范围里）
2. 改成 `10-15`（高频范围），检测结果是什么？——理解"范围选错，信号就没了"

---

### Step 14：拼成完整版——带 SNR 的 PPG 模拟

**目标**：把前面 13 步的零件全部拼起来，加上一个 SNR 计算。这就是你项目的核心数学。

```python
import numpy as np

# Step 8：模拟信号（PPG 有基频+谐波，所以加一个 0.5 倍的二次谐波）
fs = 30
duration = 60
t = np.arange(0, duration, 1/fs)
hr = 1.2
ppg_clean = np.sin(2*np.pi*hr*t) + 0.5*np.sin(2*np.pi*2*hr*t)

# Step 9：加噪声
rng = np.random.default_rng(42)
ppg_noisy = ppg_clean + 0.5 * rng.standard_normal(len(t))

# Step 10-11：FFT 找主频
fft_vals = np.fft.rfft(ppg_noisy)
freqs = np.fft.rfftfreq(len(t), 1/fs)
peak = freqs[np.argmax(np.abs(fft_vals))]
print(f"加噪后主频: {peak:.2f} Hz ≈ {peak*60:.0f} BPM")

# Step 13：带通滤波（0.5-4 Hz）
mask = (freqs >= 0.5) & (freqs <= 4.0)
fft_clean = fft_vals.copy()
fft_clean[~mask] = 0
ppg_filtered = np.fft.irfft(fft_clean, n=len(t))

# 新增：SNR（信噪比）——滤波后的信号和干净信号的差距
signal_power = np.mean(ppg_clean ** 2)
noise_power = np.mean((ppg_filtered - ppg_clean) ** 2)
snr_db = 10 * np.log10(signal_power / noise_power)
print(f"滤波后 SNR: {snr_db:.1f} dB")

# 验证：滤波后重新检测主频
mag2 = np.abs(np.fft.rfft(ppg_filtered))
print(f"滤波后主频: {freqs[np.argmax(mag2)]*60:.0f} BPM")
```

**运行看什么**：主频 ≈ 72 BPM，SNR 是正数，滤波后依然 72 BPM。

**自己做**：

1. 把噪声系数从 `0.5`​ 改成 `1.0`​、`2.0`，观察 SNR 怎么变
2. 用你自己的话写出：SNR 越高说明什么？SNR越高说明信号与噪声的比值越大，即噪声占比小

---

## 完成标准

到这一步，你其实已经完成了之前的"复杂练习"——只是这次是一步步走上来的。

- [X] Step 1-7 全部跑通，每步"自己做"都完成
- [X] Step 8-13 能说出每一步在干什么（不用背，能讲就行）
- [X] Step 14 完整跑通，改变噪声系数能预测 SNR 变化方向
- [X] 能用一句话回答： **"FFT 是干什么的？argmax 找的是什么？布尔索引做了什么？"**

全部完成后告诉我，我来评估 NumPy 从 L0 → L2。

‍

<section class="siyuan-references" aria-label="文档引用">

## 文档关系

### 反向引用
- [学习笔记](/siyuan/)
- [已归档](/siyuan/已归档/)

</section>
