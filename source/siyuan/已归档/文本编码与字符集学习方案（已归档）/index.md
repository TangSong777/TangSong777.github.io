---
title: '文本编码与字符集学习方案（已归档）'
date: '2026-08-24T15:27:56+08:00'
updated: '2026-08-27T15:40:02+08:00'
layout: page
type: siyuan-note
notebook: '学习笔记'
permalink: 'siyuan/已归档/文本编码与字符集学习方案（已归档）/'
siyuan_source: '已归档/文本编码与字符集学习方案（已归档）.md'
comments: false
categories:
  - '学习笔记'
  - '已归档'
---

> 教学讲义式学习方案：围绕"文本文件的各类编码格式"把每个知识点讲透（定义→图示→技术细节→易错→验证），按依赖顺序编排：字符集概念 → ASCII → 各编码 → UTF-8 深入 → GBK 深入 → Python 实操 → 乱码排查。前置知识：Python 文件操作（已学）。能力基线：文本编码 L0 → 目标 L2。

## 一、为什么需要懂编码

- **项目价值**：实验数据往往是中文 CSV/文本，跨 Windows（GBK）与 Linux/服务器（UTF-8）读写极易出现乱码与 `UnicodeDecodeError`；掌握编码才能稳定处理数据集。
- **依赖关系**：编码是"文件操作"的底层机制——`open(path, encoding=...)` 的参数含义。

## 二、字符集与编码（先搞懂这对概念）

> 字符集（charset）是"字符的集合 + 编号"；编码（encoding）是"把编号存成字节的具体规则"。两者不是一回事。

- **字符集**：如 Unicode 给每个字符一个码点（U+4E2D = "中"）；GB2312/GBK 是另一套字符集合。
- **编码**：同一码点在不同编码下占用的字节不同（"中"在 UTF-8 是 3 字节，在 GBK 是 2 字节）。
- **类比**：字符集 = "字典里的字 + 页码"；编码 = "把页码按某种格式抄成机器能存的 0/1"。

### 什么是 Unicode

> Unicode（统一码）是一个**字符集标准**：给全世界几乎所有字符分配一个**唯一编号**，叫做**码点（code point）** ，写作 `U+XXXX`（十六进制）。

- **码点举例**：`A`​ = U+0041、`中`​ = U+4E2D、emoji 😀 = U+1F600。Unicode 只负责"给字符编号"，**不规定存成几个字节**——那是编码（UTF-8/UTF-16 等）的事。
- **为什么需要**：早年各国各搞一套字符集（GBK、Shift-JIS…），同一串字节在不同系统被解释成不同字符 → 乱码根源。Unicode 让"同一个字符在全世界只有一个编号"，从根上解决不一致。
- **与编码的关系（最关键的理解）** ：Unicode = "编号表"；UTF-8/UTF-16 = "把编号转成字节的规则"。"中"（U+4E2D）在 UTF-8 存 **3 字节**、UTF-16 存 2 字节、GBK 存 2 字节——**码点不变，字节数随编码而变**。
- **与 ASCII 兼容**：Unicode 前 128 个码点与 ASCII 完全一致（`A`=U+0041=65），所以 ASCII 是 Unicode 的子集。
- 分组（了解）：码点按"平面"分组；日常字符大多落在基本多文种平面 BMP（U+0000～U+FFFF），emoji/生僻字在更高平面（≥U+10000，UTF-8 需 4 字节）。
- **Python 视角**：Python 3 的 `str`​ 就是 Unicode 字符序列（内存中不绑定具体编码）；只有执行 `.encode()`​ 或以某种 `encoding=` 写入文件时，才真正落到字节（联动 9.1 str 与 bytes、5 章 UTF-8）。

## 三、ASCII：一切的起点

> ASCII 用 0-127 编码英文字母、数字、常用符号，每字符 1 字节（7 位有效）。

- 例：`A`​=65（0x41）、`a`​=97、`0`=48。
- 局限：无法表示中文等非英文字符 → 各国家/地区发展出自己的扩展编码。

## 四、常见编码格式总览

|编码|字符范围|字节数|特点|适用场景|
| ----------------------| ------------------------------| -------------| ---------------------| -----------------------|
|ASCII|英文/数字/符号|1|最基础，7 位|纯英文文本|
|Latin-1 (ISO-8859-1)|西欧字符|1|ASCII 超集|西欧老系统|
|GB2312|简体中文基本集|2|我国 1980s 标准|中文旧文档|
|GBK|GB2312 超集（含繁体/生僻字）|2|中文环境兼容 GB2312|Windows 中文默认 ANSI|
|GB18030|几乎全 Unicode|1-4|中国强制标准|需要全字符集时|
|UTF-8|全部 Unicode|1-4（中 3）|变长、互联网主流|跨平台/网页/服务器|
|UTF-16|全部 Unicode|2/4|常见 BOM|Windows 内部文本|

## 五、UTF-8 详解

> UTF-8 是变长编码：ASCII 区保持 1 字节（兼容 ASCII），中文 3 字节，emoji 4 字节。

- 字节结构：`0xxxxxxx`​（1 字节，0-127）；`110xxxxx 10xxxxxx`​（2 字节）；`1110xxxx 10xxxxxx 10xxxxxx`（3 字节）……
- 示例："A" = `0x41`​；"中"（U+4E2D）= `E4 B8 AD`（3 字节）。
- 为什么互联网用 UTF-8：全球统一、兼容 ASCII、无字节序歧义（除非带 BOM）。

#### 如何判断每个字符的起点与终点（UTF-8 自同步）

> 是的——`A中A中`​ 在 UTF-8 下的字节正是 `41 E4 B8 AD 41 E4 B8 AD`​（A=1 字节，中=3 字节，共 8 字节）。解码器靠**首字节的二进制前缀**判断"这个字符占几个字节"，从而一个字符一个字符地切分，不会把字节错配。

**判断规则（看首字节高位）** ：

|首字节高位|字符长度|后续字节|
| ------------| -----------------| ----------|
|`0xxxxxxx`|1 字节（ASCII）|无|
|`110xxxxx`|2 字节|1 个 `10xxxxxx`|
|`1110xxxx`|3 字节|2 个 `10xxxxxx`|
|`11110xxx`|4 字节|3 个 `10xxxxxx`|

**逐字节演示** **​`41 E4 B8 AD 41`​**​ **（前两个字符）** ：

```text
41     → 0 开头 → 1 字节 → 字符 A
E4     → 1110 开头 → 共 3 字节 → E4 B8 AD → 字符 中
（下一字节又从新的首字节开始判断）
```

- `10xxxxxx` 只可能作为"某个多字节字符的后缀"；若它出现在字符开头位置，说明字节流损坏或从中间开始解码（乱码/报错成因之一）；
- 因为"每个字符自带长度"，解码器可顺序前进，这就是 **自同步（self-synchronizing）** ：从流的任意字符首字节开始，都能正确切出后续字符边界。

**验证**：

```python
b = "A中A中".encode("utf-8")
print(b)     # b'A\xe4\xb8\xad\xe4\xb8\xad'  == [41 E4 B8 AD 41 E4 B8 AD]
print(len(b))  # 8（1+3+1+3）
```

- **对比 GBK**：GBK 以"首字节范围"判边界——首字节 `0x81-0xFE`​ 表示 2 字节、`0x00-0x7F` 表示 1 字节（ASCII）；没有 UTF-8 的"后缀字节"约束，字节损坏时更易错位。

## 六、GBK 详解

> GBK 是 Windows 简体中文系统的默认"ANSI"编码，中文占 2 字节。

- 结构：首字节 `0x81-0xFE`​，次字节 `0x40-0xFE`（且非 0x7F）。
- 与 GB2312 兼容（GB2312 字符 GBK 全覆盖）。
- 注意：**Windows 记事本"另存为 ANSI"= GBK**；这与 Linux/服务器的 UTF-8 不一致，是跨平台乱码的主要来源。

## 七、UTF-8 vs GBK 对比

|维度|UTF-8|GBK|
| -----------------| ------------------| -----------------------------------------------------|
|ASCII 兼容|✅ 1 字节|❌（无 ASCII 兼容概念，但 0x00-0x7F 与 ASCII 相同）|
|中文字节数|3|2|
|通用性|全球通用|中文区域专用|
|BOM|可选（EF BB BF）|通常无|
|Python 常用参数|`"utf-8"`|`"gbk"`|

## 八、BOM 与乱码

### 8.1 BOM（字节序标记）

- UTF-8 BOM：`EF BB BF`​（文件开头 3 字节）；UTF-16 LE 为 `FF FE`。
- 作用：让解码器识别编码；**问题**：无感知解码器会把 BOM 当字符，出现开头多 `\ufeff`。
- Python 处理：`open(path, encoding="utf-8-sig")` 自动剥离 BOM。

#### BOM 详解：为什么有、什么时候需要

> **BOM** 全称 **Byte Order Mark（字节序标记）** ：写在文件开头的一到几个字节，用来告诉解码器"这个文件是什么编码、字节是什么顺序"。

- **为什么发明（UTF-16 场景）** ：UTF-16 每个字符占 2 字节，需要确认"高字节在前（大端 BE）还是低字节在前（小端 LE）"——于是用开头 `FF FE`​（LE）或 `FE FF`（BE）作标记；
- **UTF-8 场景**：UTF-8 按字节顺序解析、**没有字节序歧义**，BOM（`EF BB BF`​）并不是必需的；但 Windows 记事本"另存为 UTF-8"会**默认带上 BOM**，成为跨平台文件最常见的"惊喜"。

**各编码 BOM 对照**：

|编码|BOM 字节|是否必需|
| -----------| ----------| ------------------------------|
|UTF-8|`EF BB BF`|可选（Windows 记事本默认加）|
|UTF-16 LE|`FF FE`|必需（标记小端）|
|UTF-16 BE|`FE FF`|必需（标记大端）|
|UTF-32 LE|`FF FE 00 00`|少见|

**带来的麻烦**：严格按编码读取的工具把 BOM 当"普通字符"，于是文本开头多出一个不可见字符 `\ufeff`​（如 `print`​ 出来是空字符、字符串比较失败）；Linux 上用 `file -i`​ 查看会显示 `charset=utf-8 ... with BOM`。

**Python 处理**：

```python
# 读取时自动剥离 BOM（推荐用于可能带 BOM 的文件）
with open("may_have_bom.csv", "r", encoding="utf-8-sig") as f:
    text = f.read()          # 开头不会有 \ufeff

# 写入时：utf-8 不带 BOM（跨平台推荐）；utf-8-sig 会写入 BOM
with open("out.csv", "w", encoding="utf-8") as f:    # 无 BOM（服务器友好）
    f.write(text)
with open("win_out.csv", "w", encoding="utf-8-sig") as f:  # 带 BOM（Windows 记事本友好）
    f.write(text)
```

> 记忆：`utf-8`​ = 不带 BOM；`utf-8-sig` = 读时剥、写时加。

### 8.2 乱码产生原理

- 本质：**用错误的编码去解码字节**（如：GBK 编码的中文文件，用 UTF-8 解码 → 出现"锟斤拷"或 `UnicodeDecodeError`）。
- 排查路径：

  1. 确认文件真实编码（Linux `file -i 文件`​；Windows 记事本打开看最右下角；或 `chardet.detect(字节)`）；
  2. 用正确编码读取（指定 `encoding=`）；
  3. 必要时转码（先按原编码解码成 str，再 encode 成目标编码写新文件）。

## 九、Python 编码实操

### 9.1 str 与 bytes

- `str`​ = 字符序列（Unicode 抽象层）；`bytes` = 原始字节序列。
- 转换：`s.encode("utf-8")`​ → bytes；`b.decode("utf-8")` → str。
- **编码与解码必须一致**：encode 用什么，decode 也要用什么。

### 9.2 文件读写

```python
# 用 UTF-8 读写（跨平台推荐）
with open("data.csv", "w", encoding="utf-8") as f:
    f.write("姓名,数值\n张三,1.5\n")

# 读 GBK 文件（Windows 生成的历史文件）
with open("old.txt", "r", encoding="gbk") as f:
    text = f.read()

# 带 BOM 的 UTF-8 文件
with open("with_bom.csv", "r", encoding="utf-8-sig") as f:
    text = f.read()
```

### 9.3 常见报错与解决

|报错|原因|解决|
| -----------------| ------------------------------------| -----------------------|
|`UnicodeDecodeError: 'utf-8' codec can't decode byte 0xb2...`|文件是 GBK/其它编码，却用 UTF-8 读|改用 `encoding="gbk"`（或先探测）|
|`UnicodeEncodeError: 'gbk' codec can't encode character '\U0001F600'`|GBK 无法编码 emoji 等|写文件用 UTF-8；或 `errors="replace"/"ignore"`|
|文件开头出现 `\ufeff`|UTF-8 BOM 未剥离|`encoding="utf-8-sig"`|

## 十、易错点速查

- 读文件乱码/报错：`encoding` 参数与文件真实编码不匹配。
- Windows 记事本"ANSI"保存 = GBK；传到 Linux 用 UTF-8 读必乱码。
- 混用编码写同一文件：上次写的字节无法正确解码。
- 复制代码时粘贴了不可见字符（如全角空格），不是编码问题而是排版问题。
- `open()`​ 不指定 encoding 时依赖系统默认 → 跨平台行为不一致，**显式指定**最稳妥。

## 十一、验证与自测（附标准答案）

1. "中"字在 UTF-8 下占几个字节？→ 3 字节（`E4 B8 AD`）；在 GBK 下 2 字节。
2. 一句话区分字符集与编码？→ 字符集是字符及其编号，编码是编号转字节的规则。
3. 遇到 `UnicodeDecodeError: 'utf-8' codec can't decode byte 0xb2`​ 怎么处理？→ 文件大概率是 GBK/GB2312，用 `encoding="gbk"` 重新读取；不确定时先探测真实编码。
4. 实操验证：写一个含中文的 CSV，分别以 `utf-8`​ 和 `gbk`​ 保存，用另一种编码交叉读取，观察乱码与报错差异；再用 `utf-8-sig` 处理带 BOM 文件。

## 附录：编码速查

|项|值|
| ---------------------| -------------------------|
|UTF-8 中文|3 字节（GBK 2 字节）|
|UTF-8 BOM|`EF BB BF`​，Python 用 `utf-8-sig` 读取|
|Windows 记事本 ANSI|= GBK|
|Python 读 GBK|`encoding="gbk"`|
|乱码根因|编码/解码不一致|

<section class="siyuan-references" aria-label="文档引用">

## 文档关系

### 反向引用
- [学习笔记](/siyuan/)

</section>
