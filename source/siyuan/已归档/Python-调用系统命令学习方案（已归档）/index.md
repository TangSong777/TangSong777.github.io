---
title: 'Python 调用系统命令学习方案（已归档）'
date: '2026-08-24T15:29:46+08:00'
updated: '2026-08-27T11:57:48+08:00'
layout: page
type: siyuan-note
notebook: '学习笔记'
permalink: 'siyuan/已归档/Python-调用系统命令学习方案（已归档）/'
siyuan_source: '已归档/Python 调用系统命令学习方案（已归档）.md'
comments: false
categories:
  - '学习笔记'
  - '已归档'
---

> 教学讲义式学习方案：解决"如何在 Python 中运行 Windows/Linux 命令行、并让每次运行 Python 文件时都自动执行某条命令"的问题。核心结论先行：**最推荐使用标准库** **​`subprocess`​**​ **（尤其** **​`subprocess.run`​**​ **）** ；第三方 `sh` 库可作为舒适替代。按依赖顺序：为什么需要 → 方案总览 → subprocess 详解 → shell 安全 → 跨平台差异 → 自动化最佳实践 → 排障。能力基线：L0 → 目标 L2。

## 一、为什么要在 Python 里运行系统命令

- **场景**：每次运行 Python 脚本时，需要顺带执行一条系统命令——如同步数据（`rsync`​）、调用 CLI 工具（`ffmpeg`​、`rknn_toolkit`）、清理缓存、启动服务。
- **价值**：把"手工敲命令"变成"脚本自己跑"，实现完全自动化、可复现。
- 前置知识：Python 基础、文件操作（`pathlib`）——已学。

## 二、方案总览：用哪个"包"？（先给结论）

|方案|是否标准库|能否拿输出|推荐度|适用场景|
| ----------------| ------------| -------------------| --------| ---------------------|
|`os.system(cmd)`|✅|❌（只有退出码）|不推荐|最简、丢弃输出|
|`os.popen(cmd)`|✅|✅（旧式）|少用|临时取输出|
|**​`subprocess.run(...)`​** |✅|✅| **✅ 首选**|几乎一切场景|
|`subprocess.Popen(...)`|✅|✅（可流式/交互）|需要时|实时输出、复杂交互|
|`sh`（第三方）|❌ `pip install sh`|✅|可选|喜欢 shell 风格语法|

**结论：最推荐** **​`subprocess`​**​ **（标准库、功能全、官方推荐），命令形式推荐** **​`subprocess.run`​**​；  
如果你偏爱直观语法可尝试 `sh`​，但本项目建议以 `subprocess` 为主。

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

- **​`shell=False`​**​ **（默认）** ：参数列表直接传给程序，不经 shell 解析 → **安全**，带空格参数也正确。
- **​`shell=True`​**​：整条命令字符串交给系统 shell（Linux `bash -c`​ / Windows `cmd /c`​）解析 → 能写管道、通配符、内建命令，但**有注入风险**：

  - ❌ 绝不要用 `f"... {user_input} ..."` 拼接命令（用户输入可能被 shell 执行，老弟我写个sudo rm -rf /你不炸了吗）。
  - ✅ 需要 `shell=True`​ 的典型场景：管道 `ls | grep csv`​、通配符 `*.csv`​、Windows 内建命令 `dir`​/`type`（它们不是独立 exe）。

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

- 跨平台建议：能用 Python 内置（`shutil`​、`os`​、`pathlib`​）做到的就不调系统命令；必须调时按 `os.name` 分支写两条命令。

## 六、"每次运行 Python 文件都执行某命令"的最佳实践

> 把命令封装成函数，并在脚本入口统一调用——既满足"每次都执行"，又避免"导入时不执行"。

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

- 为什么放 `if __name__ == "__main__":`​：直接运行时执行；被 `import` 时不执行（见 Python 笔记 4 章入口守卫）。
- 进阶：若命令失败想"自动重试/记录日志"，在函数内加循环与 `logging`。

> <span id="20260827114934-rqcm21z" class="siyuan-block-anchor" aria-hidden="true"></span>若要在**其他 Python 文件**中复用"自动执行命令"的逻辑：把 `run_sync()`​ 定义为**可导入函数**，其他文件 `from 模块名 import run_sync`​ 后主动调用即可。`if __name__ == "__main__":`​ 的作用只是"防止被导入时误触发入口"，并不影响你主动导入并调用函数（通用规则见 [Python笔记：8.4 从其他脚本导入函数](/siyuan/Python笔记/#20260827115231-aynpyzs)）：

```python
# sync_util.py：定义函数 + 入口守卫
def run_sync():
    # ... 执行命令、检查失败 ...
    pass

if __name__ == "__main__":
    run_sync()          # 直接运行本文件时执行

# main.py：在其他文件里复用
from sync_util import run_sync
run_sync()              # 主动调用函数，与是否被导入无关
```

> 理解：`if __name__ == "__main__":`​ 只在"以本文件为入口直接运行"时成立；`import`​ 时 `__name__` 是模块名，所以不会自动执行——但函数本身照常可被调用。

## 七、高级：subprocess.Popen 流式输出

- `run()`​ 会阻塞直到完成；**实时看输出**用 `Popen`：

```python
proc = subprocess.Popen(["ping", "-c", "4", "localhost"], stdout=subprocess.PIPE, text=True)
for line in proc.stdout:      # 逐行实时读取
    print(line, end="")
proc.wait()
```

- 容易死锁：两边管道都大时用 `proc.communicate()` 统一读写。

> Popen 的实用场景：**实时逐行处理输出流**——例如监控日志、按行过滤错误、或对持续输出的命令做增量统计（`run()` 会等命令结束才返回，做不到"边跑边处理"）：

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
    if "exit" in line:      # 满足退出条件时主动终止
        break
proc.terminate()            # 结束子进程
proc.wait()
```

> 防死锁要点：若 stdout 与 stderr 都很大且要同时读，可改用一次取完的 `proc.communicate()`（阻塞到结束，返回 (stdout, stderr)），避免四条管道交叉等待。

## 八、易错点速查

- 忘记 `text=True`​ → 拿到的是 bytes，打印/拼接报错或乱码（中文可加 `encoding="utf-8"`）。
- `shell=True` + 拼接用户输入 → 命令注入风险。
- 命令不存在 → `FileNotFoundError`​（try/except 或先 `shutil.which()` 检查）。
- 退出码非 0 未检查 → 静默失败（用 `check=True`​ 或检查 `returncode`）。
- Windows 内建命令（`dir`​）用列表形式直接传 → 报找不到命令（需 `cmd /c dir`​ 或 `shell=True`）。
- 相对路径依赖当前工作目录 → 用 `cwd=`​ 显式指定，或基于 `Path(__file__).parent`。

## 九、验证与自测（附标准答案）

1. 最推荐用哪个模块/函数运行系统命令？→ `subprocess`​，首选 `subprocess.run()`（标准库、能捕获输出、能检查失败）。
2. `shell=True`​ 什么时候必须用？→ 需要管道、通配符、Windows 内建命令（如 `dir`）时；注意注入风险，不要拼接不可信输入。
3. 命令输出是 bytes 乱码怎么办？→ 加 `text=True`​（或 `encoding="utf-8"`）。
4. 实操验证：写脚本分别运行 `ls -l`​（Linux）与 `dir`​（Windows，`cmd /c` 方式），捕获 stdout 打印；再封装一个"每次运行自动执行"的函数（如同步数据），故意让命令失败验证抛错。

## 附录：命令速查

|需求|写法|
| -------------| ------|
|运行并等待|`subprocess.run([...], capture_output=True, text=True)`|
|失败即抛错|`subprocess.run([...], check=True)`|
|实时输出|`subprocess.Popen(..., stdout=subprocess.PIPE, text=True)`|
|管道/通配符|`subprocess.run("ls *.csv \| wc -l", shell=True)`|
|指定目录|`subprocess.run([...], cwd="/path")`|
|超时|`subprocess.run([...], timeout=10)`|

<section class="siyuan-references" aria-label="文档引用">

## 文档关系

### 本文引用
- [Python笔记](/siyuan/Python笔记/)

### 反向引用
- [Python笔记](/siyuan/Python笔记/)
- [学习笔记](/siyuan/)

</section>
