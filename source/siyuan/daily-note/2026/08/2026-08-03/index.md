---
title: '2026-08-03'
date: '2026-08-03T13:38:14+08:00'
updated: '2026-08-06T00:32:20+08:00'
layout: page
type: siyuan-note
notebook: '学习笔记'
permalink: 'siyuan/daily-note/2026/08/2026-08-03/'
siyuan_source: 'daily note/2026/08/2026-08-03.md'
comments: false
categories:
  - '学习笔记'
  - 'daily note'
  - '2026'
  - '08'
---

# <span id="20260803133815-px3p5o5" class="siyuan-block-anchor" aria-hidden="true"></span>力扣刷题：[1768. 交替合并字符串](https://leetcode.cn/problems/merge-strings-alternately/)

## 题目

给你两个字符串 `word1`​ 和 `word2`​。请你从 `word1` 开始，通过交替添加字母来合并字符串。如果一个字符串比另一个字符串长，就将多出来的字母追加到合并后字符串的末尾。

返回 **合并后的字符串**。

## 代码块

### 解法1

```python
class Solution:
    def mergeAlternately(self, word1: str, word2: str) -> str:
        ans = []
        m, n = len(word1), len(word2)
        for i in range(min(m,n)):
            ans.append(word1[i])
            ans.append(word2[i])
        if m >= n:
            ans.extend(word1[n:])
        else:
            ans.extend(word2[m:])
        return "".join(ans)
"""
先创建两个整型变量用于存储字符串的长度
后循环其中较小的数的次数，依次添加字符进列表
相同长度的字符串添加后，进行条件判断，添加剩余的未被添加的字符
"""
```

## 笔记：

```python
ans.append(word1[i])
# 在列表里直接添加一个元素，哪怕是一个新列表也是作为一个元素被添加进去
ans.extend(word2[m:])
# 直接将一个列表拆包并把元素一个个添加入列表中
```

# <span id="20260803150716-c5aflmi" class="siyuan-block-anchor" aria-hidden="true"></span>力扣刷题：[389. 找不同](https://leetcode.cn/problems/find-the-difference/)

## 题目

给定两个字符串 `s`​ 和 `t`，它们只包含小写字母。

字符串 `t`​ 由字符串 `s` 随机重排，然后在随机位置添加一个字母。

请找出在 `t` 中被添加的字母。

## 代码块

### 解法1-异或法

```python
class Solution:
    def findTheDifference(self, s: str, t: str) -> str:
        ans = 0
        for i in s:
            ans ^= ord(i)
        for i in t:
            ans ^= ord(i)
        return chr(ans)
# 由于s与t字符串只差了一个字符，可以使用异或运算将所有相同的字符串抵消，最终剩下的那个就是多出的字符
```

### 解法2-单字符Count()查不同

```python
class Solution:
    def findTheDifference(self, s: str, t: str) -> str:
        for c in t:
            if t.count(c) != s.count(c):
                return c
# 使用count来统计字符串中含有对应字符的数量，如果不一致，则为多出的字符
```

### 解法3-哈希表

```python
class Solution:
    def findTheDifference(self, s: str, t: str) -> str:
        cnt = [0] * 26
        for ch in s:
            cnt[ord(ch) - 97] += 1
        for ch in t:
            idx = ord(ch) - 97
            cnt[idx] -= 1
            if cnt[idx] < 0:
                return ch
# 认识到小写英文字符只有26个，创建包含26个空列表的列表cnt
# 循环s中的字符ch，对其计数。注意这里使用ord(ch) - 97的方法写下标赋值
# 循环t中的字符ch，出现一次就对cnt中对应的值-1，第一次出现负数所对应的下标即为新增字符
```

## 笔记：

- |**转换方向**|**函数**|
  | --------------------| ------|
  |字符 → 整数|`ord(c)`|
  |整数 → 字符|`chr(n)`|
  |字符 → 字节|`"x".encode()`|
  |字节 → 字符|`b"...".decode()`|
  |整数 → 十六进制|`hex()`|
  |整数 → 二进制|`bin()`|
  |字符串数字 → 整数|`int()`|

```python
count_ch1 = string.count(ch)
# count方法作用于字符串类型，返回self中的对应ch的个数
```

# <span id="20260803152556-x3m66fq" class="siyuan-block-anchor" aria-hidden="true"></span>力扣刷题：[28. 找出字符串中第一个匹配项的下标](https://leetcode.cn/problems/find-the-index-of-the-first-occurrence-in-a-string/)

## 题目

给你两个字符串 `haystack`​ 和 `needle`​，请你在 `haystack`​ 字符串中找出 `needle`​ 字符串的第一个匹配项的下标（下标从 0 开始）。如果 `needle`​ 不是 `haystack`​ 的一部分，则返回 `-1`。

## 代码块

### 解法1-枚举法

```python
class Solution:
    def strStr(self, haystack: str, needle: str) -> int:
        m, n = len(haystack), len(needle)
        if m < n:
            return -1
        for i in range(m - n + 1):
            for j in range(n):
                if haystack[i + j] != needle[j]:
                    break
                if j == n - 1:
                    return i
        return -1
# 先去定义两个整型变量用于存储两个字符串的长度
# 开头校验，如果needle字符串的长度大于haystack，则直接返回-1
# 循环读取字符串hatstack下标[0, m - n]
# 嵌套循环从对应下标i处进行条件判断，字符是否一致，若不一致则break，从下一个下标出再次判断
# 若都一致-即从头到最后都没有break出去的话，则包含，返回下标i
# 若查完下标也没发现有包含，则返回-1

#一个更好的写法：
"""
class Solution:
    def strStr(self, haystack: str, needle: str) -> int:
        m, n = len(haystack), len(needle)
        for i in range(m - n + 1):  # 窗口起始位置
            # 截取子串，判断是否与目标子串匹配
            if haystack[i:i + n] == needle:
                return i
        return -1
"""
# 这个写法是直接截取子串来来判断是否与目标子串匹配的
# 巧妙的点在于：	如果m-n+1<=0则直接不发生循环，直接返回-1；如果能发生循环，m-n+1本身已经确定了能够截取n长度的子串
```

## 笔记：

### <span id="20260803155923-lvb2fz3" class="siyuan-block-anchor" aria-hidden="true"></span>KMP算法

**核心思路**：利用已匹配部分的信息，避免重复比较。

观察暴力解法的缺陷：当 haystack \= "abababab"，needle \= "abab" 时：

```
位置 0:  a b a b a b a b
         a b a b ✓
位置 1:  a b a b a b a b  
           a b a b ✗ (a ≠ b)
位置 2:  a b a b a b a b
             a b a b ✓
```

暴力解法在位置 失败后，会从位置 $2$ 重新开始比较。但实际上，我们已经知道：

- 位置 $0$ 匹配成功：haystack[0:4] \= "abab" \= needle
- 位置 $1$ 失败：haystack[1] \= 'b' ≠ needle[0] \= 'a'

**关键洞察**：之前位置的后缀，相当于后面位置的前缀！当 needle 有重复的前缀和后缀时，可以利用已匹配的信息，跳过重复的比较！

对于 needle \= "abab"：

- 前缀："a", "ab", "aba"
- 后缀："b", "ab", "bab"
- 最长公共前后缀："ab"（长度为 $2$）

**KMP算法原理**：

- 1.**预处理阶段**：构建 next 数组，记录 needle 每个位置的最长公共前后缀长度
- 2.**匹配阶段**：当字符不匹配时，利用 next 数组跳过已匹配的部分

其中，next[i] 表示 needle[0:i] 的最长公共前后缀长度。我们使用 **双指针** 技术，i 指向当前字符，j 指向前缀末尾，从而构建出 next 数组。

以 needle \= "abab" 为例：

```python
构建next数组：

i=0: "a" → next[0] = 0
i=1: "ab" → j=0, needle[1]='b' ≠ needle[0]='a'
     不匹配，next[1] = 0
i=2: "aba" → j=0, needle[2]='a' = needle[0]='a'
     匹配，指针后移 j=1，记录 next[2] = 1
i=3: "abab" → j=1, needle[3]='b' = needle[1]='b'
     匹配，指针后移 j=2，记录 next[3] = 2

next = [0, 0, 1, 2]
```

**总结**：预处理出 next 数组，接着使用双指针匹配两字符串。同理，当字符匹配时，两指针同时前进；当字符不匹配时，j 回退到 next[j - 1] 位置。

代码如下，已附加详细注释：

```python
class Solution:
    def strStr(self, haystack: str, needle: str) -> int:
        if not needle:
            return 0
    
        # 构建next数组
        def build_next(pattern):
            n = len(pattern)
            next_arr = [0] * n
            j = 0  # 指向前缀末尾
        
            for i in range(1, n):  # i指向后缀末尾
                # 当字符不匹配时，回退j到前一个匹配位置
                while j > 0 and pattern[i] != pattern[j]:
                    j = next_arr[j - 1]
            
                # 当字符匹配时，j前进
                if pattern[i] == pattern[j]:
                    j += 1
            
                next_arr[i] = j
        
            return next_arr
    
        next_arr = build_next(needle)
        j = 0  # needle的指针
    
        # KMP匹配过程
        for i in range(len(haystack)):
            # 当字符不匹配时，利用next数组回退
            while j > 0 and haystack[i] != needle[j]:
                j = next_arr[j - 1]
        
            # 当字符匹配时，j前进
            if haystack[i] == needle[j]:
                j += 1
        
            # 完全匹配成功
            if j == len(needle):
                return i - j + 1
    
        return -1
```

# <span id="20260803161327-7zw0ozd" class="siyuan-block-anchor" aria-hidden="true"></span>力扣刷题：[242. 有效的字母异位词](https://leetcode.cn/problems/valid-anagram/)

## 题目

给定两个字符串 s 和 t ，编写一个函数来判断 t 是否是 s 的 字母异位词。

## 代码块

### 解法1-单字符Count()查不同

```python
class Solution:
    def isAnagram(self, s: str, t: str) -> bool:
        if len(s) < len(t):
            return False
        for ch in s:
            if s.count(ch) != t.count(ch):
                return False
        return True
# 超级低级的解法，类似于找不同的解法2
```

### 解法2-哈希表

```python
class Solution:
    def isAnagram(self, s: str, t: str) -> bool:
        count = [0] * 26
        for ch in s:
            count[ord(ch) - 97] += 1
        for ch in t:
            count[ord(ch) - 97] -= 1
        for i in range(26):
            if count[i] != 0:
                return False
        return True
# 基于哈希表的解法
# 类似于找不同的解法3
```

## 笔记：

- 哈希表，为列表创造一个计数列表，在本题用于计算所有字母的总个数是否相同

```python
count = [0] * 26
# 哈希表经典写法
```

# <span id="20260803213530-itiqshl" class="siyuan-block-anchor" aria-hidden="true"></span>力扣刷题：[459. 重复的子字符串](https://leetcode.cn/problems/repeated-substring-pattern/)

## 题目

给定一个非空的字符串 s ，检查是否可以通过由它的一个子串重复多次构成。

## 代码块

### 解法1-枚举法

```python
class Solution:
    def repeatedSubstringPattern(self, s: str) -> bool:
        n = len(s)
        for i in range(1, n // 2 + 1):
            if n % i == 0:
                for j in range(i, n):
                    if s[j - i] == s[j]:
                        continue
                    else:
                        break
                else:
                    return True
        return False
# 经典枚举解法
# 首先理解题目，若有重复子串，则下标只需枚举到n // 2 + 1处
# 随后判断此时枚举处长度能被总串长度整除	
# 创建一个用于枚举的变量j，查找i到n的下标位置
# 判断下标j - i的位置的字符是否与下标为j的位置的字符相同
# 若相同则继续查询，若不同则直接退出
# 若循环正常结束没有发生退出，则判定为重复子串
```

### 解法2-字符串匹配

```python
class Solution:
    def repeatedSubstringPattern(self, s: str) -> bool:
        return (s + s).find(s, 1) != len(s)
# 认识到s = t + t + ...
# 构造s' = s + s = t + t + t + t + ...
# 使用find()方法，在index = 1的位置往后找，在某个index位置找到s
# 若满足条件，则此index不可能等于len(s)即添加的第二个s的位置
```

## 笔记：

```python
s1.find(s2, 1)
# find方法作用于字符串，用于寻找s1中的第i个子串s2
```

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
