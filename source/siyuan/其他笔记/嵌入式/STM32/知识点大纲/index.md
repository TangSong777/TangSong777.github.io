---
title: '知识点大纲'
date: '2026-08-26T17:33:25+08:00'
updated: '2026-08-26T17:34:14+08:00'
layout: page
type: siyuan-note
notebook: '学习笔记'
permalink: 'siyuan/其他笔记/嵌入式/STM32/知识点大纲/'
siyuan_source: '其他笔记/嵌入式/STM32/知识点大纲.md'
comments: false
categories:
  - '学习笔记'
  - '其他笔记'
  - '嵌入式'
  - 'STM32'
---

> 蓝桥杯 STM32 竞赛知识点速查：以模块为单位整理引脚配置、初始化、核心函数与易错点，代码统一放在代码块中，可直接复制使用。

## 一、LED

### 1.1 引脚与电平

- PC8-PC15：GPIO_OUTPUT —— **LD1-LD8，低电平触发（点亮）**
- PD2：GPIO_OUTPUT —— **LED 锁，低电平锁住，高电平解锁**
- 初始化时设置 LED 默认为高电平；LD2 默认是低电平

### 1.2 单灯控制：LED_control

定义全局标志数组，通过该函数对单个 LED 进行调控（`led_index` 从 1 开始）：

```c
uint8_t Led_flag[8] = {1, 1, 1, 1, 1, 1, 1, 1};

void LED_control(uint8_t led_index, uint8_t led_mode)
{
    Led_flag[led_index - 1] = led_mode;
}
```

### 1.3 刷新显示：LED_proc

使用该函数给 LED 赋值刷新（先解锁，写完后上锁）：

```c
void LED_proc()
{
    HAL_GPIO_WritePin(GPIOD, GPIO_PIN_2, GPIO_PIN_SET);
    for (int i = 0; i < 8; i++)
    {
        HAL_GPIO_WritePin(GPIOC, GPIO_PIN_8 << i, Led_flag[i]);
    }
    HAL_GPIO_WritePin(GPIOD, GPIO_PIN_2, GPIO_PIN_RESET);
}
```

### 1.4 与 LCD 引脚冲突防护

PC 口被 LED 与 LCD 共用，应在 LCD 的相关函数前保存并恢复 `GPIOC->ODR`：

```c
uint16_t temp = GPIOC->ODR;
LCD_func();
GPIOC->ODR = temp;
```

## 二、LCD

### 2.1 引脚与初始化

- PC0-PC15：GPIO_OUTPUT —— **LED 与 LCD 共用**

放在 BEGIN SysInit 中用于初始化 LCD：

```c
LCD_Init();
LCD_Clear(Black);
LCD_SetBackColor(Black);
LCD_SetTextColor(White);
```

在 Begin2 中记得把 PD2 引脚赋值低电平（LED 锁解锁，否则 LCD 不显示）。

### 2.2 显示刷新：LCD_proc

使用 sprintf 函数来写入每行的数据：

```c
uint8_t Text[10][20] = {0};

void LCD_proc()
{
    uint16_t temp = GPIOC->ODR;
    sprintf(&Text[0], " ");
    for (int i = 0; i < 10; i++)
        LCD_DisplayStringLine(i * 24, &Text[i]);
    GPIOC->ODR = temp;
    HAL_GPIO_WritePin(GPIOD, GPIO_PIN_2, GPIO_PIN_RESET);
}
```

### 2.3 界面设计

- 总共三个界面，使用 switch 语句判断 LCD 当前的界面；
- 在需要对当前界面的参数进行修改时，使用 `para_index` 判断当前选择的参数，同样用 switch 判断选中的参数；

```c
uint8_t LCD_mode = 1;
```

**按键在不同界面有不同的功能**：在界面的 switch 中去判断按键的标志位，再进行对应的功能编写。

## 三、KEY 按键

### 3.1 引脚与定时器配置

- PA0：GPIO_INPUT —— **KEY1**
- PB0-PB2：GPIO_INPUT —— **KEY2-4**
- 定时器 17 配置 0.01s 定时中断：PSC = 79，ARR = 9999，打开定时中断

### 3.2 按键结构体与标志位

写一个结构体保存四个按键的电平状态、状态机状态、双击检测状态、长按检测时间、双击检测时间，用该结构体定义一个四对象数组：

```c
typedef struct {
    bool pin;
    uint8_t state;
    uint8_t double_state;
    uint16_t press_time;
    uint16_t double_time;
} KEY_Typedef;
KEY_Typedef Keys[4] = {0};
```

定义一个四对象按键标志位数组以储存按键标志位：

```c
uint8_t Key_flag[4] = {0};
```

### 3.3 按键扫描（状态机）：Key_scan

```c
void Key_scan()
{
    Keys[0].pin = HAL_GPIO_ReadPin(GPIOB, GPIO_PIN_0);
    Keys[1].pin = HAL_GPIO_ReadPin(GPIOB, GPIO_PIN_1);
    Keys[2].pin = HAL_GPIO_ReadPin(GPIOB, GPIO_PIN_2);
    Keys[3].pin = HAL_GPIO_ReadPin(GPIOA, GPIO_PIN_0);
    for (int i = 0; i < 4; i++)
    {
        switch (Keys[i].state)
        {
            case 0:
                if (!Keys[i].pin)
                    Keys[i].state = 1;
                break;
            case 1:
                if (!Keys[i].pin)
                {
                    Keys[i].press_time = 0;
                    Keys[i].state = 2;
                }
                else
                    Keys[i].state = 0;
                break;
            case 2:
                Keys[i].press_time++;
                if (Keys[i].pin && Keys[i].press_time >= 70)   // 长按
                {
                    Key_flag[i] = 3;
                    Keys[i].state = 0;
                }
                else if (Keys[i].pin && Keys[i].press_time < 70)
                {
                    Keys[i].state = 0;
                    Key_flag[i] = 1;   // 如果使用双击功能，则不保留该行
                }
                break;
            default:
                Keys[i].state = 0;
                break;
        }
    }
}
```

### 3.4 定时器启用与周期扫描

在 BEGIN2 中启用定时器中断：

```c
HAL_TIM_Base_Start_IT(&htim17);
```

按键扫描放在 0.01s 定时器中一直扫：

```c
void HAL_TIM_PeriodElapsedCallback(TIM_HandleTypeDef *htim)
{
    if (htim->Instance == TIM16)   // 0.01s
    {
        Key_scan();
    }
}
```

## 四、UART

### 4.1 引脚与 CubeMX 配置

- PA9：USART1_RX —— **串口 1**
- PA10：USART1_TX —— **串口 1**

打开串口 1，设置引脚 PA9 与 PA10，波特率 9600，打开中断，打开 DMA。

### 4.2 变量定义与接收说明

```c
uint8_t uart_transmitdata[50] = {0};
uint8_t uart_receivedata[50] = {0};
uint8_t uart_flag = 0;
```

- **PS**：这里使用的 DMA 存在**过半中断**——单次接收数据量超过最大允许接收量的一半时也会触发中断。建议在数据量可能超过 25 字节时增大 `uart_receivedata` 数组长度。
- 未来工程应用可以使用普通串口中断接收数据 + 循环串口数据缓冲区读写指令。
- **修正**：单独使用串口中断（拓展函数 `ReceiveToIdle`）相较于 DMA 更占用 CPU 资源，适用于低频少量的数据包接收。

### 4.3 初始化（BEGIN2）

```c
HAL_UARTEx_ReceiveToIdle_DMA(&huart1, uart_receivedata, sizeof(uart_receivedata));
__HAL_DMA_DISABLE_IT(&hdma_usart1_rx, DMA_IT_HT);   // 关闭 DMA 过半中断
```

### 4.4 中断回调（BEGIN0）

```c
void HAL_UARTEx_RxEventCallback(UART_HandleTypeDef *huart, uint16_t Size)
{
    if (huart == &huart1)
    {
        uart_flag = 1;
        HAL_UART_Transmit_DMA(&huart1, uart_receivedata, sizeof(uart_receivedata));
        HAL_UARTEx_ReceiveToIdle_DMA(&huart1, uart_receivedata, sizeof(uart_receivedata));
    }
}
```

### 4.5 数据处理：UART_proc

自定义函数检测接收到的数据：

```c
void UART_proc()
{
    if (uart_flag)
    {
        uart_flag = 0;
        if (uart_receivedata[0] == 'B' && uart_receivedata[1] == '1')
            led_flag ^= 1;
    }
}
```

### 4.6 串口重定向：fputc

```c
int fputc(int ch, FILE *f)
{
    HAL_UART_Transmit(&huart1, (const uint8_t *)&ch, 1, HAL_MAX_DELAY);
    return ch;
}
```

### 4.7 附：串口 IT（普通中断模式）

**回调函数**：

```c
void HAL_UART_RxCpltCallback(UART_HandleTypeDef *huart)
{
    HAL_UART_Transmit_IT(&huart2, ReceiveData, 5);
    HAL_UART_Receive_IT(&huart2, ReceiveData, 5);
}
```

**初始化**：

```c
HAL_UART_Receive_IT(&huart2, ReceiveData, 5);
```

## 五、ADC 采集

### 5.1 引脚

- PB15：ADC2_IN15 —— **ADC 采集 1，R37**
- PB12：ADC1_IN11 —— **ADC 采集 2，R38**

### 5.2 配置与启动

- 打开 DMA，选 circular；设置 Continuous Conversion Mode 与 DMA Continuous Requests 为 **Enabled**；Rank 选最大 Cycles（640.5 Cycles）

```c
uint16_t ADC_data1 = 0;
uint16_t ADC_data2 = 0;
```

```c
HAL_ADC_Start_DMA(&hadc2, (uint32_t *)&ADC_data1, 1);
HAL_ADC_Start_DMA(&hadc1, (uint32_t *)&ADC_data2, 1);
```

## 六、TIM 输入捕获

### 6.1 引脚

- PB4：TIM3_CH1 —— **输入捕获 1，R39**
- PA15：TIM2_CH1 —— **输入捕获 2，R40**

### 6.2 只读取频率

**PSC = 79，ARR = MAX**，打开中断；在 BEGIN2 中启用定时器中断：`HAL_TIM_IC_Start_IT(&htim2, TIM_CHANNEL_1);`

```c
void HAL_TIM_IC_CaptureCallback(TIM_HandleTypeDef *htim)
{
    if (htim->Instance == TIM3)
    {
        if (TIM3_CH1_capture_end_flag == 0)
        {
            TIM3_CH1_Freq = 1000000 / (TIM3->CCR1 + 1);
            TIM3->CNT = 0;
        }
    }
}
```

### 6.3 频率 + 占空比

**先定义五个变量**：

```c
uint8_t CapIndex = 0;
uint32_t CapVal[3] = {0};
uint8_t CapFlag = 0;
```

```c
uint32_t Frequency = 0;
uint32_t Duty = 0;
```

**函数定义，放在 main_proc() 里面**：

```c
void CAP_proc()
{
    if (CapFlag)
    {
        CapFlag = 0;
        Frequency = 1000000 / (CapVal[2] - CapVal[0]);
        Duty = (CapVal[1] - CapVal[0]) * 100UL / (CapVal[2] - CapVal[0]);
        HAL_TIM_IC_Start_IT(&htim2, TIM_CHANNEL_1);
    }
}
```

**放在 BEGIN4 里（上升沿/下降沿切换捕获）**  ：

```c
void HAL_TIM_IC_CaptureCallback(TIM_HandleTypeDef *htim)
{
    if (htim->Instance == TIM2 && htim->Channel == TIM_CHANNEL_1)
    {
        switch (CapIndex)
        {
            case 0:
                CapVal[0] = TIM2->CCR1;
                TIM2->CCER &= ~((1U << 3) | (1U << 1));
                TIM2->CCER |= (1U << 1);
                CapIndex = 1;   // 准备捕获下一个下降沿
                break;
            case 1:
                CapVal[1] = TIM2->CCR1;
                TIM2->CCER &= ~((1U << 3) | (1U << 1));
                CapIndex = 2;
                break;
            case 2:
                CapVal[2] = TIM2->CCR1;
                HAL_TIM_IC_Stop_IT(htim, TIM_CHANNEL_1);
                CapIndex = 0;
                CapFlag = 1;
                break;
            default:
                break;
        }
    }
}
```

## 七、TIM 输出 PWM

### 7.1 引脚

- PA7：TIM3_CH2 —— **输出 PWM 波**

### 7.2 配置与调节

**PSC = 799，ARR = 99**；通过修改 PSC 来修改频率，修改 CCR 来修改占空比。

```c
HAL_TIM_PWM_Start(&htim3, TIM_CHANNEL_2);
```

```c
TIM3->CCR2 = 50;   // 调占空比
TIM3->PSC = 399;   // 调频率
```

## 八、EEPROM

> 在提供的库文件中添加两个函数，别忘了在头文件中声明。

### 8.1 写函数

```c
void eeprom_write(uint8_t address, uint8_t data)
{
    I2CStart();
    I2CSendByte(0xa0);
    I2CWaitAck();
    I2CSendByte(address);
    I2CWaitAck();
    I2CSendByte(data);
    I2CWaitAck();
    I2CStop();
    HAL_Delay(10);
}
```

### 8.2 读函数

```c
uint8_t eeprom_read(uint8_t address)
{
    I2CStart();
    I2CSendByte(0xa0);
    I2CWaitAck();
    I2CSendByte(address);
    I2CWaitAck();
    I2CStop();
    I2CStart();
    I2CSendByte(0xa1);
    I2CWaitAck();
    uint8_t data = I2CReceiveByte();
    I2CWaitAck();
    I2CStop();
    return data;
}
```

## 九、IIC 扫设备

```c
void I2C_Scan(I2C_HandleTypeDef *hi2c)
{
    uint8_t device_found = 0;

    printf("Scanning I2C bus...\n");
    for (uint8_t address = 1; address < 0xFF; address++)
    {
        // 尝试读取一字节
        if (HAL_I2C_IsDeviceReady(hi2c, address << 1, 1, HAL_MAX_DELAY) == HAL_OK)
        {
            printf("I2C device found at address 0x%02X\n", address);
            device_found = 1;
        }
    }
    if (!device_found)
    {
        printf("No I2C devices found\n");
    }
}
```

## 十、程序设计

### 10.1 定时问题

涉及大定时时，可以整一个 1ms 的定时器：

- 定时器 PSC：79、ARR：999
- `Count_500ms` 在定时器里自增，在 main 里判断值是否大于 500，大于则清零并运行函数

```c
uint8_t Count_500ms = 0;
```

### 10.2 proc 函数模块化

使用模块化编程，声明自定义函数以随时增减模块：

```c
void LED_proc();
void LCD_proc();
void UART_proc();
void KEY_proc();
```

```c
void main_proc()
{
    PWM_proc();
    ADC_proc();
    KEY_proc();
    LED_proc();
    if (!(Count_1ms %= 100))
        LCD_proc();
}
```

<section class="siyuan-references" aria-label="文档引用">

## 文档关系

### 反向引用
- [STM32](/siyuan/其他笔记/嵌入式/STM32/)
- [蓝桥杯嵌入式赛道分析](/siyuan/其他笔记/嵌入式/STM32/蓝桥杯嵌入式赛道分析/)
- [旋转编码器与电机详解](/siyuan/其他笔记/嵌入式/STM32/旋转编码器与电机详解/)
- [学习笔记](/siyuan/)

</section>
