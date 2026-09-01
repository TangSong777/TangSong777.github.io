---
title: '知识点大纲'
date: '2026-08-26T17:24:56+08:00'
updated: '2026-08-26T17:37:31+08:00'
layout: page
type: siyuan-note
notebook: '学习笔记'
permalink: 'siyuan/其他笔记/嵌入式/ESP32/知识点大纲/'
siyuan_source: '其他笔记/嵌入式/ESP32/知识点大纲.md'
comments: false
categories:
  - '学习笔记'
  - '其他笔记'
  - '嵌入式'
  - 'ESP32'
---

> ESP32 Arduino 基础函数速查，涵盖 GPIO 数字 I/O、延时、LEDC PWM 输出与串口通信四大常用模块。

## 一、GPIO 数字 I/O

> 控制指定数字引脚的输入/输出模式与电平读写。

### 1.1 设置引脚模式：pinMode

```c
pinMode(pin, mode);
```

|参数|说明|
| ------| --------------------------------------------------------------------------------------------------------|
|pin|数字引脚编号|
|mode|OUTPUT：输出模式 / INPUT：输入模式 / INPUT_PULLUP：带内部上拉的输入 / INPUT_PULLDOWN：带内部下拉的输入|

### 1.2 输出高低电平：digitalWrite

```c
digitalWrite(pin, value);
```

|参数|说明|
| -------| -------------------------------|
|pin|数字引脚编号|
|value|HIGH（高电平）/ LOW（低电平）|

> 注意：调用前必须先将该引脚设置为 OUTPUT 模式。

### 1.3 读取引脚状态：digitalRead

```c
digitalRead(pin);
```

返回值：**HIGH**（高电平）/ **LOW**（低电平）

> 注意：调用前必须先将该引脚设置为 INPUT（或 INPUT_PULLUP / INPUT_PULLDOWN）模式。

## 二、延时函数

### 2.1 毫秒延时

```c
delay(ms);       // 阻塞 ms 毫秒
```

### 2.2 微秒延时

```c
delayMicroseconds(us);  // 阻塞 us 微秒
```

## 三、LEDC PWM 输出

> ESP32 内置 LEDC 控制器，支持最多 **16 个独立通道**，可分别配置不同频率与占空比分辨率，再绑定到指定 GPIO 输出 PWM 波。

### 3.1 配置通道频率与分辨率：ledcSetup

```c
ledcSetup(chan, freq, bit_num);
```

|参数|说明|
| ---------| --------------------------|
|chan|LEDC 通道号（0~15）|
|freq|PWM 频率（Hz）|
|bit_num|计数位数（占空比分辨率）|

- `bit_num = 8`​ → 占空比范围 **0~255**
- `bit_num = 10`​ → 占空比范围 **0~1023**

### 3.2 绑定通道到 GPIO：ledcAttachPin

```c
ledcAttachPin(pin, chan);
```

将指定 LEDC 通道绑定到指定 GPIO 引脚，由该引脚输出对应的 PWM 信号。

|参数|说明|
| ------| ---------------------|
|pin|GPIO 引脚数字编号|
|chan|LEDC 通道号（0~15）|

### 3.3 设置占空比：ledcWrite

```c
ledcWrite(chan, duty);
```

|参数|说明|
| ------| --------------------------------------|
|chan|LEDC 通道号（0~15）|
|duty|占空比值（取值范围由 `ledcSetup`​ 的 `bit_num` 决定）|

## 四、串口（Serial）

### 4.1 初始化串口：Serial.begin

```c
Serial.begin(baud);    // 串口 0（默认）
Serial1.begin(baud);   // 串口 1
Serial2.begin(baud);   // 串口 2
```

|参数|说明|
| ------| --------------------------------|
|baud|波特率（常用 **115200**；蓝牙串口常用 **9600**）|

### 4.2 输出字符串：print / println

```c
Serial.print("Hello");         // 无换行
Serial.println("Hello");       // 有换行（自动追加 \r\n）
```

### 4.3 格式化输出：printf

```c
Serial.printf("当前值：%d，频率：%f\n", val, freq);
```

### 4.4 不同进制输出

> `Serial.println` 支持指定数字进制输出：

```c
Serial.println(16, HEX);  // 输出：10（十六进制）
Serial.println(16, DEC);  // 输出：16（十进制）
Serial.println(16, OCT);  // 输出：20（八进制）
Serial.println(16, BIN);  // 输出：10000（二进制）
```

<section class="siyuan-references" aria-label="文档引用">

## 文档关系

### 反向引用
- [ESP32](/siyuan/其他笔记/嵌入式/ESP32/)
- [其他笔记](/siyuan/其他笔记/)
- [嵌入式](/siyuan/其他笔记/嵌入式/)
- [学习笔记](/siyuan/)

</section>
