---
title: '2026-08-07'
date: '2026-08-07T14:18:17+08:00'
updated: '2026-08-14T08:47:45+08:00'
layout: page
type: siyuan-note
notebook: '学习笔记'
permalink: 'siyuan/daily-note/2026/08/2026-08-07/'
siyuan_source: 'daily note/2026/08/2026-08-07.md'
comments: false
categories:
  - '学习笔记'
  - 'daily note'
  - '2026'
  - '08'
---

# <span id="20260807173454-gcb930z" class="siyuan-block-anchor" aria-hidden="true"></span>力扣刷题：[2. 两数相加](https://leetcode.cn/problems/add-two-numbers/)

## 题目

给你两个 **非空** 的链表，表示两个非负的整数。它们每位数字都是按照 **逆序** 的方式存储的，并且每个节点只能存储 **一位** 数字。

请你将两个数相加，并以相同形式返回一个表示和的链表。

你可以假设除了数字 0 之外，这两个数都不会以 0 开头。

## 代码块

### 解法1-迭代

```python
class Solution:
    def addTwoNumbers(self, l1: Optional[ListNode], l2: Optional[ListNode]) -> Optional[ListNode]:
        dummy  = ListNode(0)
        curr  = dummy
        carry = 0
        while l1 or l2 or carry:
            x = l1.val if l1 else 0
            y = l2.val if l2 else 0

            total = x + y + carry
            curr.next = ListNode(total % 10)
            carry = total // 10

            curr = curr.next
            if l1:
                l1 = l1.next
            if l2:
                l2 = l2.next
        return dummy.next
```

## 笔记：

无

# <span id="20260807173936-1ygxwba" class="siyuan-block-anchor" aria-hidden="true"></span>力扣刷题：[445. 两数相加 II](https://leetcode.cn/problems/add-two-numbers-ii/)

## 题目

给你两个 **非空** 链表来代表两个非负整数。数字最高位位于链表开始位置。它们的每个节点只存储一位数字。将这两数相加会返回一个新的链表。

你可以假设除了数字 0 之外，这两个数字都不会以零开头。

## 代码块

### 解法1-迭代

```python
class Solution:
    def addTwoNumbers(self, l1: ListNode, l2: ListNode) -> ListNode:
        s1, s2 = [], []
        while l1:
            s1.append(l1.val)
            l1 = l1.next
        while l2:
            s2.append(l2.val)
            l2 = l2.next
        ans = None
        carry = 0
        while s1 or s2 or carry != 0:
            a = 0 if not s1 else s1.pop()
            b = 0 if not s2 else s2.pop()
            cur = a + b + carry
            carry = cur // 10
            cur %= 10
            curnode = ListNode(cur)
            curnode.next = ans
            ans = curnode
        return ans
# 本解法使用栈来存储链表中的数据
# 本质垃圾题目，本质为两数之和与翻转链表的组合技，可使用前二者组合快速解出
```

### 解法2

```python

```

## 笔记：

无

# <span id="20260807181155-pbmka4z" class="siyuan-block-anchor" aria-hidden="true"></span>力扣刷题：[1. 两数之和](https://leetcode.cn/problems/two-sum/)

## 题目

给定一个整数数组 `nums`​ 和一个整数目标值 `target`​，请你在该数组中找出 **和为目标值**   *​`target`​*​  的那 **两个** 整数，并返回它们的数组下标。

你可以假设每种输入只会对应一个答案，并且你不能使用两次相同的元素。

你可以按任意顺序返回答案。

## 代码块

### 解法1-暴力

```python
class Solution:
    def twoSum(self, nums: List[int], target: int) -> List[int]:
        for i in range(len(nums)):
            for j in range(i + 1, len(nums)):
                if nums[i] + nums[j] == target:
                    return [i, j]
```

### 解法2-哈希表

```python
class Solution:
    def twoSum(self, nums: List[int], target: int) -> List[int]:
        hashtable = dict()
        for i, num in enumerate(nums):
            if target - num in hashtable:
                return [hashtable[target - num], i]
            hashtable[nums[i]] = i
        return []
# 使用python的数据结构-字典
# 将已经出现的数字存入字典中，键为数字对应的值，值为数字对应的下标
# 第一次遇见数字时，将数据存入字典中
# 后每次查表，判断target - num是否存在，当第二个目标数字被枚举到时，即可return下标
```

## 笔记：

- ‍

# <span id="20260807212651-bx41yb6" class="siyuan-block-anchor" aria-hidden="true"></span>力扣刷题：[167. 两数之和 II - 输入有序数组](https://leetcode.cn/problems/two-sum-ii-input-array-is-sorted/)

## 题目

![2026-08-07_21-28-04](/images/siyuan/daily%20note/2026/08/2026-08-07_21-28-04.png)

## 代码块

### 解法1-双指针

```python
class Solution:
    def twoSum(self, numbers: List[int], target: int) -> List[int]:
        left, right = 0, len(numbers) - 1
        while left < right:
            s = numbers[left] + numbers[right]
            if s == target:
                return [left + 1, right + 1]
            elif s < target:
                left += 1
            else:
                right -= 1
        return []
```

## 笔记：

无

# <span id="20260807214026-zq2brrt" class="siyuan-block-anchor" aria-hidden="true"></span>力扣刷题：[53. 最大子数组和](https://leetcode.cn/problems/maximum-subarray/)

## 题目

给你一个整数数组 `nums` ，请你找出一个具有最大和的连续子数组（子数组最少包含一个元素），返回其最大和。

**子数组**是数组中的一个连续部分。

## 代码块

### 解法1-本质失败，超出时间限制

```python
class Solution:
    def maxSubArray(self, nums: List[int]) -> int:
        maxnum = None
        sumnum = 0
        for i in range(len(nums)):
            for j in range(i, len(nums)):
                sumnum += nums[j]
                if maxnum == None:
                    maxnum = sumnum
                if sumnum > maxnum:
                    maxnum = sumnum
            sumnum = 0
        return maxnum
```

### 解法2-动态规划

```python
class Solution:
    def maxSubArray(self, nums: List[int]) -> int:
        size = len(nums)
        if size == 0:
            return 0
        dp = [0 for _ in range(size)]

        dp[0] = nums[0]
        for i in range(1, size):
            if dp[i - 1] >= 0:
                dp[i] = dp[i - 1] + nums[i]
            else:
                dp[i] = nums[i]
        return max(dp)
# 创建一个列表dp来表示以对应下标为结尾的子数组和的最大值
# 若某一下标dp[i] > 0，则dp[i + 1] = dp[i] + nums[i + 1]
# 反之dp[i] < 0，dp[i + 1] = nums[i + 1]重新开始
```

## 笔记：

无后效性：为了保证计算子问题能够按照顺序、不重复地进行，动态规划要求已经求解的子问题不受后续阶段的影响。这个条件也被叫做「无后效性」。换言之，动态规划对状态空间的遍历构成一张有向无环图，遍历就是该有向无环图的一个拓扑序。有向无环图中的节点对应问题中的「状态」，图中的边则对应状态之间的「转移」，转移的选取就是动态规划中的「决策」。

有后效性：如果之前的阶段求解的子问题的结果包含了一些不确定的信息，导致了后面的阶段求解的子问题无法得到，或者很难得到，这叫「有后效性」

‍

<section class="siyuan-references" aria-label="文档引用">

## 文档关系

### 反向引用
- [daily note](/siyuan/daily-note/)
- [类型索引](/siyuan/力扣刷题/类型索引/)
- [时间线索引](/siyuan/力扣刷题/时间线索引/)
- [算法专项](/siyuan/Python笔记/算法专项/)
- [学习笔记](/siyuan/)

</section>
