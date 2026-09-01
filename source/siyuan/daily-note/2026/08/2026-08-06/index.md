---
title: '2026-08-06'
date: '2026-08-06T00:48:49+08:00'
updated: '2026-08-06T23:15:45+08:00'
layout: page
type: siyuan-note
notebook: '学习笔记'
permalink: 'siyuan/daily-note/2026/08/2026-08-06/'
siyuan_source: 'daily note/2026/08/2026-08-06.md'
comments: false
categories:
  - '学习笔记'
  - 'daily note'
  - '2026'
  - '08'
---

# <span id="20260806005546-yxiwtk6" class="siyuan-block-anchor" aria-hidden="true"></span>力扣刷题：[73. 矩阵置零](https://leetcode.cn/problems/set-matrix-zeroes/)

## 题目

给定一个 m x n 的矩阵，如果一个元素为 0 ，则将其所在行和列的所有元素都设为 0 。请使用 原地 算法。

## 代码块

### 解法1-遍历读值、标记行列、遍历赋值

```python
class Solution:
    def setZeroes(self, matrix: List[List[int]]) -> None:
        rows, cols = len(matrix), len(matrix[0])
        zero_rows, zero_cols = [False for _ in range(rows)], [False for _ in range(cols)]
        for i in range(rows):
            for j in range(cols):
                if matrix[i][j] == 0:
                    zero_rows[i] = zero_cols[j] = True
        for i in range(rows):
            for j in range(cols):
                if zero_rows[i] or zero_cols[j]:
                    matrix[i][j] = 0
# 创建两个列表变量，用于记录矩阵的对应行/列是否需要归零
# 二次遍历，读值与赋值
```

### 解法2-降低空间复杂度，利用原矩阵的第一行和第一列

```python
class Solution:
    def setZeroes(self, matrix: List[List[int]]) -> None:
        m, n = len(matrix), len(matrix[0])
        flag_col0 = any(matrix[i][0] == 0 for i in range(m))
        flag_row0 = any(matrix[0][j] == 0 for j in range(n))
        
        for i in range(1, m):
            for j in range(1, n):
                if matrix[i][j] == 0:
                    matrix[i][0] = matrix[0][j] = 0
        
        for i in range(1, m):
            for j in range(1, n):
                if matrix[i][0] == 0 or matrix[0][j] == 0:
                    matrix[i][j] = 0
        
        if flag_col0:
            for i in range(m):
                matrix[i][0] = 0
        
        if flag_row0:
            for j in range(n):
                matrix[0][j] = 0
# 利用原矩阵得到第一行和第一列作为标记变量
# 但要注意先创建了两个变量读取原第一行/列，判断其是否含零
```

## 笔记：

```python
with_zero = any(lis[i] == 0 for i in range(len(lis)))
# any函数，实际可以写成
#	for i in range(len(lis)):
#		ans = ans or lis[i] == 0
# 即遍历整个列表，若有一项满足条件，返回真值	
```

# <span id="20260806015419-9z9jdmg" class="siyuan-block-anchor" aria-hidden="true"></span>力扣刷题：[1523. 在区间范围内统计奇数数目](https://leetcode.cn/problems/count-odd-numbers-in-an-interval-range/)

## 题目

给你两个非负整数 low 和 high 。请你返回 low 和 high 之间（包括二者）奇数的数目。

## 代码块

### 解法1-暴力分类讨论

```python
class Solution:
    def countOdds(self, low: int, high: int) -> int:
        ans = 0
        if (high - low) % 2 == 0:
            if high % 2 ==0:
                return int((high - low) / 2)
            else:
                return int((high - low) / 2 + 1)
        else:
            return int((high - low + 1) / 2)
```

### 解法2

```python
class Solution:
    def countOdds(self, low: int, high: int) -> int:
        pre = lambda x: (x + 1) >> 1
        return pre(high) - pre(low - 1)
```

## <span id="20260806015419-cl0dzyx" class="siyuan-block-anchor" aria-hidden="true"></span>笔记temp：

```python
pre = lambda x: (x + 1) >> 1
return pre(high) - pre(low - 1)
# lamba：匿名函数
# 本示例等价于：
# def pre(x):
# 	return (x + 1) >> 1

# 对于传统的d, r = divmod(mx - mn, n - 1)函数
# 可以写成divmod = lambda a, b: (a // b, a % b)
```

```python
除法运算符/与//的区别：
//计算只会得到向 -∞方向/更小的数 取整的int型
比如:
5 // 2 = 2 # 2.5向下取整
-5 // 2 = -3 #-2.5向-∞方向取整
a // b计算等价于floor(a / b)
```

‍

[divmod - lambda](/siyuan/daily-note/2026/08/2026-08-04/#20260804012834-t4osqfs)

# <span id="20260806021923-y46p07w" class="siyuan-block-anchor" aria-hidden="true"></span>力扣刷题：[1491. 去掉最低工资和最高工资后的工资平均值](https://leetcode.cn/problems/average-salary-excluding-the-minimum-and-maximum-salary/)

## 题目

给你一个整数数组 `salary`​ ，数组里每个数都是 **唯一** 的，其中 `salary[i]`​ 是第 `i` 个员工的工资。

请你返回去掉最低工资和最高工资以后，剩下员工工资的平均值。

## 代码块

### 解法1-自带库解法

```python
class Solution:
    def average(self, salary: List[int]) -> float:
        salary.remove(min(salary))
        salary.remove(max(salary))
        return sum(salary) / len(salary)
```

## 笔记：

无

# <span id="20260806022457-qlm4igu" class="siyuan-block-anchor" aria-hidden="true"></span>力扣刷题：[860. 柠檬水找零](https://leetcode.cn/problems/lemonade-change/)

## 题目

在柠檬水摊上，每一杯柠檬水的售价为 `5`​ 美元。顾客排队购买你的产品，（按账单 `bills` 支付的顺序）一次购买一杯。

每位顾客只买一杯柠檬水，然后向你付 `5`​ 美元、`10`​ 美元或 `20`​ 美元。你必须给每个顾客正确找零，也就是说净交易是每位顾客向你支付 `5` 美元。

注意，一开始你手头没有任何零钱。

给你一个整数数组 `bills`​ ，其中 `bills[i]`​ 是第 `i`​ 位顾客付的账。如果你能给每位顾客正确找零，返回 `true`​ ，否则返回 `false` 。

## 代码块

### 解法1-哈希表

```python
class Solution:
    def lemonadeChange(self, bills: List[int]) -> bool:
        money = [0] * 2
        for bill in bills:
            if bill == 5:
                money[0] += 1
            elif bill == 10:
                money[1] += 1
                if money[0] == 0:
                    return False
                else:
                    money[0] -= 1
            elif bill == 20:
                if money[0] > 0 and money[1] > 0:
                    money[0] -= 1
                    money[1] -= 1
                elif money[0] > 2:
                    money[0] -= 3
                else:
                    return False
        return True
# 使用哈希表来存储含有的5美元和10美元的张数
# 收到5美元则哈希表+1
# 收到10美元则哈希表+1并且校验是否含有一张及以上的5美元，注意找零要减钱
# 收到20美元则校验是否含有1张及以上的10美元和1张及以上的5美元，或者是3张及以上的5美元，注意找零要减钱
```

## 笔记：

贪心算法：

- 在每一步选择中，都采取当前状态下“最优”的选择，而不考虑整体后果
- 在某些问题中，这种“短视”策略恰好能推出全局最优解

# <span id="20260806194642-xqksrws" class="siyuan-block-anchor" aria-hidden="true"></span>力扣刷题：

## 题目

给定由一些正数（代表长度）组成的数组 nums ，返回 由其中三个长度组成的、面积不为零的三角形的最大周长 。如果不能形成任何面积不为零的三角形，返回 0。

## 代码块

### 解法1

```python
class Solution:
    def largestPerimeter(self, nums: List[int]) -> int:
        nums.sort()
        for i in range(len(nums) - 1, 1, -1):
            if nums[i] < nums[i - 1] + nums[i - 2]:
                return nums[i] + nums[i - 1] + nums[i - 2]
            else:
                continue
        return 0
```

## 笔记：

无

# <span id="20260806195340-i60tmg6" class="siyuan-block-anchor" aria-hidden="true"></span>力扣刷题：[1232. 缀点成线](https://leetcode.cn/problems/check-if-it-is-a-straight-line/)

## 题目

给定一个整数数组 coordinates ，其中 coordinates[i] = [x, y] ， [x, y] 表示横坐标为 x、纵坐标为 y 的点。请你来判断，这些点是否在该坐标系中属于同一条直线上。

## 代码块

### 解法1-求斜率一一对比坐标

```python
class Solution:
    def checkStraightLine(self, coordinates: List[List[int]]) -> bool:
        if coordinates[0][0] == coordinates[1][0]:
            for i in range(len(coordinates)):
                if coordinates[i][0] != coordinates[0][0]:
                    return False
            else:
                return True

        k = (coordinates[0][1] - coordinates[1][1]) / (coordinates[0][0] - coordinates[1][0])
        b = coordinates[0][1] - k * coordinates[0][0]
        for i in range(len(coordinates)):
            if coordinates[i][1] != int(k * coordinates[i][0] + b):
                return False
        return True
```

### 解法2-根据坐标求斜率一一对比斜率

```python
class Solution:
    def checkStraightLine(self, coordinates: List[List[int]]) -> bool:
        x0=coordinates[0][0]
        y0=coordinates[0][1]
        x1,y1=coordinates[1][0],coordinates[1][1]
#如何处理斜率为0与无穷的情况。只能使用乘式

        if len(coordinates)==2:
            return True
        else:
            for i in coordinates[2:]:
                if (i[0]-x1)*(y1-y0)  != (i[1]-y1)*(x1-x0):
                    return False
            return True

作者：qyQwXKdZBi
链接：https://leetcode.cn/problems/check-if-it-is-a-straight-line/solutions/4007226/xiao-bai-zi-xue-281232-zhui-dian-cheng-x-yn52/
来源：力扣（LeetCode）
著作权归作者所有。商业转载请联系作者获得授权，非商业转载请注明出处。
```

## 笔记：

- ‍

 	

# <span id="20260806210542-p5bdgnd" class="siyuan-block-anchor" aria-hidden="true"></span>力扣刷题：[67. 二进制求和](https://leetcode.cn/problems/add-binary/)

## 题目

给你两个二进制字符串 a 和 b ，以二进制字符串的形式返回它们的和。

## 代码块

### 解法1

```python
class Solution:
    def addBinary(self, a: str, b: str) -> str:
        if len(a) < len(b):
            a, b = b, a

        m, n = len(a), len(b)
        ans = [0] * (m + 1)
        carry = 0

        for i in range(m - 1, -1, -1):
            j = n - (m - i)
            y = int(b[j]) if j >= 0 else 0
            s = int(a[i]) + y + carry
            ans[i + 1] = str(s % 2)
            carry = s // 2

        ans[0] = str(carry)
        return ''.join(ans[carry ^ 1:])
```

## 笔记：

- ‍

# <span id="20260806210644-ojfjae5" class="siyuan-block-anchor" aria-hidden="true"></span>力扣刷题：[43. 字符串相乘](https://leetcode.cn/problems/multiply-strings/)

## 题目

给定两个以字符串形式表示的非负整数 `num1`​ 和 `num2`​，返回 `num1`​ 和 `num2` 的乘积，它们的乘积也表示为字符串形式。

**注意：** 不能使用任何内置的 BigInteger 库或直接将输入转换为整数。

## 代码块

### 解法1

```python
class Solution:
    def multiply(self, num1: str, num2: str) -> str:
        if num1 == "0" or num2 == "0":
            return "0"

        m, n = len(num1), len(num2)
        res = [0] * (m + n)

        for i in range(m - 1, -1, -1):
            x = ord(num1[i]) - ord('0')
            for j in range(n - 1, -1, -1):
                y = ord(num2[j]) - ord('0')
                res[i + j + 1] += x * y

        for i in range(m + n - 1, 1, -1):
            res[i - 1] += res[i] // 10
            res[i] = res[i] % 10
        
        start = 0
        for i in range(m + n):
            if res[i] == 0:
                start += 1
            else:
                break
        return "".join(str(res[j]) for j in range(start, m + n, 1))
```

## 笔记：

- ‍

# <span id="20260806222824-3zqc4lu" class="siyuan-block-anchor" aria-hidden="true"></span>力扣刷题：[50. Pow(x, n)](https://leetcode.cn/problems/powx-n/)

## 题目

实现 pow(x, n) ，即计算 x 的整数 n 次幂函数（即，x<sup>n</sup> ）。

## 代码块

### 解法1-二分法，二进制

```python
class Solution:
    def myPow(self, x: float, n: int) -> float:
        if n == 0:
            return 1.0

        if n < 0:
            x = 1 / x
            n = -n

        result = 1.0
        while n > 0:
            if n & 1:          # n 是奇数
                result *= x
            x *= x             # 底数平方
            n >>= 1            # n //= 2
        return result
```

## 笔记：

```python
if n & 1:
# 快速判断奇偶性
```

```python
n >>= 1
# n //= 2
```

```python
while n > 0:
	if n & 1:          # n 是奇数
		result *= x
	x *= x             # 底数平方
	n >>= 1            # n //= 2
return result
# 对于不确定循环次数的迭代，最好使用while [not 退出条件]:
```

# <span id="20260806223443-0tb65zs" class="siyuan-block-anchor" aria-hidden="true"></span>力扣刷题：[21. 合并两个有序链表](https://leetcode.cn/problems/merge-two-sorted-lists/)

## 题目

将两个升序链表合并为一个新的 **升序** 链表并返回。新链表是通过拼接给定的两个链表的所有节点组成的。

## 代码块

### 解法1-递归

```python
class Solution:
    def mergeTwoLists(self, l1: ListNode, l2: ListNode) -> ListNode:
        if l1 is None:
            return l2
        elif l2 is None:
            return l1
        elif l1.val < l2.val:
            l1.next = self.mergeTwoLists(l1.next, l2)
            return l1
        else:
            l2.next = self.mergeTwoLists(l1, l2.next)
            return l2
```

### 解法2-迭代

```python
class Solution:
    def mergeTwoLists(self, l1: ListNode, l2: ListNode) -> ListNode:
        prehead = ListNode(-1)

        prev = prehead
        while l1 and l2:
            if l1.val <= l2.val:
                prev.next = l1
                l1 = l1.next
            else:
                prev.next = l2
                l2 = l2.next            
            prev = prev.next

        # 合并后 l1 和 l2 最多只有一个还未被合并完，我们直接将链表末尾指向未合并完的链表即可
        prev.next = l1 if l1 is not None else l2

        return prehead.next
```

## 笔记：

- ‍

# <span id="20260806231236-s2la8a6" class="siyuan-block-anchor" aria-hidden="true"></span>力扣刷题：[206. 反转链表](https://leetcode.cn/problems/reverse-linked-list/)

## 题目

给你单链表的头节点 `head` ，请你反转链表，并返回反转后的链表。

## 代码块

### 解法1-迭代

```python
class Solution:
    def reverseList(self, head: ListNode) -> ListNode:
        curr, prev = head, None
        while curr:
            tmp = curr.next # 暂存后继节点 curr.next
            curr.next = prev # 修改 next 引用指向
            prev = curr     # prev 暂存 curr
            curr = tmp      # curr 访问下一节点
        return prev
"""另一种写法：
class Solution:
    def reverseList(self, head: ListNode) -> ListNode:
        cur, pre = head, None
        while cur:
            cur.next, pre, cur = pre, cur, cur.next
        return pre
"""
```

### 解法2-递归

```python
class Solution:
    def reverseList(self, head: ListNode) -> ListNode:
        def recur(cur, pre):
            if not cur: return pre     # 终止条件
            res = recur(cur.next, cur) # 递归后继节点
            cur.next = pre             # 修改节点引用指向
            return res                 # 返回反转链表的头节点
        
        return recur(head, None)       # 调用递归并返回
```

## 笔记：

- ‍

‍

<section class="siyuan-references" aria-label="文档引用">

## 文档关系

### 本文引用
- [2026-08-04](/siyuan/daily-note/2026/08/2026-08-04/)

### 反向引用
- [2026-08-04](/siyuan/daily-note/2026/08/2026-08-04/)
- [2026-08-14](/siyuan/daily-note/2026/08/2026-08-14/)
- [daily note](/siyuan/daily-note/)
- [类型索引](/siyuan/力扣刷题/类型索引/)
- [时间线索引](/siyuan/力扣刷题/时间线索引/)
- [算法专项](/siyuan/Python笔记/算法专项/)
- [学习笔记](/siyuan/)

</section>
