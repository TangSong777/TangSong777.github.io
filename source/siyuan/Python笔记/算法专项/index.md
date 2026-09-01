---
title: '算法专项'
date: '2026-08-17T17:25:21+08:00'
updated: '2026-08-26T17:10:44+08:00'
layout: page
type: siyuan-note
notebook: '学习笔记'
permalink: 'siyuan/Python笔记/算法专项/'
siyuan_source: 'Python笔记/算法专项.md'
comments: false
categories:
  - '学习笔记'
  - 'Python笔记'
---

> 从力扣刷题中提炼的算法知识点、Python 语法技巧和常见模式，按知识点分类整理。  
> 每条标注来源题目，方便回溯查看完整笔记。

## 一、遍历技巧

### enumerate()：同时获取下标与元素

来源：[13.罗马数字转整数](/siyuan/daily-note/2026/08/2026-08-04/#20260804021053-hozcd1u)、[1572.矩阵对角线元素的和](/siyuan/daily-note/2026/08/2026-08-05/#20260805215546-281zma3)

```python
for i, ch in enumerate(s):
# 同时获取字符串 s 的下标及其对应值
```

### 反向遍历

来源：[66.加一](/siyuan/daily-note/2026/08/2026-08-04/#20260804005704-2ik1uo6)、[58.最后一个单词的长度](/siyuan/daily-note/2026/08/2026-08-04/#20260804102143-3fz8wth)

```python
for i in range(len(digits) - 1, -1, -1):
# python 中经典的从后向前遍历的写法（步长为 -1，到 0 结束）
```

## 二、列表操作

### append 与 extend 的区别

来源：[1768.交替合并字符串](/siyuan/daily-note/2026/08/2026-08-03/#20260803133815-px3p5o5)

```python
ans.append(word1[i])
# 在列表里直接添加一个元素，哪怕是一个新列表也是作为一个元素被添加进去
ans.extend(word2[m:])
# 直接将一个列表拆包并把元素一个个添加入列表中
```

### 列表负下标

来源：[682.棒球比赛](/siyuan/daily-note/2026/08/2026-08-04/#20260804104415-di66u4f)

```python
points.append(points[len(points) - 1] + points[len(points) - 2])
# 列表的负数下标表示从「列表末尾」往前数
# 示例：points = [10, 20, 30, 40]
# points[-1] == 40
# points[-2] == 30
```

### 嵌套列表推导式

来源：[1275.找出井字棋的获胜者](/siyuan/daily-note/2026/08/2026-08-04/#20260804220931-8j8ai9h)

```python
ls = [[' ' for _ in range(3)] for _ in range(3)]
# 内层：[' ' for _ in range(3)] 生成长度为 3 的列表
# 外层：[... for _ in range(3)] 将内层列表复制 3 份
```

### 列表原地修改：nums[:] vs nums

来源：[189.轮转数组](/siyuan/daily-note/2026/08/2026-08-14/#20260814102804-z0gzw0b)

题目要求原地修改时，`nums = nums[-k:] + nums[:-k]`​ 会创建新列表并重新绑定变量，**不修改原数组**；必须用切片赋值：

```python
nums[:] = nums[-k:] + nums[:-k]   # 原地修改
```

同理，`nums.reverse()`​ 是原地方法，而 `reversed(nums)` 返回迭代器。

## 三、字符与字符串转换

### ord() 与 chr() 及转换表

来源：[389.找不同](/siyuan/daily-note/2026/08/2026-08-03/#20260803150716-c5aflmi)

|转换方向|函数|
| --------------------| ------|
|字符 → 整数|`ord(c)`|
|整数 → 字符|`chr(n)`|
|字符 → 字节|`"x".encode()`|
|字节 → 字符|`b"...".decode()`|
|整数 → 十六进制|`hex()`|
|整数 → 二进制|`bin()`|
|字符串数字 → 整数|`int()`|

### str.count()：统计字符出现次数

来源：[389.找不同](/siyuan/daily-note/2026/08/2026-08-03/#20260803150716-c5aflmi)、[242.有效的字母异位词](/siyuan/daily-note/2026/08/2026-08-03/#20260803161327-7zw0ozd)

```python
count_ch1 = string.count(ch)
# count 方法作用于字符串类型，返回其中对应 ch 的个数
```

### str.find()：查找子串位置

来源：[459.重复的子字符串](/siyuan/daily-note/2026/08/2026-08-03/#20260803213530-itiqshl)

```python
s1.find(s2, 1)
# find 方法作用于字符串，用于寻找 s1 中从第 i 个下标起的子串 s2
```

## 四、链表操作

### dummy 哑节点

来源：[2.两数相加](/siyuan/daily-note/2026/08/2026-08-07/#20260807173454-gcb930z)、[21.合并两个有序链表](/siyuan/daily-note/2026/08/2026-08-06/#20260806223443-0tb65zs)

创建哨兵节点，统一处理头节点插入，避免对空链表/头节点的特殊判断，最后返回 `dummy.next`：

```python
dummy = ListNode(0)   # 哑节点
curr = dummy
# ... 构建链表 ...
return dummy.next     # 跳过哑节点，返回真正的头
```

### 反转链表的两种写法

来源：[206.反转链表](/siyuan/daily-note/2026/08/2026-08-06/#20260806231236-s2la8a6)

**迭代**（三指针 + 暂存后继）：

```python
curr, prev = head, None
while curr:
    tmp = curr.next   # 暂存后继
    curr.next = prev  # 反转指向
    prev = curr       # 前移
    curr = tmp        # 前移
return prev
```

**递归**：

```python
def recur(cur, pre):
    if not cur: return pre          # 终止：遍历到末尾
    res = recur(cur.next, cur)      # 递归处理后继
    cur.next = pre                  # 回溯时反转指向
    return res
return recur(head, None)
```

### 用栈逆序处理链表

来源：[445.两数相加 II](/siyuan/daily-note/2026/08/2026-08-07/#20260807173936-1ygxwba)

链表只能单向遍历，需要"从尾部开始"时，可先压栈再 `pop()` 实现逆序：

```python
while l1:
    s1.append(l1.val)
    l1 = l1.next
# pop 时即从低位（末尾）开始处理
```

本质是「两数之和 + 反转链表」的组合技。

### 加法模拟：carry 进位

来源：[2.两数相加](/siyuan/daily-note/2026/08/2026-08-07/#20260807173454-gcb930z)、[67.二进制求和](/siyuan/daily-note/2026/08/2026-08-06/#20260806210542-p5bdgnd)

两数相加类题目的统一框架：`total = a + b + carry`​，`total % base`​ 存当前位，`total // base`​ 产生进位，循环条件必须包含 `carry`：

```python
carry = 0
while l1 or l2 or carry:          # 注意循环条件包含 carry
    x = l1.val if l1 else 0
    y = l2.val if l2 else 0
    total = x + y + carry
    curr.next = ListNode(total % 10)   # 取个位
    carry = total // 10                # 取进位
```

## 五、双指针

### 左右指针（有序数组）

来源：[167.两数之和 II - 输入有序数组](/siyuan/daily-note/2026/08/2026-08-07/#20260807212651-bx41yb6)

有序数组求和问题，左右指针相向移动，根据当前和与目标的大小决定移动方向，O(n)：

```python
left, right = 0, len(numbers) - 1
while left < right:
    s = numbers[left] + numbers[right]
    if s == target: return [left + 1, right + 1]
    elif s < target: left += 1     # 和太小，右移左指针
    else: right -= 1               # 和太大，左移右指针
```

### 双指针原地交换

来源：[283.移动零](/siyuan/daily-note/2026/08/2026-08-04/#20260804001819-jo9ybpr)

`left`​ 指向待写入位置，`right` 遍历；非零元素直接交换到前面，保持相对顺序：

```python
left = right = 0
while right < n:
    if nums[right] != 0:
        nums[left], nums[right] = nums[right], nums[left]
        left += 1
    right += 1
```

### 倒序双指针（原地合并）

来源：[88.合并两个有序数组](/siyuan/daily-note/2026/08/2026-08-14/#20260814090804-1r6sw29)

两个有序数组要合并到其中一个数组的尾部空间时，从**后往前**填充可以避免覆盖未处理元素：

```python
pos1, pos2 = m - 1, n - 1
i = m + n - 1
while pos2 >= 0:
    if pos1 >= 0 and nums1[pos1] > nums2[pos2]:
        nums1[i] = nums1[pos1]; pos1 -= 1
    else:
        nums1[i] = nums2[pos2]; pos2 -= 1
    i -= 1
```

### 快慢指针（覆盖式原地移除/去重）

来源：[27.移除元素](/siyuan/daily-note/2026/08/2026-08-17/#20260817085314-aoiparb)、[26.删除有序数组中的重复项](/siyuan/daily-note/2026/08/2026-08-17/#20260817091521-f1el73g)

`write`​ 指向待写入位置，`read`​ 遍历原数组；遇到符合条件的元素覆盖到 `write` 并前进。与「原地交换」（283）的区别：这里无需保留被覆盖的旧值，直接覆盖更简单：

```python
# 27. 移除元素（通用：按值过滤）
write = 0
for num in nums:
    if num != val:
        nums[write] = num
        write += 1
return write

# 26. 删除有序数组重复项（利用有序性：和前一个比较）
write = 1
for i in range(1, len(nums)):
    if nums[i] != nums[i - 1]:
        nums[write] = nums[i]
        write += 1
return write
```

### 滑动窗口（哈希表 + 左指针更新）

来源：[3.无重复字符的最长子串](/siyuan/daily-note/2026/08/2026-08-17/#20260817112000-e4whdit)

右指针 `j`​ 遍历，哈希表记录字符最近出现位置；左指针 `i`​ 维护窗口起点。关键：`i = max(dic[ch], i)`​ 必须取 `max`，否则窗口左边界可能回退：

```python
dic, res, i = {}, 0, -1
for j, ch in enumerate(s):
    if ch in dic:
        i = max(dic[ch], i)   # max 防止左指针回退
    dic[ch] = j
    res = max(res, j - i)
return res
```

## 六、哈希表（字典）

### 计数列表经典写法

来源：[242.有效的字母异位词](/siyuan/daily-note/2026/08/2026-08-03/#20260803161327-7zw0ozd)

```python
count = [0] * 26
# 哈希表经典写法：为每个字母分配一个计数位
```

### 值→下标字典，边查边存

来源：[1.两数之和](/siyuan/daily-note/2026/08/2026-08-07/#20260807181155-pbmka4z)

用字典以「值→下标」存储已遍历元素，每步只查 `target - num` 是否已出现，O(n)：

```python
hashtable = dict()
for i, num in enumerate(nums):
    if target - num in hashtable:
        return [hashtable[target - num], i]
    hashtable[nums[i]] = i   # 先查后存，避免使用同一元素两次
```

注意「先查后存」的顺序，防止同一个元素被用两次。

### 判重、最近索引与频次统计

来源：[217.存在重复元素](/siyuan/daily-note/2026/08/2026-08-14/#20260814100629-yj9lyxk)、[219.存在重复元素 II](/siyuan/daily-note/2026/08/2026-08-14/#20260814100033-kgymbyf)、[350.两个数组的交集 II](/siyuan/daily-note/2026/08/2026-08-14/#20260814094739-56cmr3k)

哈希表三种常见用途：

- **判重**：`if num in hashtable` 判断是否出现过
- **最近索引**：值→最近下标，配合 `i - hashtable[num] <= k` 判断窗口距离
- **频次统计**：值→出现次数，交集时取 `min(count1, count2)`

### 多维哈希判重（数独）

来源：[36.有效的数独](/siyuan/daily-note/2026/08/2026-08-17/#20260817093205-37keqcl)

用行、列、宫三个哈希结构分别判重。宫坐标 `(i//3, j//3)`​ 可压缩为一维 `(i//3)*3 + j//3`，避免三维数组：

```python
row = [[False] * 9 for _ in range(9)]
col = [[False] * 9 for _ in range(9)]
box = [[False] * 9 for _ in range(9)]   # 宫压缩成一维
for i in range(9):
    for j in range(9):
        if board[i][j] == '.': continue
        x = int(board[i][j]) - 1
        b = (i // 3) * 3 + (j // 3)     # 宫索引压缩
        if row[i][x] or col[j][x] or box[b][x]:
            return False
        row[i][x] = col[j][x] = box[b][x] = True
return True
```

## 七、位运算

### 异或抵消法

来源：[389.找不同](/siyuan/daily-note/2026/08/2026-08-03/#20260803150716-c5aflmi)

相同数异或为 0，遍历两串全部字符做异或，剩下的就是多出的那一个：

```python
ans = 0
for i in s: ans ^= ord(i)
for i in t: ans ^= ord(i)
return chr(ans)
```

### 快速幂（二分幂）

来源：[50.Pow(x, n)](/siyuan/daily-note/2026/08/2026-08-06/#20260806222824-3zqc4lu)

把指数 n 看作二进制，底数每轮自乘，遇到 n 的二进制位为 1 时累乘，O(log n)：

```python
result = 1.0
while n > 0:
    if n & 1: result *= x   # 当前二进制位为 1，累乘
    x *= x                  # 底数平方
    n >>= 1                 # 指数右移
return result
```

### / 与 // 的区别

来源：[1523.在区间范围内统计奇数数目](/siyuan/daily-note/2026/08/2026-08-06/#20260806015419-9z9jdmg)

```python
# // 计算只会得到向 -∞ 方向取整的 int 型
5 // 2 = 2      # 2.5 向下取整
-5 // 2 = -3    # -2.5 向 -∞ 方向取整
a // b 等价于 floor(a / b)
```

## 八、矩阵操作

### O(1) 空间标记法（第一行/列作标记）

来源：[73.矩阵置零](/siyuan/daily-note/2026/08/2026-08-06/#20260806005546-yxiwtk6)

不额外开行/列标记数组，直接利用原矩阵的**第一行、第一列**记录是否含 0；注意先用变量保存第一行/列的原始状态：

```python
flag_col0 = any(matrix[i][0] == 0 for i in range(m))
flag_row0 = any(matrix[0][j] == 0 for j in range(n))
# 用第一行/列记录内部元素是否含 0...
# 最后根据 flag_col0 / flag_row0 还原第一行/列本身
```

### 主副对角线下标关系

来源：[1572.矩阵对角线元素的和](/siyuan/daily-note/2026/08/2026-08-05/#20260805215546-281zma3)

n×n 矩阵中：主对角线满足 `i == j`​，副对角线满足 `i + j == n - 1`；中心元素（n 为奇数时）两对角线交点，勿重复累加：

```python
for i, row in enumerate(mat):
    j = m - i - 1
    if i == j:                 # 主对角线
        ans += row[i]
    elif i + j == m - 1:       # 副对角线（排除中心）
        ans += row[j]
```

### 螺旋遍历：directions 转向法

来源：[54.螺旋矩阵](/siyuan/daily-note/2026/08/2026-08-05/#20260806000809-two56jz)

二维矩阵模拟一类的解法：用 `directions`​ + `dir_idx` 控制移动方向，配合哈希表（或 visited 矩阵）确认未走过的路径，撞墙/回头时转向。此方法在螺旋题与路径规划题中通用：

```python
class Solution:
    def spiralOrder(self, matrix: List[List[int]]) -> List[int]:
        if not matrix: return []
        m, n = len(matrix), len(matrix[0])
        # 四个方向：右 → 下 → 左 → 上（顺时针）
        directions = [(0, 1), (1, 0), (0, -1), (-1, 0)]
        visited = [[False] * n for _ in range(m)]
        res = []
        x = y = 0
        dir_idx = 0
        for _ in range(m * n):
            res.append(matrix[x][y])
            visited[x][y] = True
            nx, ny = x + directions[dir_idx][0], y + directions[dir_idx][1]
            # 越界或已访问 → 转向
            if nx < 0 or nx >= m or ny < 0 or ny >= n or visited[nx][ny]:
                dir_idx = (dir_idx + 1) % 4
                nx, ny = x + directions[dir_idx][0], y + directions[dir_idx][1]
            x, y = nx, ny
        return res
```

**要点**：

- `dir_idx = (dir_idx + 1) % 4` 实现循环转向
- `visited` 用于记录已走过的格子，避免走回头路
- 撞墙判断（越界）与回头判断（visited）合并为同一个条件

### 原地旋转矩阵（四元素循环交换）

来源：[48.旋转图像](/siyuan/daily-note/2026/08/2026-08-17/#20260817101750-qcp9exh)

顺时针 90° 映射：`(i, j) → (j, n-1-i)`​。原地做法每次循环交换四个元素，只需遍历左上角 `(n//2) × ((n+1)//2)` 区域：

```python
for i in range(n // 2):
    for j in range((n + 1) // 2):
        tmp = matrix[i][j]
        matrix[i][j] = matrix[n-1-j][i]
        matrix[n-1-j][i] = matrix[n-1-i][n-1-j]
        matrix[n-1-i][n-1-j] = matrix[j][n-1-i]
        matrix[j][n-1-i] = tmp
```

**要点**：

- 只遍历左上角四分之一区域，避免重复交换
- 四个元素按「下→右→上→左」顺序循环赋值，`tmp` 暂存起点
- 先写辅助矩阵版本（额外空间）再优化成原地，是清晰的两步走路径

## 九、常用内置函数

### map()：对可迭代对象批量应用函数

来源：[1672.最富有客户的资产总量](/siyuan/daily-note/2026/08/2026-08-05/#20260805214039-pto6mtx)

```python
map(func, iterable1, iterable2, ...)
# func：函数（内置 / lambda / 自定义）
# 返回值：迭代器（map object），需要 list() 转列表
```

典型用法：

```python
max(map(sum, matrix))            # 二维数组按行求和取最大
list(map(int, "12345"))          # 字符串转数字
list(map(min, list1, list2))     # 多参数逐元素取最小
```

### divmod()：同时取商和余数

来源：[1502.判断能否形成等差数列](/siyuan/daily-note/2026/08/2026-08-04/#20260804012834-tir5j6a)

```python
d, r = divmod(c, d)
# a, b = divmod(c, d)，其中 a = c // d，b = c % d
# 等价写法：divmod = lambda a, b: (a // b, a % b)
```

### any()：任一元素满足条件

来源：[73.矩阵置零](/siyuan/daily-note/2026/08/2026-08-06/#20260806005546-yxiwtk6)

```python
with_zero = any(lis[i] == 0 for i in range(len(lis)))
# 遍历整个列表，若有一项满足条件即返回 True
```

### lambda 匿名函数

来源：[1523.在区间范围内统计奇数数目](/siyuan/daily-note/2026/08/2026-08-06/#20260806015419-9z9jdmg)

```python
pre = lambda x: (x + 1) >> 1
# 等价于：
# def pre(x):
#     return (x + 1) >> 1
```

### 三元表达式

来源：[1275.找出井字棋的获胜者](/siyuan/daily-note/2026/08/2026-08-04/#20260804220931-8j8ai9h)

```python
return True if a == b else False
# python 三元表达式：a if A else b，A 为真返回 a，反之返回 b
# 类似于 C 语言的 A ? a : b
```

### for-else 结构

来源：[28.找出字符串中第一个匹配项的下标](/siyuan/daily-note/2026/08/2026-08-03/#20260803152556-x3m66fq)、[459.重复的子字符串](/siyuan/daily-note/2026/08/2026-08-03/#20260803213530-itiqshl)

`for`​ 循环**正常结束（未被 break 打断）**  时执行 `else` 分支，常用于"全部满足/找到"的判断：

```python
for j in range(i, n):
    if s[j - i] == s[j]:
        continue
    else:
        break
else:            # 循环未被 break，说明全部匹配
    return True
```

## 十、算法思想

### KMP 字符串匹配

来源：[28.找出字符串中第一个匹配项的下标](/siyuan/daily-note/2026/08/2026-08-03/#20260803152556-x3m66fq)（[完整详解](/siyuan/daily-note/2026/08/2026-08-03/#20260803155923-lvb2fz3)）

- **核心思路**：利用已匹配部分的信息避免重复比较——之前位置的后缀相当于后面位置的前缀
- **预处理**：构建 next 数组，next[i] 记录 needle[0:i] 的最长公共前后缀长度
- **匹配**：字符不匹配时，j 回退到 next[j - 1] 位置

### 贪心算法

来源：[860.柠檬水找零](/siyuan/daily-note/2026/08/2026-08-06/#20260806022457-qlm4igu)

- 在每一步选择中都采取当前状态下"最优"的选择，不考虑整体后果
- 在某些问题中，这种"短视"策略恰好能推出全局最优解

### 买卖股票类贪心

来源：[121.买卖股票的最佳时机](/siyuan/daily-note/2026/08/2026-08-14/#20260814091052-cak9lzr)、[122.买卖股票的最佳时机 II](/siyuan/daily-note/2026/08/2026-08-14/#20260814092933-jtxcbx6)

- **单次交易**（121）：遍历时维护最低价 `minprice`​，每步更新最大利润 `max(profit, price - minprice)`
- **多次交易**（122）：只要今天比昨天涨，就累加差价 `if prices[i] > prices[i-1]: ans += prices[i] - prices[i-1]`

```python
# 121
minprice = prices[0]
profit = 0
for price in prices:
    profit = max(profit, price - minprice)
    minprice = min(minprice, price)

# 122
ans = 0
for i in range(1, len(prices)):
    if prices[i] > prices[i - 1]:
        ans += prices[i] - prices[i - 1]
```

### 摩尔投票（Boyer-Moore）

来源：[169.多数元素](/siyuan/daily-note/2026/08/2026-08-14/#20260814101725-t5suhzq)

找出现次数超过 `⌊n/2⌋` 的元素，O(n) 时间、O(1) 空间：

```python
ans = hp = 0
for x in nums:
    if hp == 0:      # 生命值为 0，换擂主
        ans = x
    hp += 1 if x == ans else -1   # 同则加血，异则扣血
return ans
```

### 复数坐标系模拟

来源：[1041.困于环中的机器人](/siyuan/daily-note/2026/08/2026-08-04/#20260804231935-7jba0tm)

```python
a = 0 + 0j
# 构建一个复数，常用于矩阵坐标系

a *= 1j
# 旋转方向：将 a 逆时针旋转 90 度
a *= -1j
# 旋转方向：将 a 顺时针旋转 90 度
```

## 十一、数学小技巧

### 前缀函数统计奇数个数

来源：[1523.在区间范围内统计奇数数目](/siyuan/daily-note/2026/08/2026-08-06/#20260806015419-9z9jdmg)

定义前缀函数 pre(x) 为 [0, x] 内奇数个数 `(x + 1) // 2`，区间答案 = 前缀差：

```python
pre = lambda x: (x + 1) >> 1
return pre(high) - pre(low - 1)
```

### 符号翻转，避免大数溢出

来源：[1822.数组元素积的符号](/siyuan/daily-note/2026/08/2026-08-04/#20260804010415-4sn040n)

只需判断乘积符号，不必真算乘积：遇 0 直接返回 0，遇负数翻转符号（等价于统计负数个数奇偶）：

```python
sign = 1
for num in nums:
    if num == 0: return 0
    if num < 0: sign = -sign   # 负数个数为奇数则结果为负
return sign
```

### 重复子串的字符串技巧

来源：[459.重复的子字符串](/siyuan/daily-note/2026/08/2026-08-03/#20260803213530-itiqshl)

若 s 由子串重复构成（s = t+t+...），则 s' = s + s 中必然在中间某处能找到 s：

```python
return (s + s).find(s, 1) != len(s)
```

（从下标 1 开始找，若找到的 s 不在第 2 个 s 的位置即 len(s)，说明是重复子串构成）

<section class="siyuan-references" aria-label="文档引用">

## 文档关系

### 本文引用
- [2026-08-03](/siyuan/daily-note/2026/08/2026-08-03/)
- [2026-08-04](/siyuan/daily-note/2026/08/2026-08-04/)
- [2026-08-05](/siyuan/daily-note/2026/08/2026-08-05/)
- [2026-08-06](/siyuan/daily-note/2026/08/2026-08-06/)
- [2026-08-07](/siyuan/daily-note/2026/08/2026-08-07/)
- [2026-08-14](/siyuan/daily-note/2026/08/2026-08-14/)
- [2026-08-17](/siyuan/daily-note/2026/08/2026-08-17/)

### 反向引用
- [Python笔记](/siyuan/Python笔记/)
- [学习笔记](/siyuan/)

</section>
