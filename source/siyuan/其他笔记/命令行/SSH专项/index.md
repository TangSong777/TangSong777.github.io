---
title: 'SSH专项'
date: '2026-08-27T10:02:49+08:00'
updated: '2026-08-31T11:17:37+08:00'
layout: page
type: siyuan-note
notebook: '学习笔记'
permalink: 'siyuan/其他笔记/命令行/SSH专项/'
siyuan_source: '其他笔记/命令行/SSH专项.md'
comments: false
categories:
  - '学习笔记'
  - '其他笔记'
  - '命令行'
---

‍

> SSH（Secure Shell）是加密的远程登录与数据传输协议：客户端与服务器之间的连接全程加密，可防止窃听与篡改。本专项覆盖连接登录、密钥认证、文件传输、端口转发、会话保持、常见故障与安全加固。来源：《SSH学习（已归档）》。相关：[Linux专项](/siyuan/其他笔记/命令行/Linux专项/)。

## 速通：一次完整创建密钥对（实操）

> 从零在 Windows 生成密钥对、把公钥放到服务器的**完整实操流程**，步骤与第二章相互印证（2.1 生成 / 2.2 免密）。

**步骤 1：Windows 端生成密钥对**

```bash
ssh-keygen -t ed25519 -C "你的备注（如邮箱）"   # -C 只是备注文字，可任意
```

**交互提示含义表**：

|提示|含义|建议|
| ------| ----------------------------| -----------------------------------------|
|`Enter file in which to save the key (...id_ed25519):`|默认保存路径|直接回车用默认；多台机器建议改名，如 `.../id_ed25519_rock`|
|`Enter passphrase (empty for no passphrase):`|给私钥再加一层密码（可选）|生产环境建议加；本地练手可留空|
|`Enter same passphrase again:`|再输一遍确认|与上一步保持一致|

**步骤 2：打印公钥并复制**

```bash
cat ~/.ssh/id_ed25519_rock5.pub    # 公钥（.pub）可以公开，复制输出内容
```

**步骤 3：服务器端写入 authorized_keys**

```bash
ssh user@host                        # 先登录进服务器
mkdir -p ~/.ssh && chmod 700 ~/.ssh  # 目录 + 目录权限
nano ~/.ssh/authorized_keys          # 粘贴公钥：Ctrl+O 保存 → Enter 确认 → Ctrl+X 退出
chmod 600 ~/.ssh/authorized_keys     # 文件权限：仅属主读写
```

**易错点**：

- **私钥（无**  **​`.pub`​**​ **）永远留在本机、绝不外传**；公钥可公开；
- 文件/目录权限错（不为 600/700）时 SSH 会直接拒绝密钥认证；
- 多台服务器建议各自命名密钥（如 `id_ed25519_rock5`​），用 `-i 指定密钥` 连接；
- 本流程与 2.2 的 `ssh-copy-id` 等效（手动版原理）。

## 一、连接与登录

> `ssh user@host` 建立到远程主机的加密会话；首次连接会询问是否信任主机指纹（输入 yes 并核对指纹）。

### 1.1 基础登录

```bash
ssh user@192.168.1.100     # 用户@主机
exit                        # 退出登录
```

### 1.2 常用连接参数

|参数|作用|示例|
| --------------| ---------------------------------| ------|
|`-p 端口`|指定非标准端口|`ssh -p 2222 user@host`|
|`-v`​ / `-vvv`|调试/详细调试模式，排查连接问题|`ssh -vvv user@host`|
|远程单条命令|不进入交互 Shell，直接执行|`ssh user@host "ls -la"`|
|`-i 密钥文件`|指定私钥文件|`ssh -i ~/.ssh/id_ed25519 user@host`|
|`-o ConnectTimeout=10`|设置连接超时（秒）|`ssh -o ConnectTimeout=10 user@host`|

### 1.3 主机指纹

- 首次连接时显示服务器公钥指纹，输入 `yes` 后才建立连接；
- 若指纹与预期不符（尤其局域网设备重置后），不要直接信任——见第六章"主机密钥变更"。

### 1.4 一次 SSH 登录的完整流程

> 一次 `ssh user@host` 背后依次发生：建立 TCP 连接 → 交换主机密钥（核对指纹）→ 协商会话密钥 → 认证（密码或密钥）→ 进入远程 shell。全程加密。

|步骤|发生了什么|你要注意什么|
| ------| ----------------------------------------| ------------------------------|
|1|客户端 TCP 连服务器 22 端口|地址/端口可达（先 ping）|
|2|服务器发来**主机公钥**，首次连接客户端显示指纹哈希|**核对指纹**，防中间人|
|3|双方协商临时**会话密钥**（如 DH）|此后链路加密|
|4|认证：密码 或 密钥对|密钥需先 `ssh-keygen`​ + `ssh-copy-id`（见第二章）|
|5|进入远程 shell，命令加密往返|用 `exit` 退出|

- **常见疑问**：SSH **不会自动生成密钥对**，需手动 `ssh-keygen`​；没有密钥**也能用密码连接**（不影响安全，只是体验与强度差异）；首次指纹写入 `~/.ssh/known_hosts`​，之后自动校验，**以后仍可正常连接**；
- 指纹变化（板卡重装/重建密钥）→ 客户端告警 → 用 `ssh-keygen -R 主机IP` 清除后重连（见 6.4）；
- 详细原理版：对称/非对称结合与握手细节见 ((20260824094622-vp6835x "博客网站部署学习方案：SSH 登录完整流程"))。

## 二、密钥认证

> 密钥对由**私钥**（本地保留、保密）与**公钥**（放到服务器）组成：登录时服务器用公钥验证"你持有对应私钥"，从而免输密码。

### 2.1 生成密钥对

```bash
ssh-keygen -t ed25519 -C "your_email@example.com"
# 生成 ~/.ssh/id_ed25519（私钥）与 id_ed25519.pub（公钥）
ssh-keygen -t ed25519 -C "[已隐藏邮箱]"
# 生成 ~/.ssh/id_ed25519（私钥）与 id_ed25519.pub（公钥）
```

- 用 `ls -la ~/.ssh/` 查看生成的文件；
- **易错**：私钥权限不能太开放，`chmod 600 ~/.ssh/id_ed25519`，否则客户端拒绝使用。

### 2.2 配置免密登录：ssh-copy-id

```bash
ssh-copy-id user@host     # 把公钥追加到服务器 ~/.ssh/authorized_keys
```

之后登录不再输密码；服务器上可用 `cat ~/.ssh/authorized_keys` 核对公钥。

### 2.3 SSH config 简化连接

```text
# ~/.ssh/config
Host rock
    HostName 192.168.1.100
    User root
    Port 22
    IdentityFile ~/.ssh/id_ed25519
```

之后直接 `ssh rock`​ 即可。可配置多个 Host 管理不同服务器。**易错**：`~/.ssh/config`​ 权限需 `chmod 600`​、`~/.ssh`​ 目录需 `chmod 700`​，否则报 `Bad owner or permissions`。

### 2.4 密钥代理：ssh-agent / ssh-add

```bash
eval "$(ssh-agent -s)"     # 启动代理
ssh-add ~/.ssh/id_ed25519  # 把私钥加入代理，之后免输 passphrase
```

## 三、文件传输

> `scp`​ 适合少量文件复制；`rsync` 增量同步、支持断点续传，适合大量数据回传。

### 3.1 scp

```bash
scp local.csv user@host:/data/          # 本地上传
scp user@host:/data/result.csv .        # 远程下载
scp -r ./dir/ user@host:/data/          # 递归目录
scp -C file user@host:/path/            # 压缩传输
```

### 3.2 rsync

```bash
rsync -avz ./data/ user@host:/data/              # 归档+详细+压缩
rsync -avz --progress ./data/ user@host:/data/   # 显示进度
rsync -avz --exclude='*.log' ./project/ user@host:/project/  # 排除文件
```

**scp vs rsync**：

|维度|scp|rsync|
| ----------| ------------| ----------------------|
|传输方式|全量复制|增量同步（只传差异）|
|断点续传|不支持|支持|
|大目录|慢|快（先比对）|
|适用|少量单文件|大量数据/目录同步|

## 四、端口转发

> SSH 隧道把"本机端口 ↔ 远程端口"之间的流量加密转发，用于安全访问内网服务或穿透 NAT。

### 4.1 本地转发：-L

```bash
ssh -L 8080:localhost:8000 user@host
```

**原理**：SSH 连接本身仍走默认 22（或 `-p`​ 指定）端口；此后打开**本机** 8080 端口的流量，会被加密转发到远程主机的 `localhost:8000` 服务。远程 8000 服务即使只监听 127.0.0.1 也能从本机访问。

### 4.2 远程转发：-R

```bash
ssh -R 9000:localhost:22 user@server
```

**原理**：把**本机**的 22 端口服务暴露到远程服务器的 9000 端口，适合内网穿透。**例子**：宿舍板卡无公网 IP，主动反向连接实验室公网服务器后，从任何地方 `ssh -p 9000 user@公网服务器` 即可连回板卡。

### 4.3 高级用法

```bash
ssh -D 1080 user@host                        # 动态 SOCKS 代理
ssh -J jump_host user@target_host            # 跳板机（多跳）
ssh -o "ControlMaster=auto" -o "ControlPath=/tmp/ssh-%r@%h:%p" user@host  # 隧道复用
```

## 五、会话保持

> 远程长任务必须解决"断线后任务继续运行"的问题，常用 `tmux`。

### 5.1 tmux 基本操作

```bash
tmux new -s train            # 新建命名会话
# 在会话内运行长任务（如 python train.py）
# Ctrl+b 再按 d → 脱离（detach），任务继续跑
tmux attach -t train         # 重新连接
tmux ls                      # 列出会话
tmux kill-session -t train   # 结束会话
```

分屏：`Ctrl+b %`​（水平）、`Ctrl+b "`（垂直）。

### 5.2 三种后台方式对比

|方式|解决的问题|边界|
| ------| --------------------------------| --------------------------------|
|`&`|让命令在当前 Shell 后台运行|终端关闭时任务可能收到挂断信号|
|`nohup`|忽略挂断信号，脱离终端运行|交互控制与恢复能力有限|
|`tmux`|可重新连接的终端会话，保留现场|需安装，需学习会话操作|

SSH 断线后 tmux 会话仍保留现场，重连 `tmux attach`​ 恢复——远程训练标准保活手段（对比详见 [Linux专项：&、nohup 与 tmux](/siyuan/其他笔记/命令行/Linux专项/)）。

## 六、常见故障与排除

> 局域网设备（路由器/板卡）重置、重刷固件是 SSH 报错的常见来源。

### 6.1 连接类

|报错|排查方向|
| -----------| ----------------------------------------------|
|`Connection refused`​ / `No route to host`|主机开机、网络连通、SSH 服务(`sudo systemctl status ssh`)、防火墙放行|
|`Permission denied, please try again`|用户名/密码、登录权限、`PermitRootLogin` 设置|

### 6.2 密钥类

|报错|排查方向|
| ------| -----------------------------------------|
|`Permission denied (publickey)`|公钥是否在 `authorized_keys`​、私钥权限 `600`​、`PubkeyAuthentication` 是否启用|
|`Bad owner or permissions on ~/.ssh/config`|`chmod 600 ~/.ssh/config`​、`chmod 700 ~/.ssh`|

### 6.3 Host Key 算法不匹配

报错 `Unable to negotiate ... no matching host key type found. Their offer: ssh-rsa`：

- 原因：新版 OpenSSH 默认禁用 `ssh-rsa`​/`ssh-dss` 等旧算法（安全性不足）；
- 临时解决：

```bash
ssh -o HostKeyAlgorithms=+ssh-rsa -o PubkeyAcceptedKeyTypes=+ssh-rsa user@x.x.x.x
```

### 6.4 主机密钥已变更

报错 `WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED!`：

- 原因：之前连接过该主机，但设备被重置/重刷固件/重新生成密钥，指纹变了（局域网内常见）；
- 解决：删除 known_hosts 中的旧条目：

```bash
ssh-keygen -R x.x.x.x
```

### 6.5 连接超时/掉线

```text
客户端：ServerAliveInterval 60（~/.ssh/config 中配置）
服务器：ClientAliveInterval 60（sshd_config）
```

## 七、安全最佳实践

- **密钥管理**：用强密钥（ed25519 / RSA 4096）；不同服务器用不同密钥；定期轮换；配合 `ssh-agent`。
- **服务器加固**：`PermitRootLogin no`​、`PasswordAuthentication no`、使用非标准端口、防火墙限制来源 IP。
- **网络安全**：用 VPN/跳板机访问内网；避免公共 WiFi 敏感操作；`ssh -C` 压缩加密。
- **日志监控**：查看 `/var/log/auth.log`​；`fail2ban` 防暴力破解；定时审计 sshd_config。

## 八、自测问题

1. **私钥和公钥分别放哪里、作用是什么？**   
   答：私钥留在本地并保密（权限 600），用于证明身份；公钥放到服务器的 `~/.ssh/authorized_keys`，用于验证身份；登录时两者配对完成免密认证。
2. **​`scp`​**​ **和** **​`rsync`​**​ **有什么区别？**   
   答：scp 全量复制、无断点续传，适合少量单文件；rsync 增量同步、支持断点续传与排除规则，适合大量数据目录回传。
3. **本地转发**  **​`-L`​**​ **与远程转发**  **​`-R`​**​ **的区别？**   
   答：`-L 8080:localhost:8000`​ 把本机端口映射到远程主机端口（本机访问远程服务）；`-R 9000:localhost:22` 把本机端口暴露到远程服务器（从远端反向访问本机），用于内网穿透。
4. **​`WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED!`​** ​ **怎么处理？**   
   答：设备重刷固件后指纹变更属正常，用 `ssh-keygen -R 主机IP` 删除旧条目后重新连接即可。

‍

<section class="siyuan-references" aria-label="文档引用">

## 文档关系

### 本文引用
- [Linux专项](/siyuan/其他笔记/命令行/Linux专项/)

### 反向引用
- [命令行](/siyuan/其他笔记/命令行/)
- [学习笔记](/siyuan/)

</section>
