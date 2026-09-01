---
title: '4 小时彻底掌握 C 指针'
date: '2026-05-27T16:00:11+08:00'
updated: '2026-08-14T10:41:16+08:00'
layout: page
type: siyuan-note
notebook: '学习笔记'
permalink: 'siyuan/4-小时彻底掌握-C-指针/'
siyuan_source: '4 小时彻底掌握 C 指针.md'
comments: false
categories:
  - '学习笔记'
  - '4 小时彻底掌握 C 指针'
---

## 学习索引

|主题|要点|
| ------| --------------------------------------------|
|[一、内存与地址基础](#20260626194149-wst5a8w)|地址按字节编号，变量名背后对应类型和地址。|
|[二、什么是指针](#20260626194149-0mih5lm)|指针变量保存地址，`&`​ 取地址，`*` 解引用。|
|[三、指针基本用法](#20260626194149-zo4s7cy)|定义指针、取地址、解引用和初始化。|
|[四、指针的打印与地址运算](#20260626194149-l5xc5e1)|`p + 1`​ 前进的是 `sizeof(*p)` 个字节。|
|[五、指针的强类型特性](#20260626194149-xkh4sen)|指针类型决定解引用读取宽度和运算步长。|
|[六、典型案例：1025 的内存布局](#20260626194149-3mk8nqj)|用 `int *`​ 与 `char *` 对比读取同一块内存。|
|[七、void * 与空指针](#20260626194149-rgpk3ah)|`void *` 是通用地址指针，不等于空指针。|
|[八、二级指针](#20260626194149-0xxmmbm)|`int **q`​ 保存 `int *p` 的地址。|
|[九、为什么要用指针](#20260626194149-ar2ni1q)|传地址后可在函数内修改外部变量。|
|[十、内存：堆与栈](#20260626194149-7iim4b6)|栈帧、局部变量生命周期和堆内存管理。|
|[十一、数组与指针](#20260626194149-40tl1s5)|数组名退化、指针访问数组元素、`sizeof` 差异。|
|[易错点速查](#20260626194149-mkr1dkk)|`%p`​、`%zu`​、`void *`、空指针和解引用安全。|

## <span id="20260626194149-wst5a8w" class="siyuan-block-anchor" aria-hidden="true"></span>一、内存与地址基础

![2026-05-27_14-14-32](/images/siyuan/2026-05-27_14-14-32.png)

- 一个内存地址通常对应 **1 个 byte（8 bit）** 。
- 变量不仅有“值”，还有“类型”和“地址”。
- 赋值操作的本质可以理解为：

```text
编译器查符号表 -> 获取变量类型和地址 -> 按地址寻址 -> 按类型写入数据
```

## <span id="20260626194149-0mih5lm" class="siyuan-block-anchor" aria-hidden="true"></span>二、什么是指针

> 指针是用于存放另一个变量地址的变量。

### 图示说明

![2026-05-27_14-16-42](/images/siyuan/2026-05-27_14-16-42.png)  
​![2026-05-27_14-16-50](/images/siyuan/2026-05-27_14-16-50.png)

- 图 1：`p = &a`​，指针 `p`​ 保存变量 `a` 的地址。
- 图 2：`p = &b`​，指针 `p`​ 改为保存变量 `b` 的地址。
- 通过给指针重新赋值，可以让同一个指针变量指向不同对象。

## <span id="20260626194149-zo4s7cy" class="siyuan-block-anchor" aria-hidden="true"></span>三、指针基本用法

### 定义与赋值

```c
int a;        // 定义整型变量 a
int *p;       // 定义整型指针变量 p
p = &a;       // p 指向 a 的地址

*p = 8;       // 解引用：给 p 指向的变量 a 赋值为 8
```

### 定义并初始化

```c
int a = 10;      // 定义并初始化 a
int *p = &a;     // 定义指针 p，同时让 p 指向 a
```

### 符号速记

- `&a`​：取变量 `a` 的地址。
- `p`：指针变量本身，保存的是地址。
- `*p`​：访问 `p` 指向的那块内存中的值。

## <span id="20260626194149-l5xc5e1" class="siyuan-block-anchor" aria-hidden="true"></span>四、指针的打印与地址运算

### 打印指针和值

原理示例：

```c
printf("%d\n", *p);    // 打印 a 的值
```

更规范的地址打印方式：

```c
printf("%p\n", (void *)p);   // 打印 p 保存的地址
```

说明：地址应使用 `%p`​ 打印，并转换为 `void *`​。用 `%d` 打印地址在现代 C 中不规范，尤其在 64 位环境下容易出错。

### `p + 1` 的含义

假设 `p`​ 是 `int *`，并且当前地址是 2002：

```text
p      -> 2002
p + 1  -> 2006
p + 2  -> 2010
```

原因：

- `int`​ 通常占 **4 个字节**。
- 指针加 1 的实际含义是：地址增加 `sizeof(指针指向的类型)`。
- 因此 `int *`​ 加 1 前进 4 字节，`char *` 加 1 前进 1 字节。

风险提示：

- `*p`​：访问 `p` 当前指向的对象。
- `*(p + 1)`：访问当前对象之后的下一段同类型内存；如果那里不是合法对象，就有非法访问风险。

## <span id="20260626194149-xkh4sen" class="siyuan-block-anchor" aria-hidden="true"></span>五、指针的强类型特性

指针是强类型的。

|变量类型|指针类型|解引用读取宽度|
| ----------| ----------| ----------------|
|`int`|`int *`|通常 4 字节|
|`char`|`char *`|1 字节|

编译器会根据指针类型决定：

- 解引用时从起始地址向后读取多少字节。
- 指针运算时每次前进多少字节。

## <span id="20260626194149-3mk8nqj" class="siyuan-block-anchor" aria-hidden="true"></span>六、典型案例：`1025` 的内存布局

### 示例代码

```c
#include <stdio.h>

int main(void)
{
    int a = 1025;
    int *p = &a;

    printf("size of integer is %zu bytes\n", sizeof(int));
    printf("Address = %p, value = %d\n", (void *)p, *p);
    printf("Address = %p\n", (void *)(p + 1));

    char *p0 = (char *)p;   // 强制类型转换

    printf("size of char is %zu bytes\n", sizeof(char));
    printf("Address = %p, value = %d\n", (void *)p0, *p0);
    printf("Address = %p, value = %d\n", (void *)(p0 + 1), *(p0 + 1));

    return 0;
}
```

### 内存示意

![2026-05-27_14-48-44](/images/siyuan/2026-05-27_14-48-44.png)

```text
1025 = 00000000 00000000 00000100 00000001
```

如果机器采用小端序，低位字节会放在低地址处，因此 `char *`​ 从同一地址读取 1 字节时，读到的通常是 `1`。

### 运行结果

![2026-05-27_15-55-48](/images/siyuan/2026-05-27_15-55-48.png)

## <span id="20260626194149-rgpk3ah" class="siyuan-block-anchor" aria-hidden="true"></span>七、`void *` 与空指针

这里更准确的标题应是 **​`void *`​** ​ **通用指针**，它不等同于空指针。

- `void *`：通用地址指针，可以保存任意对象地址。
- `NULL`​ 或 `nullptr` 风格的空地址：表示“不指向任何有效对象”的空指针值。
- `void *` 不能直接解引用，因为编译器不知道应该读取多少字节。
- 标准 C 中 `void *` 也不能直接做指针加法，需要先转换成具体类型指针。

示例：

```c
#include <stdio.h>

int main(void)
{
    int a = 1025;
    int *p = &a;

    void *p0 = p;
    printf("Address = %p\n", p0);

    // printf("Value = %d\n", *p0);   // 错误：void * 不能直接解引用
    // printf("Address = %p\n", p0 + 1); // 标准 C 中错误：void * 不能直接加 1

    int *p1 = (int *)p0;
    printf("Value = %d\n", *p1);

    return 0;
}
```

## <span id="20260626194149-0xxmmbm" class="siyuan-block-anchor" aria-hidden="true"></span>八、二级指针：指向指针的指针

```c
#include <stdio.h>

int main(void)
{
    int a = 1025;
    int *p = &a;
    int **q = &p;

    printf("%d\n", *p);     // a 的值
    printf("%p\n", (void *)*q); // p 保存的地址，也就是 &a
    printf("%d\n", **q);    // 等价于 *p，也就是 a 的值

    return 0;
}
```

![2026-05-27_16-22-40](/images/siyuan/2026-05-27_16-22-40.png)

关系可以记为：

```text
a       -> int
p = &a  -> int *
q = &p  -> int **
**q     -> a
```

## <span id="20260626194149-ar2ni1q" class="siyuan-block-anchor" aria-hidden="true"></span>九、为什么要用指针

函数参数默认是传值。把变量传给函数时，函数内部拿到的是一份副本，直接修改形参不会反向修改外部变量。

如果传入变量地址，函数就可以通过解引用访问原变量所在的内存位置，从而修改外部变量。

示例：

```c
#include <stdio.h>

void increment(int *p)
{
    *p = *p + 1;
}

int main(void)
{
    int a = 10;
    increment(&a);
    printf("a = %d\n", a);  // a = 11
    return 0;
}
```

使用指针的常见原因：

- 在函数内修改外部变量。
- 避免复制大型数据结构，提高传参效率。
- 操作数组、字符串、动态内存和复杂数据结构。
- 表达“可选值”或“没有对象”的状态，例如空指针。

## <span id="20260626194149-7iim4b6" class="siyuan-block-anchor" aria-hidden="true"></span>十、内存：堆与栈

![2026-05-27_16-32-14](/images/siyuan/2026-05-27_16-32-14.png)

### 栈（stack）

- 栈主要存放局部变量、函数参数、返回地址等函数调用相关数据。
- 运行 `main`​ 时，会创建 `main` 的栈帧（stack frame）。
- 在 `main`​ 中调用 `Increment`​ 时，会再创建 `Increment` 的栈帧。
- `Increment`​ 执行结束后，其栈帧会被清除，程序回到 `main` 的栈帧继续执行。
- 局部变量的生命周期通常持续到其所在函数或代码块执行结束。

![2026-05-27_16-36-25](/images/siyuan/2026-05-27_16-36-25.png)

### 代码块与栈帧示例

```c
#include <stdio.h>

void Increment(int *p)
{
    *p = *p + 1;
}

int main(void)
{
    int a = 10;
    Increment(&a);
    printf("a = %d\n", a);
    return 0;
}
```

![2026-05-27_16-46-50](/images/siyuan/2026-05-27_16-46-50.png)

### 堆（heap）

- 堆通常用于动态内存分配，例如 `malloc`​、`calloc`​、`realloc`。
- 堆内存不会像局部变量一样自动随函数返回而释放，需要用 `free` 主动释放。
- 指针常用于保存动态分配内存的起始地址。

## <span id="20260626194149-40tl1s5" class="siyuan-block-anchor" aria-hidden="true"></span>十一、数组与指针

![2026-05-27_16-47-56](/images/siyuan/2026-05-27_16-47-56.png)

数组和指针关系很密切，但不是同一个东西。

```c
int arr[3] = {10, 20, 30};
int *p = arr;       // arr 在多数表达式中退化为 &arr[0]

printf("%d\n", arr[0]);   // 10
printf("%d\n", *p);       // 10
printf("%d\n", *(p + 1)); // 20
```

要点：

- `arr[i]`​ 等价于 `*(arr + i)`。
- `p + 1`​ 指向下一个 `int` 元素，而不是下一个字节。
- `sizeof(arr)`​ 得到整个数组大小；`sizeof(p)` 得到指针变量自身大小。
- 把数组传入函数时，形参通常会退化为指针，因此函数内部无法直接通过 `sizeof` 得到原数组长度。

## <span id="20260626194149-mkr1dkk" class="siyuan-block-anchor" aria-hidden="true"></span>易错点速查

- 地址打印用 `%p`​，不要用 `%d`。
- `sizeof`​ 的返回类型是 `size_t`​，打印时用 `%zu`。
- `void *` 是通用指针，不是“空指针”。
- `NULL` 表示空指针值，不能解引用。
- `*p = *p + 1;`​ 才会真正修改 `p`​ 指向的值；单独写 `(*p) + 1;` 只是计算表达式，结果会被丢弃。
- 指针运算按“指向类型”的大小前进。
- 解引用前要确认指针已经初始化，并且指向有效对象。

<section class="siyuan-references" aria-label="文档引用">

## 文档关系

### 反向引用
- [Python笔记](/siyuan/Python笔记/)
- [学习笔记](/siyuan/)

</section>
