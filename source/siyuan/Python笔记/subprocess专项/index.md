---
title: 'subprocess专项'
date: '2026-08-27T11:58:16+08:00'
updated: '2026-08-27T11:58:43+08:00'
layout: page
type: siyuan-note
notebook: '学习笔记'
permalink: 'siyuan/Python笔记/subprocess专项/'
siyuan_source: 'Python笔记/subprocess专项.md'
comments: false
categories:
  - '学习笔记'
  - 'Python笔记'
---

‍

> 在 Python 中运行系统命令（Linux/Windows）的标准做法：**首选标准库** **​`subprocess`​**​ **，尤其** **​`subprocess.run()`​** ​。本专项覆盖选型、参数详解、安全、跨平台、自动化封装与易错点。来源：《Python 调用系统命令学习方案（已归档）》。相关：[Python笔记](/siyuan/Python笔记/)、[Python笔记：8.4 从其他脚本导入函数](/siyuan/Python笔记/#20260827115231-aynpyzs)。

## 一、为什么在 Python 里运行系统命令

- **场景**：每次运行脚本时顺带执行系统命令——同步数据（`rsync`​）、调用 CLI 工具（`ffmpeg`​、`rknn_toolkit`）、清理缓存、启动服务；
- **价值**：把"手工敲命令"变成"脚本自己跑"，完全自动化、可复现。

## 二、方案选型总览

|方案|是否标准库|能否拿输出|推荐度|适用场景|
| ----------------| ------------| -------------------| --------| ---------------------|
|`os.system(cmd)`|✅|❌（只有退出码）|不推荐|最简、丢弃输出|
|`os.popen(cmd)`|✅|✅（旧式）|少用|临时取输出|
|**​`subprocess.run(...)`​** |✅|✅|**首选**|几乎一切场景|
|`subprocess.Popen(...)`|✅|✅（可流式/交互）|需要时|实时输出、复杂交互|
|`sh`（第三方）|❌ `pip install sh`|✅|可选|喜欢 shell 风格语法|

**结论**：首选 `subprocess`​（标准库、功能全、官方推荐），命令行形式推荐 `subprocess.run`。

## 三、subprocess.run 详解（重点）

> `subprocess.run()`​ 运行一条命令并等待其结束，返回 `CompletedProcess` 对象（含 stdout、stderr、returncode）。

```python
import subprocess

# ① 基本用法：参数用「列表」传（不经过 shell）
result = subprocess.run(["ls", "-l"], capture_output=True, text=True)

print(result.returncode)   # 退出码，0 = 成功
print(result.stdout)       # 标准输出（text=True 时是 str）
print(result.stderr)       # 标准错误
```

- `capture_output=True`：捕获 stdout/stderr（否则直接显示在终端）；
- `text=True`​：输出为字符串（否则是 bytes，中文易乱码，可加 `encoding="utf-8"`）；
- 失败处理：

```python
result = subprocess.run(["ls", "/not_exist"], capture_output=True, text=True)
if result.returncode != 0:
    raise RuntimeError(f"命令失败：{result.stderr}")

# 或更简洁：check=True 直接抛 CalledProcessError
subprocess.run(["ls", "/not_exist"], check=True)
```

- 其它常用参数：`cwd=`​（在哪个目录执行）、`timeout=`​（超时秒数，超时抛 TimeoutExpired）、`env=`（自定义环境变量）。

## 四、shell=True vs shell=False（安全与语义）

- **​`shell=False`​**​ **（默认）** ：参数列表直接传给程序，不经 shell 解析 → **安全**，带空格参数也正确；
- **​`shell=True`​**​：整条命令字符串交给系统 shell（Linux `bash -c`​ / Windows `cmd /c`​）解析 → 能写管道、通配符、内建命令，但**有注入风险**：

  - ❌ 绝不要用 `f"... {user_input} ..."` 拼接命令（用户输入可能被 shell 执行）；
  - ✅ 需要 `shell=True`​ 的典型场景：管道 `ls | grep csv`​、通配符 `*.csv`​、Windows 内建命令 `dir`​/`type`。

```python
# 管道/通配符需要 shell=True（接受整条命令字符串）
subprocess.run("ls *.csv | wc -l", shell=True)

# 更安全替代：先用 glob 自行展开通配符，再用列表形式（shell=False）
import glob
subprocess.run(["wc", "-l"] + glob.glob("*.csv"))
```

## 五、Windows vs Linux 差异

|项|Linux|Windows|
| -------------| ------------------| -----------------------------------|
|命令|`ls`​、`cat`​、`rm`​、`grep`|`dir`​、`type`​、`del`​（内建，需 `shell=True`​ 或 `cmd /c`）|
|shell|bash / sh|cmd.exe / PowerShell|
|路径分隔|`/`|`\\`​（推荐用 `pathlib`，不硬编码）|
|Python 判断|`os.name == "posix"`|`os.name == "nt"`|

跨平台建议：能用 Python 内置（`shutil`​、`os`​、`pathlib`​）做到的就不调系统命令；必须调时按 `os.name` 分支写两条命令。

## 六、"每次运行都执行某命令"的最佳实践

> 把命令封装成函数，在脚本入口统一调用——既满足"每次都执行"，又避免"导入时不执行"。

```python
import subprocess
from pathlib import Path

def run_sync():
    """每次运行脚本时同步数据目录"""
    result = subprocess.run(
        ["rsync", "-av", "data/", "backup/"],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(f"同步失败：{result.stderr}")
    print(result.stdout)

def main():
    # ... 你的业务逻辑 ...
    run_sync()          # 每次运行 main 都会执行

if __name__ == "__main__":
    main()
```

- 为什么放 `if __name__ == "__main__":`​：直接运行时执行；被 `import` 时不执行（见 Python 笔记四章入口守卫）；
- **复用**：把 `run_sync()`​ 封装成可导入函数，其他文件 `from 模块 import run_sync`​ 后主动调用即可（见 [Python笔记：8.4 从其他脚本导入函数](/siyuan/Python笔记/#20260827115231-aynpyzs)）；
- 进阶：命令失败想"自动重试/记录日志"，在函数内加循环与 `logging`。

## 七、高级：subprocess.Popen 流式输出

> `run()`​ 会阻塞直到完成；**实时看输出**用 `Popen`——场景如监控日志、按行过滤错误、对持续输出的命令做增量处理。

```python
import subprocess

# 场景：实时跟踪日志并筛选错误行（tail -f 持续输出）
proc = subprocess.Popen(
    ["tail", "-f", "/var/log/app.log"],
    stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,   # stderr 也接住，防缓冲区堆积
)
for line in proc.stdout:
    line = line.strip()
    if "ERROR" in line:
        print(f"[检测到错误] {line}")
proc.terminate()            # 结束子进程
proc.wait()
```

- 防死锁要点：stdout 与 stderr 都很大且要同时读时，用一次取完的 `proc.communicate()`（阻塞到结束，返回 (stdout, stderr)）。

## 八、易错点速查

- 忘记 `text=True`​ → 拿到 bytes，打印/拼接报错或乱码（中文加 `encoding="utf-8"`）；
- `shell=True` + 拼接用户输入 → 命令注入风险；
- 命令不存在 → `FileNotFoundError`​（try/except 或先 `shutil.which()` 检查）；
- 退出码非 0 未检查 → 静默失败（用 `check=True`​ 或检查 `returncode`）；
- Windows 内建命令（`dir`​）用列表直接传 → 报找不到命令（需 `cmd /c dir`​ 或 `shell=True`）；
- 相对路径依赖当前工作目录 → 用 `cwd=`​ 显式指定，或基于 `Path(__file__).parent`。

## 九、自测问题（附答案)

1. **最推荐用哪个模块/函数运行系统命令？**  → `subprocess`​，首选 `subprocess.run()`（标准库、能捕获输出、能检查失败）。
2. **​`shell=True`​**​ **什么时候必须用？**  → 需要管道、通配符、Windows 内建命令（如 `dir`）时；注意注入风险，不要拼接不可信输入。
3. **命令输出是 bytes 乱码怎么办？**  → 加 `text=True`​（或 `encoding="utf-8"`）。
4. **如何在别的文件复用"自动执行命令"函数？**  → 封装为可导入函数，`from 模块 import 函数` 后主动调用；入口守卫只在"直接运行本文件"时触发（见 Python笔记 8.4）。

<section class="siyuan-references" aria-label="文档引用">

## 文档关系

### 本文引用
- [Python笔记](/siyuan/Python笔记/)

### 反向引用
- [Python笔记](/siyuan/Python笔记/)
- [学习笔记](/siyuan/)

</section>
