---
title: '旋转编码器与电机详解'
date: '2026-08-26T16:47:55+08:00'
updated: '2026-08-26T17:46:38+08:00'
layout: page
type: siyuan-note
notebook: '学习笔记'
permalink: 'siyuan/其他笔记/嵌入式/STM32/旋转编码器与电机详解/'
siyuan_source: '其他笔记/嵌入式/STM32/旋转编码器与电机详解.md'
comments: false
categories:
  - '学习笔记'
  - '其他笔记'
  - '嵌入式'
  - 'STM32'
---

> 旋转编码器 / 编码电机 A/B 相计数原理，以及 STM32 定时器编码器模式的配置与使用速查。与《知识点大纲》的 TIM 输入捕获、CubeMX 配置联动。

## 一、A/B 相与旋转方向

把旋转编码器/编码电机的两相分为 **A 相** 与 **B 相**。

在进行旋转等操作时，两相电平变化如下图所示（A、B 两相相位差 90°，根据两相先后顺序可判断正转/反转）：

![image](/images/siyuan/%E5%85%B6%E4%BB%96%E7%AC%94%E8%AE%B0/%E5%B5%8C%E5%85%A5%E5%BC%8F/STM32/image.png)

## 二、每转脉冲数

下图是电机旋转 360° 时会产生（图左侧数值）的脉冲数，一般可以在数据手册中找到对应的数值：

![image](/images/siyuan/%E5%85%B6%E4%BB%96%E7%AC%94%E8%AE%B0/%E5%B5%8C%E5%85%A5%E5%BC%8F/STM32/image-20260826164950-p2wqks2.png)

## 三、STM32 定时器编码器模式计数

### 3.1 获取计数值

可使用以下函数进行计数值获取：

```c
count = __HAL_TIM_GET_COUNTER(&htim1);
```

### 3.2 预分频器 PSC

如图为定时器的预分频器，在这种模式下工作时相当于把计数值除以（PSC+1）：

![image](/images/siyuan/%E5%85%B6%E4%BB%96%E7%AC%94%E8%AE%B0/%E5%B5%8C%E5%85%A5%E5%BC%8F/STM32/image-20260826165004-5wcwjlv.png)

### 3.3 计数模式选择

如图为选用哪个通道进行计数的模式选择：

![image](/images/siyuan/%E5%85%B6%E4%BB%96%E7%AC%94%E8%AE%B0/%E5%B5%8C%E5%85%A5%E5%BC%8F/STM32/image-20260826165010-n4842jw.png)

- 选择**两个通道**都进行计数：每次脉冲计数 **4 次**
- 选用**一个通道**：每次脉冲计数 **2 次**

### 3.4 正反转修正

如果正反转不太符合编程习惯，可以选中一个通道，将其有效电平反相（**注意只需翻转一个通道**），即可实现正反转互换的效果：

![image](/images/siyuan/%E5%85%B6%E4%BB%96%E7%AC%94%E8%AE%B0/%E5%B5%8C%E5%85%A5%E5%BC%8F/STM32/image-20260826165016-4pz6dva.png)

## 四、关联知识点

- 定时器相关配置（引脚、PSC/ARR、中断）见 [知识点大纲](/siyuan/其他笔记/嵌入式/STM32/知识点大纲/) 六～七章
- CubeMX 中 PA15（TIM2_CH1，编码器可用通道）配置见 [STM32CubeMX配置](/siyuan/其他笔记/嵌入式/STM32/STM32CubeMX配置/) 引脚表

‍

<section class="siyuan-references" aria-label="文档引用">

## 文档关系

### 本文引用
- [STM32CubeMX配置](/siyuan/其他笔记/嵌入式/STM32/STM32CubeMX配置/)
- [知识点大纲](/siyuan/其他笔记/嵌入式/STM32/知识点大纲/)

### 反向引用
- [STM32](/siyuan/其他笔记/嵌入式/STM32/)
- [蓝桥杯嵌入式赛道分析](/siyuan/其他笔记/嵌入式/STM32/蓝桥杯嵌入式赛道分析/)
- [其他笔记](/siyuan/其他笔记/)
- [嵌入式](/siyuan/其他笔记/嵌入式/)
- [学习笔记](/siyuan/)

</section>
