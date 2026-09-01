---
title: '2026-08-05'
date: '2026-08-05T21:12:07+08:00'
updated: '2026-08-06T02:18:48+08:00'
layout: page
type: siyuan-note
notebook: '学习笔记'
permalink: 'siyuan/daily-note/2026/08/2026-08-05/'
siyuan_source: 'daily note/2026/08/2026-08-05.md'
comments: false
categories:
  - '学习笔记'
  - 'daily note'
  - '2026'
  - '08'
---

# <span id="20260805214039-pto6mtx" class="siyuan-block-anchor" aria-hidden="true"></span>力扣刷题：[1672. 最富有客户的资产总量](https://leetcode.cn/problems/richest-customer-wealth/)

## 题目

给你一个 m x n 的整数网格 accounts ，其中 accounts[i][j] 是第 i​​​​​​​​​​​​ 位客户在第 j 家银行托管的资产数量。返回最富有客户所拥有的 资产总量 。  
  
客户的 资产总量 就是他们在各家银行托管的资产数量之和。最富有客户就是 资产总量 最大的客户。

## 代码块

### 解法1

```python
class Solution:
    def maximumWealth(self, accounts: List[List[int]]) -> int:
        m, n = len(accounts), len(accounts[0])
        totol = [0] * m
        for i in range(m):
            for j in range(n):
                totol[i] += accounts[i][j]
        return max(totol)
```

### 解法2

```python
class Solution:
    def maximumWealth(self, accounts: List[List[int]]) -> int:
        return max(map(sum, accounts))
```

## 笔记：

### 一、代码解析：`maximumWealth`

```python
class Solution:
    def maximumWealth(self, accounts: List[List[int]]) -> int:
        return max(map(sum, accounts))
```

#### 题目背景（LeetCode 1672）

- `accounts[i]`​ 表示第 `i` 个客户的各个银行账户余额
- 每个客户的 **财富 \= 所有账户余额之和**
- 目标：**返回所有客户中最高的财富值**

---

#### 逐行拆解

##### 1️⃣ `accounts: List[List[int]]`

- `accounts` 是一个二维列表
- 示例：

```python
accounts = [
    [1, 2, 3],   # 客户0，财富 = 6
    [3, 2, 1],   # 客户1，财富 = 6
    [4, 5]       # 客户2，财富 = 9
]
```

---

##### 2️⃣ `map(sum, accounts)`

- `sum` 是 Python 内置函数
- `map(function, iterable)`​ 会对 `iterable`​ 中的每个元素应用 `function`

等价于：

```python
[sum(row) for row in accounts]
```

具体过程：

```python
sum([1, 2, 3]) → 6
sum([3, 2, 1]) → 6
sum([4, 5])   → 9
```

`map`​ 返回的是一个 ​**迭代器**（不是列表）：

```python
<map object at ...>
```

---

##### 3️⃣ `max(...)`

- `max()` 接收可迭代对象，返回最大值
- 实际计算的是：

```python
max(6, 6, 9) → 9
```

---

#### ✅ 最终返回值

```python
9
```

---

#### 一句话总结

👉 **对每一行求和，再取最大值**

---

### 二、`map` 函数

#### 1️⃣ 基本语法

```python
map(func, iterable1, iterable2, ...)
```

- `func`：函数（内置 / lambda / 自定义）
- `iterable`：可迭代对象（list / tuple / str / range 等）
- 返回值：**迭代器（map object）**

---

#### 2️⃣ 简单示例

##### ✅ 将列表中每个数平方

```python
nums = [1, 2, 3, 4]
res = map(lambda x: x ** 2, nums)
print(list(res))   # [1, 4, 9, 16]
```

---

#### 6️⃣ 常见搭配函数

|函数|用途|
| ------| ----------|
|`sum`|求和|
|`abs`|绝对值|
|`int`|转整数|
|`str`|转字符串|
|`lambda`|匿名函数|

示例：

```python
list(map(int, ["1", "2", "3"]))  # [1, 2, 3]
```

---

#### 7️⃣ 在 LeetCode 中的典型用法

✅ 二维数组按行处理

```python
max(map(sum, matrix))
```

✅ 字符串转数字

```python
list(map(int, "12345"))
```

✅ 多参数输入

```python
list(map(min, list1, list2))
```

---

# <span id="20260805215546-281zma3" class="siyuan-block-anchor" aria-hidden="true"></span>力扣刷题：[1572. 矩阵对角线元素的和](https://leetcode.cn/problems/matrix-diagonal-sum/)

## 题目

给你一个正方形矩阵 mat，请你返回矩阵对角线元素的和。  
  
请你返回在矩阵主对角线上的元素和副对角线上且不在主对角线上元素的和。

## 代码块

### 解法1-遍历大法好（优化版）

```python
class Solution:
    def diagonalSum(self, mat: List[List[int]]) -> int:
        m = len(mat)
        ans = 0
        for i, row in enumerate(mat):
            j = m - i - 1
            if i == j or i + j == m - 1:
                ans += row[i] + (0 if j == i else row[j])
        return ans
# 依然熟悉的enumerate函数，同步提取下标和对应的row，可根据i与m计算得到该行的另一个对角线上的值对应的下标
# 使用a if A else b来判断本行是不是中心行，如果是只需要加上row[i]，反之需要加上row[j]
```

## <span id="20260805215546-0l0l4vl" class="siyuan-block-anchor" aria-hidden="true"></span>笔记：

```python
for i, row in enumerate(mat):
# 同时获取列表mat的下标及其对应值
```

[enumerate](/siyuan/daily-note/2026/08/2026-08-04/#20260804021053-xo7mpqa)

# <span id="20260806000809-two56jz" class="siyuan-block-anchor" aria-hidden="true"></span>力扣刷题：[54. 螺旋矩阵](https://leetcode.cn/problems/spiral-matrix/)

## 题目

给你一个 m 行 n 列的矩阵 matrix ，请按照 顺时针螺旋顺序 ，返回矩阵中的所有元素。

## 代码块

### 解法1-遍历模拟

```python
class Solution:
    def spiralOrder(self, matrix: List[List[int]]) -> List[int]:
        if not matrix or not matrix[0]:
            return list()
        
        rows, columns = len(matrix), len(matrix[0])
        visited = [[False] * columns for _ in range(rows)]
        total = rows * columns
        order = [0] * total

        directions = [[0, 1], [1, 0], [0, -1], [-1, 0]]
        row, column = 0, 0
        directionIndex = 0
        for i in range(total):
            order[i] = matrix[row][column]
            visited[row][column] = True
            nextRow, nextColumn = row + directions[directionIndex][0], column + directions[directionIndex][1]
            if not (0 <= nextRow < rows and 0 <= nextColumn < columns and not visited[nextRow][nextColumn]):
                directionIndex = (directionIndex + 1) % 4
            row += directions[directionIndex][0]
            column += directions[directionIndex][1]
        return order
```

### 解法2-按层模拟

```python
class Solution:
    def spiralOrder(self, matrix: List[List[int]]) -> List[int]:
        if not matrix or not matrix[0]:
            return list()
        
        rows, columns = len(matrix), len(matrix[0])
        order = list()
        left, right, top, bottom = 0, columns - 1, 0, rows - 1
        while left <= right and top <= bottom:
            for column in range(left, right + 1):
                order.append(matrix[top][column])
            for row in range(top + 1, bottom + 1):
                order.append(matrix[row][right])
            if left < right and top < bottom:
                for column in range(right - 1, left, -1):
                    order.append(matrix[bottom][column])
                for row in range(bottom, top, -1):
                    order.append(matrix[row][left])
            left, right, top, bottom = left + 1, right - 1, top + 1, bottom - 1
        return order
```

## 笔记：

该笔记需补充

‍

<section class="siyuan-references" aria-label="文档引用">

## 文档关系

### 本文引用
- [2026-08-04](/siyuan/daily-note/2026/08/2026-08-04/)

### 反向引用
- [2026-08-04](/siyuan/daily-note/2026/08/2026-08-04/)
- [daily note](/siyuan/daily-note/)
- [类型索引](/siyuan/力扣刷题/类型索引/)
- [时间线索引](/siyuan/力扣刷题/时间线索引/)
- [算法专项](/siyuan/Python笔记/算法专项/)
- [学习笔记](/siyuan/)

</section>
