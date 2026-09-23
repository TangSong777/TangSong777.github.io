---
title: 'Sigmoid激活函数的梯度饱和效应'
date: '2026-06-03T15:22:13+08:00'
updated: '2026-06-03T16:14:28+08:00'
layout: page
type: siyuan-note
notebook: '学习笔记'
permalink: 'siyuan/一口气学完CNN的卷积层、池化层、激活函数、全连接层、输出层/附3：激活函数的作用/Sigmoid激活函数的梯度饱和效应/'
siyuan_source: '一口气学完CNN的卷积层、池化层、激活函数、全连接层、输出层/附3：激活函数的作用/Sigmoid激活函数的梯度饱和效应.md'
comments: false
categories:
  - '学习笔记'
  - '一口气学完CNN的卷积层、池化层、激活函数、全连接层、输出层'
  - '附3：激活函数的作用'
---

$Sigmoid\left(x\right)=\frac{1}{1+e^{-x}}$

![2026-06-03_15-23-13](/images/siyuan/%E4%B8%80%E5%8F%A3%E6%B0%94%E5%AD%A6%E5%AE%8CCNN%E7%9A%84%E5%8D%B7%E7%A7%AF%E5%B1%82%E3%80%81%E6%B1%A0%E5%8C%96%E5%B1%82%E3%80%81%E6%BF%80%E6%B4%BB%E5%87%BD%E6%95%B0%E3%80%81%E5%85%A8%E8%BF%9E%E6%8E%A5%E5%B1%82%E3%80%81%E8%BE%93%E5%87%BA%E5%B1%82/%E9%99%843%EF%BC%9A%E6%BF%80%E6%B4%BB%E5%87%BD%E6%95%B0%E7%9A%84%E4%BD%9C%E7%94%A8/2026-06-03_15-23-13.png)![2026-06-03_15-23-20](/images/siyuan/%E4%B8%80%E5%8F%A3%E6%B0%94%E5%AD%A6%E5%AE%8CCNN%E7%9A%84%E5%8D%B7%E7%A7%AF%E5%B1%82%E3%80%81%E6%B1%A0%E5%8C%96%E5%B1%82%E3%80%81%E6%BF%80%E6%B4%BB%E5%87%BD%E6%95%B0%E3%80%81%E5%85%A8%E8%BF%9E%E6%8E%A5%E5%B1%82%E3%80%81%E8%BE%93%E5%87%BA%E5%B1%82/%E9%99%843%EF%BC%9A%E6%BF%80%E6%B4%BB%E5%87%BD%E6%95%B0%E7%9A%84%E4%BD%9C%E7%94%A8/2026-06-03_15-23-20.png)

- Sigmoid激活函数存在"梯度饱和效应”问题，即Sigmoid激活函数两端梯度都趋于0，因此在使用误差反向传播算法进行网络训练时，该区域的误差无法传递到前一层，从而导致网络训练失败。

‍

<section class="siyuan-references" aria-label="文档引用">

## 文档关系

### 反向引用
- [学习笔记](/siyuan/)
- [一口气学完CNN的卷积层、池化层、激活函数、全连接层、输出层](/siyuan/一口气学完CNN的卷积层、池化层、激活函数、全连接层、输出层/)

</section>
