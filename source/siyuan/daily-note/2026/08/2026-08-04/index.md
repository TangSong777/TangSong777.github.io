---
title: '2026-08-04'
date: '2026-08-04T00:17:25+08:00'
updated: '2026-08-06T02:18:47+08:00'
layout: page
type: siyuan-note
notebook: '学习笔记'
permalink: 'siyuan/daily-note/2026/08/2026-08-04/'
siyuan_source: 'daily note/2026/08/2026-08-04.md'
comments: false
categories:
  - '学习笔记'
  - 'daily note'
  - '2026'
  - '08'
---

# <span id="20260804001819-jo9ybpr" class="siyuan-block-anchor" aria-hidden="true"></span>力扣刷题：[283. 移动零](https://leetcode.cn/problems/move-zeroes/)

## 题目

给定一个数组 nums，编写一个函数将所有 0 移动到数组的末尾，同时保持非零元素的相对顺序。  
  
请注意 ，必须在不复制数组的情况下原地对数组进行操作。

## 代码块

### 解法1-列表方法删除/添加

```python
class Solution:
    def moveZeroes(self, nums: List[int]) -> None:
        for i in nums:
            if i == 0:
                nums.remove(i)
                nums.append(0)
# 直接利用列表的方法删除值为0的元素并在末尾添加元素0
```

### 解法2-双指针交换法

```python
class Solution:
    def moveZeroes(self, nums: List[int]) -> None:
        n = len(nums)
        left = right = 0
        while right < n:
            if nums[right] != 0:
                nums[left], nums[right] = nums[right], nums[left]
                left += 1
            right += 1
# 构建双指针，对于nums = [0,1,0,3,12]，其列表和left和right变化如下
# nums left right
# [0,1,0,3,12] 0 0
# [0,1,0,3,12] 0 1
# [1,0,0,3,12] 1 2
# [1,0,0,3,12] 1 3
# [1,3,0,0,12] 2 4
# [1,3,12,0,0] 3 5
```

### 解法3-计数0交换法

```python
class Solution:
    def moveZeroes(self, nums: List[int]) -> None:
        cnt = 0
        for i in range(len(nums)):
            if nums[i] != 0:
                nums[i], nums[i - cnt] = nums[i - cnt], nums[i]
            else:
                cnt += 1
# 对0进行计数，注意到非零数的最终下标等于原下标减去其前面的零的数量，直接交换即可
```

## 笔记：

无

# <span id="20260804005704-2ik1uo6" class="siyuan-block-anchor" aria-hidden="true"></span>力扣刷题：[66. 加一](https://leetcode.cn/problems/plus-one/)

## 题目

给定一个表示 大整数 的整数数组 digits，其中 digits[i] 是整数的第 i 位数字。这些数字按从左到右，从最高位到最低位排列。这个大整数不包含任何前导 0。

将大整数加 1，并返回结果的数字数组。

## 代码块

### 解法1-从后向前遍历

```python
class Solution:
    def plusOne(self, digits: List[int]) -> List[int]:
        n = len(digits)
        for i in range(n):
            if digits[n - i - 1] == 9:
                digits[n - i - 1] = 0
                if n - i - 1 == 0:
                    digits.insert(0, 1)
                else:
                    continue
            else:
                digits[n - i - 1] += 1
                break
        return digits
# 从后向前开始遍历
# 如果遍历到非9，则让其+1，break结束。
# 如果遍历到9，则赋值为0，继续向前遍历。
# 如果遍历到index = 0的位置依然是9，则赋值0并insert 1

# 一个更好的写法：
"""
class Solution:
    def plusOne(self, digits: List[int]) -> List[int]:
        for i in range(len(digits) - 1, -1, -1):
            if digits[i] < 9:
                digits[i] += 1  # 进位
                return digits
            digits[i] = 0  # 进位数字的右边数字都变成 0

        # digits 全是 9，加一后变成 100...00
        return [1] + digits
"""
# 原理相同，但for循环利用语言特性更加优雅
# 从最后一个下标开始，到-1结束（不包括-1，到0结束），步长为-1
```

## 笔记：

```python
for i in range(len(digits) - 1, -1, -1):
# python中经典的从后向前遍历的写法
```

# <span id="20260804010415-4sn040n" class="siyuan-block-anchor" aria-hidden="true"></span>力扣刷题：[1822. 数组元素积的符号](https://leetcode.cn/problems/sign-of-the-product-of-an-array/)

## 题目

- 如果 x 是正数，返回 1 。
- 如果 x 是负数，返回 -1 。
- 如果 x 是等于 0 ，返回 0 。

给你一个整数数组 nums 。令 product 为数组 nums 中所有元素值的乘积。

返回 signFunc(product) 。

已知函数 signFunc(x) 将会根据 x 的正负返回特定值：

## 代码块

### 解法1-硬算

```python
class Solution:
    def arraySign(self, nums: List[int]) -> int:
        ans = 1
        if 0 in nums:
            return 0
        else:
            for i in range(len(nums)):
                ans *= nums[i]
            else:
                if ans > 0:
                    return 1
                else:
                    return -1
```

### 解法2-遇到负数就变符号

```python
class Solution:
    def arraySign(self, nums: List[int]) -> int:
        sign = 1
        for num in nums:
            if num == 0:
                return 0
            if num < 0:
                sign = -sign
        return sign
# 本质为对负数计数再判断其奇偶的优化方法
```

## 笔记：

无

# <span id="20260804012834-tir5j6a" class="siyuan-block-anchor" aria-hidden="true"></span>力扣刷题：[1502. 判断能否形成等差数列](https://leetcode.cn/problems/can-make-arithmetic-progression-from-sequence/)

## 题目

给你一个数字数组 arr 。  
  
如果一个数列中，任意相邻两项的差总等于同一个常数，那么这个数列就称为 等差数列 。  
  
如果可以重新排列数组形成等差数列，请返回 true ；否则，返回 false 。

## 代码块

### 解法1-下标乘以步长来判断，排序占大头

```python
class Solution:
    def canMakeArithmeticProgression(self, arr: List[int]) -> bool:
        arr.sort()
        for i in range(len(arr)):
            if arr[0] + i * (arr[1] - arr[0]) != arr[i]:
                return False
        return True
```

### 解法2-哈希表

```python
class Solution:
    def canMakeArithmeticProgression(self, arr: List[int]) -> bool:
        mn, mx = min(arr), max(arr)
        if mn == mx:  # 特殊情况：公差为 0 的等差数列
            return True

        n = len(arr)
        d, r = divmod(mx - mn, n - 1)
        if r:  # 公差 d 必须是整数
            return False

        has = [False] * n
        for x in arr:
            k, r = divmod(x - mn, d)
            if r or has[k]:  # k 不是整数或者之前遇到过
                return False
            has[k] = True
        return True
# 先利用max()和min()函数获取混乱列表里的最大值和最小值，求得公差
# 考虑特殊情况公差为0，则直接返回
# 第八行：d, r = divmod(mx - mn, n - 1)，若d为整数，r为Ture
# 创建一个hash表，长度为列表长度
# 遍历arr中的num，将其减去mn并除以公差，若不是整数则直接返回False；若其为整数且之前未出现，置哈希表对应的整数下标的值为True，反之返回False
# 哈希表用于校验对应下标的数-即mn + d * i是否存在且只存在一个
```

## <span id="20260804012834-t4osqfs" class="siyuan-block-anchor" aria-hidden="true"></span>笔记：

```python
d, r = divmod(mx - mn, n - 1)
# a ,b = divmod(c, d)函数，其中a = c // d，b = c % d
```

[divmod - lambda](/siyuan/daily-note/2026/08/2026-08-06/#20260806015419-cl0dzyx)

# <span id="20260804014945-lis7t7x" class="siyuan-block-anchor" aria-hidden="true"></span>力扣刷题：[896. 单调数列](https://leetcode.cn/problems/monotonic-array/)

## 题目

如果数组是单调递增或单调递减的，那么它是 单调 的。  
  
如果对于所有 i <= j，nums[i] <= nums[j]，那么数组 nums 是单调递增的。 如果对于所有 i <= j，nums[i] >= nums[j]，那么数组 nums 是单调递减的。  
  
当给定的数组 nums 是单调数组时返回 true，否则返回 false。

## 代码块

### 解法1-二次遍历

```python
class Solution:
    def isMonotonic(self, nums: List[int]) -> bool:
        isUp = True
        for i in range(1,len(nums)):
            if nums[i] == nums[i - 1]:
                continue
            elif nums[i] > nums[i - 1]:
                break
            else:
                isUp = False
                break
        else:
            return True
        for i in range(1,len(nums)):
            if isUp:
                if nums[i] < nums[i - 1]:
                    return False
            else:
                if nums[i] > nums[i - 1]:
                    return False
        return True
# 两次遍历数组，第一次遍历判断其为单调递增/单调递减/恒定不变，前二者会影响isUp的值，第三者会直接返回True
# 若为前二者，再次遍历数组，确定所有元素都为单调递增/单调递减/非单调后，返回True/False
```

### 解法2-一次遍历

```python
class Solution:
    def isMonotonic(self, nums: List[int]) -> bool:
        inc, dec = True, True
        n = len(nums)
        for i in range(n - 1):
            if nums[i] > nums[i + 1]:
                inc = False
            if nums[i] < nums[i + 1]:
                dec = False
        return inc or dec
# 虽然我不知道为什么，使用力扣的环境跑示例，这个算法会慢一点
```

## 笔记：

无

# <span id="20260804021053-hozcd1u" class="siyuan-block-anchor" aria-hidden="true"></span>力扣刷题：[13. 罗马数字转整数](https://leetcode.cn/problems/roman-to-integer/)

## 题目

罗马数字包含以下七种字符: I， V， X， L，C，D 和 M。  
  
字符          数值  
I             1  
V             5  
X             10  
L             50  
C             100  
D             500  
M             1000  
例如， 罗马数字 2 写做 II ，即为两个并列的 1 。12 写做 XII ，即为 X + II 。 27 写做  XXVII, 即为 XX + V + II 。  
  
通常情况下，罗马数字中小的数字在大的数字的右边。但也存在特例，例如 4 不写做 IIII，而是 IV。数字 1 在数字 5 的左边，所表示的数等于大数 5 减小数 1 得到的数值 4 。同样地，数字 9 表示为 IX。这个特殊的规则只适用于以下六种情况：  
  
I 可以放在 V (5) 和 X (10) 的左边，来表示 4 和 9。  
X 可以放在 L (50) 和 C (100) 的左边，来表示 40 和 90。   
C 可以放在 D (500) 和 M (1000) 的左边，来表示 400 和 900。  
给定一个罗马数字，将其转换成整数。

## 代码块

### 解法1-两次遍历找特殊情况

```python
class Solution:
    def romanToInt(self, s: str) -> int:
        ans = 0
        hash = [0]*5
        n = len(s)
        for i in range(n):
            if s[i] == 'M':
                ans += 1000
            elif s[i] == 'D':
                ans += 500
            elif s[i] == 'C':
                ans += 100
            elif s[i] == 'L':
                ans += 50
            elif s[i] == 'X':
                ans += 10
            elif s[i] == 'V':
                ans += 5
            elif s[i] == 'I':
                ans += 1
        for i in range(n - 1):
            special_s = s[i] + s[i + 1]
            if special_s == "IV" or special_s == "IX":
                ans -= 2
            elif special_s == "XL" or special_s == "XC":
                ans -= 20
            elif special_s == "CD" or special_s == "CM":
                ans -= 200
        return ans
# 本质查表，遇到某个字符就自增对应的值，遇到特殊组合情况就减去补偿值，补偿值 = 原字母代表值的和 - 特殊组合代表值
# 例如：IV的补偿值 = I + V - IV = 1 + 5 - 4 = 2
# 例如：XL的补偿值 = X + L - XL = 10 + 50 - 40 = 20
# 例如：CD的补偿值 = C + D - CD = 100 + 500 - 400 = 200
```

### 解法2-分析前后变符号

```python
class Solution:

    SYMBOL_VALUES = {
        'I': 1,
        'V': 5,
        'X': 10,
        'L': 50,
        'C': 100,
        'D': 500,
        'M': 1000,
    }

    def romanToInt(self, s: str) -> int:
        ans = 0
        n = len(s)
        for i, ch in enumerate(s):
            value = Solution.SYMBOL_VALUES[ch]
            if i < n - 1 and value < Solution.SYMBOL_VALUES[s[i + 1]]:
                ans -= value
            else:
                ans += value
        return ans
# 意识到IV = -I + V，当大数字在小数字后面时，小数字需取反
```

## <span id="20260804021053-xo7mpqa" class="siyuan-block-anchor" aria-hidden="true"></span>笔记：

```python
for i, ch in enumerate(s):
# 同时获取字符串s的下标及其对应值
```

‍

[enumerate](/siyuan/daily-note/2026/08/2026-08-05/#20260805215546-0l0l4vl)

# <span id="20260804102143-3fz8wth" class="siyuan-block-anchor" aria-hidden="true"></span>力扣刷题：[58. 最后一个单词的长度](https://leetcode.cn/problems/length-of-last-word/)

## 题目

给你一个字符串 s，由若干单词组成，单词前后用一些空格字符隔开。返回字符串中 最后一个 单词的长度。

单词 是指仅由字母组成、不包含任何空格字符的最大子字符串。

子字符串：**子字符串** 是字符串中连续的 **非空** 字符序列。

## 代码块

### 解法1-反向遍历

```python
class Solution:
    def lengthOfLastWord(self, s: str) -> int:
        cnt = 0
        for i in range(len(s) - 1, -1 , -1):
            if s[i] == ' ' and cnt == 0:
                continue
            elif s[i] != ' ':
                cnt += 1
            else:
                break
        return cnt
```

## 笔记：

无

# <span id="20260804104306-ch0mjb0" class="siyuan-block-anchor" aria-hidden="true"></span>力扣刷题：[709. 转换成小写字母](https://leetcode.cn/problems/to-lower-case/)

## 题目

给你一个字符串 s ，将该字符串中的大写字母转换成相同的小写字母，返回新的字符串。

## 代码块

### 解法1

```python
class Solution:
    def toLowerCase(self, s: str) -> str:
        ans = ""
        a = ord('A') - ord('a')
        for i in range(len(s)):
            if ord(s[i]) >= ord('A') and ord(s[i]) <= ord('Z'):
                ans += chr(ord(s[i]) - a)
            else:
                ans += s[i]
        return ans

```

## 笔记：

无

# <span id="20260804104415-di66u4f" class="siyuan-block-anchor" aria-hidden="true"></span>力扣刷题：[682. 棒球比赛](https://leetcode.cn/problems/baseball-game/)

## 题目

你现在是一场采用特殊赛制棒球比赛的记录员。这场比赛由若干回合组成，过去几回合的得分可能会影响以后几回合的得分。  
  
比赛开始时，记录是空白的。你会得到一个记录操作的字符串列表 ops，其中 ops[i] 是你需要记录的第 i 项操作，ops 遵循下述规则：  
  
整数 x - 表示本回合新获得分数 x  
"+" - 表示本回合新获得的得分是前两次得分的总和。题目数据保证记录此操作时前面总是存在两个有效的分数。  
"D" - 表示本回合新获得的得分是前一次得分的两倍。题目数据保证记录此操作时前面总是存在一个有效的分数。  
"C" - 表示前一次得分无效，将其从记录中移除。题目数据保证记录此操作时前面总是存在一个有效的分数。  
请你返回记录中所有得分的总和。

## 代码块

### 解法1

```python
class Solution:
    def calPoints(self, operations: List[str]) -> int:
        points = []
        ans = 0
        for op in operations:
            if op == "C":
                points.pop()
            elif op == "D":
                points.append(2 * points[len(points) - 1])
            elif op == "+":
                points.append(points[len(points) - 1] + points[len(points) - 2])
            else:
                points.append(int(op))
        for i in points:
            ans += i
        return ans
```

## 笔记

```python
points.append(points[len(points) - 1] + points[len(points) - 2])
# 列表的负数下标表示从「列表末尾」往前数

# 示例：points = [10, 20, 30, 40]
# points[-1] == 40
# points[-2] == 30
```

# <span id="20260804220405-cpfadhw" class="siyuan-block-anchor" aria-hidden="true"></span>力扣刷题：[657. 机器人能否返回原点](https://leetcode.cn/problems/robot-return-to-origin/)

## 题目

在二维平面上，有一个机器人从原点 (0, 0) 开始。给出它的移动顺序，判断这个机器人在完成移动后是否在 (0, 0) 处结束。  
  
移动顺序由字符串 moves 表示。字符 move[i] 表示其第 i 次移动。机器人的有效动作有 R（右），L（左），U（上）和 D（下）。  
  
如果机器人在完成所有动作后返回原点，则返回 true。否则，返回 false。  
  
注意：机器人“面朝”的方向无关紧要。 “R” 将始终使机器人向右移动一次，“L” 将始终向左移动等。此外，假设每次移动机器人的移动幅度相同。

## 代码块

### 解法1

```python
class Solution:
    def judgeCircle(self, moves: str) -> bool:
        position_x, position_y= 0, 0
        for ch in moves:
            if ch == 'R':
                position_x += 1
            elif ch == 'L':
                position_x -= 1
            elif ch == 'U':
                position_y += 1
            elif ch == 'D':
                position_y -= 1
        if position_x == 0 and position_y == 0:
            return True
        else:
            return False
```

## 笔记：

无

# <span id="20260804220931-8j8ai9h" class="siyuan-block-anchor" aria-hidden="true"></span>力扣刷题：[1275. 找出井字棋的获胜者](https://leetcode.cn/problems/find-winner-on-a-tic-tac-toe-game/)

## 题目

井字棋 是由两个玩家 A 和 B 在 3 x 3 的棋盘上进行的游戏。井字棋游戏的规则如下：  
  
玩家轮流将棋子放在空方格 (' ') 上。  
第一个玩家 A 总是用 'X' 作为棋子，而第二个玩家 B 总是用 'O' 作为棋子。  
'X' 和 'O' 只能放在空方格中，而不能放在已经被占用的方格上。  
只要有 3 个相同的（非空）棋子排成一条直线（行、列、对角线）时，游戏结束。  
如果所有方块都放满棋子（不为空），游戏也会结束。  
游戏结束后，棋子无法再进行任何移动。  
给你一个数组 moves，其中 moves[i] = [rowi, coli] 表示第 i 次移动在 grid[rowi][coli]。如果游戏存在获胜者（A 或 B），就返回该游戏的获胜者；如果游戏以平局结束，则返回 "Draw"；如果仍会有行动（游戏未结束），则返回 "Pending"。  
  
你可以假设 moves 都 有效（遵循 井字棋 规则），网格最初是空的，A 将先行动。

## 代码块

### 解法1-构造棋盘

```python
class Solution:
    def tictactoe(self, moves: List[List[int]]) -> str:
        ls = [[' ' for _ in range(3)] for _ in range(3)]     #创建一个3*3的棋盘
"""
[
 [' ', ' ', ' '],
 [' ', ' ', ' '],
 [' ', ' ', ' ']
]
"""
        n = len(moves)
        for i in range(n):
            row , col = moves[i]    #得到棋子下的位置
            if i % 2 == 0:      #玩家A
                ls[row][col] = 'X'
            else:
                ls[row][col] = 'O'
            

        for i in range(3): #判断行的情况
            if ls[i][0] == ls[i][1] == ls[i][2] and ls[i][0] != ' ':
                    return 'A' if ls[i][0] == 'X' else 'B'
        for j in range(3): #判断列的情况
            if ls[0][j] == ls[1][j] == ls[2][j] and ls[0][j] != ' ':
                return 'A' if ls[0][j] == 'X' else 'B'
        if ls[0][0] == ls[1][1] == ls[2][2] and ls[1][1] != ' ': #判断主对角线
            return 'A' if ls[1][1] == 'X' else 'B'
        if ls[0][2] == ls[1][1] == ls[2][0] and ls[1][1] != ' ': #判断副对角线
            return 'A' if ls[1][1] == 'X' else 'B'
            
        if n == 9:      #判断棋盘是否铺满
            return 'Draw'
        else:
            return 'Pending'
# 通过for循环获得每个棋子的位置，再分别判断全部行、全部列、主对角线、副对角线的情况就能解决了，注意最后判断'Draw'和'Pending'的情况
```

## 笔记：

```python
ls = [[' ' for _ in range(3)] for _ in range(3)]
# 嵌套列表推导式

# 内层：[' ' for _ in range(3)]
# 含义：生成一个长度为 3 的列表，每个元素都是 ' '

# 外层：[... for _ in range(3)]
# 把上面的列表 复制 3 份，作为外层列表的元素

"""
结果：
[
 [' ', ' ', ' '],
 [' ', ' ', ' '],
 [' ', ' ', ' ']
]
"""
```

```python
return True if a == b else False
# if else的奇妙小用法
# python的三元表达式：可以为 a if A else b的形式来返回值。如果A为真，返回a，反之返回b
# 类似于C语言的A ? a : b。如果A为真，返回a，反之返回b
```

# <span id="20260804231935-7jba0tm" class="siyuan-block-anchor" aria-hidden="true"></span>力扣刷题：[1041. 困于环中的机器人](https://leetcode.cn/problems/robot-bounded-in-circle/)

## 题目

在无限的平面上，机器人最初位于 (0, 0) 处，面朝北方。注意:  
  
北方向 是y轴的正方向。  
南方向 是y轴的负方向。  
东方向 是x轴的正方向。  
西方向 是x轴的负方向。  
机器人可以接受下列三条指令之一：  
  
"G"：直走 1 个单位  
"L"：左转 90 度  
"R"：右转 90 度  
机器人按顺序执行指令 instructions，并一直重复它们。  
  
只有在平面中存在环使得机器人永远无法离开时，返回 true。否则，返回 false。

## 代码块

### 解法1-模拟坐标系

```python
class Solution:
    def isRobotBounded(self, instructions: str) -> bool:
        position_x, position_y = 0, 0
        direction = 1
        for i in range(4):
            for ins in instructions:
                if ins == 'G':
                    if direction == 0:
                        position_x += 1
                    elif direction == 1:
                        position_y += 1
                    elif direction == 2:
                        position_x -= 1
                    elif direction == 3:
                        position_y -= 1
                elif ins == 'L':
                    direction += 1
                elif ins == 'R':
                    direction += 3
                direction %= 4
            if direction == 1:
                break
        return True if position_x == position_y == 0 else False
# 采用模拟的思路，一步步的完成多次完整的instructions
# 在direction重新为朝向北方的时候判断位置是否改变，如果改变则return True，反之return False
```

### 解法2-复数坐标系

```python
class Solution:
    def isRobotBounded(self, instructions: str) -> bool:
        z = 0j
        d = 1j  # 初始朝北
        for c in instructions:
            if c == 'G':
                z += d
            elif c == 'L':
                d *= 1j
            else:
                d *= -1j
        return d != 1j or z == 0j
# 本质与上述一致，但是使用复数更加简洁和美观
```

## 笔记：

```python
a = 0 + 0j
# 构建一个复数，常用于矩阵坐标系

a *= 1j
# 用于旋转方向，将a逆时针旋转90度
a *= -1j
# 用于旋转方向，将a顺时针旋转90度
```

‍

<section class="siyuan-references" aria-label="文档引用">

## 文档关系

### 本文引用
- [2026-08-05](/siyuan/daily-note/2026/08/2026-08-05/)
- [2026-08-06](/siyuan/daily-note/2026/08/2026-08-06/)

### 反向引用
- [2026-08-05](/siyuan/daily-note/2026/08/2026-08-05/)
- [2026-08-06](/siyuan/daily-note/2026/08/2026-08-06/)
- [daily note](/siyuan/daily-note/)
- [类型索引](/siyuan/力扣刷题/类型索引/)
- [时间线索引](/siyuan/力扣刷题/时间线索引/)
- [算法专项](/siyuan/Python笔记/算法专项/)
- [学习笔记](/siyuan/)

</section>
