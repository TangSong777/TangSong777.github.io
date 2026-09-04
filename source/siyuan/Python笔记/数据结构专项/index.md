---
title: '数据结构专项'
date: '2026-08-17T17:32:28+08:00'
updated: '2026-08-18T15:22:33+08:00'
layout: page
type: siyuan-note
notebook: '学习笔记'
permalink: 'siyuan/Python笔记/数据结构专项/'
siyuan_source: 'Python笔记/数据结构专项.md'
comments: false
categories:
  - '学习笔记'
  - 'Python笔记'
---

> Python 四大内置数据结构：list、tuple、set、dict 的系统梳理。  
> 参考来源：[python基础 | がんばろう](https://yhblogs.cn/posts/60233.html)

## <span id="20260817191520-5epv779" class="siyuan-block-anchor" aria-hidden="true"></span>一、可变与不可变类型（核心概念）

> 理解可变性是掌握所有容器行为的前提：赋值语义、传参行为、能否做字典键，全都由此决定。

### 1.1 类型分类

|类型|是否可变|典型示例|
| ------------------| ----------| -------------------|
|int、float、bool|不可变|10, 3.14, True|
|str|不可变|"hello"|
|tuple|不可变|(1, 2, 3)|
|frozenset|不可变|frozenset({1, 2})|
|list|可变|[1, 2, 3]|
|set|可变|{1, 2, 3}|
|dict|可变|{"a": 1}|
|bytearray|可变|bytearray(b"abc")|

### 1.2 赋值行为差异

不可变对象（int、str、tuple）被"修改"时，实际上是创建新对象并重新绑定变量名；可变对象（list、dict、set）被"修改"时，是在原对象上原地变更。

```python
# 不可变：重新绑定
a = 10
b = a
a += 1
print(a, b)          # 11 10 — a 指向新对象，b 不变

# 可变：原地修改
lst = [1, 2, 3]
lst2 = lst
lst.append(4)
print(lst, lst2)     # [1, 2, 3, 4] [1, 2, 3, 4] — lst2 也变了
```

### 1.3 函数传参

Python 函数传参本质是"传对象引用"。不可变对象在函数内重新绑定不影响外部；可变对象在函数内原地修改会"穿透"到外部。

```python
def modify(x, y):
    x += 1       # 不可变：函数内重新绑定，外部不变
    y.append(4)  # 可变：原地修改，外部也变

a = 10
b = [1, 2, 3]
modify(a, b)
print(a)   # 10（不变）
print(b)   # [1, 2, 3, 4]（变了）
```

### 1.4 易错点

- `{}`​ 是空字典，空集合必须用 `set()`。
- 默认参数用可变对象是经典坑：`def f(x=[])`​ → 改为 `def f(x=None)`。
- `b = a`​ 不是复制，修改 `b`​ 会连带影响 `a`​；要复制用 `a.copy()`​ 或 `a[:]`。

## 二、列表 list（可变序列）

> 列表是 Python 中最常用的容器：有序、可变、可容纳任意类型。

### 2.1 创建与基本操作

```python
a = [1, False, "happy", 12, [1, 2, 3]]  # 混合类型
b = list("hello")                         # ['h', 'e', 'l', 'l', 'o']
c = [0] * 5                              # [0, 0, 0, 0, 0]
```

### 2.2 增删改查

|操作|方法|示例|说明|
| --------------| ------| ------| -------------------------|
|末尾添加|`append(x)`|`a.append(4)`|添加一个元素|
|指定位置插入|`insert(i, x)`|`a.insert(1, 99)`|在下标 i 前插入|
|删除指定值|`remove(x)`|`a.remove(99)`|删除第一个匹配项|
|按下标弹出|`pop(i)`|`a.pop(0)`|删除并返回下标 i 的元素|
|清空|`clear()`|`a.clear()`|原地清空|
|删除变量|`del a`|`del a`|释放变量引用|

### 2.3 切片

```python
a = [1, 2, 3, 4, 5]
a[1:4]       # [2, 3, 4]    — 左闭右开
a[:3]        # [1, 2, 3]    — 从头到下标 3
a[::2]       # [1, 3, 5]    — 步长 2
a[::-1]      # [5, 4, 3, 2, 1] — 反转
```

### 2.4 排序（重点）

```python
a.sort()            # 原地排序，修改 a 本身，返回 None
c = sorted(a)       # 返回新列表，a 不变
a.sort(reverse=True) # 降序
```

`sort()`​ 与 `sorted()`​ 的区别：前者原地修改，后者返回新对象。不要写 `a = a.sort()`​（会变成 `None`）。

### 2.5 复制与引用

```python
b = a               # 别名：b 和 a 指向同一对象
b = a.copy()        # 浅拷贝：b 指向新对象，二者独立
b = a[:]            # 等价浅拷贝
```

> Python 中变量是"标签"而非"盒子"。赋值只增加标签数量，不复制对象。`copy()` 才创建独立副本。

### 2.6 二维列表

```python
array = [[1, 2, 3], [4, 5, 6], [7, 8, 9]]
array[0]        # [1, 2, 3] — 第一行
array[1][2]     # 6         — 第二行第三列
```

### 2.7 常用方法速查

|方法|描述|
| ------| ------------------------------|
|`len(list)`|元素个数|
|`list.count(obj)`|统计某值出现次数|
|`list.index(obj)`|返回某值首次出现的下标|
|`list.append(obj)`|末尾添加|
|`list.insert(i, obj)`|指定位置插入|
|`list.extend(seq)`|末尾追加另一个序列的所有元素|
|`list.pop(i)`|删除并返回下标 i 的元素|
|`list.remove(obj)`|删除首个匹配值|
|`list.sort()`|原地排序|
|`list.reverse()`|原地反转|

## 三、元组 tuple（不可变序列）

> 元组与列表结构相同，但创建后不可修改。适合表示固定结构数据，也可作为字典的键。

### 3.1 创建与不可变性

```python
t = (1, 2, 3)
# t[0] = 9   # TypeError: 不支持赋值
```

单元素元组必须带逗号：`t = (1,)`​ 而非 `t = (1)`（后者只是整数）。

### 3.2 拆包

```python
t = (10, 20, 30)
a, b, c = t            # a=10, b=20, c=30
first, *rest = t       # first=10, rest=[20, 30]
```

### 3.3 适用场景

- 表示固定结构：坐标 `(x, y)`​、颜色 `(R, G, B)`
- 作为字典的键（list 不可以）
- 函数返回多个值
- `*args` 收集的位置参数

### 3.4 常用方法

|方法|描述|
| -----------| ------------------------|
|`len(tuple)`|元素个数|
|`max(tuple)`​ / `min(tuple)`|最大/最小值|
|`tuple.count(x)`|统计某值出现次数|
|`tuple.index(x)`|返回某值首次出现的下标|

## 四、集合 set（可变无序集合）

> 集合自动去重、支持数学集合运算（交/并/差），适合快速判断元素是否存在。

### 4.1 创建与去重

```python
s = {1, 3, 3, 4}   # {1, 3, 4} — 自动去重
s = set([1, 2, 2]) # {1, 2}
s = set("aeiou")   # {'a', 'e', 'i', 'o', 'u'}
empty_set = set()  # 空集合（不要用 {}，那是空字典）
```

### 4.2 增删操作

|方法|描述|
| ------| ---------------------------------|
|`set.add(x)`|添加元素|
|`set.remove(x)`|移除元素（不存在则报 KeyError）|
|`set.discard(x)`|移除元素（不存在也不报错）|
|`set.pop()`|随机移除一个元素|
|`set.clear()`|清空|

### 4.3 集合运算

```python
a = {1, 2, 3}
b = {2, 3, 4}
a & b    # 交集: {2, 3}
a | b    # 并集: {1, 2, 3, 4}
a - b    # 差集: {1}
a ^ b    # 对称差集: {1, 4}
```

### 4.4 frozenset（不可变集合）

`frozenset` 是 set 的不可变版本，可作为字典的键或集合的元素：

```python
fs = frozenset([1, 2, 3])
# fs.add(4)  # AttributeError
```

### 4.5 适用场景

- 快速去重：`list(set(lst))`
- 快速判断成员：`if x in s`（O(1) 平均复杂度）
- 集合关系运算：交集、并集、差集、子集判断

## 五、字典 dict（可变映射）

> 字典以键值对存储数据，通过键快速查找值。键必须是不可变且可哈希的类型。

### 5.1 创建与增删改查

```python
d = {"name": "Alice", "age": 25}
d["name"]            # 'Alice' — 取值
d["name"] = "Bob"    # 修改
d["city"] = "杭州"    # 新增
del d["age"]         # 删除键值对
d.pop("city")        # 删除并返回值
d.get("phone", "N/A") # 安全取值，不存在返回默认值
```

### 5.2 遍历

```python
for k in d:                # 遍历键
    print(k, d[k])

for k, v in d.items():    # 遍历键值对
    print(k, v)
```

### 5.3 嵌套字典

```python
subjects = {
    "S001": {"age": 24, "condition": "baseline", "rhi": 1.8},
    "S002": {"age": 27, "condition": "post", "rhi": 2.1},
}
print(subjects["S001"]["rhi"])  # 1.8
```

### 5.4 键的哈希性要求

键必须是不可变类型（int、str、tuple），因为字典靠键的哈希值定位存储位置。

```python
d = {}
d[(1, 2)] = "ok"     # tuple 可哈希，可以做键
# d[[1, 2]] = "no"   # TypeError: list 不可哈希
```

### 5.5 常用方法速查

|方法|描述|
| ------| ----------------------|
|`dict.keys()`|返回键的视图|
|`dict.values()`|返回值的视图|
|`dict.items()`|返回键值对的视图|
|`dict.update(dict2)`|合并另一个字典|
|`dict.pop(key)`|删除并返回值|
|`dict.get(key, default)`|安全取值|
|`dict.setdefault(key, default)`|键不存在时设置默认值|

> Python 3.7+ 字典保持插入顺序。

## 六、四大容器对比总览

|特性|list 列表|tuple 元组|set 集合|dict 字典|
| ------------| --------------------| ------------------------| --------------------------| --------------------|
|定义方式|`[]`​ 或 `list()`|`()`​ 或 `tuple()`|`{}`​ 或 `set()`|`{key: value}`|
|是否有序|有序|有序|无序|3.7+ 有序|
|是否可变|**可变**|**不可变**|**可变**|**可变**|
|元素可重复|允许|允许|自动去重|键唯一，值可重复|
|索引方式|下标 `a[i]`|下标 `t[i]`|不支持|`d[key]`|
|典型场景|有序数据，频繁修改|固定结构，保护不被修改|去重、集合运算、快速查找|键值映射、快速查找|

**选型思路：**

- 需要修改 → `list`​（或 `dict`​/`set`）
- 需要固定保护 → `tuple`
- 需要去重或集合运算 → `set`
- 需要按 key 查 value → `dict`

<section class="siyuan-references" aria-label="文档引用">

## 文档关系

### 反向引用
- [Python笔记](/siyuan/Python笔记/)
- [学习笔记](/siyuan/)

</section>
