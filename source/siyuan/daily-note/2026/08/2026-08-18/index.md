---
title: '2026-08-18'
date: '2026-08-18T09:06:38+08:00'
updated: '2026-08-24T17:01:12+08:00'
layout: page
type: siyuan-note
notebook: '学习笔记'
permalink: 'siyuan/daily-note/2026/08/2026-08-18/'
siyuan_source: 'daily note/2026/08/2026-08-18.md'
comments: false
categories:
  - '学习笔记'
  - 'daily note'
  - '2026'
  - '08'
---

# 力扣刷题：[209. 长度最小的子数组](https://leetcode.cn/problems/minimum-size-subarray-sum/)

## 题目

给定一个含有 `n`​  个正整数的数组和一个正整数 `target`​   **。**

  找出该数组中满足其总和大于等于`target`​ 的长度最小的 **子数组** [nums<sub>l</sub>, nums<sub>l+1</sub>, ..., nums<sub>r-1</sub>, nums<sub>r</sub>] ，并返回其长度 **。** 如果不存在符合条件的子数组，返回 `0` 。

## 代码块

### 解法1

```python
class Solution:
    def minSubArrayLen(self, target: int, nums: List[int]) -> int:
        n = len(nums)
        ans = n + 1  # 也可以写 inf
        s = left = 0
        for right, x in enumerate(nums):  # 枚举子数组右端点
            s += x
            while s >= target:  # 满足要求
                ans = min(ans, right - left + 1)
                s -= nums[left]
                left += 1  # 左端点右移
        return ans if ans <= n else 0
# 滑动窗口，本解法可戏称为蜗牛蠕动法
# 双指针滑窗，考虑本题target都为正整数，将右指针右移，则sum一直增大，若减去左指针数后仍然大于等于target，则左指针右移。
```

### 解法2

```python

```

## 笔记：

- ‍

# 力扣刷题：[76. 最小覆盖子串](https://leetcode.cn/problems/minimum-window-substring/)

## 题目

给定两个字符串 `s`​ 和 `t`​，长度分别是 `m`​ 和 `n`​，返回 s 中的 ​**最短窗口**  **子串**​，使得该子串包含 `t`​ 中的每一个字符（​**包括重复字符**​）。如果没有这样的子串，返回空字符串​  ​`""`。

测试用例保证答案唯一。

## 代码块

### 解法1

```python
class Solution:
    def minWindow(self, s: str, t: str) -> str:

        need = {}
        for ch in t:
            need[ch] = need.get(ch, 0) + 1

        window = {}

        left = 0
        valid = 0

        start = 0
        min_len = float("inf")

        for right, ch in enumerate(s):

            # 右边加入窗口
            if ch in need:
                window[ch] = window.get(ch, 0) + 1

                if window[ch] == need[ch]:
                    valid += 1

            # 当前窗口满足要求
            while valid == len(need):

                # 更新答案
                if right - left + 1 < min_len:
                    start = left
                    min_len = right - left + 1

                # 左边移出窗口
                left_ch = s[left]

                if left_ch in need:
                    window[left_ch] -= 1

                    if window[left_ch] < need[left_ch]:
                        valid -= 1

                left += 1

        if min_len == float("inf"):
            return ""

        return s[start:start + min_len]
```

### 解法2

```python

```

## 笔记：

- for ch in t:  
              need[ch] = need.get(ch, 0) + 1

使用这个方法来建立一个哈希表，用于统计字符串中对应字符的出现次数，键-值：字符-出现次数

get方法旨在返回哈希表里键为ch的键值对所对应的值，如果ch不在哈希表里，则返回0。

如果ch在哈希表里，则让其自增1

注意这里的need只是一个空字典，need = dict()

另一种方法：

cnt = defaultdict(int)  
for right, c in enumerate(s):  
            cnt[c] += 1

此方法可以直接创建一个默认值为0的字典，直接使用cnt[c] += 1即可

# 力扣刷题：[1456. 定长子串中元音的最大数目](https://leetcode.cn/problems/maximum-number-of-vowels-in-a-substring-of-given-length/)

## 题目

给你字符串 `s`​ 和整数 `k` 。

请返回字符串 `s`​ 中长度为 `k` 的单个子字符串中可能包含的最大元音字母数。

英文中的 **元音字母**   为（`a`​, `e`​, `i`​, `o`​, `u`）。

## 代码块

### 解法1

```python
class Solution:
    def maxVowels(self, s: str, k: int) -> int:
        match = set("aeiou")
        max_len = 0
        window_match_len = 0
        for i in range(k):
            if s[i] in match:
                window_match_len += 1
        max_len = window_match_len
        for right in range(k, len(s)):
            if s[right] in match:
                window_match_len += 1
            if s[right - k] in match:
                window_match_len -= 1
            max_len = max(max_len, window_match_len)
        return max_len
```

### 解法2-灵茶山艾府

```python
class Solution:
    def maxVowels(self, s: str, k: int) -> int:
        ans = vowel = 0
        for i, c in enumerate(s):  # 枚举窗口右端点 i
            # 1. 右端点进入窗口
            if c in "aeiou":
                vowel += 1

            left = i - k + 1  # 窗口左端点
            if left < 0:  # 窗口长度不足 k，尚未形成第一个窗口
                continue

            # 2. 更新答案
            ans = max(ans, vowel)
            if ans == k:  # 答案已经等于理论最大值
                break  # 无需再循环

            # 3. 左端点离开窗口，为下一个循环做准备
            if s[left] in "aeiou":
                vowel -= 1
        return ans
```

## 笔记：

- ‍

# 力扣刷题：[852. 山脉数组的峰顶索引](https://leetcode.cn/problems/peak-index-in-a-mountain-array/)

## 题目

给定一个长度为 `n`​ 的整数 **山脉** 数组 `arr`​ ，其中的值递增到一个 **峰值元素** 然后递减。

返回峰值元素的下标。

你必须设计并实现时间复杂度为 `O(log(n))` 的解决方案。

## 代码块

### 解法1

```python
class Solution:
    def peakIndexInMountainArray(self, arr: List[int]) -> int:
        n = len(arr)
        left, right = 0, n - 1
        while True:
            pos = (left + right) // 2
            if arr[pos] > arr[pos + 1] and arr[pos] > arr[pos - 1]:
                return pos
            if arr[pos] >= arr[pos - 1]:
                left = pos
            elif arr[pos] > arr[pos + 1]:
                right = pos
```

### 解法2-灵茶山艾府

```python
class Solution:
    def peakIndexInMountainArray(self, arr: List[int]) -> int:
        left, right = 0, len(arr) - 2
        while left + 1 < right:
            mid = (left + right) // 2
            if arr[mid] > arr[mid + 1]:
                right = mid
            else:
                left = mid
        return right
```

## 笔记：

- ‍

# 力扣刷题：[643. 子数组最大平均数 I](https://leetcode.cn/problems/maximum-average-subarray-i/)

## 题目

给你一个由 `n`​ 个元素组成的整数数组 `nums`​ 和一个整数 `k` 。

请你找出平均数最大且 **长度为**  **​`k`​** 的连续子数组，并输出该最大平均数。

任何误差小于 `10E-5` 的答案都将被视为正确答案。

## 代码块

### 解法1

```python
class Solution:
    def findMaxAverage(self, nums: List[int], k: int) -> float:
        max_sum = -inf
        window_sum = 0
        for right, num in enumerate(nums):
            window_sum += num

            left = right - k + 1
            if left < 0:
                continue
            max_sum = max(max_sum, window_sum)
            window_sum -= nums[left]
        return max_sum/k
```

### 解法2-灵茶山艾府

```python
class Solution:
    def findMaxAverage(self, nums: List[int], k: int) -> float:
        max_s = -inf  # 窗口元素和的最大值
        s = 0  # 维护窗口元素和
        for i, x in enumerate(nums):
            # 1. 进入窗口
            s += x
            if i < k - 1:  # 窗口大小不足 k
                continue
            # 2. 更新答案
            max_s = max(max_s, s)
            # 3. 离开窗口
            s -= nums[i - k + 1]
        return max_s / k
```

## 笔记：

- ‍

‍

[「新」动计划 · 编程入门 - 学习计划 - 力扣（LeetCode）全球极客挚爱的技术成长平台](https://leetcode.cn/studyplan/primers-list/)

这里面的全部题目已完成提交，大部分由于过于简单所以不做笔记与记录。

但需要计算刷题量时，需把这个题单里的题与题号记录下来。

‍

<section class="siyuan-references" aria-label="文档引用">

## 文档关系

### 反向引用
- [daily note](/siyuan/daily-note/)
- [学习笔记](/siyuan/)

</section>
