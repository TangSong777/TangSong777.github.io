---
title: 'Moonlight专项'
date: '2026-08-26T17:45:09+08:00'
updated: '2026-08-26T17:46:40+08:00'
layout: page
type: siyuan-note
notebook: '学习笔记'
permalink: 'siyuan/其他笔记/Rock5B+/Moonlight专项/'
siyuan_source: '其他笔记/Rock5B+/Moonlight专项.md'
comments: false
categories:
  - '学习笔记'
  - '其他笔记'
  - 'Rock5B+'
---

#### 1. 先安装 ffmpeg-rockchip

[安装 ffmpeg-rockchip](/siyuan/其他笔记/Rock5B+/#20260825142830-rxfbn7q)

注意这里一定要确认去搞pkg-config，把系统包给覆盖掉，完完全全确认各个.so啥的都是rockchip版本的ffmpeg（版本号62开头的），不然后续编译Moonlight链接错误几乎是必然的。

#### 2. 安装编译依赖

```bash
sudo apt-get update
sudo apt-get install libegl1-mesa-dev libgl1-mesa-dev libopus-dev libsdl2-dev libsdl2-ttf-dev libssl-dev \
libavcodec-dev libavformat-dev libswscale-dev libva-dev libvdpau-dev libxkbcommon-dev wayland-protocols \
libdrm-dev qt6-base-dev qt6-declarative-dev libqt6svg6-dev qml6-module-qtquick-controls qml6-module-qtquick-templates \
qml6-module-qtquick-layouts qml6-module-qtqml-workerscript qml6-module-qtquick-window qml6-module-qtquick
```

#### 3. 获取源码

```bash
git clone https://github.com/moonlight-stream/moonlight-qt.git
cd moonlight-qt
git submodule update --init --recursive
```

#### 4. 添加 ffmpeg 链接参数

```bash
echo 'LIBS += -L/usr/lib -lavformat -lavcodec -lavutil -lswscale' >> app/app.pro
echo 'QMAKE_LIBS += -lswresample -lx264 -lx265 -lrockchip_mpp -lrga -lz -llzma' >> app/app.pro
```

#### 5. 编译

```bash
qmake6 moonlight-qt.pro
make release -j$(nproc)
```

#### 6. 运行

```bash
app/moonlight
```

<section class="siyuan-references" aria-label="文档引用">

## 文档关系

### 本文引用
- [Rock5B+](/siyuan/其他笔记/Rock5B+/)

### 反向引用
- [学习笔记](/siyuan/)

</section>
