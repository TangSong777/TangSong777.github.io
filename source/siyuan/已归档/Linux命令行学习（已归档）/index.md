---
title: 'Linux命令行学习（已归档）'
date: '2026-08-18T17:26:50+08:00'
updated: '2026-08-19T15:17:35+08:00'
layout: page
type: siyuan-note
notebook: '学习笔记'
permalink: 'siyuan/已归档/Linux命令行学习（已归档）/'
siyuan_source: '已归档/Linux命令行学习（已归档）.md'
comments: false
categories:
  - '学习笔记'
  - '已归档'
---

# Linux命令行学习

> 从零开始系统掌握 Linux 命令行。本文档采用“概念 → 命令 → 示例 → 练习 → 验收”的结构，面向初学者，同时覆盖嵌入式开发、科研计算和服务器运维中最常用的技能。

## 学习说明

- **建议环境**：Ubuntu 或 Debian；可使用实体机、虚拟机、WSL 或 Rock 5B+。
- **学习方式**：先在安全的练习目录中操作，再接触真实项目。
- **总目标**：能够独立完成文件管理、权限配置、文本编辑、进程排查、文本搜索、后台运行和日志分析。
- **安全原则**：不要在不理解的情况下执行 `sudo`​、`rm -rf`​、`chmod -R`​、`chown -R`；涉及系统目录先确认路径。

## 全部路线

|阶段|主题|核心产出|
| ------| ----------------------| ----------------------------------|
|0|系统与终端基础|理解Linux、Shell、路径和命令格式|
|1|目录与文件|独立管理文件和目录|
|2|查看与编辑文本|能读取、编辑和生成文本文件|
|3|权限与用户|能解释并修改权限、属主和属组|
|4|进程与资源|能查找、监控和安全停止进程|
|5|搜索、管道与重定向|能组合命令处理数据和日志|
|6|文本处理与Shell基础|能编写简单自动化脚本|
|7|后台运行、服务与日志|能运行任务并排查问题|
|8|综合项目与能力验证|完成一次端到端排障|

# 第0阶段：系统、终端与命令基础

> Linux 是内核；Ubuntu、Debian 等是包含内核、工具和软件包的发行版；终端是输入命令的界面；Shell 是解释并执行命令的程序。

## 0.1 登录终端与提示符

```bash
whoami                 # 当前用户名
hostname               # 主机名
pwd                    # 当前工作目录
uname -a               # 内核和系统信息
cat /etc/os-release    # 发行版信息
```

常见提示符：`$`​ 通常表示普通用户，`#` 通常表示 root。命令的一般形式是：

```text
命令 [选项] [参数]
```

例如 `ls -lah /var/log`​ 中，`ls`​ 是命令，`-lah`​ 是选项，`/var/log` 是参数。

## 0.2 获取帮助

```bash
man ls                 # 查看手册，按 q 退出
ls --help              # 查看简要帮助
apropos permission     # 按关键词搜索手册
history                # 查看命令历史
clear                  # 清屏
cp					   # 复制文件和目录
grep				   # 打印符合图案的行
chomd				   # 改变文件的模式/权限等
```

**练习：**  查询 `cp`​、`grep`​、`chmod` 的帮助，记录一个此前不知道的选项。

# 第1阶段：目录与文件管理

> Linux 使用以 `/`​ 为根的树状目录；相对路径从当前目录出发，绝对路径从 `/` 出发。

## 1.1 常见目录

|目录|用途|
| ------| ----------------------|
|`/`|根目录|
|`/home`|普通用户的家目录|
|`/root`|root 用户家目录|
|`/etc`|系统配置|
|`/var/log`|经常变化的数据和日志|
|`/usr/bin`|系统程序|
|`/tmp`|临时文件|
|`/dev`|设备文件|
|`/proc`|进程和内核信息|

## 1.2 导航与查看

```bash
pwd                    # 显示当前位置
ls                     # 列出目录内容
ls -l                  # 长格式，包含权限、属主、大小和时间
ls -a                  # 显示隐藏文件
ls -lh                 # 使用易读的大小单位
ls -lah                # 组合选项
cd /tmp                # 进入绝对路径
cd ..                  # 返回上一级
cd ~                   # 回到家目录
cd -                   # 回到上一次目录
```

文件名以 `.`​ 开头时通常是隐藏文件。路径中的空格需要使用引号或反斜杠：`cd 'my dir'`​、`cd my\ dir`。

## 1.3 创建文件和目录

```bash
mkdir demo              # 创建目录
mkdir -p a/b/c          # 创建多层目录
touch empty.txt        # 创建空文件或更新时间
printf 'hello\n' > hello.txt  # 创建并写入一行
```

## 1.4 复制、移动和删除

```bash
cp hello.txt copy.txt       # 复制文件
cp -i hello.txt copy.txt    # 覆盖前询问
cp -r a backup_a            # 递归复制目录
mv copy.txt renamed.txt     # 重命名或移动
mv renamed.txt a/           # 移动到目录
rm -i a/renamed.txt         # 删除前询问
rmdir empty_dir             # 删除空目录
rm -r directory             # 递归删除目录，谨慎使用
```

`rm` 通常不可恢复。练习必须放在专用目录中：

```bash
mkdir -p ~/linux-lab/files
cd ~/linux-lab/files
```

## 1.5 文件名匹配与通配符

- `*`​：匹配任意长度字符，例如 `*.log`
- `?`​：匹配一个字符，例如 `file?.txt`
- `[abc]`：匹配括号中的一个字符
- `{a,b}`​：Shell 展开为多个选项，例如 `cp file.{txt,bak}`

```bash
ls *.txt
cp report{,.bak}
```

**阶段练习：**  创建 `project/{src,docs,logs}`​，在 `src`​ 中创建三个文件，复制一个文件到 `docs`，再安全删除其中一个。

# 第2阶段：查看、编辑与生成文本

> 命令行中的配置、脚本和日志大多是文本文件；先学会查看，再学会编辑，最后学会批量处理。

## 2.1 查看文本

```bash
cat file.txt              # 一次性输出全文，适合短文件
less file.txt             # 分页查看，q退出，/关键词搜索
head -n 10 file.txt       # 查看前10行
 tail -n 10 file.txt       # 查看后10行
wc -l -w -c file.txt      # 行数、单词数、字节数
file file.txt             # 判断文件类型
```

大文件优先使用 `less`​，不要盲目使用 `cat`。

## 2.2 nano

```bash
nano config.txt
```

`nano`​ 中常用快捷键：`Ctrl+O`​ 保存，回车确认文件名；`Ctrl+X`​ 退出；`Ctrl+W`​ 搜索；`Ctrl+K`​ 剪切行；`Ctrl+U`​ 粘贴；`Ctrl+G`​ 帮助。底部的 `^` 表示 Ctrl。

## 2.3 vim

```bash
vim notes.txt
```

vim 的核心是模式：普通模式用于移动和操作，插入模式用于输入，命令模式用于保存和退出。

- `i`​：当前位置前插入；`a`​：当前位置后插入；`o`：下一行插入
- `Esc`：回普通模式
- `h j k l`​：左、下、上、右；`w`​ 下一个单词；`gg`​ 文件开头；`G` 文件末尾
- `dd`​ 删除行；`yy`​ 复制行；`p`​ 粘贴；`u`​ 撤销；`Ctrl+r` 重做
- `/text`​ 搜索；`n`​ 下一个匹配；`:%s/旧/新/g` 全文替换
- `:w`​ 保存；`:q`​ 退出；`:wq`​ 保存退出；`:q!` 不保存退出

**安全练习：**  创建实验文件，在其中写入5行文本，完成搜索、删除一行、复制一行、替换一个词并保存。

## 2.4 不打开编辑器修改文本

```bash
echo 'one' > file.txt             # 覆盖写入
echo 'two' >> file.txt            # 追加写入
printf 'a\nb\n' > data.txt
sed -n '1,5p' data.txt             # 打印指定行
sed 's/old/new/g' data.txt         # 输出替换结果，不修改原文件
sed -i.bak 's/old/new/g' data.txt  # 原地修改并保留备份
cat > new.txt <<'EOF'
line one
line two
EOF
```

# 第3阶段：权限、用户与安全

> 权限决定“谁能对什么对象做什么操作”。文件权限分为属主、属组和其他人三组。

## 3.1 用户与属组

```bash
whoami                       # 当前用户
id                           # UID、GID及所属组
id username                  # 查看指定用户
 groups                      # 当前用户所属组
ls -l file.txt               # 查看属主和属组
```

属主通常是创建文件的用户；属组用于多人协作。root 可以管理系统资源，但不应把日常操作都放在 root 下。

## 3.2 读、写、执行权限

```text
-rw-r--r--
│├──┬──┬──  属主、属组、其他人权限
│└───────    文件类型
```

- 普通文件：`r`​ 读取内容，`w`​ 修改内容，`x` 作为程序执行。
- 目录：`r`​ 列出名称，`w`​ 创建/删除/重命名其中的项目，`x` 进入目录并访问其内容。
- `-` 表示没有该权限。

`rwx`​ 的数值分别为 `4、2、1`​：`7=rwx`​、`6=rw-`​、`5=r-x`​、`4=r--`。

```bash
-rw-r--r--  # 644：属主读写，其他人只读
-rwxr-xr-x  # 755：属主读写执行，其他人读执行
-rw-------  # 600：只有属主读写
```

## 3.3 修改权限和属主

```bash
chmod 644 file.txt             # 数字方式
chmod u+x script.sh             # 属主增加执行权限
chmod g-w file.txt              # 属组移除写权限
chmod o-r file.txt              # 其他人移除读权限
chmod a=rx file.txt             # 所有人设置为读和执行
chmod -R u+rwX project/         # 递归修改，先确认目录
chown user:group file.txt       # 修改属主和属组，需要相应权限
chgrp group file.txt            # 修改属组
```

常见场景：脚本通常需要 `chmod +x script.sh`​；私钥等敏感文件通常使用 `chmod 600 key`​；共享目录应优先使用合适的属组，而不是简单设置 `777`。

## 3.4 特殊权限与默认权限

```bash
umask                       # 查看默认权限掩码
stat file.txt               # 查看详细元数据
```

目录的 `x`​ 权限尤其重要。没有目录的 `x`​，即使知道文件名，也不能正常访问文件。`777` 会让所有人可写，容易造成误删或篡改，不应作为默认解决方案。

**阶段练习：**  创建脚本和私密文件，分别设置 `755`​ 与 `600`​，用 `ls -l`​ 和 `stat` 验证变化，并解释每一位权限。

# 第4阶段：进程、信号与资源

> 程序运行后成为进程；每个进程有PID、父进程、用户、状态和资源占用。

## 4.1 查看进程

```bash
ps                         # 当前终端的进程
ps aux                     # 全部用户的进程快照
ps -ef                     # 另一种常用格式
pgrep -af python            # 按名称查找并显示命令行
pstree -p                  # 查看进程树
top                        # 实时监控，q退出
```

```bash
ps aux | grep '[p]ython'                 # 避免匹配grep自身
ps -p PID -o pid,ppid,user,stat,%cpu,%mem,cmd
```

## 4.2 信号与结束进程

```bash
kill PID                  # 默认发送TERM，请求程序正常退出
kill -TERM PID            # 明确发送TERM
kill -STOP PID            # 暂停
kill -CONT PID            # 继续
kill -KILL PID            # 强制结束，最后手段
pkill -f 'pattern'        # 按命令行匹配，谨慎使用
```

优先使用普通 `kill`​，给程序清理资源的机会；只有程序无响应时才使用 `kill -9`（KILL）。不要随意对系统进程或未知PID执行强制结束。

## 4.3 前台、后台与作业控制

```bash
command &                 # 后台运行
jobs                      # 查看当前Shell作业
Ctrl+Z                    # 暂停前台任务
bg                        # 让暂停任务后台继续
bg %1					  # 选择哪个后台继续
fg                        # 调回前台
fg %2					  # 选择哪个后台调回前台
```

**练习：**  用 `sleep 300 &`​ 创建后台任务，使用 `jobs`​、`ps`​ 找到它，再用 `kill` 正常结束。

# 第5阶段：搜索、管道与重定向

> 管道把一个命令的标准输出连接到另一个命令的标准输入；重定向把输入或输出连接到文件。

## 5.1 grep文本搜索

```bash
grep 'error' app.log                  # 搜索文本
grep -n 'error' app.log               # 显示行号
grep -i 'error' app.log               # 忽略大小写
grep -v 'debug' app.log               # 排除匹配行
grep -r --include='*.log' 'error' .   # 递归搜索
grep -E 'error|warning' app.log       # 扩展正则
grep -C 2 'error' app.log              # 显示上下文
grep -c 'error' app.log               # 统计匹配行数
grep -l 'error' *.log                  # 只显示文件名
```

## 5.2 find文件搜索

```bash
find . -type f -name '*.py'
find . -type d -name 'build'
find . -type f -size +100M
find . -type f -mtime -1
find . -type f -mmin -30
find . -type f -name '*.log' -exec grep -l 'error' {} \;
```

`find`​ 的 `-exec`​ 会对找到的对象执行命令；删除前先把 `-delete`​ 换成 `-print` 检查结果。

## 5.3 管道、标准流与重定向

标准输入是 `0`​，标准输出是 `1`​，标准错误是 `2`。

```bash
cat app.log | grep 'error' | wc -l
ps aux | grep '[p]ython' | sort -k3 -nr | head
ls -lah > listing.txt                 # 覆盖标准输出
ls -lah >> listing.txt                # 追加标准输出
command 2> error.log                  # 只保存错误
command > all.log 2>&1                # 输出和错误都保存
command 2>&1 | tee -a run.log        # 显示并追加保存
```

- `|`：命令之间传递数据。
- `>`：输出到文件并覆盖旧内容。
- `>>`：输出到文件并追加。
- `wc -l`​：统计行数；`cat`​：读取/连接文件；`echo`：输出字符串。

# 第6阶段：文本处理与Shell基础

> 当命令组合重复出现时，应使用文本处理工具或脚本提高效率和可重复性。

## 6.1 常用文本工具

```bash
cut -d: -f1 /etc/passwd          # 按分隔符提取字段
sort names.txt                   # 排序
sort names.txt | uniq             # 去重相邻行
sort access.log | uniq -c | sort -nr | head
awk '{print $1, $3}' data.txt     # 按列处理
sed -n '10,20p' file.txt          # 打印范围行
tr 'a-z' 'A-Z' < file.txt         # 字符转换
tee output.txt                    # 同时显示和保存
```

## 6.2 Shell脚本基础

```bash
#!/usr/bin/env bash
set -u

name="Linux"
echo "Hello, $name"

for file in *.log; do
  [ -e "$file" ] || continue
  echo "处理：$file"
done
```

变量引用通常使用双引号：`"$file"`，避免路径含空格时被错误拆分。判断、条件和函数：

```bash
if [ -f "$1" ]; then
  echo "普通文件"
elif [ -d "$1" ]; then
  echo "目录"
else
  echo "不存在"
fi
```

运行：`chmod +x check.sh`​，然后 `./check.sh path`​。脚本修改后先用 `bash -n check.sh` 检查语法。

# 第7阶段：后台运行、服务与日志

> 长时间任务需要脱离终端运行，并通过日志确认状态和定位错误。

## 7.1 nohup与输出保存

```bash
python train.py > train.log 2>&1 &
nohup python train.py > train.log 2>&1 &
echo $!                         # 最近一个后台进程PID
pgrep -af train.py
```

`&`​ 只表示放到后台；终端关闭后任务可能收到挂断信号。`nohup`​ 忽略挂断信号，但不等于完善的任务管理器。更复杂的任务可使用 `tmux`​ 或 `screen`。

## 7.2 查看日志

```bash
tail -f train.log                 # 实时跟踪，Ctrl+C退出
tail -n 100 train.log
grep -nEi 'error|fail|warning' train.log
journalctl -u service-name        # 查看systemd服务日志
journalctl -u service-name -f     # 实时跟踪服务日志
journalctl --since '1 hour ago'
```

## 7.3 systemd服务基础

```bash
systemctl status service-name
sudo systemctl start service-name
sudo systemctl stop service-name
sudo systemctl restart service-name
sudo systemctl enable service-name
```

先查看状态和日志，再决定是否重启。不要把未知服务设置为开机启动。

# 第8阶段：综合项目

> 用一个小项目串联目录、权限、编辑、进程、搜索、后台运行和日志分析。

## 8.1 项目任务

1. 在 `~/linux-lab/project`​ 创建 `src`​、`logs`​、`backup` 三个目录。
2. 创建一个可执行脚本 `src/worker.sh`，每秒输出一条带时间的消息，并偶尔输出错误信息。
3. 使用 `chmod`​ 设置脚本权限，使用 `ls -l` 验证。
4. 使用 `nohup`​ 将脚本放到后台，输出保存到 `logs/worker.log`。
5. 用 `pgrep`​ 或 `ps`​ 找到进程，使用 `tail -f` 观察日志。
6. 用 `grep`​ 统计错误，用 `find` 找到日志文件。
7. 复制日志到 `backup`，结束进程，并确认进程已消失。
8. 将执行命令和结果写入 `README.md`。

## 8.2 推荐脚本

```bash
#!/usr/bin/env bash
for i in $(seq 1 10); do
  printf '%s INFO iteration=%s\n' "$(date '+%F %T')" "$i"
  if [ "$((i % 4))" -eq 0 ]; then
    printf '%s ERROR simulated_failure iteration=%s\n' "$(date '+%F %T')" "$i" >&2
  fi
  sleep 1
done
```

# 完成标准与验证

## 必须掌握

- [X] 能优先使用 TERM 停止进程，并解释 KILL 的风险
- [X] 能用 `grep`​、`find`、管道和重定向分析文件
- [X] 能让任务后台运行并用日志确认结果
- [X] 能完成综合项目并解释每条命令

## 学习验证提交格式

每个阶段提交三类证据：

1. **运行输出**：粘贴关键命令和真实输出。
2. **主动修改**：修改参数或命令，说明结果如何变化。
3. **口头解释**：回答“为什么这样做”，而不是只描述命令表面含义。

建议重点回答：

- `chmod 755`​ 与 `chmod +x` 有什么区别？

前者是修改属主，属组，其他人的权限为读写和执行，仅不可写，仅不可写。后者是为所有人加上了可执行的权限

- 文件的 `x`​ 权限和目录的 `x` 权限分别意味着什么？

文件的x权限意味着可执行，目录的x权限意味着可以进入目录

- 管道 `|`​ 与重定向 `>` 有什么区别？

前者是将前面的命令执行的输出给后面的命令，常用于grep搜索用。

后者是将前面的命令写入到某个文件中，常用于运行程序编写日志

- `kill`​、`kill -9`​、`pkill` 的风险和使用顺序是什么？

kill是正常结束程序

kill -9是强制结束程序

pkill是按命令行匹配去结束程序

- `&`​、`nohup`​、`tmux` 分别解决什么问题？

不清楚区别，但都是将程序挂在后台

- 如何从日志中定位错误发生的时间和上下文？

grep -i 'error' *.log直接查就行

用-n查行号，再用nano去看然后查行号去看上下文

‍

常见错误排查

|现象|检查方向|
| --------------| ----------------------------------------------|
|`Permission denied`|路径权限、文件权限、属主、是否需要执行权限|
|`No such file or directory`|当前目录、拼写、绝对/相对路径、文件是否存在|
|命令找不到|命令是否安装、是否在 `PATH` 中、是否写错名称|
|脚本无法执行|首行解释器、执行权限、换行符、当前路径|
|后台任务消失|是否受到终端关闭影响、查看日志、检查进程状态|
|日志没有内容|输出是否缓冲、重定向顺序、程序是否真的启动|

## 进阶方向

完成本指南后，可以继续学习：SSH远程连接、网络工具（`ip`​、`ss`​、`curl`）、包管理器、Git、正则表达式、tmux、systemd服务文件、容器和Shell脚本工程化。

<section class="siyuan-references" aria-label="文档引用">

## 文档关系

### 反向引用
- [学习笔记](/siyuan/)
- [已归档](/siyuan/已归档/)

</section>
