---
title: 'CMD专项'
date: '2026-08-25T09:11:52+08:00'
updated: '2026-08-25T09:12:23+08:00'
layout: page
type: siyuan-note
notebook: '学习笔记'
permalink: 'siyuan/其他笔记/命令行/CMD专项/'
siyuan_source: '其他笔记/命令行/CMD专项.md'
comments: false
categories:
  - '学习笔记'
  - '其他笔记'
  - '命令行'
---

‍

> CMD 是 Windows 传统命令解释器：**内部命令**（`dir`​/`copy`​/`del`​ 等，由 cmd.exe 内置）＋**外部命令**（`findstr`​/`ping`​ 等独立 exe，靠 PATH 调用）。本专项整理自《Windows命令行学习（已归档）》。相关专项：[PowerShell专项](/siyuan/其他笔记/命令行/PowerShell专项/)、[Linux专项](/siyuan/其他笔记/命令行/Linux专项/)。

## 一、CMD 基础

> 导航（cd/dir）→ 建文件目录 → 复制/移动/删除 → 查文本 → 查进程，命令短、参数用 `/` 开关。

### 1.1 导航与文件管理

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

### 1.2 文本、搜索与重定向

```cmd
type app.log               REM 查看文本
findstr /i "error fail" app.log REM 搜索文本
dir /s /b *.py             REM 递归列出匹配文件
command > output.txt       REM 覆盖重定向
command >> output.txt      REM 追加重定向
command 2> error.txt       REM 重定向错误输出
```

- CMD 管道/重定向处理的是**文本流**（一行行字符串），与 PowerShell 对象管道本质不同。

### 1.3 进程与环境变量

```cmd
tasklist                  REM 查看进程
taskkill /PID 1234 /F     REM 强制结束指定进程
echo %PATH%               REM 查看环境变量
set MY_VAR=value           REM 设置当前 CMD 会话变量
systeminfo                REM 查看系统信息
sc query                  REM 查看服务状态
```

- `%变量%`​ 是 CMD 环境变量写法（对应 PowerShell 的 `$env:`​、Linux 的 `$变量`）。

## 二、IP 与网络排查（CMD）

> 排查链路与 PowerShell 版一致，只是命令更短：`ipconfig`​ → `ping`​ → `nslookup`​ → `netstat`。

### 2.1 查看 IP 配置

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

### 2.2 连通性、DNS 与路径

```cmd
ping 192.168.1.1                 REM 测试主机连通性
ping -t 192.168.1.1              REM 持续 Ping，Ctrl+C 停止
nslookup example.com             REM DNS 解析
tracert example.com              REM 查看经过的路由跳数
pathping example.com             REM 结合路径和丢包统计
netstat -ano                     REM 查看连接、监听端口和 PID
netstat -ano | findstr :8080     REM 筛选 8080 端口
```

## 三、与 PowerShell 的对照

> CMD 几乎每条命令都能在 PowerShell 中找到对应 cmdlet（PowerShell 甚至能用别名直接敲 CMD 命令，机制详见 [PowerShell专项：别名机制](/siyuan/其他笔记/命令行/PowerShell专项/)）。

|任务|CMD|PowerShell|
| -------------| ------| ------------|
|当前目录|`cd`|`Get-Location`|
|列出文件|`dir`|`Get-ChildItem`|
|复制|`copy`|`Copy-Item`|
|移动/重命名|`move`|`Move-Item`|
|删除文件|`del`|`Remove-Item`|
|查看文本|`type`|`Get-Content`|
|搜索文本|`findstr`|`Select-String`|
|查看进程|`tasklist`|`Get-Process`|
|结束进程|`taskkill`|`Stop-Process`|
|查看帮助|`命令 /?`|`Get-Help`|

网络排查对照：

|排查任务|CMD|PowerShell|
| --------------| ------| ------------|
|本机 IP 配置|`ipconfig /all`|`Get-NetIPConfiguration`|
|路由表|`route print`|`Get-NetRoute`|
|DNS 解析|`nslookup`|`Resolve-DnsName`|
|Ping|`ping`|`Test-Connection`|
|TCP 端口|`netstat -ano`|`Test-NetConnection -Port`|
|连接与监听|`netstat -ano`|`Get-NetTCPConnection`|

## 四、易错点速查

- `set MY_VAR=value`​ 只影响当前 CMD 会话，新开窗口即失效（永久修改用 `setx`）
- `rmdir /s /q`​、`del /s` 会递归删除，执行前确认路径与匹配范围
- 重定向 `>`​ 覆盖、`>>` 追加，别写反
- `netstat`​ 的 8080 端口筛选用 `findstr :8080`，注意冒号前缀

## 五、自测问题

1. **CMD 的内部命令与外部命令有什么区别？**   
   答：内部命令由 cmd.exe 内置（`dir`​/`copy`​/`del`​），不依赖额外文件；外部命令是独立 exe（`findstr`​/`ping`​/`netstat`），靠 PATH 找到并执行。
2.  **​`>`​** ​ **、**​ **​`>>`​** ​ **、**​**​`2>`​** ​ **分别表示什么？**   
   答：`>`​ 覆盖重定向标准输出；`>>`​ 追加；`2>` 重定向错误输出（标准错误流）。
3. **在 PowerShell 中直接敲** **​`tasklist`​**​ **为什么有效？**   
   答：`tasklist` 是外部 exe，PowerShell 与 CMD 共享系统 PATH，所以都能直接执行；这属于"外部命令兼容"，不是别名。

<section class="siyuan-references" aria-label="文档引用">

## 文档关系

### 本文引用
- [Linux专项](/siyuan/其他笔记/命令行/Linux专项/)
- [PowerShell专项](/siyuan/其他笔记/命令行/PowerShell专项/)

### 反向引用
- [Linux专项](/siyuan/其他笔记/命令行/Linux专项/)
- [PowerShell专项](/siyuan/其他笔记/命令行/PowerShell专项/)
- [命令行](/siyuan/其他笔记/命令行/)
- [其他笔记](/siyuan/其他笔记/)
- [学习笔记](/siyuan/)

</section>
