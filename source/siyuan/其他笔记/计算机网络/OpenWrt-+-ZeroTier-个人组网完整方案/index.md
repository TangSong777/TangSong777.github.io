---
title: 'OpenWrt + ZeroTier 个人组网完整方案'
date: '2026-08-24T09:13:30+08:00'
updated: '2026-08-24T09:13:30+08:00'
layout: page
type: siyuan-note
notebook: '学习笔记'
permalink: 'siyuan/其他笔记/计算机网络/OpenWrt-+-ZeroTier-个人组网完整方案/'
siyuan_source: '其他笔记/计算机网络/OpenWrt + ZeroTier 个人组网完整方案.md'
comments: false
categories:
  - '学习笔记'
  - '其他笔记'
  - '计算机网络'
---

> 本文档整合《Prompt-基于OpenWrt与ZeroTier的个人组网》的需求分析与《基于OpenWrt与ZeroTier的个人组网》的方案设计，形成一份可直接照做的完整实施方案。最终目标：笔记本无论在家还是外地，都能透明访问家庭 192.168.6.0/24 网段，并自动选择最佳路径。

## 1. 需求与目标

### 1.1 双场景定义

|场景|笔记本位置|网络环境|期望访问路径|
| --------------| --------------| ---------------------------| ------------------------------------|
|场景一：在家|家庭局域网内|有线/无线连接 OpenWrt LAN|直接走物理 LAN，不经过 ZeroTier|
|场景二：外地|互联网环境|仅通过 ZeroTier 联网|经 ZeroTier → OpenWrt → 家庭 LAN|

### 1.2 访问目标

- 目标网段：`192.168.6.0/24`（整个网段透明访问）
- 目标设备：`192.168.6.1`​（OpenWrt LAN）、`192.168.6.5`（家庭设备示例）等所有网内设备

### 1.3 硬性约束

- 不使用 ZeroTier Managed Route
- 不购买任何 ZeroTier 付费功能
- 家庭设备无需任何配置修改
- 自动选择最佳路径（在家走 LAN、外地走 ZeroTier）

## 2. 网络拓扑与 IP 规划

### 2.1 IP 规划

|节点|接口|IP 地址|
| ----------| ---------------| ----------------------|
|OpenWrt|LAN|192.168.6.1|
|OpenWrt|ZeroTier|192.168.195.4|
|笔记本|ZeroTier|192.168.195.2|
|笔记本|LAN（在家时）|192.168.6.x（如 .2）|
|家庭设备|LAN|192.168.6.5（示例）|

### 2.2 在家场景拓扑

```
笔记本 192.168.6.x
   |
   | Ethernet / WiFi
   v
OpenWrt LAN 192.168.6.1
   |
   v
家庭设备 192.168.6.5
```

访问路径：`笔记本 → 本地网卡 → OpenWrt LAN → 家庭设备`，不经过 ZeroTier。

### 2.3 外地场景拓扑

```
笔记本 (ZeroTier 192.168.195.2)
   |
   | ZeroTier Overlay
   v
OpenWrt ZeroTier 192.168.195.4
   |
   v
OpenWrt LAN 192.168.6.1
   |
   v
家庭设备 192.168.6.5
```

访问路径：`笔记本 → ZeroTier → OpenWrt → 家庭 LAN`。

## 3. 方案选型：ZeroTier + OpenWrt NAT

### 3.1 为什么选 NAT 而不是纯路由

|对比项|NAT 方案（推荐）|纯路由方案|
| -----------------| ------------------------| -------------------------|
|家庭设备配置|无需任何修改|需要家庭 LAN 有回程路由|
|主路由修改|不需要|需要下发静态路由|
|配置复杂度|低|高|
|稳定性|最高|依赖回程路由正确|
|设备可见来源 IP|全部显示为 192.168.6.1|可见真实 192.168.195.x|

**原因**：OpenWrt 的 ZeroTier 插件内置"自动允许客户端 NAT"功能，开启后自动解决回程路由问题，家庭环境无需改动任何设备。

### 3.2 NAT 数据流

```
笔记本 192.168.195.2
   ↓
OpenWrt NAT
   ↓
192.168.6.1
   ↓
家庭设备 192.168.6.5
```

家庭设备看到的来源地址是 `192.168.6.1`​，而不是 `192.168.195.2`。

### 3.3 纯路由方案的回程问题（不推荐的原理）

如果关闭 NAT，家庭设备回复 `192.168.195.2` 时若无回程路由则无法返回。需要家庭 LAN 显式配置：

```
192.168.195.0/24 via 192.168.6.1
```

家庭环境通常不推荐这么做。

## 4. OpenWrt 端配置

### 4.1 ZeroTier 插件配置

当前系统已安装 ZeroTier 插件，配置如下：

```
ZeroTier 运行：开启
加入 Network ID：填写自己的 ZeroTier 网络 ID
自动允许客户端 NAT：开启
```

### 4.2 防火墙配置

需要允许 ZeroTier zone 到 LAN zone 的转发：

```
zerotier → lan
```

即允许 `zerotier`​ 区域转发到 `lan` 区域。

### 4.3 NAT 的作用

开启"自动允许客户端 NAT"后：

- 远程 ZeroTier 客户端访问 `192.168.6.0/24` 时
- 源地址被转换为 `192.168.6.1`
- 解决家庭设备回程路由无法到达 ZeroTier 网段的问题

## 5. Windows 客户端配置

### 5.1 调整 ZeroTier 接口 Metric（降低优先级）

目的：让 Windows 尽量优先使用物理网卡。

```
Ethernet：10 ~ 25
WLAN：20 ~ 50
ZeroTier：5000
```

当前已设置：

```
ZeroTier IPv4 Metric：5000
```

可通过 `Get-NetIPInterface -AddressFamily IPv4` 确认。

### 5.2 添加家庭 LAN 静态路由

不使用 Managed Route，因此需手动添加持久路由：

```
route -p add 192.168.6.0 mask 255.255.255.0 192.168.195.4 metric 5000
```

含义：访问家庭 LAN `192.168.6.0/24`​ 时，下一跳为 OpenWrt 的 ZeroTier 地址 `192.168.195.4`。

### 5.3 Windows 路由选择逻辑

Windows 依据以下规则选择路径：

1. 最长前缀匹配
2. Metric 优先级（越小越优先）

**在家时**：

```
192.168.6.0/24  On-link（本地直连）  Metric 低   ← 被选中
192.168.6.0/24  via 192.168.195.4    Metric 5000
```

**在外地时**：

```
192.168.6.0/24  On-link  不存在
192.168.6.0/24  via 192.168.195.4   ← 唯一选择
```

## 6. 双场景行为验证

### 6.1 在家（预期走本地 LAN）

```powershell
ping 192.168.6.5
tracert 192.168.6.5   # 第一跳应为本地网关，不出现 ZeroTier
```

### 6.2 在外地（预期走 ZeroTier）

```powershell
ping 192.168.6.5
tracert 192.168.6.5   # 经过 192.168.195.4 进入家庭 LAN
```

### 6.3 确认路由表

```powershell
route print -4 | findstr 192.168.6
Get-NetIPInterface -AddressFamily IPv4
```

## 7. 注意事项与避坑

### 7.1 不要使用 ZeroTier Managed Route

- 不要在 ZeroTier Central 添加 `192.168.6.0/24 via 192.168.195.4`
- 客户端路由由 Windows 本地静态路由控制（更可控、更简单）

### 7.2 不让 ZeroTier 接管默认网络

检查路由表中是否存在：

```
0.0.0.0/0 via ZeroTier
```

如果存在必须删除。ZeroTier 只负责 `192.168.6.0/24`，不负责互联网出口。

### 7.3 Metric 建议优化

当前路由为 `Metric 10000`​，建议统一优化为 `Metric 5000`，与接口 Metric 保持一致。

## 8. 故障排查

|现象|排查步骤|
| ---------------------------------| --------------------------------------------------------------------------------------------------------------------------------------------------------------|
|外地 ping 不通家庭设备|1. 两端 ZeroTier 是否在线（`zerotier-cli listnetworks` / 托盘图标）<br />2. 笔记本是否在 ZeroTier Central 被授权<br />3. OpenWrt 防火墙 zerotier→lan 转发是否生效<br />4. 静态路由是否存在（`route print`）|
|在家访问走 ZeroTier|1. 检查本地 LAN 接口 Metric 是否低于 5000<br />2. 检查是否存在重复静态路由干扰|
|ZeroTier 接口拿到 IP 但无法出网|检查是否存在 `0.0.0.0/0` 默认路由被 ZeroTier 接管，删除之|
|家庭设备能看到来源但回包失败|确认 OpenWrt 自动 NAT 已开启|

## 9. 安全建议

- ZeroTier 网络 ID 与成员授权保持私密，网络内只授权自己的设备
- 防火墙规则可进一步收紧：只允许笔记本的 ZeroTier IP（192.168.195.2）访问 LAN
- 定期检查 ZeroTier Central 中的授权设备列表，移除陌生设备

## 10. 最终配置清单

**OpenWrt 端**：

```
ZeroTier：开启
自动允许客户端 NAT：开启
防火墙：zerotier → lan 转发
Managed Route：关闭（不使用）
```

**Windows 端**：

```
ZeroTier IPv4 Metric：5000
家庭 LAN 静态路由：192.168.6.0/24 via 192.168.195.4（持久）
Ethernet / WiFi：低 Metric
```

**最终效果**：

```
同一个 192.168.6.0/24 访问目标
在家：自动走本地 LAN
外地：自动走 ZeroTier
```

方案满足：双场景自动切换、不依赖付费功能、不依赖 Managed Route、家庭设备零修改、OpenWrt 配置简单稳定。

## 参考文档

- [Prompt-基于OpenWrt与ZeroTier的个人组网（需求）](/siyuan/其他笔记/计算机网络/OpenWrt-+-ZeroTier-个人组网完整方案/Prompt-基于OpenWrt与ZeroTier的个人组网/)
- [基于OpenWrt与ZeroTier的个人组网（方案原稿）](/siyuan/其他笔记/计算机网络/OpenWrt-+-ZeroTier-个人组网完整方案/基于OpenWrt与ZeroTier的个人组网/)

<section class="siyuan-references" aria-label="文档引用">

## 文档关系

### 本文引用
- [Prompt-基于OpenWrt与ZeroTier的个人组网](/siyuan/其他笔记/计算机网络/OpenWrt-+-ZeroTier-个人组网完整方案/Prompt-基于OpenWrt与ZeroTier的个人组网/)
- [基于OpenWrt与ZeroTier的个人组网](/siyuan/其他笔记/计算机网络/OpenWrt-+-ZeroTier-个人组网完整方案/基于OpenWrt与ZeroTier的个人组网/)

### 反向引用
- [ZeroTier专项](/siyuan/其他笔记/计算机网络/学习文档/ZeroTier专项/)
- [个人路由配置记录](/siyuan/其他笔记/计算机网络/个人路由配置记录/)
- [计算机网络](/siyuan/其他笔记/计算机网络/)
- [其他笔记](/siyuan/其他笔记/)
- [学习笔记](/siyuan/)

</section>
