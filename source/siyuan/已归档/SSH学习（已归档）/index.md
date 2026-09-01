---
title: 'SSH学习（已归档）'
date: '2026-08-17T17:13:14+08:00'
updated: '2026-08-27T10:03:37+08:00'
layout: page
type: siyuan-note
notebook: '学习笔记'
permalink: 'siyuan/已归档/SSH学习（已归档）/'
siyuan_source: '已归档/SSH学习（已归档）.md'
comments: false
categories:
  - '学习笔记'
  - '已归档'
---

# SSH学习

> 目标：从零掌握 SSH 远程连接、密钥认证、文件传输、端口转发与会话保持。项目连接：**远程连接 Rock 5B+** 、**实验数据回传**当前能力：L0（未完成、未归档，不升级）。

## 阶段一：SSH 是什么、怎么登录

### Step 1：密码登录

```bash
ssh user@192.168.1.100
```

**理解**：SSH 是安全远程登录协议；`user@host` 表示用户和主机地址。首次连接会询问是否信任主机指纹。

**自己做**：连接一台可用 Linux 主机或虚拟机，退出用 `exit`。

### Step 2：常用连接参数

```bash
ssh -p 2222 user@host      # 指定端口
ssh -v user@host           # 调试模式
ssh user@host "ls -la"     # 远程执行单条命令
```

**理解**：这些参数帮助你更灵活地使用SSH：

- `-p`：当SSH服务运行在非标准端口时使用
- `-v`：调试模式，用于排查连接问题
- 直接执行命令：适合快速检查或自动化任务

**自己做**：尝试使用不同的参数连接服务器，比如：

1. 使用`-p`指定非标准端口连接
2. 使用`-v`查看详细连接过程
3. 使用`ssh user@host "命令"`执行远程命令
4. 记录不同参数的使用场景

## 阶段二：密钥认证

### Step 3：生成密钥对

```bash
ssh-keygen -t ed25519 -C "your_email@example.com"
```

**理解**：生成一对密钥：私钥（留在本地，保密）和公钥（放到服务器）。

**自己做**：生成你自己的密钥对：

1. 使用`ssh-keygen -t ed25519 -C "你的邮箱@example.com"`生成密钥
2. 查看生成的文件：`ls -la ~/.ssh/`
3. 理解私钥(`id_ed25519`​)和公钥(`id_ed25519.pub`)的区别
4. 尝试使用不同的密钥类型（如`-t rsa -b 4096`）

### Step 4：配置免密登录

```bash
ssh-copy-id user@host
```

**理解**：`ssh-copy-id`​ 把公钥追加到服务器的 `~/.ssh/authorized_keys`。之后登录不再输密码。

**易错**：私钥权限不能太开放，`chmod 600 ~/.ssh/id_ed25519`。

**自己做**：配置免密登录并测试：

1. 使用`ssh-copy-id user@host`将公钥上传到服务器
2. 尝试使用密码登录（应该不再需要密码）
3. 检查服务器上的`~/.ssh/authorized_keys`文件内容
4. 故意设置错误的私钥权限，观察连接错误信息

### Step 5：SSH config 简化连接

```text
# ~/.ssh/config
Host rock
    HostName 192.168.1.100
    User root
    Port 22
    IdentityFile ~/.ssh/id_ed25519
```

之后直接 `ssh rock`。

**理解**：SSH config文件允许你定义主机别名，简化复杂的SSH命令。只需记住别名，SSH会自动使用配置的参数。

**自己做**：创建并使用SSH config：

1. 创建或编辑`~/.ssh/config`文件
2. 为你的服务器添加一个Host配置
3. 使用`ssh 别名`连接服务器
4. 尝试添加多个Host配置，管理不同的服务器

## 阶段三：文件传输

### Step 6：scp 与 rsync

```bash
scp local.csv user@host:/data/
scp user@host:/data/result.csv .
rsync -avz ./data/ user@host:/data/
```

**理解**：`scp`​ 单文件/目录复制；`rsync` 增量同步，适合大量数据回传。

**自己做**：练习文件传输：

1. 使用scp将本地文件上传到服务器
2. 使用scp从服务器下载文件到本地
3. 使用rsync同步一个目录，观察增量传输效果
4. 比较scp和rsync在传输大量小文件时的性能差异

## 阶段四：端口转发

### Step 7：本地端口转发

```bash
ssh -L 8080:localhost:8000 user@host
```

**理解**：把本地 8080 端口转发到远程 8000 端口，用于访问板卡内部服务。

**自己做**：设置端口转发并测试：

1. 设置本地端口转发，将远程服务映射到本地端口
2. 在本地浏览器或客户端访问`localhost:8080`测试连接
3. 尝试同时进行多个端口转发
4. 观察端口转发在防火墙限制下的作用

> 本地端口转发原理：`-L 8080:localhost:8000`​ 建立一条 SSH 加密隧道——SSH 连接本身仍走默认 22 端口（或 `-p`​ 指定端口）连到远程主机；此后打开**本机** 8080 端口的流量，会被加密转发到远程主机的 `localhost:8000` 服务。因此远程 8000 服务即使只监听 127.0.0.1，也能从本机安全访问（如板卡 Web 服务、调试接口）。

### Step 8：远程端口转发

```bash
ssh -R 9000:localhost:22 user@server
```

**理解**：把本地 22 端口暴露到远程 9000，用于内网穿透。

**自己做**：尝试远程端口转发：

1. 设置远程端口转发，将本地SSH服务暴露到远程服务器
2. 从远程服务器连接回本地机器
3. 理解远程端口转发在网络受限环境中的应用
4. 尝试结合本地和远程端口转发创建隧道

> 远程端口转发 `-R 9000:localhost:22`​ 的典型用途是**内网穿透/反向连接**：把你本机的 22 端口服务"暴露"到远程服务器的 9000 端口，之后从任何地方连接 `远程服务器:9000`，等效于连接你的本机。
>
> **例子**：宿舍里的板卡没有公网 IP，但实验室有台公网服务器。在板卡上执行 `ssh -R 9000:localhost:22 user@公网服务器`​，建立反向隧道；之后你在实验室机器上执行 `ssh -p 9000 user@公网服务器`，就能经由公网服务器连回宿舍板卡，实现从外网管理内网设备。

## 阶段五：会话保持与实战

### Step 9：tmux 保持会话

```bash
tmux new -s train
# 运行 python train.py
# 按 Ctrl+b 再按 d 脱离
tmux attach -t train
```

**理解**：tmux 让远程训练在断线后继续运行。

**自己做**：使用tmux管理远程会话：

1. 创建一个新的tmux会话并命名
2. 在会话中运行一个长时间任务（如`sleep 100`）
3. 脱离会话（Ctrl+b d），观察任务是否继续运行
4. 重新连接会话，检查任务状态
5. 尝试在tmux中分屏操作

> 关联：SSH 会话断开后 tmux 会话仍保留现场，重连后 `tmux attach -t 会话名`​ 恢复——这是远程长任务的保活标准做法。`&`​/`nohup`​/`tmux`​ 三种后台方式对比见 [Linux专项：&、nohup 与 tmux](/siyuan/其他笔记/命令行/Linux专项/#20260819145903-odv1il7)。

### Step 10：综合练习

目标：从本机免密登录板卡，回传一个 CSV，并通过本地端口转发访问板卡 Web 服务。

```bash
ssh rock
scp rock:/data/result.csv .
ssh -L 8080:localhost:8000 rock
```

## 完成标准

- [X] 能解释公钥/私钥原理
- [X] 能配置免密登录和 SSH config
- [X] 能用 scp/rsync 传输文件
- [X] 能配置本地端口转发
- [X] 会用 tmux 保持远程会话

## 学习验证提交格式

完成后提交三类证据：

### 证据 1：运行输出

粘贴免密登录、scp 文件传输、tmux 会话的真实输出。

### 证据 2：主动修改

至少完成一项并说明结果变化：

- 修改 SSH config 增加 Host 别名
- 改用 rsync 替代 scp 并观察传输
- 配置本地端口转发并访问服务

### 证据 3：口头解释

1. 公钥和私钥分别放在哪里、作用是什么？
2. `scp`​ 和 `rsync` 的区别？
3. 本地端口转发 `-L`​ 和远程端口转发 `-R` 的区别？

## 常见错误与故障排除

### 1. 连接问题

**错误**：`Connection refused`​ 或 `No route to host`

- 检查目标主机是否开机、网络是否连通
- 确认SSH服务正在运行：`sudo systemctl status ssh`
- 检查防火墙是否放行SSH端口（默认22）

**错误**：`Permission denied, please try again`

- 确认用户名和密码正确
- 检查用户是否有登录权限
- 检查`/etc/ssh/sshd_config`​中的`PermitRootLogin`设置

### 2. 密钥认证问题

**错误**：`Permission denied (publickey)`

- 检查公钥是否已正确上传到服务器：`cat ~/.ssh/authorized_keys`
- 检查私钥权限：`chmod 600 ~/.ssh/id_ed25519`
- 确认服务器`sshd_config`​中`PubkeyAuthentication`已启用

**错误**：`Bad owner or permissions on ~/.ssh/config`

- 修复权限：`chmod 600 ~/.ssh/config`
- 确保目录权限：`chmod 700 ~/.ssh`

### 3. 文件传输问题

**错误**：`scp: protocol not available` 或传输中断

- 使用`rsync -avz`替代，支持断点续传
- 检查网络稳定性
- 尝试压缩传输：`scp -C file user@host:/path/`

### 4. 端口转发问题

**错误**：端口被占用

- 使用`netstat -tuln | grep 端口号`检查端口占用
- 选择其他端口进行转发
- 使用`lsof -i :端口号`查找占用进程

### 5. tmux会话问题

**错误**：`tmux: command not found`

- 安装tmux：`sudo apt install tmux`（Ubuntu/Debian）
- 或`sudo yum install tmux`（CentOS/RHEL）

**错误**：无法重新连接tmux会话

- 列出所有会话：`tmux ls`
- 重新连接：`tmux attach -t 会话名`
- 检查会话是否已结束：`tmux list-sessions`

### 6. SSH连接超时

**问题**：长时间无操作后连接断开

- 在客户端配置`ServerAliveInterval 60`
- 在服务器配置`ClientAliveInterval 60`
- 使用`tmux`保持会话

### 7. SSH配置问题

**错误**：配置文件语法错误

- 验证配置：`sshd -t`
- 检查配置文件权限：`chmod 600 /etc/ssh/sshd_config`
- 重启SSH服务：`sudo systemctl restart ssh`

## SSH安全最佳实践

### 1. 密钥管理

- 使用强密钥（ed25519或RSA 4096位）
- 为不同服务器使用不同密钥
- 定期轮换密钥
- 使用密钥代理：`ssh-agent`​和`ssh-add`

### 2. 服务器加固

- 禁用root直接登录：`PermitRootLogin no`
- 禁用密码认证：`PasswordAuthentication no`
- 使用非标准端口
- 配置防火墙限制IP访问

### 3. 网络安全

- 使用VPN或跳板机访问内部服务器
- 启用SSH端口转发加密
- 避免在公共WiFi下进行敏感操作
- 使用`ssh -C`启用压缩加密

### 4. 日志监控

- 监控SSH登录日志：`/var/log/auth.log`
- 使用`fail2ban`防止暴力破解
- 设置登录失败通知
- 定期审计SSH配置

### 5. 备份与恢复

- 备份SSH配置：`/etc/ssh/`
- 备份密钥文件：`~/.ssh/`
- 测试恢复流程
- 使用版本控制管理配置

## 实用SSH技巧

### 1. 快速连接

```bash
# 使用SSH config别名
Host rock
    HostName 192.168.1.100
    User root
    Port 22
    IdentityFile ~/.ssh/id_ed25519

# 直接连接
ssh rock
```

### 2. 文件同步

```bash
# 使用rsync增量同步
rsync -avz --progress ./data/ user@host:/data/

# 排除某些文件
rsync -avz --exclude='*.log' ./project/ user@host:/project/
```

### 3. 端口转发高级用法

```bash
# 动态SOCKS代理
ssh -D 1080 user@host

# 多跳转发
ssh -J jump_host user@target_host

# 隧道复用
ssh -o "ControlMaster=auto" -o "ControlPath=/tmp/ssh-%r@%h:%p" user@host
```

### 4. 会话管理

```bash
# tmux会话命名
tmux new -s work
tmux rename -t old_name new_name

# 分屏操作
Ctrl+b %  # 水平分屏
Ctrl+b "  # 垂直分屏
```

### 5. 故障排查

```bash
# 详细调试模式
ssh -vvv user@host

# 测试配置
ssh -G user@host

# 检查连接
ssh -o ConnectTimeout=10 user@host
```

## 能力等级目标

完成基础步骤并在 AI 帮助下跑通并提交证据归档：L0 → L2。  
若脱离本文档独立完成板卡远程连接与数据回传并通过验证归档：L2 → L3 候选。归档前仍按 L0。

## SSH 常见报错补充（局域网设备场景）

以下两个报错常见于路由器/板卡等局域网设备被重置、重刷固件或重新生成密钥之后。

Unable to negotiate with 192.168.195.4 port 22: no matching host key type found. Their offer: ssh-rsa

这个错误表明你尝试使用 ssh 连接到远程服务器时，客户端和服务器之间没有匹配的 host key 类型。

具体来说，远程服务器提供了 ssh-rsa 和 ssh-dss 类型的 host key，但你的 SSH 客户端配置可能不再支持这些较旧的算法。最近的 OpenSSH 版本默认禁用了不够安全的算法，如 ssh-rsa 和 ssh-dss。

- 临时解决方案：`ssh -o HostKeyAlgorithms=+ssh-rsa -o PubkeyAcceptedKeyTypes=+ssh-rsa user@x.x.x.x`

  如果还是连不上：`WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED! `

  这个提示说明你之前连接过 `192.168.6.1`，但这次它的主机密钥变了。在局域网环境里，常见原因就是路由器/设备被重置、重刷固件、或者重新生成了 SSH 密钥。

  那就`ssh-keygen -R 192.168.6.1`直接删除对应条目

<section class="siyuan-references" aria-label="文档引用">

## 文档关系

### 本文引用
- [Linux专项](/siyuan/其他笔记/命令行/Linux专项/)

### 反向引用
- [Linux专项](/siyuan/其他笔记/命令行/Linux专项/)
- [学习笔记](/siyuan/)

</section>
