---
title: 'ReLU激活函数出现神经元死亡'
date: '2026-06-03T15:18:53+08:00'
updated: '2026-06-03T16:14:30+08:00'
layout: page
type: siyuan-note
notebook: '学习笔记'
permalink: 'siyuan/一口气学完CNN的卷积层、池化层、激活函数、全连接层、输出层/附3：激活函数的作用/ReLU激活函数出现神经元死亡/'
siyuan_source: '一口气学完CNN的卷积层、池化层、激活函数、全连接层、输出层/附3：激活函数的作用/ReLU激活函数出现神经元死亡.md'
comments: false
categories:
  - '学习笔记'
  - '一口气学完CNN的卷积层、池化层、激活函数、全连接层、输出层'
  - '附3：激活函数的作用'
---

$\text{ReLU}(x) =  \begin{cases}  x  x \geq 0 \\  0  x < 0  \end{cases}$  

![2026-06-03_15-20-43](/images/siyuan/%E4%B8%80%E5%8F%A3%E6%B0%94%E5%AD%A6%E5%AE%8CCNN%E7%9A%84%E5%8D%B7%E7%A7%AF%E5%B1%82%E3%80%81%E6%B1%A0%E5%8C%96%E5%B1%82%E3%80%81%E6%BF%80%E6%B4%BB%E5%87%BD%E6%95%B0%E3%80%81%E5%85%A8%E8%BF%9E%E6%8E%A5%E5%B1%82%E3%80%81%E8%BE%93%E5%87%BA%E5%B1%82/%E9%99%843%EF%BC%9A%E6%BF%80%E6%B4%BB%E5%87%BD%E6%95%B0%E7%9A%84%E4%BD%9C%E7%94%A8/2026-06-03_15-20-43.png)![2026-06-03_15-20-49](/images/siyuan/%E4%B8%80%E5%8F%A3%E6%B0%94%E5%AD%A6%E5%AE%8CCNN%E7%9A%84%E5%8D%B7%E7%A7%AF%E5%B1%82%E3%80%81%E6%B1%A0%E5%8C%96%E5%B1%82%E3%80%81%E6%BF%80%E6%B4%BB%E5%87%BD%E6%95%B0%E3%80%81%E5%85%A8%E8%BF%9E%E6%8E%A5%E5%B1%82%E3%80%81%E8%BE%93%E5%87%BA%E5%B1%82/%E9%99%843%EF%BC%9A%E6%BF%80%E6%B4%BB%E5%87%BD%E6%95%B0%E7%9A%84%E4%BD%9C%E7%94%A8/2026-06-03_15-20-49.png)

- 与Sigmoid激活函数相比，ReLU在$x≥0$部分消除了梯度饱和效应”，且ReLU的计算更简单，计算速度更快
- 但ReLU本身也存在缺陷，如果输入为负值，其梯度等于0，导致“神经元死亡”，将无法进行权重更新，进而无法完成网络训练。
- 即便如此，ReLU仍然是当前深度学习领域中最为常用的激活函数之一。

‍

<section class="siyuan-references" aria-label="文档引用">

## 文档关系

### 反向引用
- [学习笔记](/siyuan/)
- [一口气学完CNN的卷积层、池化层、激活函数、全连接层、输出层](/siyuan/一口气学完CNN的卷积层、池化层、激活函数、全连接层、输出层/)

</section>
