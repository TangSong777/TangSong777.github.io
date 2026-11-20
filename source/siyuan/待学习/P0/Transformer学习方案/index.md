---
title: 'Transformer学习方案'
date: '2026-11-20T11:37:35+08:00'
updated: '2026-11-20T17:48:45+08:00'
layout: page
type: siyuan-note
notebook: '学习笔记'
permalink: 'siyuan/待学习/P0/Transformer学习方案/'
siyuan_source: '待学习/P0/Transformer学习方案.md'
comments: false
categories:
  - '学习笔记'
  - '待学习'
  - 'P0'
---

# <span id="" style="display: none;"></span>Transformer学习方案

> **标题**：Transformer 学习方案  
> **类型**：学习方案  
> **状态**：进行中  
> **标签**：​#文档/学习方案#​ ​#文档/待学习#​  
> **创建**：2026-11-20  
> **更新**：2026-11-20  
> **来源**：Attention Is All You Need（Vaswani et al., 2017）+ CNN/RNN 演进脉络

# Transformer 学习方案

> 教学讲义式学习方案：以《Attention Is All You Need》为主线，**把 CNN、RNN/LSTM 作为对照系**——先讲三代架构各自解决了什么问题、又留下什么坑，再讲 Transformer 如何用注意力一次性补齐，最后讲现代变体（BERT/GPT/ViT/LLaMA）与工程优化（FlashAttention/RoPE）。能力基线：Transformer L0 → 目标 L3（能脱离笔记手写 Self-Attention、解释每个设计选择、说清与 CNN/RNN 的取舍）。项目连接：PPG/PAT 时序建模、文本理解、视觉特征提取。​**零基础读者请先读第零章「小白预备」** ——它用 8 个零件和一次手算，把后面所有公式的前置知识补齐。

## 零、小白预备：读这篇之前需要知道的 8 件事

> 如果你没系统学过神经网络，**先读这一章**。它不讲 Transformer，只讲后面会反复用到的 8 个基础零件。每个零件都配一个能心算的小例子——读完你会发现，自己已经能看懂注意力在干什么。

### 0.1 这份文档怎么读

|你的基础|建议路线|预计时间|
| ------------| --------------------------------------------------------------------| ----------|
|完全零基础|第零章 → 第一~五章 → 第六~十章 → 第十一~十五章 → 第十六~十九章|3-4 周|
|学过 CNN|0.7 手算 → 第一~三章快速过 → 第四~十章精读 → 第十一~十九章|2 周|
|学过 RNN|0.7 手算 → 第一、三章快速过 → 第四~十章精读 → 第十一~十九章|1.5 周|

每章固定四段结构：**直觉（为什么）→ 公式（是什么）→ 代码（怎么写）→ 易错点（哪里会错）**  。

学习节奏建议：

- 每天 1-2 章，不要贪多；
- 每章至少手算一次（纸笔或 Python 都行）；
- 代码必须自己敲一遍，不要复制粘贴；
- 每章末尾的自测题能答出来，再进下一章。

### 0.2 向量：把「一个东西」变成一串数字

计算机不认识「猫」，只认识数字。所以第一步永远是：**把对象变成一串数字**。

- **向量**：有序的一串数字，写作 ​`[0.2, -0.5, 0.8]`；
- **维度**：数字的个数；
- 例子：一张 $28 \times 28$ 灰度图 = 784 维向量；1 秒 100Hz 的 PPG 信号 = 100 维向量；Transformer 里一个词 = 512 维向量。

**点积 = 相似度**：

$$
a \cdot b = a_1 b_1 + a_2 b_2 + \cdots + a_d b_d
$$

几何意义：$a \cdot b = |a||b|\cos\theta$，夹角越小越相似。手算三个例子：

|a|b|点积|含义|
| --------| ---------| ------| ------------------|
|[1, 0]|[1, 0]|1|完全同向，最相似|
|[1, 0]|[0, 1]|0|垂直，毫无关系|
|[1, 0]|[-1, 0]|-1|完全反向|

**为什么重要**：注意力里「Q 和 K 有多像」就是用点积算的——这是整篇文档最核心的一次运算。

### 0.3 矩阵乘法：一次算很多个点积

- **矩阵**：二维数字表，形状记作 ​`(行, 列)`；
- 规则：$(n, d) \times (d, m) = (n, m)$——中间维度必须相等，结果只保留两边。

两种看法：

1. 行 × 列：结果第 $i$ 行第 $j$ 列 = $A$ 第 $i$ 行与 $B$ 第 $j$ 列的点积；
2. **列的组合**：结果每一列 = A 的各列按 B 的系数加权求和。

手算一个 $2 \times 2$ 的例子：

```text
A = [[1, 2],      B = [[1, 0],
     [3, 4]]           [0, 1]]

A × B = [[1, 2],
         [3, 4]]   （B 是单位矩阵，乘了不变）
```

**为什么重要**：Transformer 里所有「变换」都是矩阵乘法——​`Q = X W_q` 就是把每个词向量乘一个矩阵，得到新的表示。GPU 最擅长的就是这种批量矩阵乘法，这也是 Transformer 能大规模并行的根本原因。

### 0.4 softmax：把分数变成概率

公式：

$$
\text{softmax}(x_i) = \frac{\exp(x_i)}{\sum_j \exp(x_j)}
$$

三个性质：

- 每个输出都大于 0；
- 所有输出加起来等于 1；
- 保序：输入大的，输出也大。

手算：$\text{softmax}([2, 1, 0])$

```text
exp([2, 1, 0]) = [7.39, 2.72, 1.00]
和 = 11.11
结果 = [0.665, 0.245, 0.090]
```

两个工程细节：

- 数值稳定：先减去最大值再算 exp（$\text{softmax}(x - \max(x))$），防止 exp(1000) 溢出；
- 温度：$\text{softmax}(x / \tau)$，$\tau$ 小更尖锐（接近 argmax），$\tau$ 大更平滑（接近均匀分布）。

**为什么重要**：注意力权重就是 softmax 出来的——「每个词该分多少注意力」全靠它。

### 0.5 神经网络最小单元：线性层 + 激活

一个神经元做的事：

$$
y = W x + b
$$

- `W`​ 是权重矩阵，​`b`​ 是偏置，​`x` 是输入向量；
- 只有线性层的话，堆多少层都等价于一层（矩阵乘法可结合）——所以必须加**非线性激活**。

常用激活函数：

|激活|公式|特点|
| ---------| ------| ------------------------|
|ReLU|$\max(0, x)$|简单、稀疏、CNN 常用|
|GELU|$x \cdot \Phi(x)$|平滑、Transformer 常用|
|Sigmoid|$1/(1+e^{-x})$|压到 0-1，门控用|
|Tanh|$(e^x - e^{-x})/(e^x + e^{-x})$|压到 -1~1，RNN 用|

**训练 = 调 W 和 b**，四步循环：

1. **前向**：算输出；
2. **算损失**：预测和真实差多少；
3. **反向**：链式法则算每个参数的梯度；
4. 更新：$W \leftarrow W - lr \times \nabla$。

两个最常用的损失：

|损失|用途|直觉|
| --------| ------| ---------|
|MSE|回归|$(\text{预测} - \text{真实})^2$ 取平均|
|交叉熵|分类|$-\log(\text{正确类别的概率})$|

**为什么重要**：Transformer 的每一层都是「线性层 + 激活 + 归一化」的组合，看懂这一节，后面所有模块都不陌生。

### 0.6 词怎么变成向量：one-hot → embedding

**one-hot**：词表 10000 个词，每个词是 10000 维向量，只有自己那一位是 1。

- 问题 1：维度爆炸；
- 问题 2：任意两个词的点积都是 0——「猫」和「狗」跟「猫」和「汽车」一样远，没有语义。

**embedding**：用一张可学习的查找表，把词 ID 映射到 512 维稠密向量。

```python
import torch.nn as nn
emb = nn.Embedding(vocab_size, d_model)   # 查表：词 ID → 向量
```

训练后，语义相近的词向量也相近——「猫」和「狗」的向量夹角小，「猫」和「汽车」夹角大。

**位置问题**：embedding 只编码「是什么词」，不编码「第几个词」。所以 Transformer 必须额外加**位置编码**（第八章）。

### 0.7 五分钟手算：注意力到底在干什么

假设 3 个词，每个词 2 维向量：

```text
x1 = [1, 0]   （「我」）
x2 = [0, 1]   （「爱」）
x3 = [1, 1]   （「你」）
```

简化：令 $Q = K = V = X$（真实模型会乘三个不同的矩阵）。

第 1 步：算相似度矩阵 $QK^T$

```text
scores = X Xᵀ = [[1, 0, 1],
                 [0, 1, 1],
                 [1, 1, 2]]
```

第 1 行 ​`[1, 0, 1]` 表示「我」和三个词的相似度：和自己 1、和「爱」0、和「你」1。

第 2 步：除以 $\sqrt{d_k}$（$d_k = 2$，$\sqrt{2} \approx 1.41$）

```text
scores / 1.41 = [[0.71, 0.00, 0.71],
                 [0.00, 0.71, 0.71],
                 [0.71, 0.71, 1.41]]
```

**第 3 步：按行 softmax**

```text
第 1 行：exp([0.71, 0, 0.71]) = [2.03, 1.00, 2.03]，和 5.06 → [0.40, 0.20, 0.40]
第 2 行：exp([0, 0.71, 0.71]) = [1.00, 2.03, 2.03]，和 5.06 → [0.20, 0.40, 0.40]
第 3 行：exp([0.71, 0.71, 1.41]) = [2.03, 2.03, 4.10]，和 8.16 → [0.25, 0.25, 0.50]
```

第 4 步：加权求和 $\text{attn} \times V$

```text
第 1 个词的新表示 = 0.40×[1,0] + 0.20×[0,1] + 0.40×[1,1] = [0.80, 0.60]
第 2 个词的新表示 = 0.20×[1,0] + 0.40×[0,1] + 0.40×[1,1] = [0.60, 0.80]
第 3 个词的新表示 = 0.25×[1,0] + 0.25×[0,1] + 0.50×[1,1] = [0.75, 0.75]
```

观察：每个词的新表示都「混入」了其他词的信息——这就是注意力：每个词按相关度，从所有词那里收集信息。第 3 个词「你」和自己最像（权重 0.50），所以保留最多自己的信息。

问：这里的d_k是啥啊

答：$d_k$ 是 Key 向量的维度（dimension of key），也就是每个词被压成多少个数字。  
在 0.7 的手算例子里，每个词是 2 维向量（$x_1=[1,0]$），所以 $d_k = 2$，除以 $\sqrt{d_k} = \sqrt{2} \approx 1.41$。  
在真实 Transformer 里，$d_k = d_{model} / h$：base 版 $d_{model}=512$、$h=8$ 个头，所以每个头 $d_k = 64$，除以 $\sqrt{64} = 8$。  
为什么要除：$Q$ 和 $K$ 做点积，每个分量相乘再相加，$d_k$ 越大点积的方差越大（方差 $\approx d_k$）。不除的话分数会很大，softmax 之后几乎全部分配给最大值，梯度接近 0，模型学不动。除以 $\sqrt{d_k}$ 把方差拉回 1 左右，softmax 才不会饱和。

问：第 3 个词「你」和自己最像（权重 0.50），所以保留最多自己的信息。这句话是啥意思？没看懂。

答：这句话拆成两半看。  
第一半「第 3 个词「你」和自己最像（权重 0.50）」：第 3 个词是「你」，向量 $x_3=[1,1]$。注意力分数矩阵第 3 行是 $[0.71, 0.71, 1.41]$，softmax 后是 $[0.25, 0.25, 0.50]$。0.50 就是「你」分给自己的权重。为什么最大？因为 $x_3 \cdot x_3 = 1\times1 + 1\times1 = 2$，而 $x_3 \cdot x_1 = 1$、$x_3 \cdot x_2 = 1$——自己和自己点积最大，所以「和自己最像」。  
第二半「所以保留最多自己的信息」：「你」的新表示 = $0.25 \times x_1 + 0.25 \times x_2 + 0.50 \times x_3$。自己占 50% 权重，是三者里最大的，所以新表示里自己的信息保留最多。  
一句话总结：权重 0.50 是「你」分给自己的注意力分数，因为自己和自己最像；加权求和时自己占一半，所以新表示里自己的信息保留最多。

### 0.8 名词对照表

|英文|中文|一句话解释|
| -----------| --------------| --------------------------------------|
|token|词元|模型处理的最小单位（词/子词/像素块）|
|embedding|嵌入|把 token 变成向量|
|attention|注意力|按相关度加权收集信息|
|Q / K / V|查询/键/值|注意力的三个角色|
|head|头|一组独立的注意力|
|residual|残差|x + f(x)，让梯度直通|
|LayerNorm|层归一化|按特征维度归一化|
|FFN|前馈网络|逐位置的两层 MLP|
|logits|未归一化分数|softmax 之前的输出|
|mask|掩码|屏蔽不该看的位置|

### 0.9 自测：读完这章你应该能回答

问：两个向量的点积为什么能表示相似度？

答：因为点积反映了夹角的大小，夹角越小越相似

标答：点积 $a \cdot b = |a||b|\cos\theta$，$\theta$ 是两向量夹角。向量长度固定时，点积只由 $\cos\theta$ 决定：同向（$\theta=0$）最大，垂直（$\theta=90°$）为 0，反向（$\theta=180°$）为负。所以点积越大，方向越接近，语义越相似。  
易错点：点积受长度影响——长向量即使方向不同也可能点积很大，所以注意力里要除以 $\sqrt{d_k}$ 缩放，把方差拉回 1。

问：(3, 4) 的矩阵乘 (4, 5) 的矩阵，结果是什么形状？

答：3x5的形状

标答：$(3,4)\times(4,5)=(3,5)$。规则：结果形状 = (左矩阵行数, 右矩阵列数)，中间维度必须相等（这里是 4）。  
手算验证：左矩阵 3 行，每行与右矩阵 5 列各做一次点积，得到 $3\times5=15$ 个元素。  
易错点：不要写成 $(4,4)$ 或 $(3,4)$——中间维度被「消掉」，只保留两边。

问：softmax([1, 1, 1]) 等于多少？

答：[0.33，0.33，0.33]

标答：$[1/3, 1/3, 1/3]$。三个输入相等，$e^1$ 也相等，分子相同、分母是三者之和，所以各占 1/3。  
这体现 softmax 的「保序 + 归一」：输入全等 → 输出均匀分布。  
工程含义：注意力分数全相同时，每个词分到的权重一样，模型无法区分主次——所以需要 Q/K 提供有区分度的分数。

问：为什么神经网络需要非线性激活？

答：线性激活在矩阵乘法中会合并，多层实际上就是一层

标答：因为线性变换的复合仍是线性变换。若每层都是 $W_2(W_1x)=(W_2W_1)x$，多层等价于一层，深度毫无意义。  
非线性激活（ReLU/GELU）打破这个封闭性，让网络能拟合任意连续函数（万能近似定理）。  
易错点：不是「激活让输出变大/变小」，而是「激活让函数空间从线性扩展到非线性」。

问：0.7 的手算里，第 3 个词的新表示为什么「你」的权重最大？

答：因为第三个词就是你，自身与自身的点积，包含的自身的信息最多，注意力最集中。

标答：因为第 3 个词就是「你」，它和自己的点积最大。$x_3=[1,1]$，$x_3\cdot x_3=2$，而 $x_3\cdot x_1=1$、$x_3\cdot x_2=1$。  
除以 $\sqrt{2}$ 后 softmax，自身分数最高，权重 0.50，另外两个各 0.25。所以新表示里「你」自己的信息占一半。  
直觉：每个词首先「看自己」，再按相关度吸收别人。

问：embedding 和 one-hot 的区别是什么？

答：one-hot是n个纬度里对应自己的那个词是1；embedding是查表投影，将n纬矩阵投影到稠密矩阵中

标答：one-hot 是 $n$ 维稀疏向量（词表多大就多长），只有自己那一维是 1，其余全 0；任意两个不同词的 one-hot 点积恒为 0，无法表达「相似」。  
embedding 是查表得到的 $d$ 维稠密向量（$d \ll n$），每个维度都是可学习的实数，相似词在空间中靠近，点积/余弦能反映语义关系。  
一句话：one-hot 是「编号」，embedding 是「坐标」。

## 一、序列建模演进史：从 CNN 到 Transformer

> 理解 Transformer 的最好方式，是先理解它**替代了什么**。三代架构不是互相否定，而是各自补上一代的短板。

### 1.1 三代架构的接力

|代际|代表架构|核心机制|解决的问题|留下的坑|
| --------| ---------------------------------| ---------------------| --------------------------| ------------------------------|
|第一代|CNN（LeNet/AlexNet/VGG/ResNet）|局部卷积 + 权值共享|参数爆炸、平移不变性|感受野有限，远距离依赖要堆层|
|第二代|RNN/LSTM/GRU|循环 + 门控|变长序列、顺序建模|顺序计算无法并行、长距衰减|
|第三代|Transformer|自注意力 + 位置编码|全并行、任意位置直接交互|$O(n^2)$ 复杂度、需要大量数据|

### 1.2 CNN 的归纳偏置：强先验，强局部

CNN 把两个强假设写进结构里：

- **局部性**：相邻像素/相邻词更相关，卷积核只看局部窗口。
- **平移等变性**：同一个卷积核滑过全图，猫在左上角和右下角用同一组权重识别。

这两个假设在图像上极其有效（所以 CNN 统治视觉十年），但在**长距离依赖**上成了枷锁：第 1 个词和第 100 个词的关系，要靠 100 层卷积才能连上。

### 1.3 RNN 的顺序建模：能连远，但连得慢

RNN 用隐状态把历史压进一个向量，理论上能建模任意长依赖。但：

- 第 t 步依赖第 t-1 步，**无法并行**；
- 梯度沿时间反向传播，**长距衰减**（LSTM 门控只是缓解，不是根治）；
- 所有历史压进固定维度隐状态，**信息瓶颈**。

### 1.4 Attention 的起源：不是 Transformer 发明的

注意力机制最早用于**机器翻译的 Seq2Seq**（Bahdanau et al., 2014）：

- 传统 Seq2Seq：Encoder 把整句压成一个向量，Decoder 只能看这一个向量——长句必丢信息。
- 加 Attention：Decoder 每一步**动态地**回看 Encoder 的所有隐状态，按相关度加权——长句也能对齐。

**关键洞察**：既然 Attention 已经能解决「对齐」问题，那还要 RNN 干什么？——Transformer 的答案：**全用 Attention，连循环都不要了**。

## 二、CNN 回顾：局部性与平移不变性

> 这一章不是复习 CNN 基础，而是提炼**哪些设计被 Transformer 继承、哪些被抛弃**。

### 2.1 卷积的核心机制

|概念|含义|在 Transformer 中的对应|
| ----------| ------------------------------| -------------------------------------|
|卷积核|局部窗口的权重|注意力的 Q/K/V 投影矩阵（全局）|
|权值共享|同一核滑过全图|注意力对所有位置用同一组投影|
|感受野|一个输出像素能看到的输入范围|注意力一步看到全序列（感受野=全局）|
|平移等变|输入平移，输出跟着平移|位置编码显式注入位置，不再等变|
|池化|下采样压缩|注意力的加权聚合（可看作软池化）|

### 2.2 感受野计算（为什么 CNN 连不远）

第 l 层感受野递推：

$$
RF_l = RF_{l-1} + (k_l - 1) \times \prod_{i=1}^{l-1} \text{stride}_i
$$

- $3 \times 3$ 卷积堆 10 层，感受野约 $21 \times 21$；
- 要覆盖 $224 \times 224$ 整图，需要约 100 层（ResNet 靠残差才堆得动）；
- 序列上更糟：TextCNN 用 3/4/5 的窗口，只能看 3~5 个词。

**Transformer 的对比**：任意两个位置**一层直达**，路径长度 $O(1)$。

### 2.3 CNN 处理序列的尝试

|方案|做法|局限|
| -----------------| ---------------------| --------------------------------|
|TextCNN|1D 卷积 + 多窗口|只看局部 n-gram，长依赖弱|
|TCN（时序卷积）|因果卷积 + 膨胀卷积|感受野指数增长，但仍需堆层|
|WaveNet|膨胀因果卷积|生成质量高，但推理慢（自回归）|

这些尝试证明：卷积能并行，但连不远；注意力正好相反——连得远，但 $O(n^2)$。

### 2.4 CNN vs Transformer 对比表

|维度|CNN|Transformer|
| ------------| ------------------------| ----------------------------|
|归纳偏置|强（局部性、平移等变）|弱（几乎无先验，靠数据学）|
|感受野|局部，随层数增长|全局，一层直达|
|并行度|高（卷积可并行）|高（注意力可并行）|
|计算复杂度|$O(k \cdot n \cdot d^2)$|$O(n^2 \cdot d)$|
|数据需求|中等（先验帮忙）|大（先验少，要更多数据）|
|位置信息|结构自带|需显式位置编码|
|典型场景|图像、局部模式|长序列、全局关系|

## 三、RNN/LSTM 回顾：顺序建模的极限

### 3.1 RNN 展开与梯度消失

RNN 的隐状态递推：

$$
h_t = \tanh(W_h h_{t-1} + W_x x_t + b)
$$

反向传播时梯度连乘：

$$
\frac{\partial L}{\partial h_1} = \frac{\partial L}{\partial h_T} \times \prod_{t=2}^{T} \frac{\partial h_t}{\partial h_{t-1}}
$$

- 每项含 $W_h$ 与 $\tanh$ 导数（$\le 1$），连乘 $T$ 次 → **指数衰减**；
- 序列越长，远距离梯度越接近 0 → 学不到长依赖。

### 3.2 LSTM 门控：缓解而非根治

|门|作用|公式（简化）|
| ----------| ------------------| --------------|
|遗忘门|决定丢多少旧记忆|$f_t = \sigma(W_f [h_{t-1}, x_t])$|
|输入门|决定写多少新信息|$i_t = \sigma(W_i [h_{t-1}, x_t])$|
|输出门|决定输出多少|$o_t = \sigma(W_o [h_{t-1}, x_t])$|
|细胞状态|长期记忆通道|$C_t = f_t \odot C_{t-1} + i_t \odot \tanh(\cdots)$|

LSTM 用**加法**的细胞状态缓解梯度消失，但**顺序计算**的本质没变——第 t 步仍要等第 t-1 步。

### 3.3 Seq2Seq 与 Bahdanau Attention

```
Encoder: x_1..x_n → h_1..h_n（RNN 隐状态）
Decoder: 每步用 s_{t-1} 与所有 h_i 算注意力权重 α_i
         c_t = Σ α_i h_i（上下文向量）
         s_t = RNN(s_{t-1}, y_{t-1}, c_t)
```

**这是 Transformer 的直接前身**：把「RNN + 注意力」里的 RNN 去掉，只留注意力，就是 Self-Attention。

### 3.4 RNN vs Transformer 对比表

|维度|RNN/LSTM|Transformer|
| ------------| ----------------------| --------------------|
|并行度|低（必须顺序）|高（全并行）|
|长距依赖|衰减（LSTM 缓解）|一步直达|
|路径长度|$O(n)$|$O(1)$|
|每层复杂度|$O(n \cdot d^2)$|$O(n^2 \cdot d)$|
|推理|天然流式（逐 token）|需 KV Cache 才高效|
|位置信息|结构自带（顺序）|需位置编码|

## 四、Attention 的直觉与数学

### 4.1 Q/K/V 图书馆类比

- **Q（Query）** ：你想找的问题（"我想看讲猫的书"）。
- **K（Key）** ：每本书的标签（"动物/猫科"）。
- **V（Value）** ：每本书的内容。

用 Q 和每个 K 算相似度 → softmax 归一化成权重 → 对 V 加权求和。**注意力 = 软检索**。

### 4.2 点积注意力公式

$$
\text{Attention}(Q, K, V) = \text{softmax}\left(\frac{QK^T}{\sqrt{d_k}}\right) V
$$

|步骤|操作|形状（单头）|为什么|
| ------| ----------| --------------| -------------------------------|
|1|$QK^T$|$(n, n)$|每对位置的相似度|
|2|$\div \sqrt{d_k}$|$(n, n)$|防止点积过大导致 softmax 饱和|
|3|$\text{softmax}$（按行）|$(n, n)$|每行权重和为 1|
|4|$\times V$|$(n, d_v)$|加权求和得到新表示|

### 4.3 为什么除以 $\sqrt{d_k}$（推导）

假设 Q、K 各分量独立、均值 0、方差 1：

$$
\mathbb{E}[q \cdot k] = 0, \quad \text{Var}(q \cdot k) = \sum_i \text{Var}(q_i k_i) = d_k
$$

所以点积的标准差 ≈ $\sqrt{d_k}$。$d_k=64$ 时标准差 ≈ 8，softmax 输入跨度过大 → 输出接近 one-hot → 梯度趋近 0（饱和）。除以 $\sqrt{d_k}$ 把方差拉回 1，softmax 保持平滑。

### 4.4 softmax 的作用

- 把任意实数分数变成**概率分布**（非负、和为 1）。
- 可看作**软化的 argmax**：分数差距越大越接近硬选择。
- 温度参数 $\tau$：$\text{softmax}(x/\tau)$，$\tau$ 小更尖锐，$\tau$ 大更平滑。

## 五、Transformer 整体架构

### 5.1 Encoder-Decoder 数据流

```
输入序列 → Embedding + Positional Encoding
        → Encoder × N（Self-Attention → FFN，各带残差+LayerNorm）
        → 编码表示（K, V 供 Decoder 用）
输出序列 → Embedding + Positional Encoding
        → Decoder × N（Masked Self-Attention → Cross-Attention → FFN）
        → Linear → Softmax → 下一个词概率
```

### 5.2 三个注意力位置

|位置|Q 来自|K/V 来自|作用|
| -------------------------------| --------------| --------------| --------------------------|
|Encoder Self-Attention|Encoder 输入|Encoder 输入|编码输入内部关系|
|Decoder Masked Self-Attention|Decoder 输入|Decoder 输入|只看已生成部分（防偷看）|
|Decoder Cross-Attention|Decoder|Encoder 输出|对齐输入与输出|

### 5.3 关键超参（论文 base 版）

|超参|值|说明|
| --------------| ------| -----------------------------|
|d_model|512|所有子层输入输出维度|
|N（层数）|6|Encoder/Decoder 各 6 层|
|h（头数）|8|多头注意力头数|
|d_k = d_v|64|每头维度 = d_model / h|
|d_ff|2048|FFN 中间层维度|
|dropout|0.1|残差、Embedding、注意力权重|
|warmup_steps|4000|学习率预热步数|

### 5.4 与 CNN/RNN 的结构对应

|Transformer 组件|CNN 对应|RNN 对应|
| ------------------| ------------------------| ----------------------|
|Self-Attention|全局卷积（动态权重）|隐状态更新（全局版）|
|Multi-Head|多通道/多核|多隐状态|
|FFN|$1 \times 1$ 卷积（逐位置）|逐时间步 MLP|
|残差|ResNet 残差|门控捷径|
|LayerNorm|BatchNorm（维度不同）|—|
|位置编码|卷积的平移等变（隐式）|循环顺序（隐式）|

## 六、Self-Attention 深入

### 6.1 公式与形状

```
输入 X: (n, d_model)
W_q, W_k, W_v: (d_model, d_k)
Q = X W_q, K = X W_k, V = X W_v  → 各 (n, d_k)
scores = Q Kᵀ / √d_k             → (n, n)
attn = softmax(scores, dim=-1)    → (n, n)
out = attn V                      → (n, d_k)
```

### 6.2 最小实现

```python
import torch, math
def scaled_dot_product_attention(Q, K, V, mask=None):
    d_k = Q.size(-1)
    scores = Q @ K.transpose(-2, -1) / math.sqrt(d_k)
    if mask is not None:
        scores = scores.masked_fill(mask == 0, float("-inf"))
    weights = torch.softmax(scores, dim=-1)
    return weights @ V, weights
```

### 6.3 复杂度分析

|操作|复杂度|说明|
| ------| --------| --------------------|
|$QK^T$|$O(n^2 \cdot d)$|每对位置算点积|
|$\text{softmax}$|$O(n^2)$|对 $n \times n$ 矩阵逐行归一化|
|$\text{attn} \times V$|$O(n^2 \cdot d)$|加权求和|
|总计|$O(n^2 \cdot d)$|$n$ 大时是瓶颈|

### 6.4 注意力与卷积的关系

注意力可以看作**动态卷积**：

- 卷积核权重是**固定的**（训练后不变），对所有位置相同；
- 注意力权重是**动态的**（由 Q/K 算出来），每个位置不同。

所以注意力比卷积表达力更强，但代价是 $O(n^2)$ 且失去平移等变先验。

## 七、Multi-Head Attention

### 7.1 拆头/合并

$$
\text{MultiHead}(Q,K,V) = \text{Concat}(\text{head}_1, \ldots, \text{head}_h) W^O, \quad \text{head}_i = \text{Attention}(Q W_i^Q, K W_i^K, V W_i^V)
$$

1. 把 $d_{model}$ 拆成 $h$ 份（每份 $d_k = d_{model} / h$）。
2. 每头独立做缩放点积注意力。
3. 拼接 h 个头的结果（$h \times d_k = d_{model}$）。
4. 过线性层 W^O 融合。

### 7.2 参数量

|矩阵|形状|参数量|
| ------| ------| --------|
|$W_i^Q, W_i^K, W_i^V$|$(d_{model}, d_k) \times 3$|$3 \times d_{model} \times d_k$|
|$W^O$|$(h \cdot d_k, d_{model})$|$d_{model}^2$|
|合计|—|$4 \times d_{model}^2$|

### 7.3 最小实现

```python
import torch.nn as nn
class MultiHeadAttention(nn.Module):
    def __init__(self, d_model=512, h=8, dropout=0.1):
        super().__init__()
        assert d_model % h == 0
        self.d_k = d_model // h
        self.h = h
        self.W_q = nn.Linear(d_model, d_model)
        self.W_k = nn.Linear(d_model, d_model)
        self.W_v = nn.Linear(d_model, d_model)
        self.W_o = nn.Linear(d_model, d_model)
        self.dropout = nn.Dropout(dropout)

    def forward(self, q, k, v, mask=None):
        B, n, _ = q.shape
        q = self.W_q(q).view(B, n, self.h, self.d_k).transpose(1, 2)
        k = self.W_k(k).view(B, -1, self.h, self.d_k).transpose(1, 2)
        v = self.W_v(v).view(B, -1, self.h, self.d_k).transpose(1, 2)
        scores = q @ k.transpose(-2, -1) / (self.d_k ** 0.5)
        if mask is not None:
            scores = scores.masked_fill(mask == 0, float("-inf"))
        attn = self.dropout(torch.softmax(scores, dim=-1))
        out = attn @ v
        out = out.transpose(1, 2).contiguous().view(B, n, -1)
        return self.W_o(out)
```

**易错点**：拆头用 ​`view + transpose`​，合并时必须 ​`contiguous()`​ 再 ​`view`，否则报错或数据错位。

### 7.4 多头学到了什么

可视化研究发现不同头关注不同模式：

|头类型|关注模式|例子|
| --------| --------------| --------------------------|
|局部头|相邻位置|前一个词/后一个词|
|句法头|依存关系|动词→宾语、形容词→名词|
|指代头|代词→先行词|"它"→"猫"|
|稀有头|特殊模式|分隔符、句首|

**为什么多头有效**：单头只能学一种关系模式，多头在不同子空间并行学多种关系。

## 八、Positional Encoding

### 8.1 为什么需要

注意力对位置**无感**：打乱输入顺序，输出只是跟着打乱，模型学不到"谁在前谁在后"。CNN 靠卷积的局部结构隐式知道位置，RNN 靠循环顺序隐式知道位置，Transformer 必须**显式注入**。

### 8.2 正弦位置编码（论文方案）

$$
PE_{(pos, 2i)} = \sin\left(\frac{pos}{10000^{2i/d_{model}}}\right), \quad PE_{(pos, 2i+1)} = \cos\left(\frac{pos}{10000^{2i/d_{model}}}\right)
$$

|特点|说明|
| -------------------| --------------------------------------|
|无参数|不增加训练参数|
|可外推|任意长度都能算（但实际外推效果有限）|
|相对位置|sin/cos 的线性组合可表达相对位移|
|与 Embedding 相加|不是拼接，直接逐元素相加|

### 8.3 最小实现

```python
import torch, math
def positional_encoding(max_len, d_model):
    pe = torch.zeros(max_len, d_model)
    pos = torch.arange(0, max_len).unsqueeze(1).float()
    div = torch.exp(torch.arange(0, d_model, 2).float() * (-math.log(10000.0) / d_model))
    pe[:, 0::2] = torch.sin(pos * div)
    pe[:, 1::2] = torch.cos(pos * div)
    return pe.unsqueeze(0)
```

### 8.4 现代替代

|方案|做法|优点|缺点|
| ------------| -------------------------| ----------------------| --------------|
|可学习编码|每个位置一个可训练向量|简单、效果好|无法外推|
|RoPE|把位置编码进 Q/K 的旋转|相对位置自然、外推好|实现稍复杂|
|ALiBi|用线性偏置惩罚距离|外推极好、无参数|表达能力有限|

### 8.5 与 CNN 的位置信息对比

|维度|CNN|Transformer|
| ----------| ------------------------| --------------------|
|位置来源|卷积的局部结构（隐式）|位置编码（显式）|
|平移等变|有|无（位置编码打破）|
|外推能力|天然（卷积核可滑更远）|取决于编码方案|

## 九、Feed-Forward Network

### 9.1 结构

$$
\text{FFN}(x) = \max(0, x W_1 + b_1) W_2 + b_2
$$

|项|值|说明|
| ----------| --------------| --------------------------------|
|中间维度|d_ff = 2048|通常是 d_model 的 4 倍|
|激活|ReLU（论文）|现代多用 GELU/SwiGLU|
|作用|逐位置独立|不跨位置交互（交互交给注意力）|

### 9.2 激活函数演进

|激活|公式|特点|
| --------| ------| ----------------------------|
|ReLU|$\max(0, x)$|简单、稀疏|
|GELU|$x \cdot \Phi(x)$|平滑、BERT/GPT 常用|
|SwiGLU|$\text{Swish}(xW) \cdot (xV)$|LLaMA 用，效果更好但参数多|

### 9.3 参数量占比

- 每层 FFN 参数：$2 \times d_{model} \times d_{ff} = 2 \times 512 \times 2048 \approx 2.1M$；
- 每层注意力参数：$4 \times d_{model}^2 = 4 \times 512^2 \approx 1.05M$；
- **FFN 约占每层参数的 2/3**——这是很多人忽略的事实。

### 9.4 与 CNN 的 $1 \times 1$ 卷积对比

FFN 本质是逐位置的 $1 \times 1$ 卷积（两层 MLP）：

- 相同点：不跨位置交互、逐位置独立、可并行；
- 不同点：FFN 通常先升维再降维（$d_{ff} > d_{model}$），$1 \times 1$ 卷积常保持通道数。

## 十、残差与 LayerNorm

### 10.1 残差连接

$$
\text{输出} = x + \text{Sublayer}(x)
$$

- 梯度直通：反向传播时梯度可以跳过子层，缓解深层退化；
- 与 ResNet 的残差同源：ResNet 解决 CNN 深层退化，Transformer 解决深层堆叠。

### 10.2 LayerNorm vs BatchNorm

|维度|BatchNorm（CNN 常用）|LayerNorm（Transformer 用）|
| ------------| -----------------------| -----------------------------|
|归一化维度|跨 batch（每个特征）|跨特征（每个样本）|
|依赖 batch|是（batch 小不稳）|否（单样本即可）|
|序列适配|差（变长序列难对齐）|好（逐位置独立）|
|训练/推理|统计量不同|一致|

**为什么 Transformer 用 LayerNorm**：序列长度可变、batch 内样本独立，LayerNorm 不依赖 batch 统计，天然适配。

### 10.3 Post-LN vs Pre-LN

|方案|结构|特点|
| -----------------| ----------------------------| -------------------------|
|Post-LN（论文）|LayerNorm(x + Sublayer(x))|需 warmup，深层易不稳|
|Pre-LN（现代）|x + Sublayer(LayerNorm(x))|训练更稳，可不用 warmup|

### 10.4 RMSNorm

LLaMA 等现代模型用 RMSNorm 替代 LayerNorm：

$$
\text{RMSNorm}(x) = \frac{x}{\sqrt{\text{mean}(x^2) + \epsilon}} \times \gamma
$$

- 去掉均值中心化，只做缩放；
- 计算更快，效果接近。

## 十一、Masked Attention 与训练

### 11.1 因果掩码

```python
def causal_mask(n):
    return torch.tril(torch.ones(n, n)).bool()
```

- 下三角为 1（可见），上三角为 0（屏蔽）；
- 掩码位置填 ​`-inf`，softmax 后权重为 0；
- Encoder 不需要掩码（双向可见）；Decoder 自注意力必须掩码。

### 11.2 padding 掩码

变长序列 padding 后，要屏蔽 padding 位置：

```python
# mask: (B, n)，1=有效，0=padding
scores = scores.masked_fill(mask[:, None, None, :] == 0, float("-inf"))
```

### 11.3 训练细节（论文）

|项|设置|说明|
| -----------------| ----------------------------------| -------------------------|
|优化器|Adam(β1=0.9, β2=0.98, ε=1e-9)|—|
|学习率|warmup 4000 步后按 $1/\sqrt{\text{step}}$ 衰减|$\text{lrate} = d_{model}^{-0.5} \cdot \min(\text{step}^{-0.5}, \text{step} \cdot \text{warmup}^{-1.5})$|
|Dropout|0.1|残差、Embedding、注意力|
|Label Smoothing|ε=0.1|缓解过拟合、提升 BLEU|
|批大小|约 25k token/批|按 token 数而非句数|

### 11.4 学习率调度实现

```python
def lr_lambda(step, d_model=512, warmup=4000):
    step = max(step, 1)
    return d_model ** -0.5 * min(step ** -0.5, step * warmup ** -1.5)
```

## 十二、复杂度与效率优化

### 12.1 $O(n^2)$ 问题

|序列长度 $n$|注意力矩阵大小|显存（fp16）|
| -----------| ----------------| --------------|
|512|$512^2 \approx 26$ 万|~0.5 MB|
|2048|$2048^2 \approx 420$ 万|~8 MB|
|8192|$8192^2 \approx 6700$ 万|~128 MB|
|32768|$32768^2 \approx 10.7$ 亿|~2 GB|

n 翻倍，显存和计算量翻 4 倍——这是长文本/高分辨率图像的瓶颈。

### 12.2 FlashAttention

- 核心思想：**分块计算 + 不存完整注意力矩阵**，在 SRAM 中完成 softmax；
- 效果：显存 $O(n)$ 而非 $O(n^2)$，速度提升 2-4 倍；
- 数学等价：结果与标准注意力完全一致，只是实现优化。

### 12.3 稀疏/线性注意力

|方案|做法|复杂度|
| ------------| ------------------------| --------|
|Longformer|局部窗口 + 全局 token|$O(n)$|
|BigBird|局部 + 全局 + 随机|$O(n)$|
|Linformer|低秩近似 K/V|$O(n)$|
|Performer|核函数近似 softmax|$O(n)$|
|Mamba/SSM|状态空间模型替代注意力|$O(n)$|

### 12.4 与 CNN 复杂度对比

|层类型|每层复杂度|顺序操作|最大路径长度|
| ----------------| ------------| ----------| --------------|
|Self-Attention|$O(n^2 \cdot d)$|$O(1)$|$O(1)$|
|RNN|$O(n \cdot d^2)$|$O(n)$|$O(n)$|
|CNN|$O(k \cdot n \cdot d^2)$|$O(1)$|$O(\log_k n)$|

结论：$n < d$ 时注意力更划算；$n$ 很大时 $O(n^2)$ 成为瓶颈，需要 FlashAttention/稀疏化。

## 十三、架构变体全景

### 13.1 Encoder-only：BERT

- 只用 Encoder，双向注意力；
- 预训练任务：MLM（掩码语言模型）+ NSP（下一句预测）；
- 擅长：理解任务（分类、抽取、相似度）；
- 代表：BERT、RoBERTa、ALBERT、DeBERTa。

### 13.2 Decoder-only：GPT

- 只用 Decoder，因果掩码；
- 预训练任务：下一词预测（自回归）；
- 擅长：生成任务（写作、对话、代码）；
- 代表：GPT-1/2/3/4、LLaMA、Qwen、DeepSeek。

### 13.3 Encoder-Decoder：T5

- 完整架构，Encoder 双向 + Decoder 因果；
- 统一成"文本到文本"框架；
- 擅长：翻译、摘要、问答；
- 代表：T5、BART、mT5。

### 13.4 视觉 Transformer：ViT/Swin

|模型|做法|特点|
| ------| ---------------------------------| ------------------|
|ViT|图像切 patch（$16 \times 16$），当 token 序列|大数据下超越 CNN|
|Swin|窗口注意力 + 层级结构|局部窗口降复杂度|
|DeiT|蒸馏训练|小数据也能训 ViT|

### 13.5 多模态：CLIP

- 图像 Encoder + 文本 Encoder，对比学习对齐；
- 零样本分类：用文本描述匹配图像。

### 13.6 现代 LLM：LLaMA

|改进|说明|
| ----------| -----------------------------|
|RoPE|旋转位置编码，外推好|
|RMSNorm|替代 LayerNorm，更快|
|SwiGLU|FFN 激活，效果更好|
|GQA|分组查询注意力，省 KV Cache|
|KV Cache|推理时缓存 K/V，避免重算|

## 十四、CNN 与 Transformer 的融合

### 14.1 ViT 的 patch embedding

```
图像 (H, W, 3) → 切 patch (P×P) → 展平 → 线性投影 → token 序列
例：224×224 图，16×16 patch → 196 个 token
```

本质：用卷积（stride=$P$ 的 $P \times P$ 卷积）实现切块+投影，然后交给 Transformer。

### 14.2 CNN 作为 backbone

- 混合架构：CNN 提局部特征 → Transformer 建模全局关系；
- 代表：Conformer（语音）、CoAtNet（视觉）、CMT。

### 14.3 ConvNeXt：CNN 现代化

把 Transformer 的设计搬回 CNN：

|Transformer 设计|ConvNeXt 对应|
| ------------------| --------------------|
|大核注意力|$7 \times 7$ 深度卷积|
|LayerNorm|换成 LN|
|GELU|换成 GELU|
|倒瓶颈 FFN|$1 \times 1$ 升维 → $7 \times 7$ → $1 \times 1$ 降维|

**结论**：架构之争不是非此即彼，好的设计会被互相借鉴。

### 14.4 混合架构选型

|场景|推荐|理由|
| ------------| --------------------------| --------------|
|小数据图像|CNN（ResNet）|归纳偏置帮忙|
|大数据图像|ViT/Swin|表达力强|
|长文本|Transformer + 稀疏注意力|全局关系|
|实时流式|RNN/SSM（Mamba）|推理 $O(1)$ 内存|
|多模态|CLIP 类双塔|对齐图文|

## 十五、最小可运行实现

### 15.1 完整 Encoder

```python
import torch, torch.nn as nn

class EncoderLayer(nn.Module):
    def __init__(self, d_model=512, h=8, d_ff=2048, dropout=0.1):
        super().__init__()
        self.attn = MultiHeadAttention(d_model, h, dropout)
        self.ffn = nn.Sequential(
            nn.Linear(d_model, d_ff), nn.ReLU(), nn.Dropout(dropout),
            nn.Linear(d_ff, d_model))
        self.norm1 = nn.LayerNorm(d_model)
        self.norm2 = nn.LayerNorm(d_model)
        self.drop = nn.Dropout(dropout)
    def forward(self, x, mask=None):
        x = self.norm1(x + self.drop(self.attn(x, x, x, mask)))
        x = self.norm2(x + self.drop(self.ffn(x)))
        return x

x = torch.randn(2, 10, 512)
enc = EncoderLayer()
print(enc(x).shape)   # torch.Size([2, 10, 512])
```

### 15.2 完整 Decoder

```python
class DecoderLayer(nn.Module):
    def __init__(self, d_model=512, h=8, d_ff=2048, dropout=0.1):
        super().__init__()
        self.self_attn = MultiHeadAttention(d_model, h, dropout)
        self.cross_attn = MultiHeadAttention(d_model, h, dropout)
        self.ffn = nn.Sequential(
            nn.Linear(d_model, d_ff), nn.ReLU(), nn.Dropout(dropout),
            nn.Linear(d_ff, d_model))
        self.norm1 = nn.LayerNorm(d_model)
        self.norm2 = nn.LayerNorm(d_model)
        self.norm3 = nn.LayerNorm(d_model)
        self.drop = nn.Dropout(dropout)
    def forward(self, x, enc_out, tgt_mask=None, src_mask=None):
        x = self.norm1(x + self.drop(self.self_attn(x, x, x, tgt_mask)))
        x = self.norm2(x + self.drop(self.cross_attn(x, enc_out, enc_out, src_mask)))
        x = self.norm3(x + self.drop(self.ffn(x)))
        return x
```

### 15.3 训练循环骨架

```python
model = nn.Sequential()  # 实际用 Encoder+Decoder 组合
opt = torch.optim.Adam(model.parameters(), lr=1e-4, betas=(0.9, 0.98), eps=1e-9)
sched = torch.optim.lr_scheduler.LambdaLR(opt, lambda s: lr_lambda(s))
loss_fn = nn.CrossEntropyLoss(label_smoothing=0.1)

for batch in dataloader:
    logits = model(batch.src, batch.tgt)
    loss = loss_fn(logits.view(-1, vocab), batch.tgt_y.view(-1))
    opt.zero_grad(); loss.backward(); opt.step(); sched.step()
```

## 十六、易错点

|易错点|后果|正确做法|
| ---------------------------| ---------------------------| ----------------------------------|
|忘记 $\div \sqrt{d_k}$|softmax 饱和、梯度消失|除以 $\sqrt{d_k}$|
|拆头后忘记 contiguous|view 报错或数据错位|transpose 后 contiguous().view()|
|Decoder 忘记因果掩码|训练时偷看未来，推理崩|tril 掩码|
|位置编码与 Embedding 拼接|维度翻倍、后续层不匹配|相加，不是拼接|
|Post-LN 不 warmup|训练发散|warmup 或改 Pre-LN|
|mask 用 0/1 直接乘|softmax 前乘 0 不等于屏蔽|-inf 填充|
|FFN 维度写错|参数量与论文不符|$d_{ff} = 4 \times d_{model}$|
|忽略 padding 掩码|padding 位置参与注意力|显式 mask|
|推理不用 KV Cache|每步重算全部 K/V，极慢|缓存 K/V|

## 十七、验证方法（怎么确认学会了）

1. **手写**：不看笔记写出缩放点积注意力 + 多头拆分/合并，跑通形状检查。
2. **解释**：能说清「为什么除以 $\sqrt{d_k}$」「为什么需要位置编码」「Post-LN 与 Pre-LN 区别」「LayerNorm 为什么不用 BatchNorm」。
3. **对比**：能画出 Attention/RNN/CNN 的复杂度、路径长度、归纳偏置对比表。
4. **调试**：给一段错误实现（如漏 mask），能定位并修复。
5. **迁移**：能说明 BERT（Encoder-only）、GPT（Decoder-only）、T5（Encoder-Decoder）、ViT（视觉）分别用了哪部分。
6. **工程**：能解释 FlashAttention 为什么快、KV Cache 为什么省、RoPE 为什么外推好。

## 十八、学习路径与能力目标

|阶段|内容|产出|目标等级|
| ------| -------------------------------------------------------------------| --------------------------| ----------|
|0|第零章小白预备（向量/矩阵/softmax/神经网络/embedding/手算注意力）|能回答 0.9 的 6 个自测题|L0→L1|
|1|演进史 + CNN/RNN 回顾（第一~三章）|能画三代架构对比图|L1|
|2|Attention 数学 + 架构总览（第四、五章）|能推导公式|L1|
|3|Self-Attention + 多头（第六、七章）|手写实现|L2|
|4|位置编码 + FFN + 残差（第八~十章）|解释每个设计|L2|
|5|掩码 + 训练细节（第十一章）|跑通小训练|L3|
|6|复杂度 + 变体全景（第十二、十三章）|能选型|L3|
|7|CNN 融合 + 完整实现（第十四、十五章）|能改架构|L3|

**下一步**：读 BERT/GPT 论文，理解 Encoder-only 与 Decoder-only 的取舍；用 FlashAttention 优化长序列；尝试把 ViT 用到 PPG 图像化特征上。

## 十九、延伸阅读

|论文/资料|主题|为什么读|
| ----------------------------------| ----------------------| --------------------------|
|Attention Is All You Need (2017)|Transformer 原始论文|一切起点|
|BERT (2018)|Encoder-only 预训练|理解双向注意力|
|GPT-3 (2020)|Decoder-only 缩放|理解自回归生成|
|ViT (2020)|视觉 Transformer|理解 patch embedding|
|Swin Transformer (2021)|窗口注意力|理解层级视觉架构|
|FlashAttention (2022)|高效注意力|理解工程优化|
|LLaMA (2023)|现代 LLM 架构|理解 RoPE/RMSNorm/SwiGLU|
|Mamba (2023)|状态空间模型|理解注意力替代方案|

<section class="siyuan-references" aria-label="文档引用">

## 文档关系

### 反向引用
- [学习笔记](/siyuan/)
- [P0](/siyuan/待学习/P0/)

</section>
