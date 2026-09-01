---
title: 'STM32CubeMX配置'
date: '2025-03-29T15:44:28+08:00'
updated: '2026-08-26T17:11:52+08:00'
layout: page
type: siyuan-note
notebook: '学习笔记'
permalink: 'siyuan/其他笔记/嵌入式/STM32/STM32CubeMX配置/'
siyuan_source: '其他笔记/嵌入式/STM32/STM32CubeMX配置.md'
comments: false
categories:
  - '学习笔记'
  - '其他笔记'
  - '嵌入式'
  - 'STM32'
---

> STM32CubeMX 工程配置速查：包含工程级配置、引脚功能配置总表，以及"为什么要这样配"的原理说明（面向蓝桥杯嵌入式赛道统一开发板）。

## 一、工程配置总览

|配置项|配置值|说明|
| ---------------| ----------------------------| -------------------------------------------------|
|时钟源（RCC）|外部晶振 HSE|24MHz 外部晶振作为时钟源|
|系统时钟|HSE → PLL，PLLCLK = 80MHz|由 PLL 倍频得到系统时钟|
|调试接口|Serial Wire（SWD）|仅占用 SWDIO/SWCLK 两根线，释放 JTAG 占用的引脚|
|IDE 工程|MDK-ARM|生成 Keil MDK 工程|
|代码生成|.c 与 .h 文件分离|便于按模块维护、直接对接官方库文件|

## 二、引脚功能配置表

|引脚|模式|功能|补充说明|
| ----------| -------------| ------------| ------------------------|
|PA0|GPIO_INPUT|KEY1|按键 1|
|PA7|TIM3_CH2|PWM 输出|输出 PWM 波|
|PA9|USART1_RX|串口 1|RX|
|PA10|USART1_TX|串口 1|TX|
|PA15|TIM2_CH1|输入捕获 2|对应 R40|
|PB0-PB2|GPIO_INPUT|KEY2-4|按键 2-4|
|PB4|TIM3_CH1|输入捕获 1|对应 R39|
|PB12|ADC1_IN11|ADC 采集 2|对应 R38|
|PB15|ADC2_IN15|ADC 采集 1|对应 R37|
|PC0-PC7|GPIO_OUTPUT|LCD 专属|保持默认电平即可|
|PC8-PC15|GPIO_OUTPUT|LD1-LD8|低电平点亮，高电平熄灭|
|PD2|GPIO_OUTPUT|LED 锁|低电平锁住，高电平解锁|

## 三、为什么蓝桥杯嵌入式赛道要这么配置

1. **统一开发板、统一引脚分配**：赛事使用官方统一开发板，LED/LCD/KEY 等板载外设的引脚分配由板级库固定（如 PC8-PC15 接 LED、PD2 接 LED 锁、PB0-PB2/PA0 接按键）。凡是调用官方库函数时，都隐含了这套引脚假设——个人擅自改引脚会导致库函数失效。
2. **24MHz HSE + PLL 到 80MHz**：80MHz 系统时钟对定时器分频非常友好：TIM 输入时钟 80MHz 时，设置 PSC=79、ARR=999 即可得到 1ms 基准（(79+1)×(999+1) / 80M = 1ms），PSC=79、ARR=9999 即 10ms——竞赛题目要求的分频（如 PWM 步进 <200Hz）都能通过整数分频实现，避免小数分频引入误差。
3. **Serial Wire 而非 JTAG**：JTAG 复用引脚（PA13/PA14/PA15/PB3/PB4）中，**PA15 与 PB4 恰好是输入捕获通道**（TIM2_CH1 / TIM3_CH1），PB3-PB4 还可能是其他外设位置。改用 SWD 后仅占用 SWDIO/SWCLK，把这些引脚完完整整让给功能外设。
4. **生成 .c/.h 分离文件**：官方例程库按模块提供 .c/.h 文件（如 LCD、LED、按键、EEPROM 的库），CubeMX 同步生成分离文件可直接调用，同时便于多人/多工程共用与增量编译。

> 与知识点大纲的对应：本表引脚分配与《知识点大纲》中各模块章节一致（KEY=三章、UART=四章、ADC=五章、TIM 输入捕获=六章、PWM=七章、LED/LCD=一/二章），配置完成后再按大纲填充业务逻辑即可。

<section class="siyuan-references" aria-label="文档引用">

## 文档关系

### 反向引用
- [STM32](/siyuan/其他笔记/嵌入式/STM32/)
- [蓝桥杯嵌入式赛道分析](/siyuan/其他笔记/嵌入式/STM32/蓝桥杯嵌入式赛道分析/)
- [其他笔记](/siyuan/其他笔记/)
- [嵌入式](/siyuan/其他笔记/嵌入式/)
- [旋转编码器与电机详解](/siyuan/其他笔记/嵌入式/STM32/旋转编码器与电机详解/)
- [学习笔记](/siyuan/)

</section>
