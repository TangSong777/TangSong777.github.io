---
title: '2026-08-14'
date: '2026-08-14T08:35:31+08:00'
updated: '2026-08-18T15:25:28+08:00'
layout: page
type: siyuan-note
notebook: '学习笔记'
permalink: 'siyuan/daily-note/2026/08/2026-08-14/'
siyuan_source: 'daily note/2026/08/2026-08-14.md'
comments: false
categories:
  - '学习笔记'
  - 'daily note'
  - '2026'
  - '08'
---

# <span id="20260814090804-1r6sw29" class="siyuan-block-anchor" aria-hidden="true"></span>力扣刷题：[88. 合并两个有序数组](https://leetcode.cn/problems/merge-sorted-array/)

## 题目

给你两个按 **非递减顺序** 排列的整数数组 `nums1`​  和 `nums2`​，另有两个整数 `m`​ 和 `n`​ ，分别表示 `nums1`​ 和 `nums2` 中的元素数目。

 请你 **合并** `nums2`​ 到 `nums1`​ 中，使合并后的数组同样按 **非递减顺序** 排列。

**注意：** 最终，合并后数组不应由函数返回，而是存储在数组 `nums1`​ 中。为了应对这种情况，`nums1`​ 的初始长度为 `m + n`​，其中前 `m`​ 个元素表示应合并的元素，后 `n`​ 个元素为 `0`​ ，应忽略。`nums2`​ 的长度为 `n` 。

## 代码块

### 解法1-倒序双指针

```python
class Solution:
    def merge(self, nums1: List[int], m: int, nums2: List[int], n: int) -> None:
        pos1, pos2 = m - 1, n - 1
        i = m + n - 1

        while i >= 0:
            if pos1 < 0:
                nums1[i] = nums2[pos2]
                pos2 -= 1
            elif pos2 < 0:
                nums1[i] = nums1[pos1]
                pos1 -= 1
            elif nums1[pos1] > nums2[pos2]:
                nums1[i] = nums1[pos1]
                pos1 -= 1
            else:
                nums1[i] = nums2[pos2]
                pos2 -= 1
            i -= 1
```

## 笔记：

本题与[21.合并两个有序链表](/siyuan/daily-note/2026/08/2026-08-06/#20260806223443-0tb65zs)非常相似，但要注意其本质不同

一个为数组排序一个为链表排序

# <span id="20260814091052-cak9lzr" class="siyuan-block-anchor" aria-hidden="true"></span>力扣刷题：[121. 买卖股票的最佳时机](https://leetcode.cn/problems/best-time-to-buy-and-sell-stock/)

## 题目

给定一个数组 `prices`​ ，它的第 `i`​ 个元素 `prices[i]`​ 表示一支给定股票第 `i` 天的价格。

你只能选择 **某一天** 买入这只股票，并选择在 **未来的某一个不同的日子** 卖出该股票。设计一个算法来计算你所能获取的最大利润。

返回你可以从这笔交易中获取的最大利润。如果你不能获取任何利润，返回 `0` 。

## 代码块

### 解法1-动态规划

```python
class Solution:
    def maxProfit(self, prices: List[int]) -> int:
        profit = 0
        minprice = prices[0]
        m = len(prices)
        for i in range(m):
            if minprice > prices[i]:
                minprice = prices[i]
            if profit < prices[i] - minprice:
                profit = prices[i] - minprice
        return profit
# 动态规划类题目，从每一个遇到的新历史低点开始计算利润，往后遍历只取最大利润
# 若遇到更低的历史低点，则重新定义minprice并往后计算利润
```

## 笔记：

无

# <span id="20260814092933-jtxcbx6" class="siyuan-block-anchor" aria-hidden="true"></span>力扣刷题：[122. 买卖股票的最佳时机 II](https://leetcode.cn/problems/best-time-to-buy-and-sell-stock-ii/)

## 题目

给你一个整数数组 `prices`​ ，其中 `prices[i]`​ 表示某支股票第 `i` 天的价格。

在每一天，你可以决定是否购买和/或出售股票。你在任何时候 **最多** 只能持有 **一股** 股票。然而，你可以在 **同一天** 多次买卖该股票，但要确保你持有的股票不超过一股。

返回 *你能获得的*  ***最大***  *利润* 。

## 代码块

### 解法1-贪心

```python
class Solution:
    def maxProfit(self, prices: List[int]) -> int:
        ans = 0
        profit = 0
        minprice, maxprice = prices[0], prices[0]
        m = len(prices)

        for i in range(1, m):
            if prices[i] < maxprice:
                ans += maxprice - minprice
                minprice = prices[i]
            maxprice = prices[i]
        ans += maxprice - minprice
        return ans
# 找到阶段的最大差值，遇到小于阶段最大值的就把当前阶段的最大收益计入并开始一个新阶段

# 一个更好的写法是：
"""
class Solution:
    def maxProfit(self, prices: List[int]) -> int:
        profit = 0
        for i in range(1, len(prices)):
            tmp = prices[i] - prices[i - 1]
            if tmp > 0: profit += tmp
        return profit

"""
```

### 解法2

```python

```

## 笔记：

- ‍

# <span id="20260814094739-56cmr3k" class="siyuan-block-anchor" aria-hidden="true"></span>力扣刷题：[350. 两个数组的交集 II](https://leetcode.cn/problems/intersection-of-two-arrays-ii/)

## 题目

给你两个整数数组 `nums1`​ 和 `nums2` ，请你以数组形式返回两数组的交集。返回结果中每个元素出现的次数，应与元素在两个数组中都出现的次数一致（如果出现次数不一致，则考虑取较小值）。可以不考虑输出结果的顺序。

**进阶：** 

- 如果给定的数组已经排好序呢？你将如何优化你的算法？
- 如果 `nums1`​  的大小比 `nums2` 小，哪种方法更优？
- 如果 `nums2`​  的元素存储在磁盘上，内存是有限的，并且你不能一次加载所有的元素到内存中，你该怎么办？

## 代码块	

### 解法1-哈希表

```python
class Solution:
    def intersect(self, nums1: List[int], nums2: List[int]) -> List[int]:
        hashtable = [0 for _ in range(1001)]
        ans = []
        for i in range(len(nums1)):
            hashtable[nums1[i]] += 1
        for i in range(len(nums2)):
            if hashtable[nums2[i]] > 0:
                hashtable[nums2[i]] -= 1
                ans.append(nums2[i])
        return ans
```

## 笔记：

无

# <span id="20260814100033-kgymbyf" class="siyuan-block-anchor" aria-hidden="true"></span>力扣刷题：[219. 存在重复元素 II](https://leetcode.cn/problems/contains-duplicate-ii/)

## 题目

给你一个整数数组 `nums`​ 和一个整数 `k`​ ，判断数组中是否存在两个 **不同的索引**  `i`​ 和  `j`​ ，满足 `nums[i] == nums[j]`​ 且 `abs(i - j) <= k`​ 。如果存在，返回 `true`​ ；否则，返回 `false` 。

## 代码块

### 解法1-哈希表

```python
class Solution:
    def containsNearbyDuplicate(self, nums: List[int], k: int) -> bool:
        hashtable = dict()
        for i, num in enumerate(nums):
            if num in hashtable:
                if abs(hashtable[num] - i) <= k:
                    return True
            hashtable[num] = i
        return False
```

## 笔记：

无

# <span id="20260814100629-yj9lyxk" class="siyuan-block-anchor" aria-hidden="true"></span>力扣刷题：[217. 存在重复元素](https://leetcode.cn/problems/contains-duplicate/)

## 题目

给你一个整数数组 `nums`​ 。如果任一值在数组中出现 **至少两次** ，返回 `true`​ ；如果数组中每个元素互不相同，返回 `false` 。

## 代码块

### 解法1-哈希表

```python
class Solution:
    def containsDuplicate(self, nums: List[int]) -> bool:
        hashtable = dict()
        for i, num in enumerate(nums):
            if num in hashtable:
                return True
            else:
                hashtable[num] = 1
        return False
```

## 笔记：

无

# <span id="20260814101112-yz0tag9" class="siyuan-block-anchor" aria-hidden="true"></span>力扣刷题：[136. 只出现一次的数字](https://leetcode.cn/problems/single-number/)

## 题目

给你一个 **非空** 整数数组 `nums` ，除了某个元素只出现一次以外，其余每个元素均出现两次。找出那个只出现了一次的元素。

你必须设计并实现线性时间复杂度的算法来解决此问题，且该算法只使用常量额外空间。

## 代码块

### 解法1-异或法

```python
class Solution:
    def singleNumber(self, nums: List[int]) -> int:
        ans = 0
        for i, num in enumerate(nums):
            ans ^= num
        return ans
```

## 笔记：

无

# <span id="20260814101725-t5suhzq" class="siyuan-block-anchor" aria-hidden="true"></span>力扣刷题：[169. 多数元素](https://leetcode.cn/problems/majority-element/)

## 题目

给定一个大小为 `n`​  的数组 `nums`​ ，返回其中的多数元素。多数元素是指在数组中出现次数 **大于** `⌊ n/2 ⌋` 的元素。

你可以假设数组是非空的，并且给定的数组总是存在多数元素。

## 代码块

### 解法1-摩尔投票

```python
class Solution:
    def majorityElement(self, nums: List[int]) -> int:
        ans = hp = 0
        for x in nums:
            if hp == 0:  # x 是初始擂主，生命值为 1
                ans, hp = x, 1
            else:  # 比武，同门加血，否则扣血
                hp += 1 if x == ans else -1
        return ans
```

## 笔记：

无

# <span id="20260814102804-z0gzw0b" class="siyuan-block-anchor" aria-hidden="true"></span>力扣刷题：[189. 轮转数组](https://leetcode.cn/problems/rotate-array/)

## 题目

给定一个整数数组 `nums`​，将数组中的元素向右轮转 `k`​  个位置，其中 `k`  是非负数。

**进阶：**

- 尽可能想出更多的解决方案，至少有 **三种** 不同的方法可以解决这个问题。
- 你可以使用空间复杂度为 `O(1)`​ 的 **原地** 算法解决这个问题吗？

## 代码块

### 解法1-额外数组

```python
class Solution:
    def rotate(self, nums: List[int], k: int) -> None:
        m = len(nums)
        ans = [0 for _ in range(m)]

        for i in range(m):
            pos = (k + i) % m
            ans[pos] = nums[i]

        for i in range(m):
            nums[i] = ans[i]
```

### 解法2-负负得正，翻转法

```python
class Solution:
    def rotate(self, nums: List[int], k: int) -> None:
        def reverse(i: int, j: int) -> None:
            while i < j:
                nums[i], nums[j] = nums[j], nums[i]
                i += 1
                j -= 1

        n = len(nums)
        k %= n  # 轮转 k 次等同于轮转 k % n 次
        reverse(0, n - 1)
        reverse(0, k - 1)
        reverse(k, n - 1)
```

### 解法3-四种解法

```python
class Solution:
    def rotate(self, nums: List[int], k: int) -> None:
        """
        Do not return anything, modify nums in-place instead.
        """
        # 方法1
        # for i in range(k):
        #     nums.insert(0, nums.pop())

        # 方法2
        # k = k % len(nums)
        # nums[:] = nums[-k:] + nums[:-k]

        # 方法3
        # print(nums[:], nums, nums == nums[:], id(nums), id(nums[:]), nums.reverse(), nums)
        # def swap(nums, left, right):
        #     while left < right:
        #         nums[left], nums[right] = nums[right], nums[left]
        #         left += 1
        #         right -= 1
        #
        # length = len(nums)
        # k %= length
        # swap(nums, 0, length-k-1)
        # swap(nums, length-k, length-1)
        # swap(nums, 0, length-1)
        
        # 方法3：pythonic实现方式
        length = len(nums)
        k %= length
        nums[:] = nums[::-1]
        nums[:k] = nums[:k][::-1]
        nums[k:] = nums[k:][::-1] 
```

## 笔记：

- 要求原地修改，所以不能使用nums = nums[-k:] + nums[:-k]，只能使用nums[:] = nums[-k:] + nums[:-k]

‍

<section class="siyuan-references" aria-label="文档引用">

## 文档关系

### 本文引用
- [2026-08-06](/siyuan/daily-note/2026/08/2026-08-06/)

### 反向引用
- [daily note](/siyuan/daily-note/)
- [类型索引](/siyuan/力扣刷题/类型索引/)
- [时间线索引](/siyuan/力扣刷题/时间线索引/)
- [算法专项](/siyuan/Python笔记/算法专项/)
- [学习笔记](/siyuan/)

</section>
