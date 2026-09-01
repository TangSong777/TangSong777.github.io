---
title: 'Linux专项'
date: '2026-08-18T14:03:34+08:00'
updated: '2026-08-27T10:45:21+08:00'
layout: page
type: siyuan-note
notebook: '学习笔记'
permalink: 'siyuan/其他笔记/命令行/Linux专项/'
siyuan_source: '其他笔记/命令行/Linux专项.md'
comments: false
categories:
  - '学习笔记'
  - '其他笔记'
  - '命令行'
---

# Linux 命令行核心知识

> 与 Windows 命令行体系的对应：PowerShell 内置别名兼容了 `ls`​、`cat`​、`pwd`​、`rm`​、`cp`​、`mv`​ 等 Linux 常用命令（别名机制与命令映射详见 [PowerShell专项：别名机制](/siyuan/其他笔记/命令行/PowerShell专项/)）；PowerShell 与 CMD 的对照见 [CMD专项：与 PowerShell 的对照](/siyuan/其他笔记/命令行/CMD专项/)。命令体系逻辑相通（导航/文件/文本/进程/网络），跨体系时先找"对应命令"即可快速上手。

> Linux 命令行知识的主线是：路径与文件 → 文本处理 → 权限与安全 → 进程与任务 → 管道与脚本 → 后台运行与日志排障。

## 一、系统、终端与路径

> Linux 是内核；发行版提供用户空间工具；终端负责交互，Shell 负责解释和执行命令。

### 1.1 基础信息与帮助

```bash
whoami              # 当前用户
hostname            # 主机名
pwd                 # 当前目录
uname -a            # 内核信息
cat /etc/os-release # 发行版信息
man ls              # 完整手册，按 q 退出
ls --help           # 简要帮助
history             # 命令历史
```

命令通常采用 `命令 [选项] [参数]`​ 格式，例如 `ls -lah /var/log`。

### 1.2 绝对路径与相对路径

|概念|含义|
| ----------| -----------------------|
|绝对路径|从 `/`​ 开始，如 `/var/log`|
|相对路径|从当前目录开始，如 `./logs`|
|`~`|当前用户家目录|
|`..`|上一级目录|
|`.`|当前目录|

## 二、文件与目录管理

> Linux 文件系统以 `/` 为根的树状结构组织，文件操作应先确认路径，再执行修改或删除。

### 2.1 导航、创建与查看

```bash
ls -lah                 # 含隐藏文件的详细列表
cd /tmp                 # 进入目录
cd -                    # 返回上次目录
mkdir -p a/b/c          # 创建多级目录
touch empty.txt         # 创建空文件或更新时间
printf 'hello\n' > a.txt # 覆盖写入
```

以 `.` 开头的文件通常是隐藏文件；路径含空格时使用引号或反斜杠。

### 2.2 复制、移动与删除

```bash
cp -i a.txt b.txt       # 覆盖前确认
cp -r src backup        # 递归复制目录
mv old.txt new.txt      # 重命名或移动
rm -i file.txt          # 删除前确认
rmdir empty_dir         # 删除空目录
rm -r directory         # 递归删除，谨慎使用
```

> 💡 **理解**：`rm`​ 通常不可恢复；练习应限制在 `~/linux-lab` 等专用目录，避免直接操作系统目录。

### 2.3 通配符

|符号|作用|示例|
| ------| --------------------| ------|
|`*`|任意长度字符|`*.log`|
|`?`|一个字符|`file?.txt`|
|`[abc]`|匹配其中一个字符|`file[123].txt`|
|`{a,b}`|Shell 展开多个选项|`file.{txt,bak}`|

## 三、文本查看、编辑与处理

> 配置、脚本和日志大多是文本：小文件可直接输出，大文件应分页查看，再按需筛选或修改。

### 3.1 查看文本

```bash
less file.txt             # 分页查看，q 退出，/关键词搜索
head -n 10 file.txt       # 前 10 行
tail -n 10 file.txt       # 后 10 行
tail -f app.log           # 实时跟踪日志
wc -l -w -c file.txt      # 行数、单词数、字节数
file file.txt             # 文件类型
```

### 3.2 编辑与非交互修改

```bash
nano config.txt           # Ctrl+O 保存，Ctrl+X 退出
vim notes.txt             # i 插入，Esc 返回普通模式，:wq 保存退出
echo 'one' > file.txt     # 覆盖
echo 'two' >> file.txt    # 追加
sed -n '1,5p' data.txt     # 查看指定行
sed -i.bak 's/old/new/g' data.txt # 原地替换并保留备份
```

## 四、权限、用户与安全

> 权限回答“谁能对什么对象做什么操作”，分为属主、属组和其他人三组。

### 4.1 权限语义

|对象|`r`|`w`|`x`|
| ----------| ----------| ----------------------| --------------------|
|普通文件|读取内容|修改内容|作为程序执行|
|目录|列出名称|创建/删除/重命名项目|进入目录并访问内容|

`rwx`​ 数值为 `4、2、1`​：`755`​ 表示属主 `rwx`​、属组和其他人 `r-x`​；`600` 表示仅属主读写。

### 4.2 修改与验证

```bash
id                         # 用户、组信息
ls -l file.txt             # 查看权限和属主
chmod 755 script.sh        # 设置为 rwxr-xr-x
chmod u+x script.sh        # 给属主增加执行权限
chmod 600 private.key      # 敏感文件仅属主读写
chown user:group file.txt  # 修改属主和属组
umask                      # 默认权限掩码
stat file.txt              # 详细元数据
```

> 💡 **理解**：`chmod 755`​ 会直接设定三组权限；`chmod +x`​ 是在原权限基础上增加执行权限，二者不是同一操作。目录的 `x` 允许进入和访问目录。
>
> ### 4.3 常见问题：`chmod 755`​ 与 `chmod +x`
>
> `chmod 755 file`​ 是直接把属主、属组和其他人的权限分别设为 `rwx`​、`r-x`​、`r-x`​；`chmod +x file`​ 是在原有权限基础上为所有用户类别增加执行权限，保留其他权限位。因此二者的结果可能不同，使用前应先用 `ls -l` 查看原权限。
>
> ### 4.4 常见问题：文件与目录的 `x` 权限
>
> - 普通文件的 `x`：允许将文件作为程序执行，但仍需正确的解释器或格式。
> - 目录的 `x`：允许进入目录，并按路径访问其中的项目；它不是“执行目录”。
> - 目录的 `r`​ 主要用于列出名称，目录的 `w`​ 用于创建、删除和重命名项目；实际访问通常还需要 `x`。

## 五、进程、信号与作业控制

> 程序运行后成为进程，通常通过 PID、父进程、用户、状态和资源占用进行管理。

### 5.1 查找与结束进程

```bash
ps aux                       # 所有用户进程快照
pgrep -af python              # 按名称查找
ps -p PID -o pid,ppid,user,stat,%cpu,%mem,cmd
top                           # 实时监控
kill PID                      # 默认 TERM，请求正常退出
kill -KILL PID                # 强制结束，最后手段
pkill -f 'pattern'            # 按命令行匹配，风险较高
```

推荐顺序是先确认 PID，再用 `kill`/TERM；程序无响应时才使用 KILL，避免误杀系统进程。

### 5.2 常见问题：`kill`​、`kill -9`​ 与 `pkill`

|命令|作用|风险与顺序|
| ------| ----------------------------------------| ------------------------------------------|
|`kill PID`|向指定 PID 发送 TERM，请求程序正常退出|优先使用，给程序清理资源的机会|
|`kill -9 PID`|发送 KILL，强制结束进程|无法清理资源；仅在普通终止无效时使用|
|`pkill -f pattern`|按命令行模式匹配并结束进程|可能匹配多个进程；执行前必须确认匹配范围|

安全顺序：先用 `ps`​/`pgrep` 确认目标，再发送 TERM；确认仍无响应后才考虑 KILL。不要对未知 PID 或系统进程随意操作。

### 5.2 前台与后台

```bash
command &     # 后台运行
jobs          # 查看当前 Shell 作业
Ctrl+Z        # 暂停前台任务
bg %1         # 后台继续
fg %1         # 调回前台
```

## 六、搜索、管道与重定向

> 管道连接命令之间的数据流；重定向连接命令与文件，是日志分析和命令组合的基础。

### 6.1 grep 与 find

```bash
grep -ni 'error' app.log                 # 忽略大小写并显示行号
grep -C 2 'error' app.log                # 显示上下文
find . -type f -name '*.py'              # 查找 Python 文件
find . -type f -name '*.log' -exec grep -l 'error' {} \;
```

删除操作前先将 `-delete`​ 改为 `-print`，确认匹配范围。

#### 6.1.1 grep 常用参数详解

> grep 在文本中按"模式"搜索行并输出匹配的行；参数决定匹配方式、输出格式与范围。

|参数|含义|示例|
| -----------| ---------------------------------| --------------------|
|`-i`|忽略大小写|`grep -i error app.log`|
|`-n`|显示行号|`grep -n error app.log`|
|`-c`|只统计匹配的行数（不输出内容）|`grep -c error app.log`​ → `42`|
|`-v`|反选：输出**不匹配**的行|`grep -v '^#' config`（去掉注释行）|
|`-w`|整词匹配|`grep -w error`​（不匹配 `errorlog`）|
|`-r`​ / `-R`|递归搜索目录（-R 跟随符号链接）|`grep -rn 'TODO' src/`|
|`-E`|扩展正则（`+`/`|`/`()` 等）|
|`-C 数字`|显示匹配行前后 N 行上下文|`grep -C 2 error app.log`|
|`-l`|只列出包含匹配的文件名|`grep -l error *.log`|
|`--include=模式`|限制搜索的文件类型|`grep -rn --include='*.py' 'TODO' .`|

**组合示例**：

```bash
grep -niE 'error|fail|warning' app.log   # 忽略大小写+行号+扩展正则
grep -c 'timeout' *.log                   # 每个文件超时次数
grep -v '^#' /etc/ssh/sshd_config | grep -v '^$'   # 去注释与空行
```

#### 6.1.2 find 常用参数详解

> find 在目录树中**按条件查找文件**；条件用参数表达（名称、类型、大小、时间），`-exec` 对结果执行命令。

|参数|含义|示例|
| ------| ------------------------------------| -----------------------|
|`-name 模式`|按文件名匹配（支持通配符，需引号）|`find . -name '*.py'`|
|`-iname`|忽略大小写的文件名匹配|`find . -iname '*.log'`|
|`-type f/d/l`|按类型：普通文件/目录/符号链接|`find . -type d`（只看目录）|
|`-size 大小`|按大小（`+100M`​ 大于、`-1k` 小于）|`find . -size +100M`|
|`-mtime 天数`|按修改时间（`-7` 七天内）|`find . -mtime -7`（最近 7 天修改）|
|`-mmin 分钟`|按分钟级修改时间|`find . -mmin -10`|
|`-maxdepth N`|限制搜索深度（默认无限深）|`find . -maxdepth 2 -name '*.conf'`|
|`-print`|（默认）输出完整路径|`find . -name '*.log' -print`|
|`-delete`|删除找到的文件（**先 -print 确认**）|`find . -name '*.tmp' -delete`|
|`-exec 命令 {} \;`|对每个结果执行命令|`find . -name '*.log' -exec rm {} \;`|

**组合示例**：

```bash
find . -type f -name '*.log' -size +10M      # 大日志文件
find . -name '*.py' -exec grep -l 'TODO' {} \;   # 搜索含 TODO 的 py 文件
find . -maxdepth 1 -type f -mtime -1         # 当前目录下最近 1 天修改的文件
```

> **安全习惯**：`-delete`​ 不可撤销，先用 `-print`​ 确认匹配范围；`-exec`​ 中 `{}`​ 会被替换为每个匹配路径，`\;` 结尾表示执行一次命令。

### 6.2 标准流与组合

标准输入、标准输出、标准错误分别是 `0、1、2`。

```bash
cat app.log | grep 'error' | wc -l
ps aux | grep '[p]ython' | sort -k3 -nr | head
command > all.log 2>&1        # 标准输出和错误都写入文件
command 2>&1 | tee -a run.log # 同时显示并追加保存
```

> 💡 **理解**：`|`​ 把前一个命令的输出交给后一个命令；`>`​ 把输出写入文件并覆盖旧内容；`>>` 追加。

### 6.3 常见问题：管道与重定向

- `|`：把前一个命令的标准输出传给后一个命令的标准输入，适合组合处理。
- `>`：把标准输出写入文件并覆盖原内容。
- `>>`：把标准输出追加到文件末尾。
- `2>`​：只重定向标准错误；`> all.log 2>&1` 同时保存标准输出和标准错误。

例如：

```bash
ps aux | grep '[p]ython'        # 进程输出交给 grep 筛选
ls -lah > listing.txt           # 输出写入文件并覆盖
command 2> error.log            # 错误单独保存
```

## 七、Shell 脚本与后台任务

> 当命令组合需要重复执行时，脚本可以提高效率和可重复性；后台任务必须配合进程检查和日志确认。

### 7.1 脚本基础

```bash
#!/usr/bin/env bash
set -u
for file in *.log; do
  [ -e "$file" ] || continue
  echo "处理：$file"
done
```

使用双引号保护变量，避免路径中的空格被拆分；修改后先执行 `bash -n script.sh` 检查语法。

### 7.2 后台运行与日志

```bash
python train.py > train.log 2>&1 &
nohup python train.py > train.log 2>&1 &
echo $!                         # 最近后台进程 PID
pgrep -af train.py
grep -nEi 'error|fail|warning' train.log
```

`&`​ 只负责放入后台；`nohup`​ 主要防止终端关闭造成挂断，复杂任务更适合 `tmux`​/`screen`。日志定位通常按“关键字 → 行号 → 上下文 → 进程状态”进行。

### <span id="20260819145903-odv1il7" class="siyuan-block-anchor" aria-hidden="true"></span>7.3 常见问题：`&`​、`nohup`​ 与 `tmux`

|方式|解决的问题|边界|
| ------| ----------------------------------------------| -----------------------------------------------|
|`&`|让命令在当前 Shell 的后台运行|终端关闭或 Shell 退出时，任务可能收到挂断信号|
|`nohup`|忽略挂断信号，使任务尽量不受终端关闭影响|不是完整的任务管理器，交互控制和恢复能力有限|
|`tmux`|提供可重新连接的终端会话，保留交互环境和现场|需要安装并学习会话、窗口和分屏操作|

短暂后台任务可用 `&`​；需要脱离终端运行的非交互任务可用 `nohup`​；需要持续观察或再次交互的任务适合 `tmux`。

> SSH 场景补充：远程 SSH 会话断开后，`tmux`​ 会话仍保留现场，重连后 `tmux attach -t 会话名`​ 即可恢复——远程训练/长任务的标准保活手段（关联：[SSH学习：Step 9 tmux](/siyuan/已归档/SSH学习（已归档）/)）。

### 7.4 作业控制与后台任务实战

> 作业（job）是 Shell 中"正在运行的一条命令"；配合 `Ctrl+Z`​、`jobs`​、`fg/bg` 可以在前后台之间切换。

**作业控制命令**：

|命令/按键|作用|
| -----------| ------------------------------|
|`Ctrl+Z`|暂停当前前台任务（不是结束）|
|`Ctrl+C`|结束当前前台任务|
|`jobs`|列出当前 Shell 的作业及编号|
|`bg %编号`|把暂停的任务放到后台继续运行|
|`fg %编号`|把后台任务调回前台|

**常用组合示例**：

```bash
# 1. 直接后台 + 日志分离
python train.py > train.log 2>&1 &

# 2. 暂停后转后台（适合已启动但忘记加 & 的任务）
python train.py
# 按 Ctrl+Z 暂停 → jobs 查看编号 → bg %1 后台继续

# 3. nohup：脱离终端运行（不会因终端关闭被杀）
nohup python train.py > train.log 2>&1 &

# 4. tmux：完全保活 + 可重新介入
tmux new -s train
# 在会话里运行 python train.py，Ctrl+b d 脱离后任务继续
tmux attach -t train     # 回来继续操作
```

**tmux 速查**：

|操作|命令/按键|
| -------------------| -------------------|
|新建会话|`tmux new -s 名称`|
|列出会话|`tmux ls`|
|重连会话|`tmux attach -t 名称`|
|脱离会话|`Ctrl+b`​ 然后 `d`|
|结束会话|`tmux kill-session -t 名称`|
|分屏（水平/垂直）|`Ctrl+b`​ `%`​ / `Ctrl+b`​ `"`|
|切换分屏|`Ctrl+b` 方向键|
|滚动查看历史|`Ctrl+b`​ `[`（q 退出）|

> 选型记忆：**临时小任务**用 `&`​；**要脱离终端但无需交互**用 `nohup`​；**长任务/需要再看再干预**用 `tmux`。

### 7.5 tmux 操作键速查（prefix + 命令键）

> tmux 的所有操作都以**前缀键（prefix）** 开始：默认 `Ctrl+b`​。先按 `Ctrl+b`​ 松开，再按功能键；`Ctrl+b`​ 后跟字符键时**不需要一直按住 Ctrl**。

**会话（session）级操作**——`tmux` 的顶层容器，一个会话含多个窗口：

|操作|按键/命令|
| --------------------------| ---------------------------------|
|脱离会话（任务继续运行）|`Ctrl+b`​ `d`|
|切换会话列表|`Ctrl+b`​ `s`（方向键选择，回车进入）|
|重命名会话|`Ctrl+b`​ `$`|
|新建会话（CLI）|`tmux new -s 名称`|
|列出/重连/结束|`tmux ls`​ / `tmux attach -t 名称`​ / `tmux kill-session -t 名称`|

**窗口（window）级操作**——会话内的"标签页"：

|操作|按键|
| -------------------| -------------------|
|新建窗口|`Ctrl+b`​ `c`|
|重命名窗口|`Ctrl+b`​ `,`|
|上一个/下一个窗口|`Ctrl+b`​ `p`​ / `n`|
|跳到指定编号窗口|`Ctrl+b`​ `0`​~`9`|
|窗口列表|`Ctrl+b`​ `w`|
|关闭当前窗口|`Ctrl+b`​ `&`（确认 y）|

**窗格（pane）级操作**——把窗口拆分成多个区域，可在同一屏幕并行多个命令：

|操作|按键|
| --------------------------| -------------------------|
|左右分窗格|`Ctrl+b`​ `%`|
|上下分窗格|`Ctrl+b`​ `"`|
|按方向切换窗格|`Ctrl+b` 方向键（↑↓←→）|
|切换回上一个窗格|`Ctrl+b`​ `;`|
|循环切换窗格|`Ctrl+b`​ `o`|
|调整当前窗格大小|`Ctrl+b`​ `Ctrl+方向键`（按住持续调整）|
|最大化/还原当前窗格|`Ctrl+b`​ `z`|
|关闭当前窗格|`Ctrl+b`​ `x`|
|把当前窗格拆出为独立窗口|`Ctrl+b`​ `!`|
|窗格布局循环|`Ctrl+b`​ `空格`|

**复制模式与查看历史**：

|操作|按键|
| ----------------------------| -------------------------|
|进入复制模式（可滚动历史）|`Ctrl+b`​ `[`|
|退出复制模式|`q`|
|分页向上/向下滚动|`PageUp`​ / `PageDown`（复制模式中）|
|开始选择文本|空格（复制模式中）|
|复制选中文本|`Enter`|
|粘贴|`Ctrl+b`​ `]`|

**配置示例（~/.tmux.conf）** ：

```text
set -g mouse on        # 开启鼠标：可点击窗格/滚动历史
unbind C-b
set -g prefix C-a      # 把前缀键改为 Ctrl+a（可选）
bind r source-file ~/.tmux.conf   # Ctrl+b r 重载配置
```

> 选型记忆：**会话 = 一组窗口，窗口 = 一组窗格**。分屏看日志/编辑器/运行面板时用 pane；多任务分组用 window；多台机器/项目用 session。

## 八、常见排障与安全清单

|现象|检查方向|
| --------------| ------------------------------------|
|`Permission denied`|路径权限、文件权限、属主、执行权限|
|`No such file or directory`|当前目录、拼写、路径和文件是否存在|
|命令找不到|命令是否安装、是否在 `PATH` 中|
|脚本无法执行|解释器首行、执行权限、换行符、路径|
|后台任务消失|终端挂断、进程状态、日志内容|
|日志没有内容|重定向顺序、输出缓冲、程序是否启动|

### 8.1 常见问题：如何定位日志中的错误时间与上下文

推荐按以下顺序排查：

1. 用 `grep -niE 'error|fail|warning' app.log` 找到关键词、行号并忽略大小写。
2. 用 `grep -C 2 'error' app.log` 查看错误前后的上下文。
3. 若日志没有时间，结合程序输出格式、文件修改时间或 `journalctl` 的时间筛选补充时间信息。
4. 用 `tail -f app.log`​ 观察实时变化，并用 `ps`​/`pgrep` 确认对应进程是否仍在运行。

```bash
grep -niE 'error|fail|warning' train.log
grep -n -C 3 'error' train.log
tail -f train.log
journalctl -u service-name --since '1 hour ago'
```

## 九、压缩与解压

> 归档（archive）是把多个文件/目录**打包**成一个文件；压缩进一步减小体积。Linux 中常"先打包再压缩"（`tar`​ + 压缩工具），常用格式：`.tar.gz`​、`.tar.bz2`​、`.tar.xz`​ 与跨平台 `.zip`。

### 9.1 命令速查总表

|格式|打包/压缩|解压|查看内容（不解压）|
| --------------------| -----------| -----------| --------------------|
|ZIP|`zip`|`unzip`|`unzip -l`|
|gzip（单文件）|`gzip`|`gunzip`​ / `zcat`|`zcat`|
|bzip2（单文件）|`bzip2`|`bunzip2`​ / `bzcat`|`bzcat`|
|xz（单文件）|`xz`|`unxz`​ / `xzcat`|`xzcat`|
|tar 打包（不压缩）|`tar -cvf`|`tar -xvf`|`tar -tvf`|
|tar.gz|`tar -czvf`|`tar -xzvf`|`tar -tzvf`|
|tar.bz2|`tar -cjvf`|`tar -xjvf`|`tar -tjvf`|
|tar.xz|`tar -cJvf`|`tar -xJvf`|`tar -tJvf`|

### 9.2 常用示例

```bash
# ZIP：压缩目录（-r 递归）、解压（-d 指定目录）、查看内容
zip -r archive.zip ./data/
unzip archive.zip -d ./extracted/
unzip -l archive.zip      # -l（list）：只列出包内文件清单，不解压

# tar 打包 + gzip 压缩 / 解压 / 查看
tar -czvf archive.tar.gz ./data/
tar -xzvf archive.tar.gz -C /tmp/
tar -tzvf archive.tar.gz   # -t（list）：列出 tar 包内容，不解压

# xz 单文件压缩 / 解压 / 查看（xzcat 只输出内容，不生成文件）
xz file.txt            # → file.txt.xz
xz -d file.txt.xz      # → 还原 file.txt
xzcat file.txt.xz      # 直接查看内容

# 解压常见四种格式的统一记忆
tar -xzf a.tar.gz   # gzip
tar -xjf a.tar.bz2  # bzip2
tar -xJf a.tar.xz   # xz
tar -xf  a.tar      # 纯打包
```

### 9.3 指令不可用怎么办（安装对应 apt 包）

> 遇到 `command not found`​，先用 `command -v 命令` 确认缺失，再按对应工具包安装。

```bash
command -v zip unzip xz xzcat     # 查看哪些缺失
```

|命令|对应 apt 包|
| ----------------| ------------------|
|`zip`​ / `unzip`|`sudo apt install zip unzip`|
|`xz`​ / `xzcat`​ / `unxz`|`sudo apt install xz-utils`|
|`tar`|`sudo apt install tar`（一般已装）|
|`gzip`​ / `zcat`|`sudo apt install gzip`（一般已装）|
|`bzip2`​ / `bzcat`|`sudo apt install bzip2`（一般已装）|

```bash
sudo apt update
sudo apt install zip unzip xz-utils    # 示例：补齐常用压缩工具
```

> 一般套路：`command -v 命令`​ 确认缺失 → `apt-cache search 关键词`​ 找包名 → `sudo apt install 包名`​ 安装 → 再 `command -v` 验证。

### 9.4 易错点

- **解压到指定目录**：`unzip x.zip -d dir/`​、`tar -xzf x.tar.gz -C dir/`，避免文件散落当前目录；
- **zip 必须**  **​`-r`​**​ **才递归压缩目录**，否则只打包空目录；
- `xzcat`​ / `zcat`​ / `bzcat`​ 只是**打印内容查看**，不会生成解压后的文件；需要还原文件用 `xz -d`​ / `gunzip`​ / `bunzip2`；
- **tar 选项中的** **​`f`​**​ **必须写在一起结尾并紧跟文件名**：`tar -xzf`​ 中的 `f`​ 是最后一位且后面直接跟归档文件名；把 `f` 放别处容易报错。

<section class="siyuan-references" aria-label="文档引用">

## 文档关系

### 本文引用
- [CMD专项](/siyuan/其他笔记/命令行/CMD专项/)
- [PowerShell专项](/siyuan/其他笔记/命令行/PowerShell专项/)
- [SSH学习（已归档）](/siyuan/已归档/SSH学习（已归档）/)

### 反向引用
- [CMD专项](/siyuan/其他笔记/命令行/CMD专项/)
- [PathLib专项](/siyuan/Python笔记/PathLib专项/)
- [PowerShell专项](/siyuan/其他笔记/命令行/PowerShell专项/)
- [Python文件操作学习（已归档）](/siyuan/已归档/Python文件操作学习（已归档）/)
- [SSH学习（已归档）](/siyuan/已归档/SSH学习（已归档）/)
- [SSH专项](/siyuan/其他笔记/命令行/SSH专项/)
- [命令行](/siyuan/其他笔记/命令行/)
- [其他笔记](/siyuan/其他笔记/)
- [学习笔记](/siyuan/)

</section>
