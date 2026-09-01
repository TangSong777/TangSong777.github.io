---
title: 'PyTorch与CNN基础学习方案'
date: '2026-08-27T16:51:11+08:00'
updated: '2026-08-27T16:52:10+08:00'
layout: page
type: siyuan-note
notebook: '学习笔记'
permalink: 'siyuan/待学习/PyTorch与CNN基础学习方案/'
siyuan_source: '待学习/PyTorch与CNN基础学习方案.md'
comments: false
categories:
  - '学习笔记'
  - '待学习'
---

‍

# PyTorch 与 CNN 基础学习方案

> 教学讲义式学习方案：每章先讲原理、用**表格**列出函数（作用/参数/示例），再用**最小实例**佐证。逻辑链：Tensor → 自动求导 → 数据加载 → 模型 → 训练循环 → CNN 组件 → 手搓 CNN。能力基线：PyTorch/CNN L1 → 目标 L2。前置：NumPy/Python（已学）。

## 一、Tensor 概览

> Tensor ≈ NumPy 数组 + 自动求导；多数 NumPy 操作同名可用。

|创建方式|作用|示例|
| ----------------| -----------------------------| ---------------|
|`torch.tensor(数据, dtype=)`|从数据创建|`torch.tensor([1.,2.])`|
|`torch.zeros(形状)`​ / `ones`​ / `randn`|初始化全0/全1/正态随机|`torch.zeros(3,4)`|
|`torch.from_numpy(ndarray)`|NumPy 转 Tensor（共享内存）|需要独立用 `.clone()`|

|属性/操作|作用|示例|
| ----------------| ----------------| ------------------|
|`.shape`​ / `.dtype`​ / `.device`|形状/类型/设备|`x.device` → cpu/cuda|
|`x + 10`​ / `x * 2`|向量化运算|—|
|`x.sum(dim=0)`|指定维度聚合|沿列求和|

**短实例**：

```python
import torch
x = torch.tensor([[1., 2.], [3., 4.]])   # 常用法：tensor 从列表或 NumPy 来
print(x.shape, x.sum(dim=0))             # 先看 shape 再运算
```

## 二、自动求导

> `requires_grad=True`​ 的张量会被记录运算图，`backward()` 一次算出梯度。

|API|作用|示例|
| ------| --------------------------| ------|
|`torch.tensor(值, requires_grad=True)`|声明需要梯度|—|
|`x.grad`|backward 后的梯度|—|
|`with torch.no_grad():`|推理时关闭梯度（省内存）|—|

**短实例**：

```python
x = torch.tensor(2.0, requires_grad=True)
y = x ** 2 + 3 * x          # dy/dx = 2x+3 = 7
y.backward()
print(x.grad)               # tensor(7.)
```

## 三、Dataset 与 DataLoader

> Dataset 规定"按索引取样本"，DataLoader 负责批量/打乱/加载。

|方法/参数|作用|
| -----------| --------------------------------------|
|`__len__(self)`|必须实现：样本总数|
|`__getitem__(self, idx)`|必须实现：返回第 idx 个 (特征, 标签)|
|`DataLoader(ds, batch_size, shuffle)`|批量+打乱；进程加载|

**短实例**（合成波形二分类数据集）：

```python
from torch.utils.data import Dataset, DataLoader
import torch

class WaveDataset(Dataset):
    def __init__(self, n=1000, n_points=64):
        self.x, self.y = [], []
        for i in range(n):
            if i % 2 == 0:  # 类别0：干净正弦
                self.x.append(torch.sin(torch.linspace(0, 4*torch.pi, n_points)))
            else:           # 类别1：噪声三角
                self.x.append(torch.randn(n_points) + 0.2*torch.sin(torch.linspace(0, 4*torch.pi, n_points)))
            self.y.append(i % 2)
    def __len__(self): return len(self.y)
    def __getitem__(self, i): return self.x[i].view(1, -1), torch.tensor(self.y[i])  # [1,64] 与标签

loader = DataLoader(WaveDataset(), batch_size=32, shuffle=True)
for bx, by in loader: print(bx.shape, by.shape); break   # [32,1,64] [32]
```

## 四、nn.Module 模型定义

> 网络 = nn.Module 子类：`__init__`​ 搭层、`forward` 定义数据流。

|成员|作用|
| ------| --------------------------|
|`nn.Linear(输入, 输出)`|全连接层|
|`nn.Conv1d/2d(...)`|卷积层|
|`nn.MaxPool1d(k=2)`|池化层|
|`F.relu(x)`|激活（非线性）|
|`model.parameters()`|可迭代的参数（给优化器）|
|`x.view(B, -1)`|展平（保留 batch）|

**短实例**：

```python
import torch.nn as nn, torch.nn.functional as F
class MLP(nn.Module):
    def __init__(s, n=64, c=2):
        super().__init__(); s.fc1 = nn.Linear(n, 32); s.fc2 = nn.Linear(32, c)
    def forward(s, x):
        return s.fc2(F.relu(s.fc1(x.view(x.size(0), -1))))   # 展平→relu→输出
```

## 五、损失与优化器

|API|作用|易错|
| ------| ----------------| ------------------------|
|`nn.CrossEntropyLoss()`|多分类损失|输入 logits，**别手动 softmax**|
|`torch.optim.Adam(model.parameters(), lr=1e-3)`|自适应优化|常用 lr=1e-3|
|`optimizer.zero_grad()`|清梯度|每步必须，否则梯度累积|
|`optimizer.step()`|按梯度更新参数|在 backward 之后|

## 六、训练循环（三步铁律）

> 每批：`zero_grad → forward/loss → backward → step`；训练/验证态切换。

|函数/写法|作用|
| -----------| --------------------------|
|`model.train()`|开训练模式（Dropout/BN）|
|`model.eval()`|推理模式|
|`with torch.no_grad():`|验证不存图|
|`logits.argmax(dim=1)`|取预测类别|

**短实例**：

```python
def train_epoch(m, dl, loss_fn, opt):
    m.train(); tot = 0
    for x, y in dl:
        opt.zero_grad()                       # ① 清
        loss = loss_fn(m(x), y)               # ② 前向+损失
        loss.backward(); opt.step()           # ③ 反向+更新
        tot += loss.item()
    return tot / len(dl)

def acc(m, dl):
    m.eval(); c = 0
    with torch.no_grad():
        for x, y in dl: c += (m(x).argmax(1) == y).sum().item()
    return c / len(dl.dataset)
```

## 七、CNN 组件逐个讲透

|组件|函数/类|作用|关键参数|
| ----------| ---------| ------------------| -----------------------|
|一维卷积|`nn.Conv1d(1, 16, 5, padding=2)`|沿时间滑窗提特征|输出长度 `(L+2p-k)//s+1`|
|二维卷积|`nn.Conv2d(3, 8, 3, padding=1)`|图像滑窗|padding=k//2 保持尺寸|
|最大池化|`nn.MaxPool1d(2, 2)`|降采样减半|保留最显著响应|
|激活|`F.relu(x)`|非线性|无它多层=单层线性|
|防过拟合|`nn.Dropout(0.3)`|随机丢弃|训练开、推理自动关|

> 为什么卷积省参数：**共享权重 + 局部感受野**，同组 kernel 滑过全图，而非每像素一根线。

## 八、手搓一个简单 CNN

> 把零件拼起来：输入 `[B,1,64]`​ → conv1→pool→conv2→pool→展平→fc→`[B,2]`。

```python
class SmallCNN(nn.Module):
    def __init__(s, c=2):
        super().__init__()
        s.conv1 = nn.Conv1d(1, 16, 5, padding=2); s.conv2 = nn.Conv1d(16, 32, 5, padding=2)
        s.pool = nn.MaxPool1d(2, 2); s.fc = nn.Linear(32 * 16, c)   # 64→16（两次pool减半）
    def forward(s, x):
        x = s.pool(F.relu(s.conv1(x)))          # [B,16,32]
        x = s.pool(F.relu(s.conv2(x)))          # [B,32,16]
        return s.fc(x.view(x.size(0), -1))      # 展平后全连接

m = SmallCNN(); opt = torch.optim.Adam(m.parameters(), 1e-3)   # 1e-3 是 Adam 常用学习率
loss_fn = nn.CrossEntropyLoss()
for ep in range(30):
    train_epoch(m, loader, loss_fn, opt)                        # 复用第六节
    if ep % 5 == 0: print(ep, round(acc(m, loader), 3))         # 理想 >0.98
```

- **易错**：`view`​ 展平数要与 `Linear`​ 输入一致（此处 32×16=512）；维度错先逐层打印 `x.shape`。

## 九、训练/验证划分与检查点

|API|作用|
| ------| ------------------------|
|`random_split(ds, [n1,n2])`|划分 train/val|
|`model.state_dict()`|只存参数|
|`torch.save(..., "best.pth")`|保存|
|`load_state_dict(torch.load(...))`|加载（先建同结构模型）|

**短实例**：

```python
train_ds, val_ds = torch.utils.data.random_split(WaveDataset(), [800, 200])
tl = DataLoader(train_ds, 32, True); vl = DataLoader(val_ds, 32)
best = 0
for ep in range(30):
    train_epoch(m, tl, loss_fn, opt)
    a = acc(m, vl)
    if a > best: best = a; torch.save(m.state_dict(), "best.pth")   # 只存最佳
```

## 十、易错点与自测（附答案）

**易错**：CrossEntropyLoss 输入 logits；忘 zero_grad；忘 train/eval 切换；view 维度不匹配；数据未归一化；模型与数据设备不一致（都 `.to(device)`）。

1. **backward 前必须做什么？**  答：`optimizer.zero_grad()` 清上次梯度，否则梯度累积、方向错乱。
2. **卷积为什么比全连接省参数？**  答：共享权重+局部感受野，同 kernel 滑过全图。
3. **验证时** **​`no_grad()`​** ​  **+**  **​`eval()`​** ​ **的作用？**  答：eval 切换 Dropout/BN；no_grad 省内存、结果稳定。
4. **训练损失降但验证准率不动？**  答：过拟合——降容量/加 Dropout/加数据/早停。

<section class="siyuan-references" aria-label="文档引用">

## 文档关系

### 反向引用
- [待学习](/siyuan/待学习/)
- [学习笔记](/siyuan/)

</section>
