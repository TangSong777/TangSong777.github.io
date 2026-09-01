---
title: 'Rock5B+'
date: '2026-08-25T11:07:11+08:00'
updated: '2026-08-26T17:45:55+08:00'
layout: page
type: siyuan-note
notebook: '学习笔记'
permalink: 'siyuan/其他笔记/Rock5B+/'
siyuan_source: '其他笔记/Rock5B+.md'
comments: false
categories:
  - '学习笔记'
  - '其他笔记'
---

> 本文档是 Rock 5B+（Radxa OS 26.01 / KDE Plasma）从"烧录系统"到"投入使用"的完整实操记录：系统烧录与启动、基础环境配置、系统设置、UART 串口调试、SSH 远程连接、多媒体软件（ffmpeg-rockchip / Moonlight / GStreamer）编译安装。官方参考：[ROCK 5B/5B+ | Radxa Docs](https://docs.radxa.com/rock5/rock5b)。

## 一、系统烧录与启动

### 1.1 刷写 SPI Flash

先使用rkdevtool去刷spi flash，第一遍erase，第二遍烧录官方spi loader

### 1.2 烧写 TF 卡系统镜像

然后用balenaEtcher去烧系统镜像到TF卡中，注意使用格式化SD卡的软件先做一遍格式化，然后烧系统镜像（这里注意要解压缩为.img格式）

### 1.3 首次上电与账户

烧录后插板子上，上电进系统，系统有两个默认账户radxa和rock，一般进radxa，密码和账户都是一致的

```bash
# 更新一下系统
sudo apt-get update
sudo apt-get full-upgrade
```

开rsetup，选`System Maintenance`​，选`Update SPI Bootloader`，空格选择，回车确认。

### 1.4 烧录NVME

注意SD卡和固态都插在板子上会先从SD卡启动系统。

对于有系统有内容的固态：

```bash
# 1. 确认设备名（一般是 nvme0n1）
lsblk

# 2. 卸载所有分区（如果有自动挂载）
sudo umount /dev/nvme0n1p* 2>/dev/null

# 3. 清空开头 GPT 头（可选，但换 Android<->Linux 镜像时建议做）
sudo dd if=/dev/zero of=/dev/nvme0n1 bs=1M count=16 status=progress

# 4. 写入新镜像（xz 压缩版）
sudo xzcat ~/rock-5b-plus-xxx.img.xz | sudo dd of=/dev/nvme0n1 bs=1M status=progress conv=fsync

# 5. 拔电源，拔SD卡，上电进桌面
```

## 二、系统信息

官方的系统为Radxa OS 26.01

KDE plasma版本：5.27.5

## 三、首次进入与基础环境

### 3.1 打开终端并联网

进系统后ctrl+alt+t调出console就可以打指令了，注意先联网。

### 3.2 换源（可选）

> 可选优化：系统默认使用官方（Debian/Ubuntu）软件源。若安装/更新速度慢或失败，再执行以下命令切换为清华 TUNA 镜像后重试；网络状况良好时可跳过本节。

请执行以下命令来使用由第三方提供的 Debian / Ubuntu 仓库镜像：

本镜像由清华大学开源软件镜像站提供。

```bash
sudo sed -i 's/deb.debian.org/mirrors.tuna.tsinghua.edu.cn/g' /etc/apt/sources.list.d/*
sudo sed -i 's/deb.ubuntu.com/mirrors.tuna.tsinghua.edu.cn/g' /etc/apt/sources.list.d/*
sudo apt-get update
```

### 3.3 更新系统

rsetup进设置，选system然后选system update更新全部内容。

更新完后重启一下。

## 四、系统基本设置

### 4.1 自动登录

进rsetup，`User Settings`​里选`Configure auto login`​，按空格选中`gdm.service`，选OK完成自动登录设置

### 4.2 MIPI 屏幕

进rsetup，选overlays，我手上的屏是8寸的，选Radxa Display 8 HD就行。

### 4.3 更改系统语言

注意：系统默认设置为英文

在系统设置中，点击区域设置添加语言。

![rock5a_system_language_1](https://docs.radxa.com/assets/images/rock5a_system_language_1-cf76e806017e2131bd01e1cbfa7bb1f2.webp)

选择您想要的语言并单击添加。

![rock5a_system_language_2](https://docs.radxa.com/assets/images/rock5a_system_language_2-0a0bc97438413e9e1649364fc10affbb.webp)

在新语言列中，单击向上图标提升为默认语言，然后单击应用。 重新启动计算机，系统语言将设置为新语言。

![rock5a_system_language_3](https://docs.radxa.com/assets/images/rock5a_system_language_3-4ebab2249c87ed0244ad9c462cf2778c.webp)

之后直接rsetup更新即可。

#### （已废弃）命令行方式切换语言

~~如果使用的Debian环境不是中文环境，需要切换到中文环境，可以使用如下命令切换，然后输入用户密码~~

```bash
sudo dpkg-reconfigure locales
```

~~按空格或回车选择确定，准备下一步安装。~~

 ~~（注意这里往下翻，空格选en_US.UTF-8即可OK进下一步）~~

![rock5a_language_input_1](https://docs.radxa.com/assets/images/rock5a_language_input_1-e0985ab84726f77315a368bbea7a6b2e.webp)![rock5a_language_input_2](https://docs.radxa.com/assets/images/rock5a_language_input_2-029b603e8128181b0689309ac3c3754b.webp)

~~执行以下命令更新并安装系统环境软件：~~

```bash
sudo apt update
```

### 4.4 电源与休眠设置

电源设置->屏幕亮度、降低屏幕亮度、屏幕节能、挂起会话全部取消勾选。

按键事件处理->按下电源键时关机

工作区行为->锁屏->自动锁定屏幕取消勾选->应用

右下角亮度那里勾选禁止自动熄屏

## 六、SSH（远程连接）

`sudo systemctl enable --now ssh`实现开机自启动ssh服务，基本rsetup后运行一条这个就行了

附：

`sudo apt-get install openssh-server openssh-sftp-server`安装ssh服务

`sudo systemctl status ssh`查看ssh服务状态

`sudo systemctl restart ssh`重新启动ssh

## 七、应用软件安装

### <span id="20260825142830-rxfbn7q" class="siyuan-block-anchor" aria-hidden="true"></span>7.1 安装 ffmpeg-rockchip

```bash
# 依赖啥的
sudo apt-get update
sudo apt-get install build-essential cmake git libdrm-dev librga-dev librockchip-mpp-dev libsdl2*-dev libx264-dev libx265-dev pkg-config
```

```bash
# 拉源码，注意这里有enable-shared，要部署Moonlight得这么干（尽量都这么干）
git clone https://github.com/nyanmisaka/ffmpeg-rockchip
pushd ffmpeg-rockchip/
./configure --prefix=/usr --enable-shared --enable-gpl --enable-version3 --enable-libdrm --enable-rkmpp --enable-rkrga --enable-libx264 --enable-libx265 --enable-ffplay
make -j$(nproc)
sudo make install
popd
```

### 7.2 安装 GStreamer

```bash
sudo apt-get update
sudo apt-get install gstreamer1.0-rtsp
```

## 八、常见问题（FAQs）

1. 使用调试控制台时，屏幕上有系统启动信息，但无法使用键盘输入文字？ 可能是默认开启了 Hardware Flow Control。关闭 Hardware Flow Control 后应该能恢复正常。

## 九、UART 串口控制台

瑞莎的绝大多数产品将 GPIO 引脚上的第 8 (TX)、第 10 (RX) 引脚定义为 UART 串口通信接口，以方便排查系统早期启动阶段的问题。

### 9.1 准备事项

- 任意瑞莎提供了 GPIO 引脚的产品，及兼容供电方案
- 个人电脑
- USB 转 TTL 串口线

USB 转 TTL 串口线

请根据厂商的串口数据线的引脚功能进行接线，示意图为常见 USB 串口数据线的引脚功能。

![USB to TTL](https://docs.radxa.com/assets/images/600px-Usb2ttl-cable-definition-f826a3cbfb872af17280c8740f64f6e9.webp)

### 9.2 提示

基于 Rockchip 芯片的瑞莎产品，UART 默认配置为 1500000n8，无流量控制。

请检查您的 USB 转 TTL 串口线是否支持 1.5M 波特率：

- 基于 [CP210X](https://www.silabs.com/interface/usb-bridges) 和 [PL2303x](https://www.prolific.com.tw/US/index.aspx) 的部分产品有波特率限制。
- 基于 FT232RL 的部分产品有[电源问题](https://forum.radxa.com/t/u-boot-cant-boot-with-serial-console-attached/7684)。

下文使用基于 [CH340](http://wch-ic.com/products/CH340.html) 的串口线进行描述。

### 9.3 串口连接

如下所示连接 USB 转 TTL 串口线：

|Radxa SBC|连接|串口线|
| -----------| ---------------| ---------------|
|**GND** (pin 6)|\<---\>|黑色线（GND）|
|**TX** (pin 8)|\<---\>|白色线（RXD）|
|**RX** (pin 10)|\<---\>|绿色线（TXD）|

![](https://docs.radxa.com/img/accessories/rock5a-1000px-Serial-connection.webp)

危险

请勿连接红色供电线！

### 9.4 使用串口工具

基于 Rockchip 芯片的瑞莎产品的串口默认配置如下：

```text
baudrate: 1500000

data bit: 8

stop bit: 1

parity  : none

flow control: none
```

- Windows
- Linux
- Mac

### 9.5 Windows：使用 Putty

Putty 是一个可以在 Windows 上使用，支持多种波特率的串口工具。下面介绍如何使用 Putty 连接串口。

1. 下载 [Putty](https://www.chiark.greenend.org.uk/~sgtatham/putty/latest.html) 并安装。
2. 将 USB 转 TTL 串口线的 USB 一端插到 PC，查看​**设备管理器**，以找到 COM 编号。这里假设是 COM3。
3. 打开 Putty，并按如下方式进行设置：

- 在左边栏目中选择 Session，将串行线路设置为 COM3，波特率设置 1500000，连接类型为 Serial。
- 在 Saved Sessions 列中写入 radxa-rock5 ，然后按 Save。

![Putty](https://docs.radxa.com/assets/images/putty-rk-1-07f8f73e72c03e3725bbafbe575a078d.webp)

4. 在左边栏目选择最底下的 Serial 并按照以下参数配置：

Flow Control 设置

请确保将 **Flow control** 设置为 ​**None**​（如果您的终端支持，也可以设置为 ​**XON/XOFF**）。对于瑞莎产品，应禁用 Hardware flow control。

![Putty](https://docs.radxa.com/assets/images/putty-rk-2-0c618da7d2b185398567ff00a98042d8.webp)

5. 设置完成后，点击 Open 打开串口，确保 TTL 端正确接入之后，接通主板的电源即可。

<section class="siyuan-references" aria-label="文档引用">

## 文档关系

### 反向引用
- [Moonlight专项](/siyuan/其他笔记/Rock5B+/Moonlight专项/)
- [学习笔记](/siyuan/)

</section>
