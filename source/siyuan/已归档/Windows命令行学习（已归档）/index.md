---
title: 'Windows命令行学习（已归档）'
date: '2026-08-19T16:16:46+08:00'
updated: '2026-08-25T09:07:33+08:00'
layout: page
type: siyuan-note
notebook: '学习笔记'
permalink: 'siyuan/已归档/Windows命令行学习（已归档）/'
siyuan_source: '已归档/Windows命令行学习（已归档）.md'
comments: false
categories:
  - '学习笔记'
  - '已归档'
---

# Windows 命令行学习

> 学习 Windows 环境中的 PowerShell 基本指令与 CMD 基本指令，重点掌握文件管理、目录导航、文本查看、进程管理、环境变量和命令帮助。

## 一、学习目标

> PowerShell 面向对象并以命令（cmdlet）为核心；CMD 是 Windows 传统命令解释器，二者语法和管道行为存在差异。

完成后能够：

- 使用 PowerShell 和 CMD 导航目录、管理文件和目录
- 查看和筛选文本输出
- 查询进程、结束进程和查看系统信息
- 理解 PowerShell 命令与 CMD 命令的对应关系
- 区分 PowerShell 对象管道与 CMD 文本管道

## 二、PowerShell 基础

### 2.1 环境与帮助

```powershell
Get-Location                 # 查看当前目录
Get-ChildItem                # 列出目录内容
Get-Command Get-Process      # 查找命令
Get-Help Get-Process         # 查看帮助
Get-Member                   # 查看对象成员
$PSVersionTable              # 查看 PowerShell 版本
```

### 2.2 文件与目录

```powershell
Set-Location .\work          # 进入目录
New-Item -ItemType Directory data # 创建目录
New-Item notes.txt -ItemType File # 创建文件
Copy-Item notes.txt backup.txt    # 复制文件
Move-Item backup.txt archive.txt  # 移动或重命名
Remove-Item archive.txt           # 删除文件
Test-Path .\data                 # 检查路径是否存在
```

### 2.3 文本与管道

```powershell
Get-Content app.log | Select-String 'error' # 搜索文本
Get-Content app.log -Tail 20               # 查看末尾 20 行
Get-Process | Sort-Object CPU -Descending | Select-Object -First 10
Get-ChildItem -Recurse -Filter '*.py'      # 递归查找文件
```

PowerShell 管道传递对象，后续命令可以直接访问对象属性；这与 CMD 主要传递文本不同。

### 2.4 进程与环境变量

```powershell
Get-Process                       # 查看进程
Stop-Process -Id 1234             # 结束指定进程
$env:Path                         # 查看环境变量
$env:MY_VAR = 'value'             # 设置当前会话变量
Get-Service                       # 查看服务
Get-ComputerInfo                 # 查看系统信息
```

## 三、CMD 基础

### 3.1 导航与文件管理

```cmd
cd                         REM 查看或切换目录
cd /d D:\work              REM 切换盘符和目录
dir                       REM 列出目录内容
mkdir data                 REM 创建目录
type nul > notes.txt       REM 创建空文件
copy notes.txt backup.txt  REM 复制文件
move backup.txt archive.txt REM 移动或重命名
del archive.txt            REM 删除文件
rmdir /s /q data           REM 递归删除目录，谨慎使用
```

### 3.2 文本、搜索与重定向

```cmd
type app.log               REM 查看文本
findstr /i "error fail" app.log REM 搜索文本
dir /s /b *.py             REM 递归列出匹配文件
command > output.txt       REM 覆盖重定向
command >> output.txt      REM 追加重定向
command 2> error.txt       REM 重定向错误输出
```

### 3.3 进程与环境变量

```cmd
tasklist                  REM 查看进程
taskkill /PID 1234 /F     REM 强制结束指定进程
echo %PATH%               REM 查看环境变量
set MY_VAR=value           REM 设置当前 CMD 会话变量
systeminfo                REM 查看系统信息
sc query                  REM 查看服务状态
```

## 四、PowerShell 与 CMD 对照

## 三、Windows IP 与网络命令

> Windows 网络排查的基本链路是：查看本机配置 → 检查网关与连通性 → 查看 DNS → 查看路由和端口 → 定位具体连接问题。

### 3.1 PowerShell：查看 IP 配置

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

### 3.2 PowerShell：连通性、DNS 与端口

```powershell
Test-Connection 8.8.8.8                 # 测试 ICMP 连通性
Test-Connection 192.168.1.1 -Count 4    # 测试局域网网关
Resolve-DnsName example.com             # DNS 解析
Test-NetConnection example.com -Port 443 # 测试 TCP 端口
Test-NetConnection 192.168.1.10 -Port 22 -InformationLevel Detailed
```

- `Test-Connection` 主要验证主机是否能通过 ICMP 响应。
- `Test-NetConnection -Port` 用于验证指定 TCP 端口是否可达，不能把 Ping 通当作端口一定开放。
- `Resolve-DnsName` 用于区分“域名解析失败”和“网络/端口连接失败”。

### 3.3 CMD：查看 IP 配置

```cmd
ipconfig                         REM 查看基本 IP 配置
ipconfig /all                    REM 查看详细网卡、网关和 DNS
ipconfig /release                REM 释放 DHCP 地址
ipconfig /renew                  REM 重新获取 DHCP 地址
ipconfig /flushdns               REM 清理 DNS 缓存
route print                      REM 查看路由表
arp -a                           REM 查看 ARP 缓存
```

`ipconfig /release`​ 和 `/renew` 会影响 DHCP 网卡连接；在远程机器上执行前应确认不会中断当前会话。

### 3.4 CMD：连通性、DNS 与路径

```cmd
ping 192.168.1.1                 REM 测试主机连通性
ping -t 192.168.1.1              REM 持续 Ping，Ctrl+C 停止
nslookup example.com             REM DNS 解析
tracert example.com              REM 查看经过的路由跳数
pathping example.com             REM 结合路径和丢包统计
netstat -ano                     REM 查看连接、监听端口和 PID
netstat -ano | findstr :8080     REM 筛选 8080 端口
```

### 3.5 PowerShell 与 CMD 对照

|排查任务|PowerShell|CMD|
| --------------| ------------| -------------------|
|本机 IP 配置|`Get-NetIPConfiguration`|`ipconfig /all`|
|IP 地址|`Get-NetIPAddress`|`ipconfig`|
|网卡状态|`Get-NetAdapter`|`ipconfig /all`|
|路由表|`Get-NetRoute`|`route print`|
|DNS 解析|`Resolve-DnsName`|`nslookup`|
|Ping|`Test-Connection`|`ping`|
|路由路径|`Test-NetConnection`​ 或 `tracert`|`tracert`|
|TCP 端口|`Test-NetConnection -Port`|`netstat -ano` 查看本机端口|
|ARP 缓存|`Get-NetNeighbor`|`arp -a`|
|连接与监听|`Get-NetTCPConnection`|`netstat -ano`|

### 3.6 常见排查顺序

1. `Get-NetIPConfiguration`​ 或 `ipconfig /all`：确认网卡已启用、IP/掩码、默认网关和 DNS。
2. `ping 127.0.0.1`：确认本机 TCP/IP 协议栈基本正常。
3. `ping 默认网关`：确认局域网连接。
4. `ping 公网 IP`：区分本地网络与外网连通性。
5. `nslookup`​ 或 `Resolve-DnsName`：确认 DNS 是否正常。
6. `Test-NetConnection 主机 -Port 端口`：确认具体 TCP 服务端口。
7. `tracert`​、`pathping`：需要定位跨网段或公网路径问题时使用。

## 四、PowerShell 与 CMD 对照

|任务|PowerShell|CMD|
| -------------| ------------| ------|
|当前目录|`Get-Location`|`cd`|
|列出文件|`Get-ChildItem`|`dir`|
|复制|`Copy-Item`|`copy`|
|移动/重命名|`Move-Item`|`move`|
|删除文件|`Remove-Item`|`del`|
|查看文本|`Get-Content`|`type`|
|搜索文本|`Select-String`|`findstr`|
|查看进程|`Get-Process`|`tasklist`|
|结束进程|`Stop-Process`|`taskkill`|
|查看帮助|`Get-Help`|`命令 /?`|

### 4.1 PowerShell 兼容 CMD 与 Linux 命令：别名机制

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

**为什么能做到**：PowerShell 启动时加载一张别名表（`Get-Alias` 可查全表），把 CMD/Unix 习惯的短命令名指向语义对应的 cmdlet，新用户不用记两套命令，老习惯直接可用。

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

## 五、安全注意

- 删除前确认路径和匹配范围，尤其是 `Remove-Item -Recurse`​ 与 `rmdir /s /q`。
- 使用 `Stop-Process`​ 或 `taskkill` 前先确认进程 ID 和进程名称。
- 区分当前会话环境变量与永久系统环境变量，修改系统变量前先确认影响范围。
- 从 CMD 调用 PowerShell 时使用 `powershell -Command "..."`；从 PowerShell 调用 CMD 命令时可直接调用兼容命令，但输出通常需要按文本处理。

## 六、最小综合练习

1. 在 PowerShell 中创建 `windows-lab\logs`​、`windows-lab\backup` 和三个日志文件。
2. 使用 PowerShell 搜索包含 `ERROR` 的日志行，并将结果保存到文件。
3. 使用 CMD 的 `dir /s /b`​ 和 `findstr` 完成同一搜索任务。
4. 启动一个可观察的进程，分别用 `Get-Process`​/`Stop-Process`​ 和 `tasklist`​/`taskkill` 查询并结束它。
5. 用表格总结 PowerShell 对象管道与 CMD 文本管道的差异。

## 七、完成标准

- 能在 PowerShell 中独立完成基本目录、文件、文本和进程操作。
- 能在 CMD 中独立完成对应的基本操作。
- 能根据任务选择 PowerShell 或 CMD。
- 能解释两者的管道、帮助、重定向和环境变量差异。

‍

<section class="siyuan-references" aria-label="文档引用">

## 文档关系

### 反向引用
- [学习笔记](/siyuan/)

</section>
