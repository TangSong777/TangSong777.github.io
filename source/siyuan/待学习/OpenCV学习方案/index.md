---
title: 'OpenCV学习方案'
date: '2026-08-27T16:45:57+08:00'
updated: '2026-08-27T16:47:47+08:00'
layout: page
type: siyuan-note
notebook: '学习笔记'
permalink: 'siyuan/待学习/OpenCV学习方案/'
siyuan_source: '待学习/OpenCV学习方案.md'
comments: false
categories:
  - '学习笔记'
  - '待学习'
---

‍

# OpenCV 学习方案

> 教学讲义式学习方案：每章先讲原理并用**表格**列出全部相关函数（作用/参数/示例），再用**最小实例**佐证。章节按依赖编排：图像本质 → 读写 → 像素 → 颜色与阈值 → 几何 → 滤波 → 形态学 → ROI/mask → 视频 → **Linux 摄像头部署（V4L2 高速采集）**  → 指端 ROI 实战。能力基线：OpenCV L0 → 目标 L2。项目连接："一指知心"视频帧处理与指端 ROI。

## 一、图像本质与 OpenCV 概览

> OpenCV 的图像 = **NumPy 数组**：灰度图是二维 `(H, W)`​，彩色图是三维 `(H, W, 3)`——一切操作都是数组操作。

- **类比**：图像 = 带坐标的格子纸，每个格子（像素）填一个颜色值；
- **核心概念速查**：

|概念|含义|备注|
| -----------| ---------------------------------| ---------------------------------|
|`cv2` 模块|OpenCV Python 包（`import cv2`）|pip 安装 `opencv-python`|
|BGR|OpenCV 彩色图的通道顺序|**不是 RGB**（红色存第 3 通道）|
|`uint8`|像素默认类型，0-255|溢出会回绕，用 cv2 函数自动饱和|
|`(H, W, 3)`|彩色图 shape 顺序：高、宽、通道|与"x,y"直觉相反，行在前|
|`ndarray`|图像本质|可被 NumPy 任意计算|

## 二、安装与环境

> 一行命令装好后，用"读一张图并打印形状"验证环境。

|工具|命令/入口|用途|
| -------------| -------------| --------------------------|
|OpenCV|`pip install opencv-python numpy`|核心库（含 cv2 + numpy）|
|无GUI服务器|验证改为 `imwrite`|`imshow` 需要显示器|
|版本验证|`cv2.__version__`|确认安装成功|

**短实例**：

```python
import cv2
print(cv2.__version__)          # 输出版本即安装成功
```

## 三、图像读写与显示

> 读入（imread）→ 显示（imshow+waitKey）→ 保存（imwrite），是每个项目的第一步。

|函数|作用|常用参数|示例|
| ------| -------------------| -------------------------| ------|
|`cv2.imread(路径, flags)`|读图，返回数组|`0`=灰度；默认彩色 BGR|`img = cv2.imread("a.jpg")`|
|`cv2.imwrite(路径, 图)`|保存图像|—|`cv2.imwrite("out.jpg", img)`|
|`cv2.imshow(窗口名, 图)`|弹窗显示|—|`cv2.imshow("win", img)`|
|`cv2.waitKey(毫秒)`|等待按键；`0`=无限|按任意键继续|`cv2.waitKey(0)`|
|`cv2.destroyAllWindows()`|关闭所有窗口|—|`cv2.destroyAllWindows()`|

**短实例**：

```python
img = cv2.imread("finger.jpg")          # imread 读入失败返回 None 而非异常
assert img is not None, "路径不存在或无法读取"   # 先判空再继续

cv2.imwrite("copy.jpg", img)            # 保存即验证成功
print(img.shape)                        # (H, W, 3)
```

## 四、像素与通道操作

> 像素就是数组元素；批量运算交给 NumPy 向量化，不要写双 for 循环。

|函数/写法|作用|示例|
| -----------| -----------------------------| ------|
|`img[行, 列]`|访问/修改像素（BGR 三元组）|`img[10, 20] = (255,0,0)`|
|`img.shape`​ / `img.dtype`|形状与类型|`(480, 640, 3) uint8`|
|`cv2.split(img)`​ / `cv2.merge([...])`|通道分离/合并|`b,g,r = cv2.split(img)`|
|`cv2.convertScaleAbs(img, alpha, beta)`|亮度/对比度(饱和处理)|`alpha=1.2, beta=30`|
|`cv2.bitwise_not(img)`|逐像素取反（负片）|—|
|`img[行切片, 列切片]`|裁剪出子图|`img[100:300, 50:250]`|

**短实例**（每个函数一两句说明）：

```python
b, g, r = cv2.split(img)                 # split 得到三个单通道(灰度)图
img[10, 20] = (0, 0, 255)                # 常用法：按(B,G,R)给像素上色=红色
bright = cv2.convertScaleAbs(img, alpha=1.2, beta=30)  # alpha 调对比度、beta 调亮度，自动防溢出
roi = img[100:300, 50:250]               # 常用法：切片即裁剪，先行后列
```

- **易错**：`uint8`​ 下 `255+1=0`​（回绕）；用 cv2 或 `np.clip` 避免。

## 五、颜色空间与阈值

> 不同颜色坐标系各有用途：灰度做阈值、HSV 按颜色分离（如肤色）、BGR 是原始存储。阈值把图分成"目标/背景"。

|函数/写法|作用|常用参数|示例|
| -----------| -------------------| -----------------------| ----------------|
|`cv2.cvtColor(img, 目标)`|颜色空间转换|`COLOR_BGR2GRAY`​ / `COLOR_BGR2HSV`|`gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)`|
|`cv2.threshold(gray, 阈值, 最大值, 方式)`|全局阈值二值化|`127, 255, THRESH_BINARY`|`_, bin = cv2.threshold(gray, 127, 255, cv2.THRESH_BINARY)`|
|`cv2.adaptiveThreshold(...)`|局部自适应阈值|`ADAPTIVE_THRESH_MEAN_C, 块大小11, C=2`|光照不均场景用|
|`cv2.inRange(hsv, 下限, 上限)`|按颜色范围做 mask|HSV 三元组（H:0-179）|`mask = cv2.inRange(hsv, (l0,l1,l2),(h0,h1,h2))`|

**短实例**：

```python
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)          # 常用法：灰度作为阈值/边缘输入
hsv  = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)           # 常用法：HSV 按"颜色"筛目标，抗光照变化
_, binary = cv2.threshold(gray, 127, 255, cv2.THRESH_BINARY)  # 阈值：>127 置 255
```

- **易错**：HSV 的 H 是 0-179（不是 0-360）；写 inRange 阈值前先打印像素 HSV 实测，不要拍脑袋。

## 六、几何变换

> 裁剪=切片；缩放/旋转/翻转/平移=重采样坐标。注意 resize 参数是 `(宽, 高)`。

|函数/写法|作用|常用参数|示例|
| -----------| -----------| ------------------------| ------|
|`img[y1:y2, x1:x2]`|裁剪|—|`roi = img[0:100, 0:100]`|
|`cv2.resize(img, (w,h))`|缩放|`(宽, 高)`​ 或 `fx=,fy=`|`r = cv2.resize(img, (320, 240))`|
|`cv2.rotate(img, 模式)`|90°旋转|`ROTATE_90_CLOCKWISE`|—|
|`cv2.flip(img, 轴)`|翻转|`1`​=水平镜像、`0`=垂直|—|
|`cv2.warpAffine(img, 矩阵, (w,h))`|平移/仿射|平移矩阵 `[1,0,tx; 0,1,ty]`|—|

**短实例**：

```python
roi = img[100:400, 200:500]                     # 常用法：手指区域裁剪
r = cv2.resize(img, (320, 240))                 # 常用法：降采样提速（先 resize 再处理）
mirror = cv2.flip(img, 1)                       # 常用的镜像画面（自拍预览）
```

## 七、滤波与边缘

> 滤波用邻域平滑或增强像素；去噪用高斯，保边去噪用双边，提取边缘用 Canny/Sobel。

|函数|作用|常用参数|示例|
| ------| ----------------------| -------------------| ------------|
|`cv2.blur(img, (k,k))`|均值模糊|核须奇数|`(5,5)`|
|`cv2.GaussianBlur(img, (k,k), 0)`|高斯模糊（常用去噪）|核奇数，σ=0 自动|`(5,5)`|
|`cv2.bilateralFilter(img, d, σc, σs)`|保边去噪|`9, 75, 75`|合边缘保留|
|`cv2.Canny(gray, 低阈值, 高阈值)`|Canny 边缘|`100, 200`|输入需灰度|
|`cv2.Sobel(gray, ddepth, dx, dy)`|梯度边缘|`CV_64F, 1, 0`|—|

**短实例**：

```python
gauss = cv2.GaussianBlur(gray, (5, 5), 0)        # 常用法：处理前先去噪
edges = cv2.Canny(gray, 100, 200)                # 常用法：找轮廓前先取边缘
```

## 八、形态学操作

> 形态学针对**二值图**做膨胀/腐蚀/开/闭：去小噪点、填洞、连接断区。

|函数/写法|作用|记忆|
| -----------| ----------------| -----------------------|
|`cv2.getStructuringElement(形状, (k,k))`|生成核|`MORPH_RECT` 矩形核|
|`cv2.erode(bin, 核)`|腐蚀：缩小亮区|去小白点|
|`cv2.dilate(bin, 核)`|膨胀：扩大亮区|连接断裂|
|`cv2.morphologyEx(bin, 操作, 核)`|开/闭运算|`MORPH_OPEN`​ 去噪点 / `MORPH_CLOSE` 填洞|

**短实例**：

```python
kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))      # 常用法：核越大效果越强
clean = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel)        # 开运算：去散落小白点
filled = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)      # 闭运算：填补手指内部黑点
```

## 九、ROI 与 mask（重点）

> 只处理"手指那块"两种思路：矩形 ROI 切片（规则框），或任意形状 mask + 按位与（贴合手指）。

|函数/写法|作用|常用参数|示例|
| -----------| ---------------| ------------------| --------------|
|`img[y1:y2, x1:x2]`|矩形 ROI 切片|—|手指定点框|
|`np.zeros((h,w), np.uint8)`|生成全黑 mask|单通道|`mask = np.zeros(img.shape[:2], np.uint8)`|
|`cv2.circle(mask, 中心, 半径, 255, -1)`|画实心区域|`-1`=填充|手指圆域|
|`cv2.bitwise_and(img, img, mask=mask)`|按 mask 隔离|mask 单通道 8 位|区域外全黑|
|`cv2.findContours(bin, 模式, 方法)`|找轮廓|`RETR_EXTERNAL, CHAIN_APPROX_SIMPLE`|取最大连通域|
|`cv2.boundingRect(轮廓)`|轮廓外接矩形|—|`(x, y, w, h)`|
|`cv2.mean(img, mask=mask)`|mask 内均值|去背景统计|指端平均亮度|
|`cv2.drawContours(图, [c], -1, 颜色, 厚度)`|画轮廓|—|可视化|

**短实例**：

```python
contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
finger = max(contours, key=cv2.contourArea)        # 常用法：取最大连通区域当手指
x, y, w, h = cv2.boundingRect(finger)              # 常用法：得到手指外接框
mask = np.zeros_like(gray); cv2.drawContours(mask, [finger], -1, 255, -1)  # 生成手指掩码
mean = cv2.mean(gray, mask=mask)                   # 常用法：只统计手指内的平均亮度
```

- **易错**：mask 必须单通道、尺寸与图一致；`bitwise_and`​ 要写 `(img, img, mask=mask)`。

## 十、视频与摄像头

> 视频=连续帧；`VideoCapture`​ 打开设备/文件，循环 `read()` 即可复用单帧逻辑。

|函数/属性|作用|常用参数|
| -----------| ----------------------------| -------------------------|
|`cv2.VideoCapture(0 或 路径)`|打开摄像头(数字)或视频文件|`0`=默认摄像头|
|`cap.isOpened()`|检查是否打开成功|—|
|`cap.set(属性, 值)`|设置帧率/分辨率|`CAP_PROP_FRAME_WIDTH/HEIGHT/FPS`|
|`cap.read()`|读一帧 → `(ret, frame)`|ret=False 表示结束/失败|
|`cap.release()`|释放设备|—|

**短实例**：

```python
cap = cv2.VideoCapture(0)                 # 打开摄像头
cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)    # 常用法：先设小分辨率再读，采集更快
while True:
    ret, frame = cap.read()               # ret 为 False 时停止
    if not ret: break
    cv2.imshow("frame", frame)
    if cv2.waitKey(1) & 0xFF == ord('q'): break
cap.release()
```

## 十一、Linux 摄像头部署与 V4L2 高速采集

> **V4L2（Video for Linux 2）**  是 Linux 内核的视频采集框架：摄像头在 `/dev/video*`​ 暴露为设备文件，`ioctl` 控制采集参数。理解 V4L2 = 懂"设备、格式、帧率、缓冲"四件事。

### 11.1 V4L2 是什么

- 摄像头(USB 摄像头 / 板载 MIPI-CSI)在内核表现为 `/dev/video0`​、`/dev/video1`…；
- 采集链路：**传感器 → V4L2 设备 → 应用(OpenCV/FFmpeg)读缓冲**；OpenCV 在 Linux 默认通过 V4L2 后端操作摄像头；
- 常用管理工具 **​`v4l2-ctl`​**​（`sudo apt install v4l-utils`）。

### 11.2 探测设备与参数

|命令|作用|示例|
| ------| --------------------------------| ----------------------------------|
|`v4l2-ctl --list-devices`|列出摄像头设备与名称|看到板卡摄像头型号|
|`v4l2-ctl -d /dev/video0 --list-formats-ext`|查看支持的分辨率/帧率/像素格式|`640x480@30 YUYV / MJPEG`|
|`v4l2-ctl -d /dev/video0 --all`|查看当前所有参数|驱动、能力、格式|
|`ls -l /dev/video*`|确认设备存在与权限|权限不够加 `udev` 规则或用户组 video|

**为什么看像素格式**（关键）：USB 摄像头一般支持 **YUYV（原始未压缩，CPU 要转码）**  与 **MJPEG（硬件 JPEG，带宽小）** 。高速采集→选用 **MJPEG**，640×480 可达 60-90 FPS，而 YUYV 常只有 30 FPS。

### 11.3 高速采集方法（V4L2 + OpenCV）

|手段|做法|效果/原理|
| -------------------| -------------------------------------------| ------------------------------|
|降分辨率|`CAP_PROP_FRAME_WIDTH/HEIGHT` 设小|每帧数据量小，FPS 立涨|
|改像素格式(MJPEG)|`CAP_PROP_FOURCC = cv2.VideoWriter_fourcc('M','J','P','G')`|带宽大降，帧率提升的关键|
|限制帧率|`CAP_PROP_FPS`|稳定节奏、避免缓冲堆积|
|加大缓冲|`CAP_PROP_BUFFERSIZE`（如 4）|减少丢帧抖动，配合多线程更稳|
|多线程读帧|采集线程不阻塞主线程（线程 + 最新帧变量）|处理慢也不丢新帧|
|轮询取最新帧|循环 `read()` 只保留最新一帧|丢弃旧帧，实时性优先|

**短实例（MJPEG 高速读帧）** ：

```python
cap = cv2.VideoCapture(0, cv2.CAP_V4L2)                    # 明确用 V4L2 后端
cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc('M', 'J', 'P', 'G'))  # 关键：MJPEG 硬件压缩
cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
cap.set(cv2.CAP_PROP_FPS, 60)                              # 目标帧率
cap.set(cv2.CAP_PROP_BUFFERSIZE, 4)                        # 增大驱动缓冲

while True:
    ret, frame = cap.read()
    if not ret: continue                                   # 采集中失败就跳过，不退出
    # ... 对最新帧做 ROI/推理 ...
```

### 11.4 常用命令行采集备选

```bash
# FFmpeg 直接从 V4L2 采集到文件（调试/记录用）
ffmpeg -f v4l2 -input_format mjpeg -video_size 640x480 -framerate 60 -i /dev/video0 out.mp4
# 验证当前设备实测帧率
ffmpeg -f v4l2 -input_format mjpeg -video_size 640x480 -i /dev/video0 -t 2 -f null -
```

- **易错**：分辨率/像素格式必须设备支持（先 `--list-formats-ext`​ 查）；MIPI-CSI 摄像头与 USB 摄像头驱动不同，参数以设备能力为准；权限问题报错先 `id`​ 看是否在 `video` 组。

## 十二、指端 ROI 最小实战

> 读指端图 → 灰度 → 高斯 → 阈值 → 形态学 → 取最大轮廓 → mask → 均值统计，跑通"一指知心"预处理雏形。

```python
img = cv2.imread("fingertip.jpg"); assert img is not None
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)                                # 灰度
gauss = cv2.GaussianBlur(gray, (5, 5), 0)                                   # 去噪
_, binary = cv2.threshold(gauss, 60, 255, cv2.THRESH_BINARY)               # 二值化
binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_RECT, (9, 9)))  # 填洞
contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
finger = max(contours, key=cv2.contourArea)                                 # 手指=最大连通域
x, y, w, h = cv2.boundingRect(finger)                                       # 外接框
mask = np.zeros_like(gray); cv2.drawContours(mask, [finger], -1, 255, -1)   # 掩码
mean = cv2.mean(gray, mask=mask)                                            # 指端平均亮度
cv2.imwrite("roi_result.jpg", cv2.drawContours(img, [finger], -1, (0, 255, 0), 2))
```

## 十三、自测（附答案）

1. **彩色图像 shape 与通道顺序？**  答：`(H, W, 3)`​，通道顺序 **BGR**。
2. **裁剪与 mask 区别？**  答：裁剪=矩形切片；mask=任意形状（圆/轮廓）配合 `bitwise_and` 贴合目标。
3. **用 V4L2 高速采集 USB 摄像头，最关键的两步？**  答：① 改用 **MJPEG** 像素格式（`CAP_PROP_FOURCC`​），② 降低分辨率（并适当加大 `BUFFERSIZE`、多线程取最新帧）。
4. **​`v4l2-ctl --list-formats-ext`​**​ **有什么用？**  答：查看设备支持的分辨率/帧率/像素格式，据此选择 MJPEG 与合适尺寸，避免设置无效参数。

<section class="siyuan-references" aria-label="文档引用">

## 文档关系

### 反向引用
- [待学习](/siyuan/待学习/)
- [学习笔记](/siyuan/)

</section>
