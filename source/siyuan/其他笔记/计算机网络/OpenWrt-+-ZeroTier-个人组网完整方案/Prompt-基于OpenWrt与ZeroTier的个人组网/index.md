---
title: 'Prompt-基于OpenWrt与ZeroTier的个人组网'
date: '2026-08-22T21:44:04+08:00'
updated: '2026-08-22T22:13:29+08:00'
layout: page
type: siyuan-note
notebook: '学习笔记'
permalink: 'siyuan/其他笔记/计算机网络/OpenWrt-+-ZeroTier-个人组网完整方案/Prompt-基于OpenWrt与ZeroTier的个人组网/'
siyuan_source: '其他笔记/计算机网络/OpenWrt + ZeroTier 个人组网完整方案/Prompt-基于OpenWrt与ZeroTier的个人组网.md'
comments: false
categories:
  - '学习笔记'
  - '其他笔记'
  - '计算机网络'
  - 'OpenWrt + ZeroTier 个人组网完整方案'
---

我有一台 OpenWrt 路由器，需要设计一个双场景网络访问方案。

网络结构：

家庭 LAN：

- OpenWrt LAN IP：192.168.6.1
- 家庭设备网段：192.168.6.0/24
- 示例设备：192.168.6.5

ZeroTier 网络：

- OpenWrt ZeroTier IP：192.168.195.4
- 笔记本 ZeroTier IP：192.168.195.2

需求：

我的笔记本有两种使用环境：

场景1：  
笔记本通过网线连接 OpenWrt LAN。  
此时：

- 笔记本获得家庭 LAN IP，例如 192.168.6.2
- 访问家庭设备应该直接走物理网卡
- 不希望流量经过 ZeroTier

场景2：  
笔记本在外地，通过互联网连接 ZeroTier。  
此时：

- 笔记本只有 ZeroTier IP：192.168.195.2
- 希望访问家庭 LAN：

  - 192.168.6.1
  - 192.168.6.5
  - 整个 192.168.6.0/24 网段
- 不使用 ZeroTier Managed Route
- 不购买 ZeroTier 付费功能

请设计一个最佳方案。

要求分析：

1. OpenWrt 端应该如何配置：

- ZeroTier接口
- 防火墙zone
- LAN转发
- 是否开启IP转发
- 是否使用NAT
- 如果使用NAT，请解释影响
- 如果不用NAT，请解释回程路由如何解决

2. 笔记本端应该如何配置：

- Windows/Linux路由规则
- 如何避免在家时和外地时产生路由冲突
- 是否需要永久静态路由
- 是否需要metric优先级

3. 请重点分析以下问题：

- 当笔记本同时连接：

  - 有线LAN
  - ZeroTier  
    时，访问192.168.6.0/24应该走哪个接口？
- Windows/Linux系统如何选择路由？
- 如何避免ZeroTier路径覆盖本地LAN路径？

4. 请给出推荐方案：

- 简单稳定方案
- 高级纯路由方案

5. 如果推荐NAT方案，请提供：

- OpenWrt具体配置步骤
- 防火墙配置
- ZeroTier配置
- 笔记本路由配置

6. 如果推荐非NAT方案，请提供：

- 回程路由设计
- OpenWrt配置
- 客户端配置

最终目标：

无论笔记本在家还是外地，都可以透明访问：

192.168.6.0/24

并且自动选择最佳路径。

<section class="siyuan-references" aria-label="文档引用">

## 文档关系

### 反向引用
- [OpenWrt + ZeroTier 个人组网完整方案](/siyuan/其他笔记/计算机网络/OpenWrt-+-ZeroTier-个人组网完整方案/)
- [计算机网络](/siyuan/其他笔记/计算机网络/)
- [其他笔记](/siyuan/其他笔记/)
- [学习笔记](/siyuan/)

</section>
