---
title: '文本编码与字符集专项'
date: '2026-08-27T15:40:02+08:00'
updated: '2026-08-27T15:41:46+08:00'
layout: page
type: siyuan-note
notebook: '学习笔记'
permalink: 'siyuan/其他笔记/文本编码与字符集专项/'
siyuan_source: '其他笔记/文本编码与字符集专项.md'
comments: false
categories:
  - '学习笔记'
  - '其他笔记'
---

‍

> 文本编码与字符集知识点专项：从"字符集 vs 编码"概念出发，覆盖 Unicode、ASCII、UTF-8、GBK、BOM、乱码排查与 Python 实操。来源：《文本编码与字符集学习方案（已归档）》。项目用途：跨 Windows（GBK）/ Linux（UTF-8）读写中文实验数据。

## 一、字符集与编码（核心概念）

> 字符集（charset）是"字符的集合 + 编号"；编码（encoding）是"把编号存成字节的具体规则"。两者不是一回事。

- **字符集**：如 Unicode 给每个字符一个码点（U+4E2D = "中"）；GB2312/GBK 是另一套字符集合；
- **编码**：同一码点在不同编码下占用的字节不同（"中"在 UTF-8 是 3 字节，在 GBK 是 2 字节）；
- **类比**：字符集 = "字典里的字 + 页码"；编码 = "把页码按某种格式抄成机器能存的 0/1"。

### 什么是 Unicode

> Unicode 是一个**字符集标准**：给全世界几乎所有字符分配唯一编号（码点 code point），写作 `U+XXXX`。

- **码点**：`A`​=U+0041、`中`=U+4E2D、😀=U+1F600。只编号，不规定字节数；
- **为什么需要**：早年各国各搞一套字符集（GBK、Shift-JIS…）导致同一字节解释不同 → 乱码；Unicode 统一编号；
- **与编码的关系**：Unicode = 编号表；UTF-8/UTF-16 = 编号转字节的规则。"中"（U+4E2D）码点不变，UTF-8 存 3 字节、UTF-16 存 2 字节、GBK 存 2 字节；
- **与 ASCII 兼容**：前 128 个码点与 ASCII 一致，ASCII 是 Unicode 子集；
- **平面（了解）** ：BMP（U+0000～U+FFFF）容纳日常字符；emoji/生僻字在更高平面（≥U+10000，UTF-8 需 4 字节）；
- **Python 视角**：`str`​ 就是 Unicode 字符序列；`encode()`​/`open(encoding=)` 时才落到字节。

## 二、常见编码总览

|编码|字符范围|字节数|特点|适用场景|
| ----------------------| ------------------------------| -------------| ---------------------| -----------------------|
|ASCII|英文/数字/符号|1|最基础，7 位|纯英文文本|
|Latin-1 (ISO-8859-1)|西欧字符|1|ASCII 超集|西欧老系统|
|GB2312|简体中文基本集|2|我国 1980s 标准|中文旧文档|
|GBK|GB2312 超集（含繁体/生僻字）|2|中文环境兼容 GB2312|Windows 中文默认 ANSI|
|GB18030|几乎全 Unicode|1-4|中国强制标准|需要全字符集时|
|UTF-8|全部 Unicode|1-4（中 3）|变长、互联网主流|跨平台/网页/服务器|
|UTF-16|全部 Unicode|2/4|常见 BOM|Windows 内部文本|

## 三、UTF-8 详解（含自同步）

> UTF-8 是变长编码：ASCII 区保持 1 字节，中文 3 字节，emoji 4 字节。互联网默认编码。

- 字节结构：`0xxxxxxx`​（1 字节）；`110xxxxx 10xxxxxx`​（2 字节）；`1110xxxx 10xxxxxx 10xxxxxx`​（3 字节）；`11110xxx ...`（4 字节）；
- 示例："A" = `0x41`​；"中"（U+4E2D）= `E4 B8 AD`（3 字节）；
- 为什么用 UTF-8：全球统一、兼容 ASCII、无字节序歧义（除非带 BOM）。

### 如何判断每个字符的起点与终点（自同步）

> `A中A中`​ 在 UTF-8 下是 `41 E4 B8 AD 41 E4 B8 AD`​（共 8 字节）。解码器靠**首字节二进制前缀**判断字符占几字节，逐字符切分。

|首字节高位|字符长度|后续字节|
| ------------| -----------------| ----------|
|`0xxxxxxx`|1 字节（ASCII）|无|
|`110xxxxx`|2 字节|1 个 `10xxxxxx`|
|`1110xxxx`|3 字节|2 个 `10xxxxxx`|
|`11110xxx`|4 字节|3 个 `10xxxxxx`|

```text
41     → 0 开头 → 1 字节 → 字符 A
E4     → 1110 开头 → 共 3 字节 → E4 B8 AD → 字符 中
```

- `10xxxxxx` 只能作为多字节字符的后缀；单独出现在字符开头说明字节流损坏/从中间解码（乱码成因）；
- 自同步：从任意字符首字节开始都能正确切分；
- 验证：`len("A中A中".encode("utf-8")) == 8`；
- 对比 GBK：GBK 以首字节范围（`0x81-0xFE`​ 为 2 字节、`0x00-0x7F` 为 1 字节）判边界，无后缀字节约束，损坏时更易错位。

## 四、GBK 详解

> GBK 是 Windows 简体中文系统默认"ANSI"编码，中文占 2 字节。

- 结构：首字节 `0x81-0xFE`​，次字节 `0x40-0xFE`（且非 0x7F）；
- 与 GB2312 兼容（GB2312 字符全覆盖）；
- 注意：Windows 记事本"另存为 ANSI" = GBK；与 Linux/服务器 UTF-8 不一致，是跨平台乱码主要来源。

## 五、UTF-8 vs GBK

|维度|UTF-8|GBK|
| -----------------| ------------------| -------------------------------|
|ASCII 兼容|✅ 1 字节|✅（0x00-0x7F 与 ASCII 相同）|
|中文字节数|3|2|
|通用性|全球通用|中文区域专用|
|BOM|可选（EF BB BF）|通常无|
|Python 常用参数|`"utf-8"`|`"gbk"`|

## 六、BOM 与乱码

### 6.1 BOM（字节序标记）详解

> **BOM** = Byte Order Mark，写在文件开头的若干字节，标记"编码 + 字节序"。

- 起源（UTF-16）：每字符 2 字节，需区分大/小端——`FF FE`​（LE）、`FE FF`（BE）；
- UTF-8：无字节序歧义，BOM（`EF BB BF`）非必需，但 Windows 记事本"另存为 UTF-8"默认带 BOM；
- 麻烦：严格读取器把 BOM 当普通字符 → 文本开头多 `\ufeff`​；`file -i` 显示 "with BOM"。

|编码|BOM 字节|是否必需|
| -----------| ----------| ------------------------------|
|UTF-8|`EF BB BF`|可选（Windows 记事本默认加）|
|UTF-16 LE|`FF FE`|必需（标记小端）|
|UTF-16 BE|`FE FF`|必需（标记大端）|
|UTF-32 LE|`FF FE 00 00`|少见|

**Python 处理**（记忆：`utf-8`​=不带 BOM；`utf-8-sig`=读剥写加）：

```python
with open("may_have_bom.csv", "r", encoding="utf-8-sig") as f:  # 读时自动剥 BOM
    text = f.read()

with open("out.csv", "w", encoding="utf-8") as f:            # 写：无 BOM（服务器友好）
    f.write(text)
with open("win_out.csv", "w", encoding="utf-8-sig") as f:    # 写：带 BOM（Windows 友好）
    f.write(text)
```

### 6.2 乱码产生原理

- 本质：**用错误的编码去解码字节**（如 GBK 编码的中文文件用 UTF-8 解码 → "锟斤拷"或 `UnicodeDecodeError`）；
- 排查路径：① 确认真实编码（Linux `file -i`​、Windows 记事本右下角、`chardet.detect`​）→ ② 用正确 `encoding=` 读取 → ③ 需要时转码（先按原编码 decode 成 str，再 encode 成目标编码写新文件）。

## 七、Python 编码实操

### 7.1 str 与 bytes

- `str`​ = 字符序列（Unicode 抽象层）；`bytes` = 原始字节序列；
- 转换：`s.encode("utf-8")`​ → bytes；`b.decode("utf-8")` → str；
- **编码与解码必须一致**。

### 7.2 文件读写

```python
with open("data.csv", "w", encoding="utf-8") as f:      # 写 UTF-8（跨平台推荐）
    f.write("姓名,数值\n张三,1.5\n")

with open("old.txt", "r", encoding="gbk") as f:         # 读 GBK（Windows 历史文件）
    text = f.read()
```

### 7.3 常见报错

|报错|原因|解决|
| -----------------| ------------------------------------| -----------------------|
|`UnicodeDecodeError: 'utf-8' codec can't decode byte 0xb2...`|文件是 GBK/其它编码，却用 UTF-8 读|改用 `encoding="gbk"`（或先探测）|
|`UnicodeEncodeError: 'gbk' codec can't encode char '\U0001F600'`|GBK 无法编码 emoji 等|写文件用 UTF-8；或 `errors="replace"/"ignore"`|
|文件开头出现 `\ufeff`|UTF-8 BOM 未剥离|`encoding="utf-8-sig"`|

## 八、易错点速查

- 读文件乱码/报错：`encoding` 与文件真实编码不匹配；
- Windows 记事本"ANSI"保存 = GBK，传到 Linux 用 UTF-8 读必乱码；
- 混用编码写同一文件：上次字节无法正确解码；
- `open()`​ 不指定 encoding 依赖系统默认 → 跨平台行为不一致，**显式指定最稳妥**；

## 九、自测问题（附答案）

1.  **"中"字在 UTF-8 下占几个字节？**  → 3 字节（`E4 B8 AD`）；GBK 下 2 字节。
2. **一句话区分字符集与编码？**  → 字符集是字符及其编号，编码是编号转字节的规则。
3. **​`UnicodeDecodeError: 'utf-8' codec can't decode byte 0xb2`​**​ **怎么处理？**  → 文件大概率 GBK/GB2312，用 `encoding="gbk"` 重读；不确定先探测。
4. **​`A中A中`​**​ **的 UTF-8 字节是怎样的？如何判断字符边界？**  → `41 E4 B8 AD 41 E4 B8 AD`；靠首字节高位前缀判断字符长度（自同步）。

<section class="siyuan-references" aria-label="文档引用">

## 文档关系

### 反向引用
- [学习笔记](/siyuan/)

</section>
