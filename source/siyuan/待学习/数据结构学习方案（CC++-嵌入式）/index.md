---
title: '数据结构学习方案（CC++ 嵌入式）'
date: '2026-08-27T16:51:27+08:00'
updated: '2026-08-27T16:55:07+08:00'
layout: page
type: siyuan-note
notebook: '学习笔记'
permalink: 'siyuan/待学习/数据结构学习方案（CC++-嵌入式）/'
siyuan_source: '待学习/数据结构学习方案（CC++ 嵌入式）.md'
comments: false
categories:
  - '学习笔记'
  - '待学习'
---

‍

# 数据结构学习方案（C/C++ 嵌入式）

> 教学讲义式学习方案：每章先讲概念、用**表格**列出语法/操作（作用/示例），再以**嵌入式实例**佐证（状态机、传感器数据、菜单、队列、路径等）。逻辑链：类型与枚举 → 结构体 → 指针与数组 → 链表 → 栈/队列 → 树 → 图 → 综合实战。能力基线：嵌入式 C 数据结构 L1 → 目标 L2（A 类·等级制）。前置：STM32/C 基础。

## 一、为什么嵌入式要懂数据结构

> 嵌入式里"数据怎么组织"决定代码可维护性与实时性：状态用枚举、传感器数据用结构体、任务用队列、菜单用链表、路径用图。

|场景|用到的结构|
| -----------------| -----------------------|
|按键/系统状态|`enum` 状态机|
|传感器打包|`typedef struct`|
|串口缓冲|环形队列（数组+指针）|
|动态菜单/任务表|链表|
|路径规划/路由|图（邻接表）|

## 二、enum：给状态起名字

> `enum` 把一组常量打包命名，代码只认名字不认魔法数字——状态机必备。

|语法|作用|示例|
| ----------| -------------------------------| ------|
|`enum 名 { A, B, C }`|定义一组整型常量（从 0 递增）|`enum KeyState { IDLE, PRESSED, RELEASED }`|
|枚举变量|存状态|`enum KeyState st = PRESSED;`|
|`typedef enum ... 别名`|取别名省写 enum|`typedef enum {...} KeyState;`|

**嵌入式实例（按键状态机）** ：

```c
typedef enum { KEY_IDLE, KEY_DOWN, KEY_LONG } KeyState;
KeyState state = KEY_IDLE;
if (state == KEY_IDLE && HAL_GPIO_ReadPin(GPIOB, GPIO_PIN_0) == 0)
    state = KEY_DOWN;                // 读到按下才转移状态
```

## 三、typedef struct：数据打包

> `struct`​ 把相关字段捆成一个整体；`typedef` 给它起短名后像"内置类型"一样用。

|语法|作用|
| -----------| --------------------------|
|`struct 名 { 字段 }`|定义结构体|
|`typedef struct {...} 别名`|取别名（嵌入式通用写法）|
|`别名 变量`​ / `变量.字段`|声明与访问|
|`指针->字段`|指针访问|

**嵌入式实例（传感器数据打包）** ：

```c
typedef struct {
    uint16_t adc_raw;     // 原始 ADC
    float voltage;        // 换算电压
    uint8_t  quality;     // 信号质量
} SensorData;

SensorData temp = {0};          // 初始化清空
temp.adc_raw = HAL_ADC_GetValue(&hadc1);       // 采集
temp.voltage = temp.adc_raw * 3.3f / 4095.0f; // 换算 12 位 ADC
```

> 用结构体：一包数据一起传参/存储，避免散落变量。对齐 STM32 开发习惯。

## 四、指针与数组：嵌入式数据搬运

|写法|作用|易错|
| -----------| ----------------------| ----------------|
|`int arr[10]`|定长数组（编译期定）|越界访问无检查|
|`arr[i]`​ / `*(arr+i)`|下标/指针等价|—|
|`p = &var`​ / `*p`|取地址/解引用|野指针|
|`sizeof(arr)/sizeof(arr[0])`|元素个数|对指针无效|

**嵌入式实例（串口收数缓冲）** ：

```c
uint8_t rx_buf[64];          // 定长缓冲
uint8_t idx = 0;
void on_byte(uint8_t b) {
    if (idx < 64) rx_buf[idx++] = b;   // 指针前后缀：先取旧值再加
    else { /* 溢出处理：清空或报警 */ idx = 0; }
}
```

## 五、链表：动态组织的菜单/任务表

> 链表用"节点+指针"串起来，适合数量不定、频繁增删的场景；代价：不能随机访问（要遍历）。

|操作|核心代码（单链表）|
| ----------| --------------------|
|节点定义|`typedef struct Node { int data; struct Node *next; } Node;`|
|插入头|`n->next = head; head = n;`|
|遍历|`for (p = head; p; p = p->next)`|
|删除|`prev->next = cur->next; free(cur);`|

**嵌入式实例（动态菜单）** ：

```c
typedef struct Node { const char *name; void (*run)(void); struct Node *next; } MenuItem;

void show_menu(MenuItem *head) {
    for (MenuItem *p = head; p; p = p->next)   // 遍历链，逐项显示
        printf("%s\n", p->name);
}
```

- 易错：遍历尽头判 `p==NULL`​；删除要记 prev；`malloc/free` 在 MCU 上可用但慎用（碎片），静态链/数组池更稳。

## 六、栈与队列：任务的先进先出

|结构|特性|嵌入式用途|
| ------| ---------------| ------------------|
|栈|后进先出 LIFO|函数调用栈、撤销|
|队列|先进先出 FIFO|**串口环形缓冲、任务队列**|

**嵌入式实例（环形队列，数组实现无需 malloc）** ：

```c
typedef struct { uint8_t buf[32]; uint8_t head, tail; uint8_t count; } RingQueue;

int push(RingQueue *q, uint8_t b){
    if (q->count == 32) return -1;          // 满
    q->buf[q->head] = b; q->head = (q->head+1) % 32; q->count++; return 0;
}
int pop(RingQueue *q, uint8_t *out){
    if (!q->count) return -1;               // 空
    *out = q->buf[q->tail]; q->tail = (q->tail+1) % 32; q->count--; return 0;
}
```

- 环队列解决"数据生产快消费慢"；`% N`​ 回绕（N 一般用 2 的幂，`& (N-1)` 更快）。

## 七、树：层级关系与搜索

> 树 = 一个根 + 多棵子树；二叉树最多两子。常见于文件系统、哈夫曼、决策树、表达式解析。

|概念|说明|
| ------------| --------------------------|
|节点/根/叶|根无父、叶无子|
|前/中/后序|根左右 / 左根右 / 左右根|
|二叉搜索树|左<根<右，查找 O(log n)|

**嵌入式实例（简化决策/状态树，用数组索引代替指针也行）** ：

```c
typedef struct TreeNode { int val; struct TreeNode *lc, *rc; } TreeNode;

void inorder(TreeNode *r) {           // 中序遍历：左-根-右
    if (!r) return;                    // 空节点返回
    inorder(r->lc); printf("%d ", r->val); inorder(r->rc);
}
```

## 八、图：多点关系（路径/路由）

> 图 = 顶点 + 边；嵌入式常做**邻接表**（每个顶点头挂它的邻居链表），比邻接矩阵省内存。

|表示|适用|
| ----------| -------------------------------------|
|邻接矩阵|顶点少、稠密|
|邻接表|顶点多、稀疏（路由/机器人导航常用）|

**嵌入式实例（小车节点导航抽象）** ：

```c
typedef struct Edge { int to; struct Edge *next; } Edge;
typedef struct { Edge *head; } Vertex;      // 邻接表：每个顶点一条链表

void add_edge(Vertex *g, int u, int v){     // u 的链表头插 v
    Edge *e = malloc(sizeof(Edge)); e->to = v; e->next = g[u].head; g[u].head = e;
}
```

## 九、综合实例：把知识串起来（数据采集+事件队列+菜单）

```c
typedef enum { EV_NONE, EV_KEY, EV_UART, EV_ADC } EventType;   // enum
typedef struct { EventType type; uint16_t value; } Event;      // struct
typedef struct { Event q[16]; uint8_t h, t, n; } EventQueue;   // 队列

EventQueue eq = {0};                    // 事件队列（环形）
void post_event(EventType t, uint16_t v){ /* 入队，参考第六节 */ }
void system_loop(void){
    Event e;
    if (pop_event(&eq, &e) == 0) {      // 出队处理
        switch (e.type) {                // enum switch 状态分发
            case EV_KEY: /* 按键流程 */ break;
            case EV_ADC : /* 采集流程 */ break;
        }
    }
}
```

> 这套"enum 事件 + struct 数据 + 环形队列 + switch 分发"是嵌入式软件骨架，串起全章。

## 十、易错点与自测（附答案）

**易错**：struct 忘了结尾分号；指针未初始化就解引用；队列回绕忘取模；链表删除忘接 prev；`sizeof(指针)` 不是数组长度；malloc 无配对 free。

1. **enum 与 #define 常量区别？**  答：enum 类型化、可作变量类型、自动递增；代码意图更清楚，调试器可见名字。
2. **链表 vs 数组增删？**  答：数组插入/删除 O(n)（要搬移）；链表 O(1)（改指针），但查找需遍历 O(n)。
3. **RingQueue 为什么**  **​`% N`​**​ **？**  答：head/tail 到末尾后回绕到开头，形成环；N 取 2 的幂可用 `& (N-1)` 提速。
4. **树中序+二叉搜索树能做什么？**  答：中序输出 BST 即升序；查找/插入 O(log n)。

<section class="siyuan-references" aria-label="文档引用">

## 文档关系

### 反向引用
- [待学习](/siyuan/待学习/)
- [学习笔记](/siyuan/)

</section>
