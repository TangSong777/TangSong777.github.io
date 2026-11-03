---
title: 'c2026-11-03'
date: '2026-11-03T10:26:46+08:00'
updated: '2026-11-03T10:26:46+08:00'
layout: page
type: siyuan-note
notebook: '学习笔记'
permalink: 'siyuan/daily-card/c2026/c2026-11/c2026-11-03/'
siyuan_source: 'daily card/c2026/c2026-11/c2026-11-03.md'
comments: false
categories:
  - '学习笔记'
  - 'daily card'
  - 'c2026'
  - 'c2026-11'
---

# <span id="" style="display: none;"></span>c2026-11-03

‍

[Rock5B+](/siyuan/其他笔记/Rock5B+/)　

```text
                    ┌──────────────────────────────┐
                    │  宿舍（Rock5B+ 所在）         │
                    │                              │
                    │  Redmi AX6 / OpenWrt         │
                    │  ████  ← 网关 / DNS   │
                    │  ████ ← ZeroTier 中继│
                    │        │                     │
                    │        ├── Rock5B+ 有线 ████
                    │        │     公网 IPv6 240e:399:f93:eac0::1a2b:3c4d
                    │        │     ZeroTier 192.168.195.5
                    │        └── （Rock 的 WiFi 已关闭）    │
                    └──────────────┬───────────────┘
                                   │
              ┌────────────────────┼─────────────────────┐
              │                    │                     │
     ① 局域网 ████   ② IPv6 公网直连      ③ ZeroTier ████
        （宿舍内 0.4ms）          （跨城 ~30ms）        （管理 / 兜底）
              │                    │                     │
        ┌─────┴────────────────────┴─────────────────────┴─────┐
        │  串流主机（Windows，当前在另一处网络）                    │
        │  WLAN 192.168.1.100/24  网关 192.168.1.1          	   │
        │  IPv6 240c:c983:5:231:d8db:57e:a3f2:e25f             │
        │  ZeroTier ████                              │
        └──────────────────────────────────────────────────────┘

  公网入口（Rock 侧，全部入站零端口）：
    history.yanghanlin.cn  ─┐
    server.yanghanlin.cn   ─┼─ Cloudflare Tunnel ─► 127.0.0.1:4181 / 4180 / 4173
    manager.yanghanlin.cn  ─┘
    blogs.yanghanlin.cn    ─── GitHub Pages（不经 Rock）
```

‍

‍

‍

<section class="siyuan-references" aria-label="文档引用">

## 文档关系

### 本文引用
- [Rock5B+](/siyuan/其他笔记/Rock5B+/)

</section>
