---
title: 'PPG与rPPG学习方案'
date: '2026-08-27T16:51:12+08:00'
updated: '2026-08-27T16:52:42+08:00'
layout: page
type: siyuan-note
notebook: '学习笔记'
permalink: 'siyuan/待学习/PPG与rPPG学习方案/'
siyuan_source: '待学习/PPG与rPPG学习方案.md'
comments: false
categories:
  - '学习笔记'
  - '待学习'
---

‍

# PPG 与 rPPG 学习方案

> 教学讲义式学习方案：先讲原理、用**表格**列出函数（作用/参数/示例），再**最小实例**佐证。逻辑链：脉搏波来源 → 信号形态 → 模拟 → FFT 心率 → 滤波 → rPPG 原理 → 视频提取 → 评估。能力基线：PPG L1、rPPG L0 → 目标 L2（B 类·确认制，未确认）。项目连接："一指知心"血管反应性分析。

## 一、脉搏波怎么来的

> 心脏泵血 → 动脉血液容积周期变化 → 组织对光吸收随之变化。PPG 就是用光学手段把这个"搏动"量出来。

- **类比**：手电筒照手指，心跳时血流增多、透射光减少——把光强波动画出来就是 PPG；
- **组成**：直流分量（组织/静脉静态吸收）+ 交流分量（动脉搏动，约 1-2 %）；
- **指标**：心率 HR、波形形态、HRV、血管反应性（RHI）。

## 二、信号形态与关键频带

|概念|值|说明|
| ----------| ----------------| --------------------------------------|
|静息心率|60-100 bpm|主频 ≈ 1-1.67 Hz|
|生理频带|**0.5-4 Hz**|对应 30-240 bpm，滤波窗口|
|特征点|主峰、重搏切迹|升支（收缩）→ 降支（舒张+重搏切迹）|

## 三、生成模拟 PPG

|函数|作用|示例|
| ------| -------------------| ---------------|
|`np.arange / linspace`|时间轴|`t=np.arange(0,10,1/fs)`|
|`np.sin / np.cos`|主频+谐波模拟形态|`0.3*cos(4πf t)` 二次谐波|
|`rng.normal(size=n)`|加噪声|`np.random.default_rng(0)` 固定种子|

**短实例**：

```python
import numpy as np
fs = 100; t = np.arange(0, 10, 1/fs)            # 100Hz 采样 10 秒
f = 72 / 60                                      # 72bpm -> 1.2Hz
ppg = np.sin(2*np.pi*f*t) + 0.3*np.cos(4*np.pi*f*t)      # 主频+谐波更像真实形态
ppg += np.random.default_rng(0).normal(size=len(t)) * 0.2 # 加噪声
```

## 四、FFT 心率估计

|函数|作用|示例|
| ------| ----------------------| ----------------------|
|`np.fft.rfft(信号)`|实数频谱（正频部分）|`fftv = ...`|
|`np.fft.rfftfreq(n, 1/fs)`|对应频率轴|必须与 rfft 配对被组|
|`np.abs(fftv)`|幅值|取强度|
|`np.argmax(幅值)`|主峰位置|限制在 0.5-4Hz 内找|
|`频率*60`|Hz→bpm|`hr = freqs[idx]*60`|

**短实例**：

```python
fftv = np.fft.rfft(ppg); freqs = np.fft.rfftfreq(len(ppg), 1/fs)
mag = np.abs(fftv)
mask = (freqs >= 0.5) & (freqs <= 4.0)          # 只能生理频带内找主峰
idx = np.argmax(mag * mask)                      # 掩码后取最大
print("心率 ≈", round(freqs[idx]*60, 1), "bpm")  # 1.2Hz -> 72
```

- 易错：`rfftfreq`​ 与 `rfft` 长度一致；先滤波再 FFT。

## 五、预处理滤波

|函数（scipy）|作用|常用参数|
| ---------------| ------------| --------------------|
|`sig.butter(阶, [低,高], btype='bandpass', fs=fs)`|设计带通|4 阶、0.5-4Hz|
|`sig.filtfilt(b, a, x)`|零相位滤波|离线推荐（无延迟）|
|`sig.iirnotch(50, 30, fs)`|工频陷波|50Hz|

**短实例**：

```python
from scipy import signal as sig
b, a = sig.butter(4, [0.5, 4.0], btype='bandpass', fs=fs)  # 4 阶带通
clean = sig.filtfilt(b, a, ppg)                            # 滤波后再 FFT
```

- `filtfilt`​（零相位，离线）/ `lfilter`（实时有相位滞后）对比选择。

## 六、rPPG 原理

> 普通相机拍皮肤：血液容积变化改变皮肤反射光强（光电容积描记），区域像素亮度随心搏微幅波动——提取即得 rPPG。

|要点|内容|
| -------------| -----------------------------------------------------------------------------|
|物理基础|比尔-朗伯定律：吸收与浓度指数相关；血红蛋白随心动周期变化|
|与 PPG 区别|PPG 专用传感（LED+光电，接触）；rPPG 普通相机（非接触），信号更弱、伪影更多|
|通道选择|**绿通道**对血红蛋白吸收敏感；可用 ICA/PCA 从 RGB 分解|

## 七、从视频提取 rPPG（最小闭环）

|函数/写法|作用|
| -----------| ------------------------------------------------|
|`cv2.VideoCapture(路径)`|打开视频|
|`cap.read()`|逐帧 (ret, frame)|
|`frame[y:y+h, x:x+w]`|ROI 切片（选皮肤区）|
|`roi[:, :, 1].mean()`|绿色通道区域均值 → 每帧 1 个值|
|后续|拼接时间序列 → 带通滤波 → FFT（复用四/五节）|

**短实例**：

```python
import cv2, numpy as np
cap = cv2.VideoCapture("face.mp4"); x, y, w, h = 200, 100, 300, 300
sig = []
while True:
    ret, frame = cap.read()
    if not ret: break
    roi = frame[y:y+h, x:x+w]
    sig.append(roi[:, :, 1].mean())          # 每帧取 G 通道均值
sig = np.array(sig)                          # 转成时间序列后滤波+FFT
```

- 关键：ROI 选**皮肤且少运动**区域（脸颊 > 下颚）；固定曝光减少伪影；头部运动是最大噪声源。

## 八、评估

|指标|含义|
| --------------------| -----------------------|
|主频是否落 0.5-4Hz|判断估频可信|
|SNR|`10*log10(主峰功率/噪声带功率)`|
|与真值对照|误差 < ±5 bpm 算可用|

## 九、易错点与自测（附答案）

**易错**：fs 与信号不符；不滤波直接 FFT；ROI 选到背景；相机自动曝光导致整体漂移；把运动伪影当心跳。

1. **PPG 测的是什么？为什么光强随心跳波动？**  答：光学组织信号；动脉血液容积周期变化改吸收（比尔-朗伯）→ 光强波动。
2. **为什么先带通 0.5-4Hz？**  答：对应 30-240bpm 生理范围；去直流漂移与高频噪声，避免主峰被噪声淹没。
3. **rPPG 与接触式 PPG 核心区别？**  答：相机非接触、靠肤色像素亮度波动；信号弱、对运动光照敏感，需严格 ROI+滤波。
4. **视频估心率最小流程？**  答：读帧→ROI(皮肤)→G 均值→时间序列→带通→FFT×60=HR→对照验证。

<section class="siyuan-references" aria-label="文档引用">

## 文档关系

### 反向引用
- [待学习](/siyuan/待学习/)
- [学习笔记](/siyuan/)

</section>
