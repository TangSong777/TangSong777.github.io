---
title: '基于OpenWrt与ZeroTier的个人组网'
date: '2026-08-22T22:13:18+08:00'
updated: '2026-08-22T22:13:33+08:00'
layout: page
type: siyuan-note
notebook: '学习笔记'
permalink: 'siyuan/其他笔记/计算机网络/OpenWrt-+-ZeroTier-个人组网完整方案/基于OpenWrt与ZeroTier的个人组网/'
siyuan_source: '其他笔记/计算机网络/OpenWrt + ZeroTier 个人组网完整方案/基于OpenWrt与ZeroTier的个人组网.md'
comments: false
categories:
  - '学习笔记'
  - '其他笔记'
  - '计算机网络'
  - 'OpenWrt + ZeroTier 个人组网完整方案'
---

# OpenWrt + ZeroTier 双场景访问家庭 LAN 方案设计文档

## 1. 目标需求

设计一个双场景网络访问方案，使笔记本无论在家庭局域网内还是外地通过互联网连接 ZeroTier，都可以访问家庭 LAN：

目标访问网段：

```
192.168.6.0/24
```

目标设备：

```
OpenWrt LAN:
192.168.6.1

家庭设备示例:
192.168.6.5
```

ZeroTier 网络：

```
OpenWrt ZeroTier:
192.168.195.4

笔记本 ZeroTier:
192.168.195.2
```

需求：

- 家庭内访问家庭设备时，优先走物理 LAN
- 外地访问家庭设备时，通过 ZeroTier
- 不使用 ZeroTier Managed Route
- 不购买 ZeroTier 付费功能
- 自动选择最佳路径

---

# 2. 网络拓扑

## 家庭场景

```
笔记本
192.168.6.x

   |
   | Ethernet / WiFi
   |

OpenWrt LAN
192.168.6.1

   |

家庭设备
192.168.6.5
```

访问路径：

```
笔记本
 ↓
本地网卡
 ↓
OpenWrt LAN
 ↓
家庭设备
```

不经过 ZeroTier。

---

## 外地场景

```
笔记本

ZeroTier:
192.168.195.2

       |
       |

OpenWrt ZeroTier:
192.168.195.4

       |
       |

OpenWrt LAN:
192.168.6.1

       |
       |

家庭设备:
192.168.6.5
```

访问路径：

```
笔记本
 ↓
ZeroTier
 ↓
OpenWrt
 ↓
家庭 LAN
```

---

# 3. 推荐方案

采用：

## ZeroTier + OpenWrt NAT 方案

原因：

- 不需要修改家庭设备路由
- 不需要 ZeroTier Managed Route
- 配置简单
- 稳定性最高
- 适合家庭环境

数据流：

```
192.168.195.2

        ↓

OpenWrt NAT

        ↓

192.168.6.1

        ↓

192.168.6.5
```

家庭设备看到的来源：

```
192.168.6.1
```

而不是：

```
192.168.195.2
```

---

# 4. OpenWrt 配置

## ZeroTier插件

当前系统已经安装 OpenWrt ZeroTier 插件。

配置：

```
ZeroTier运行:
开启

加入Network ID:
填写自己的ZeroTier网络ID

自动允许客户端 NAT:
开启
```

---

## 防火墙要求

需要允许：

```
ZeroTier zone

↓

LAN zone
```

即：

```
zerotier → lan
```

允许转发。

---

## NAT

开启：

```
自动允许客户端 NAT
```

作用：

远程 ZeroTier 客户端访问：

```
192.168.6.0/24
```

时：

转换为：

```
192.168.6.1
```

解决回程路由问题。

---

# 5. 为什么选择 NAT 而不是纯路由

## NAT方案

优点：

- 家庭设备无需配置
- NAS、摄像头、打印机直接可访问
- 不需要修改主路由
- 不需要 DHCP 下发静态路由

缺点：

家庭设备无法看到真实 ZeroTier 客户端地址。

例如：

真实：

```
192.168.195.2
```

家庭设备看到：

```
192.168.6.1
```

---

## 纯路由方案

如果关闭 NAT：

需要家庭 LAN 有回程路由：

```
192.168.195.0/24

via

192.168.6.1
```

否则：

家庭设备回复：

```
192.168.195.2
```

时无法返回。

家庭环境通常不推荐。

---

# 6. Windows客户端配置

## ZeroTier接口

当前接口：

```
ZeroTier One [[已隐藏 Network ID]]
```

接口编号：

```
ifIndex:
14
```

---

## 调整接口Metric

目的：

降低 ZeroTier 优先级。

配置：

```
Ethernet:
10~25

WLAN:
20~50

ZeroTier:
5000
```

当前设置：

```
ZeroTier IPv4 Metric:
5000
```

正确。

---

# 7. Windows静态路由

由于不使用 ZeroTier Managed Route，需要手动添加：

目标：

```
192.168.6.0/24
```

下一跳：

```
192.168.195.4
```

命令：

```
route -p add 192.168.6.0 mask 255.255.255.0 192.168.195.4 metric 5000
```

作用：

告诉 Windows：

访问家庭 LAN：

```
192.168.6.0/24
```

通过：

```
OpenWrt ZeroTier地址
192.168.195.4
```

---

# 8. Windows路由选择逻辑

Windows依据：

1. 最长匹配
2. Metric

选择路径。

---

## 家庭环境

存在：

本地 LAN：

```
192.168.6.0/24
On-link
Metric较低
```

ZeroTier：

```
192.168.6.0/24
via 192.168.195.4
Metric 5000
```

Windows选择：

```
本地LAN
```

路径：

```
笔记本
 ↓
Ethernet/WiFi
 ↓
家庭LAN
```

---

## 外地环境

没有：

```
192.168.6.0/24 On-link
```

只有：

```
192.168.6.0/24
via 192.168.195.4
```

Windows选择：

```
ZeroTier
```

路径：

```
笔记本
 ↓
ZeroTier
 ↓
OpenWrt
 ↓
家庭LAN
```

---

# 9. 当前Windows配置状态

已完成：

## ZeroTier Metric

```
ZeroTier IPv4 Metric:
5000
```

确认：

```
Get-NetIPInterface -AddressFamily IPv4
```

显示：

```
ZeroTier One
IPv4
5000
```

---

## 当前路由

已经存在：

```
192.168.6.0
255.255.255.0
192.168.195.4
192.168.195.2
Metric 10000
```

说明：

Windows已经知道：

```
192.168.6.0/24
通过ZeroTier访问
```

建议优化为：

```
Metric 5000
```

---

# 10. 注意事项

## 不使用 ZeroTier Managed Route

不要添加：

```
192.168.6.0/24 via 192.168.195.4
```

到 ZeroTier Central。

原因：

客户端路由由 Windows 控制。

---

## 不让 ZeroTier 接管默认网络

检查是否存在：

```
0.0.0.0/0
via ZeroTier
```

如果存在，需要删除。

目标：

ZeroTier只负责：

```
192.168.6.0/24
```

不要负责：

```
互联网出口
```

---

# 11. 最终效果

## 在家

```
访问:

192.168.6.5


实际路径:

笔记本
 ↓
Ethernet/WLAN
 ↓
OpenWrt LAN
 ↓
设备
```

---

## 外地

```
访问:

192.168.6.5


实际路径:

笔记本
 ↓
ZeroTier
 ↓
192.168.195.4
 ↓
OpenWrt NAT
 ↓
192.168.6.5
```

---

# 12. 最终推荐配置总结

OpenWrt：

```
ZeroTier:
开启

自动允许客户端 NAT:
开启

防火墙:
ZeroTier → LAN

Managed Route:
关闭
```

Windows：

```
ZeroTier Metric:
5000

家庭LAN路由:
192.168.6.0/24 via 192.168.195.4

Ethernet/WiFi:
低Metric
```

最终实现：

```
同一个192.168.6.0/24访问目标

家庭:
自动走本地LAN

外地:
自动走ZeroTier
```

该方案满足：

- 双场景自动切换
- 不依赖付费功能
- 不依赖Managed Route
- 家庭设备无需修改
- OpenWrt配置简单稳定

<section class="siyuan-references" aria-label="文档引用">

## 文档关系

### 反向引用
- [OpenWrt + ZeroTier 个人组网完整方案](/siyuan/其他笔记/计算机网络/OpenWrt-+-ZeroTier-个人组网完整方案/)
- [计算机网络](/siyuan/其他笔记/计算机网络/)
- [其他笔记](/siyuan/其他笔记/)
- [学习笔记](/siyuan/)

</section>
