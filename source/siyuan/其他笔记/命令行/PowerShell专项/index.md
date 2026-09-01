---
title: 'PowerShell专项'
date: '2026-08-25T09:11:52+08:00'
updated: '2026-08-25T09:12:15+08:00'
layout: page
type: siyuan-note
notebook: '学习笔记'
permalink: 'siyuan/其他笔记/命令行/PowerShell专项/'
siyuan_source: '其他笔记/命令行/PowerShell专项.md'
comments: false
categories:
  - '学习笔记'
  - '其他笔记'
  - '命令行'
---

‍

> PowerShell 是 Windows 面向对象的命令行与脚本环境，命令（cmdlet）为核心，管道传递**对象**而非文本。本专项整理自《Windows命令行学习（已归档）》，覆盖基础命令、与 CMD/Linux 命令的兼容机制（别名）、IP 与网络排查。相关专项：[CMD专项](/siyuan/其他笔记/命令行/CMD专项/)、[Linux专项](/siyuan/其他笔记/命令行/Linux专项/)。

## 一、PowerShell 基础

> 一组高频 cmdlet：定位当前位置 → 列目录 → 建/复制/移动/删除文件 → 读文本 → 查进程，记住"动词-名词"命名规律即可举一反三。

### 1.1 环境与帮助

```powershell
Get-Location                 # 查看当前目录
Get-ChildItem                # 列出目录内容
Get-Command Get-Process      # 查找命令（可查别名解析：Get-Command cd）
Get-Help Get-Process         # 查看帮助
Get-Member                   # 查看对象成员（管道后使用）
$PSVersionTable              # 查看 PowerShell 版本
```

### 1.2 文件与目录

```powershell
Set-Location .\work          # 进入目录
New-Item -ItemType Directory data # 创建目录
New-Item notes.txt -ItemType File # 创建文件
Copy-Item notes.txt backup.txt    # 复制文件
Move-Item backup.txt archive.txt  # 移动或重命名
Remove-Item archive.txt           # 删除文件
Test-Path .\data                 # 检查路径是否存在
```

### 1.3 文本与管道（对象管道）

```powershell
Get-Content app.log | Select-String 'error' # 搜索文本
Get-Content app.log -Tail 20               # 查看末尾 20 行
Get-Process | Sort-Object CPU -Descending | Select-Object -First 10
Get-ChildItem -Recurse -Filter '*.py'      # 递归查找文件
```

> PowerShell 管道传递的是**对象**（每行是一个带属性的对象），后续命令可 `.属性`​ 访问、`Where-Object` 筛选；这与 CMD 主要传递文本不同——这是两套命令体系最本质的差异。

### 1.4 进程与环境变量

```powershell
Get-Process                       # 查看进程
Stop-Process -Id 1234             # 结束指定进程
$env:Path                         # 查看环境变量
$env:MY_VAR = 'value'             # 设置当前会话变量
Get-Service                       # 查看服务
Get-ComputerInfo                 # 查看系统信息
```

- `$env:变量名`​ 是 PowerShell 访问环境变量的写法（对应 CMD 的 `%变量名%`​、Linux 的 `$变量名`）。
- 设置 `$env:MY_VAR`​ 仅对**当前会话**有效，关闭窗口即失效。

## 二、PowerShell 兼容 CMD 与 Linux 命令：别名机制

> PowerShell 中可以直接使用大部分 CMD 命令（如 `dir`​、`cd`​、`copy`​、`type`​）和 Linux 风格命令（如 `ls`​、`cat`​、`pwd`​、`rm`​）——原理是**别名（alias）** ：短名字被映射到对应的 PowerShell cmdlet；此外 PowerShell 继承系统 PATH，还能直接执行 `ipconfig`​、`ping`​、`netstat` 等外部 exe。

**兼容的两个来源**：

1. **内置别名（CMD/Linux 短名 → cmdlet）** ：

|输入的命令|实际执行的 cmdlet|说明|
| ------------| -------------------| --------------|
|`cd`|`Set-Location`|切换目录|
|`dir`​ / `ls`|`Get-ChildItem`|列出目录内容|
|`pwd`|`Get-Location`|当前目录|
|`cat`​ / `type`|`Get-Content`|查看文本|
|`copy`​ / `cp`|`Copy-Item`|复制|
|`move`​ / `mv`|`Move-Item`|移动/重命名|
|`del`​ / `rm`|`Remove-Item`|删除|
|`echo`|`Write-Output`|输出|
|`cls`​ / `clear`|`Clear-Host`|清屏|

2. **外部命令（靠 PATH 兼容）** ：`ipconfig`​、`ping`​、`netstat`​、`findstr`​、`tasklist`​、`tracert`​ 等本身是独立 exe 程序，PowerShell 与 CMD 一样按 PATH 环境变量找到并执行它们——这**不是别名**，而是"共享同一个系统 PATH"。

**为什么能做到**：PowerShell 启动时加载一张别名表（`Get-Alias`​ 可查全表），把 CMD/Unix 习惯的短命令名指向语义对应的 cmdlet，新用户不用记两套命令，老习惯直接可用。CMD 侧的对应命令详见 [CMD专项](/siyuan/其他笔记/命令行/CMD专项/)，Linux 侧详见 [Linux专项](/siyuan/其他笔记/命令行/Linux专项/)。

**易错点**：

- 别名只换"名字"，**语义以 cmdlet 为准**：参数、通配符、输出格式都听 `Copy-Item`​/`Remove-Item` 的，与 CMD 同名命令的参数不一定相同；
- `findstr`​、`netstat`​ 等是**外部 exe**，输出是**文本**不是对象，不能直接管道给 `Where-Object` 按属性筛选；
- 想严格按 **CMD 解释器**语义执行某命令，用 `cmd /c 命令`；
- 别把"长得像"当"行为一样"：`type`​ 在 PowerShell 中实际是 `Get-Content`​（管道传对象），与 CMD 的 `type` 行为有差异。

**验证**：

```powershell
Get-Alias                # 查看全部别名
Get-Alias dir            # 查看 dir 映射到什么
Get-Command cd           # 显示命令类型：Alias → Set-Location
ls | Get-Member          # 观察 ls 输出的是对象（证明它实际是 Get-ChildItem）
```

## 三、IP 与网络排查（PowerShell）

> Windows 网络排查的基本链路：查看本机配置 → 检查网关与连通性 → DNS → 路由与端口 → 定位具体连接问题。

### 3.1 查看 IP 配置

```powershell
Get-NetIPConfiguration                 # 查看网卡、IPv4/IPv6、网关和 DNS
Get-NetIPAddress                       # 查看所有 IP 地址
Get-NetIPAddress -AddressFamily IPv4  # 只查看 IPv4
Get-NetAdapter                         # 查看网卡状态、名称和链路速率
Get-NetRoute                           # 查看路由表
Get-DnsClientServerAddress             # 查看 DNS 服务器
```

常用筛选：

```powershell
Get-NetAdapter | Where-Object Status -eq 'Up'
Get-NetIPAddress -AddressFamily IPv4 | Format-Table IPAddress,InterfaceAlias,PrefixLength
Get-NetRoute -AddressFamily IPv4 | Sort-Object RouteMetric
```

### 3.2 连通性、DNS 与端口

```powershell
Test-Connection 8.8.8.8                 # 测试 ICMP 连通性
Test-Connection 192.168.1.1 -Count 4    # 测试局域网网关
Resolve-DnsName example.com             # DNS 解析
Test-NetConnection example.com -Port 443 # 测试 TCP 端口
Test-NetConnection 192.168.1.10 -Port 22 -InformationLevel Detailed
```

- `Test-Connection` 主要验证主机是否能通过 ICMP 响应。
- `Test-NetConnection -Port`​ 用于验证指定 TCP 端口是否可达，**不能把 Ping 通当作端口一定开放**。
- `Resolve-DnsName` 用于区分"域名解析失败"和"网络/端口连接失败"。

### 3.3 常见排查顺序

1. `Get-NetIPConfiguration`​ 或 `ipconfig /all`：确认网卡启用、IP/掩码、默认网关和 DNS。
2. `ping 127.0.0.1`：确认本机 TCP/IP 协议栈基本正常。
3. `ping 默认网关`：确认局域网连接。
4. `ping 公网 IP`：区分本地网络与外网连通性。
5. `Resolve-DnsName`​ 或 `nslookup`：确认 DNS 是否正常。
6. `Test-NetConnection 主机 -Port 端口`：确认具体 TCP 服务端口。
7. `tracert`​、`pathping`：定位跨网段或公网路径问题。

## 四、易错点速查

- 管道传**对象**不是文本：`Where-Object`​/`Select-Object`​ 用属性名筛选，不要按字符串 `findstr` 思路写
- `dir`​、`type` 等别名背后是 cmdlet，参数语义以 cmdlet 为准（见第二章）
- `Test-Connection`​ 通 ≠ TCP 端口通，端口用 `Test-NetConnection -Port`
- `$env:变量`​ 只在当前会话有效，永久修改需 `setx` 或系统属性
- `Stop-Process` 前先确认进程 ID/名称，避免误杀

## 五、自测问题

1. **为什么 PowerShell 里能直接敲** **​`dir`​**​ **、**​**​`ls`​**​ **？**   
   答：别名（alias）机制——`dir`​、`ls`​ 都是 `Get-ChildItem` 的别名；PowerShell 启动时加载别名表，把 CMD/Linux 短命令名映射到对应 cmdlet；同时外部 exe（ipconfig/ping 等）靠共享 PATH 直接可执行。
2. **​`Get-Content`​**​ **与 CMD** **​`type`​**​ **有什么本质区别？**   
   答：`Get-Content`​ 是 cmdlet，管道输出的是**文件行对象**（可继续管道筛选/取属性）；CMD `type` 只是把文本打到屏幕上，输出是纯文本。
3. **​`Test-Connection`​**​ **与** **​`Test-NetConnection -Port`​**​ **的区别？**   
   答：前者测 ICMP 连通性（主机可达）；后者测指定 TCP 端口是否开放。主机 Ping 通不代表服务端口开放。

<section class="siyuan-references" aria-label="文档引用">

## 文档关系

### 本文引用
- [CMD专项](/siyuan/其他笔记/命令行/CMD专项/)
- [Linux专项](/siyuan/其他笔记/命令行/Linux专项/)

### 反向引用
- [CMD专项](/siyuan/其他笔记/命令行/CMD专项/)
- [Linux专项](/siyuan/其他笔记/命令行/Linux专项/)
- [命令行](/siyuan/其他笔记/命令行/)
- [其他笔记](/siyuan/其他笔记/)
- [学习笔记](/siyuan/)

</section>
