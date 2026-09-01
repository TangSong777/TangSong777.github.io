---
title: '2026-08-17'
date: '2026-08-17T08:43:45+08:00'
updated: '2026-08-18T10:26:47+08:00'
layout: page
type: siyuan-note
notebook: '学习笔记'
permalink: 'siyuan/daily-note/2026/08/2026-08-17/'
siyuan_source: 'daily note/2026/08/2026-08-17.md'
comments: false
categories:
  - '学习笔记'
  - 'daily note'
  - '2026'
  - '08'
---

# 力扣刷题：[27. 移除元素](https://leetcode.cn/problems/remove-element/)

## 题目

给你一个数组 `nums`​  和一个值 `val`​，你需要 **[原地](https://baike.baidu.com/item/%E5%8E%9F%E5%9C%B0%E7%AE%97%E6%B3%95)** 移除所有数值等于 `val`​  的元素。元素的顺序可能发生改变。然后返回 `nums`​ 中与 `val` 不同的元素的数量。

假设 `nums`​ 中不等于 `val`​ 的元素数量为 `k`，要通过此题，您需要执行以下操作：

- 更改 `nums`​ 数组，使 `nums`​ 的前 `k`​ 个元素包含不等于 `val`​ 的元素。`nums`​ 的其余元素和 `nums` 的大小并不重要。
- 返回 `k`。

## 代码块

### 解法1

<span id="20260817085314-aoiparb" class="siyuan-block-anchor" aria-hidden="true"></span>```python
class Solution:
    def removeElement(self, nums: List[int], val: int) -> int:
        stackSize = 0

        for num in nums:
            if num != val:
                nums[stackSize] = num
                stackSize += 1 
        return stackSize
# 想象nums为一个栈，把不等于val的值入栈，最后返回栈的大小，单指针可解
```

### 解法2

```python

```

## 笔记：

- ‍

# 力扣刷题：[26. 删除有序数组中的重复项](https://leetcode.cn/problems/remove-duplicates-from-sorted-array/)

## 题目

给你一个 **非严格递增排列** 的数组 `nums`​ ，请你  **[原地](http://baike.baidu.com/item/%E5%8E%9F%E5%9C%B0%E7%AE%97%E6%B3%95)** 删除重复出现的元素，使每个元素 **只出现一次** ，返回删除后数组的新长度。元素的 **相对顺序** 应该保持 **一致** 。然后返回 `nums` 中唯一元素的个数。

考虑 `nums`​ 的唯一元素的数量为 `k`​。去重后，返回唯一元素的数量 `k`。

`nums`​ 的前 `k`​ 个元素应包含 **排序后** 的唯一数字。下标 `k - 1` 之后的剩余元素可以忽略。

## 代码块

### 解法1

<span id="20260817091521-6b9q8b8" class="siyuan-block-anchor" aria-hidden="true"></span>```python
class Solution:
    def removeDuplicates(self, nums: List[int]) -> int:
        hashtable = [False for _ in range(202)]
        stackSize = 0
        for i, num in enumerate(nums):
            if hashtable[num] == False:
                hashtable[num] = True
                nums[stackSize] = num
                stackSize += 1
        return stackSize
# 仿造上一题的栈的思想，加上哈希表的思想
# 本解法未注意到数组nums为非严格递增排列
```

### 解法2

<span id="20260817091521-f1el73g" style="display: none;"></span>```python
class Solution:
    def removeDuplicates(self, nums: List[int]) -> int:
        samenum = nums[0]
        m = len(nums)
        stackSize = 1
        for i in range(1,m):
            if nums[i] != samenum:
                samenum = nums[i]
                nums[stackSize] = samenum
                stackSize += 1
        return stackSize
# 该解法有考虑到数组nums为非严格递增排列，直接去寻找samenum即可
```

## 笔记：

- ‍

# 力扣刷题：[36. 有效的数独](https://leetcode.cn/problems/valid-sudoku/)

## 题目

请你判断一个 `9 x 9`​ 的数独是否有效。只需要  **根据以下规则** ，验证已经填入的数字是否有效即可。

1. 数字 `1-9` 在每一行只能出现一次。
2. 数字 `1-9` 在每一列只能出现一次。
3. 数字 `1-9`​ 在每一个以粗实线分隔的 `3x3` 宫内只能出现一次。（请参考示例图）

## 代码块

### 解法1

<span id="20260817093205-37keqcl" class="siyuan-block-anchor" aria-hidden="true"></span>```python
class Solution:
    def isValidSudoku(self, board: List[List[str]]) -> bool:
        rowHash = [[False] * 9 for _ in range(9)]
        colHash = [[False] * 9 for _ in range(9)]
        subHash = [[[False] * 9 for _ in range(3)] for _ in range(3)]
        for i, row in enumerate(board):
            for j, num in enumerate(row):
                if num == '.':
                    continue
                x = int(num) - 1
                if rowHash[i][x] or colHash[j][x] or subHash[i//3][j//3][x]:
                    return False
                rowHash[i][x] = colHash[j][x] = subHash[i // 3][j // 3][x] = True
        return True
```

## 笔记：

- ‍

# 力扣刷题：[48. 旋转图像](https://leetcode.cn/problems/rotate-image/)

## 题目

给定一个 ​*n* ​× *n* 的二维矩阵 `matrix` 表示一个图像。请你将图像顺时针旋转 90 度。

你必须在  **[原地](https://baike.baidu.com/item/%E5%8E%9F%E5%9C%B0%E7%AE%97%E6%B3%95)** 旋转图像，这意味着你需要直接修改输入的二维矩阵。**请不要**   使用另一个矩阵来旋转图像。

## 代码块

### 解法1

<span id="20260817101750-s5pmwzn" style="display: none;"></span>```python
class Solution:
    def rotate(self, matrix: List[List[int]]) -> None:
        """
        Do not return anything, modify matrix in-place instead.
        """
        n = len(matrix[0])
        tmp = [[0] * n for _ in range(n)]

        for i in range(n):
            for j in range(n):
                tmp[j][n - 1 -i] = matrix[i][j]
        for i in range(n):
            for j in range(n):
                matrix[i][j] = tmp[i][j]
# 使用了额外的空间，利用临时的数组tmp来存储经过旋转后的图像数据、
# 再把tmp里的数据覆写回原矩阵
```

### 解法2

<span id="20260817101750-qcp9exh" class="siyuan-block-anchor" aria-hidden="true"></span>```python
class Solution:
    def rotate(self, matrix: List[List[int]]) -> None:
        n = len(matrix)
        for i in range(n // 2):
            for j in range((n + 1) // 2):
                tmp = matrix[i][j]
                matrix[i][j] = matrix[n - 1 - j][i]
                matrix[n - 1 - j][i] = matrix[n - 1 - i][n - 1 - j]
                matrix[n - 1 - i][n - 1 - j] = matrix[j][n - 1 - i]
                matrix[j][n - 1 - i] = tmp
```

## 笔记：

- ‍

# 力扣刷题：[3. 无重复字符的最长子串](https://leetcode.cn/problems/longest-substring-without-repeating-characters/)

## 题目

给定一个字符串 `s`​ ，请你找出其中不含有重复字符的 **最长**  **子串**  的长度。

## 代码块

### 解法1

<span id="20260817112000-e4whdit" style="display: none;"></span>```python
class Solution:
    def lengthOfLongestSubstring(self, s: str) -> int:
        dic, res, i = {}, 0, -1
        for j in range(len(s)):
            if s[j] in dic:
                i = max(dic[s[j]], i) # 更新左指针 i
            dic[s[j]] = j # 哈希表记录
            res = max(res, j - i) # 更新结果
        return res
```

### 解法2

```python
class Solution:
    def lengthOfLongestSubstring(self, s: str) -> int:
        ans = left = 0
        cnt = defaultdict(int)  # 维护从下标 left 到下标 right 的字符及其出现次数
        for right, c in enumerate(s):
            cnt[c] += 1
            while cnt[c] > 1:  # 窗口内有重复字母
                cnt[s[left]] -= 1  # 移除窗口左端点字母
                left += 1  # 缩小窗口
            ans = max(ans, right - left + 1)  # 更新窗口长度最大值
        return ans
```

## 笔记：

- ‍

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
