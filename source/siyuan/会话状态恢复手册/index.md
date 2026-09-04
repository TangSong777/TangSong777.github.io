---
title: '会话状态恢复手册'
date: '2026-08-24T16:41:06+08:00'
updated: '2026-08-31T14:42:14+08:00'
layout: page
type: siyuan-note
notebook: '学习笔记'
permalink: 'siyuan/会话状态恢复手册/'
siyuan_source: '会话状态恢复手册.md'
comments: false
categories:
  - '学习笔记'
  - '会话状态恢复手册'
---

> 用途：**新会话完美续接本知识库工作**。新会话开场请说"读取[Skill速查手册](/siyuan/Skill速查手册/)与本手册继续"，AI 将据此恢复全部上下文。最后更新：2026-08-31（博客部署改为 GitHub Pages 托管：重写学习方案（Actions 构建/在线写文/CNAME 域名），删除板卡版旧文档与开发 Prompt；本手册由 session-state-sync 持续同步维护）。

## 一、新会话恢复步骤

1. 读取本手册（掌握结构）+ ((20260824095337-gbdcqka "Skill速查手册")（掌握 10 个 Skill）。
2. 按需读取 能力评估（当前能力状态）与 能力规划（后续计划）。
3. 明确本次任务目标后，调用对应 Skill 执行（见本手册「三、Skill 体系」）；本手册每次重要变更后由 session-state-sync 自动同步。

## 二、知识库结构总览（最新索引 2026-08-24）

├── 待学习/                       （学习方案统一存放处）  
│   ├── OpenCV学习方案  
│   ├── PyTorch与CNN基础学习方案  
│   ├── PPG与rPPG学习方案  
│   ├── Docker学习方案  
│   ├── 数据结构学习方案（C/C++ 嵌入式）  
│   ├── 嵌入式控制算法PID专项  
│   └── 博客网站部署学习方案（GitHub Pages 版）

## 三、Skill 体系（10 个，按名称 a-z 排序）

|Skill|核心作用|触发时机|
| -------------------------| -----------------------------------------------------------------------------------------------------------------| ----------------------------------------|
|ability-summary|更新能力评估/规划（A/B/C 三类标注：A 等级制 / B 混合 / C 确认制）|每次笔记整理/学习完成后（本人确认制）|
|decision-point|需求模糊/多方案时用 Question 工具确认方向|需求提出后方向不明、重大修改前|
|document-refactor|净化重构：先校验知识浓度 + 二次笔记覆盖校验（未覆盖调 knowledge-coach），再删笔记|结构性错误/要求整理/迭代完成后|
|knowledge-coach|模式A 文档内二次笔记/提问迭代补齐；模式B 跨文档定位补充新知识点|二次笔记/提问时、要求补充知识点时|
|learning-plan-generator|生成教学讲义式学习方案（答案伴随）；生成前同步能力体系；产出待学习/归档已归档|学习未知知识点之前|
|leetcode-organizer|整理每日力扣题解至时间线/类型索引，提炼进算法专项（标注来源原块）|每天刷题后请求整理时|
|link-checker|引用规范校验（旁路）：双括号 ((ID "标题"))、断链检测|每次文档增删改后（默认旁路）+ 全库扫描|
|note-organize|整理知识笔记（提炼而不精简）；学习文档存待学习/归档已归档；归档后先 Question 询问是否整理；触发 ability-summary|学习完成后归档时|
|session-state-sync|知识库重要变更后自动同步《会话状态恢复手册》|文档/Skill/能力/方案变更后（默认旁路）|
|skill-manual-updater|Skill 变更即同步《Skill速查手册》+ 重复校验（合并申请）+ a-z 排序|每次 Skill 增删改后（默认旁路）|

跨 Skill 约定：**答案伴随原则**（问题必附标准答案）；**知识浓度 ≥ 学习文档**（学习方案详细 ≠ 笔记可精简）。

## 四、关键文档 ID 速查

|文档|ID|
| -----------------------------------------| ------------------------|
|Skill 速查手册|20260824095337-gbdcqka|
|能力评估|20260815022629-6odbk4f|
|能力规划|20260815025510-tdh6skx|
|学习方法论|20260817172529-ypfyqky|
|计算机网络专项|20260824092532-9seych4|
|ZeroTier专项|20260819150918-s1pyugy|
|Python笔记|20260802000129-za3r55f|
|NumPy专项|20260817114056-cr0n2lh|
|PathLib专项|20260818140629-gbo53ov|
|subprocess专项|20260827115816-dorddul|
|算法专项|20260817172521-oo5kvcj|
|Linux专项|20260818140334-clwzgfw|
|SSH专项|20260827100249-mldbbr2|
|文本编码与字符集专项|20260827154002-enk6shj|
|命令行|20260825091143-nhu744x|
|PowerShell专项|20260825091152-47rn9fp|
|CMD专项|20260825091152-pmw6gjv|
|个人路由配置记录|20260819150925-18p0bwy|
|OpenWrt+ZeroTier完整方案|20260824091330-r09rtmg|
|待学习目录|20260824113130-c2v5iss|
|已归档目录|20260817155621-fc20cmb|
|博客网站部署学习方案（GitHub Pages 版）|20260831143811-a5jwz9c|
|从公网到 ZeroTier（已归档）|20260818174157-ntjwrh2|
|Python文件操作学习（已归档）|20260817160144-5mnhidk|
|Windows命令行学习（已归档）|20260819161646-wa2s9ig|
|SSH学习（已归档）|20260817171314-vcfmc6v|
|Python 调用系统命令学习方案（已归档）|20260824152946-tz0du52|
|文本编码与字符集学习方案（已归档）|20260824152756-ugwnrst|
|力扣规范|20260807222438-kl3375r|
|时间线索引|20260807222438-duymdi7|

## 五、工作流与规则速查

```
需求模糊？→ decision-point（Question 确认）
学习新知识 → learning-plan-generator（先同步能力体系；方案存「待学习」）
边学边问 → knowledge-coach（二次笔记/提问 → 讲解放入原文，问题必带答案）
学完整理 → note-organize（知识笔记，浓度≥原文档；触发 ability-summary）
二次笔记净化 → document-refactor（覆盖校验→补齐→删除笔记）
引用/手册 → link-checker / skill-manual-updater（全自动旁路）
```

## 六、当前进行状态与待办

- **能力评估 L0/L1 项待学习**：OpenCV、PyTorch/CNN（L1）、Docker、Edge AI/模型部署、数据结构 C（L1）、控制算法 PID、RK3588 边缘集成、博客搭建/公网发布（个人爱好）
- **能力规划 P0-P2**：OpenCV、PyTorch/CNN、NumPy/SciPy 进阶、PPG/rPPG、Linux 板卡、Docker、深度学习部署（已完成：Python 文件操作、Windows 命令行、SSH、subprocess、文本编码）
- **最近完成**：博客部署换用 GitHub Pages 方案（重写 11 章详细版：Actions 自动构建、在线写文发布、CNAME 自定义域名、自动 HTTPS；删除板卡版与旧 Prompt）
- **可能的中断点**：PathLib（L2）、NumPy（L2）、Windows 命令行（L2）均未脱离资料独立验证，深化任务待做；OpenCV/PyTorch/SSH/Docker 等 L0 项待学习

## 七、给新会话的恢复指令模板

```
读取((20260824095337-gbdcqka "Skill速查手册"))与会话状态恢复手册，
按手册中的 Skill 体系与规则继续工作。
本次任务：<在此说明要做什么>
```

<section class="siyuan-references" aria-label="文档引用">

## 文档关系

### 本文引用
- [Skill速查手册](/siyuan/Skill速查手册/)

### 反向引用
- [学习笔记](/siyuan/)

</section>
