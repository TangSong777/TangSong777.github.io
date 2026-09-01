---
title: 'Docker学习方案'
date: '2026-08-27T16:51:12+08:00'
updated: '2026-08-27T16:53:14+08:00'
layout: page
type: siyuan-note
notebook: '学习笔记'
permalink: 'siyuan/待学习/Docker学习方案/'
siyuan_source: '待学习/Docker学习方案.md'
comments: false
categories:
  - '学习笔记'
  - '待学习'
---

‍

# Docker 学习方案

> 教学讲义式学习方案：每章先讲原理、用**表格**列出命令/参数（作用/示例），再**最小实例**佐证。逻辑链：为什么容器 → 核心概念 → 基础命令 → 端口与卷 → Dockerfile → 构建运行训练 → 多阶段 → Compose → 排障。能力基线：Docker L0 → 目标 L2（B 类·等级制）。项目连接：实验环境复现与部署（Rock 5B+ 方向）。

## 一、为什么需要容器

> 把"代码+依赖+配置"打包成可移植单元，任何机器行为一致，消灭"在我机器上能跑"。

|对比|虚拟机|容器|
| -----------| ---------------| -------------------------|
|内核|自带整颗 OS|**共享宿主内核**|
|体积/启动|重/慢（分钟）|轻/秒级|
|隔离|强|进程+文件系统级（够用）|

**三个核心概念**：

|概念|是什么|类比|
| ----------------| ------------------------| ------------------------|
|镜像 image|只读模板|模具 / 安装盘|
|容器 container|镜像的运行实例，可启停|用模具做的零件|
|仓库 registry|存放镜像的地方|应用商店（Docker Hub）|

## 二、安装与核心命令

```bash
sudo apt update && sudo apt install docker.io
sudo usermod -aG docker $USER    # 免 sudo（重新登录生效）
```

|命令|作用|示例|
| -----------| ----------------| ----------------|
|`docker images`|本地镜像列表|—|
|`docker pull 名:标签`|拉镜像|`docker pull python:3.11-slim`|
|`docker run -it 镜像 bash`|交互进入容器|调试常用|
|`docker ps`​ / `ps -a`|运行中 / 全部|—|
|`docker exec -it 容器 bash`|进入已运行容器|调试运行中服务|
|`docker logs 容器`|看输出|排障|
|`docker stop/start/rm 容器`|停止/启动/删除|—|
|`docker rmi 镜像`|删镜像|—|

## 三、端口映射与卷挂载

|参数|作用|示例|
| ------| ----------------------------------| ------------|
|`-p 8080:80`|宿主8080→容器80|`docker run -d -p 8080:80 nginx`|
|`-v 宿主目录:容器目录`|目录挂载（数据持久化、双向可见）|`-v "$PWD/data":/data`|
|`-w 目录`|容器内工作目录|`-w /work`|
|`--rm`|退出即删容器|一次性任务|
|`--name 名`|给容器命名|好管理|

**短实例**：

```bash
# 跑训练：代码/数据在宿主机，产物写回宿主机
docker run --rm -v "$PWD":/work -w /work python:3.11-slim python train.py
```

- 易错：不加 `-v` → 容器文件删除即丢；Windows 路径要绝对路径。

## 四、Dockerfile：把环境写成代码

> 每行指令=一层，层有缓存：**依赖放前面（稳），代码放后面（常变）** ，构建更快。

|指令|作用|示例|
| ------| ----------------| ------|
|`FROM 镜像`|基底|`FROM python:3.11-slim`|
|`WORKDIR /app`|工作目录|—|
|`COPY 源 目标`|复制文件进镜像|`COPY requirements.txt .`|
|`RUN 命令`|构建时执行|`RUN pip install -r requirements.txt`|
|`CMD [数组]`|容器启动命令|`CMD ["python", "train.py"]`|

**短实例**（Dockerfile）：

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
COPY train.py .
CMD ["python", "train.py"]
```

- 易错：CMD 用 JSON 数组；COPY 只能拿构建上下文内文件；`-slim` 减体积。

## 五、构建与运行训练闭环

|命令|作用|
| ------| ------------------------|
|`docker build -t 名:标签 .`|在 Dockerfile 目录构建|
|`docker run --rm -v ... 名:标签`|挂载数据运行|
|`docker images`|看镜像大小|

**短实例**：

```bash
docker build -t my-train:0.1 .
docker run --rm -v "$PWD/data":/data -v "$PWD/out":/out my-train:0.1
```

## 六、多阶段与体积优化

|写法|作用|
| ------| -------------------------|
|`FROM python:3.11 AS builder`|阶段1：装全套依赖|
|`COPY --from=builder /路径`|阶段2：只复制产物|
|`.dockerignore`|排除 data/.git 进上下文|

**短实例**：阶段1 `pip install`​，阶段2 只 `COPY --from=builder site-packages` + 代码。

## 七、Compose 编排

|字段|作用|
| ------| ------------------------|
|`services:`|定义多容器|
|`build: .`|用本地 Dockerfile 构建|
|`volumes:`|挂载/命名卷|
|`environment:`|环境变量|

```yaml
services:
  train:
    build: .
    volumes: ["./data:/data", "./out:/out"]
  db:
    image: postgres:15
```

```bash
docker compose up -d && docker compose logs -f train && docker compose down
```

## 八、排障与易错

|现象|处理|
| --------------| -------------------------------------|
|权限不足|入 docker 组 / sudo|
|拉不动镜像|daemon.json 配国内 registry-mirrors|
|端口占用|换 -p 宿主端口|
|构建卡 pip|pip 换清华源|
|容器中文乱码|`-e LANG=C.UTF-8`|

**易错**：忘 `-v` 数据易失；改代码要重新 build；CMD 数组形式；GPU 需 nvidia-container-toolkit（本实验先 CPU 复现）。

## 九、自测（附答案）

1. **镜像/容器/仓库？**  答：镜像=只读模板；容器=镜像运行实例；仓库=存放/分发镜像处。
2. **容器数据为什么丢？**  答：容器文件系统临时，删除即丢；用 `-v` 挂载宿主机目录持久化。
3. **Dockerfile 分层为什么依赖放前？**  答：层有缓存，依赖不动则增量构建快。
4.  **​`-p 8080:80`​**​ **含义？**  答：宿主 8080 → 容器 80，外部访问宿主 8080 即容器内 80 服务。

<section class="siyuan-references" aria-label="文档引用">

## 文档关系

### 反向引用
- [待学习](/siyuan/待学习/)
- [学习笔记](/siyuan/)

</section>
