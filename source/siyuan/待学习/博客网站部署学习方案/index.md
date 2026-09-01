---
title: '博客网站部署学习方案'
date: '2026-08-31T14:38:11+08:00'
updated: '2026-08-31T14:42:38+08:00'
layout: page
type: siyuan-note
notebook: '学习笔记'
permalink: 'siyuan/待学习/博客网站部署学习方案/'
siyuan_source: '待学习/博客网站部署学习方案.md'
comments: false
categories:
  - '学习笔记'
  - '待学习'
---

‍

# 博客网站部署学习方案（GitHub Pages 版）

> 小白友好·详细版教学讲义。目标不变：基于 **Hexo + Butterfly** 的博客，浏览器输入 **blogs.yanghanlin.cn** 即可访问；写文章用**在线方式**（登录账号 → 网站/仓库内直接写 → 自动发布）。托管改用 **GitHub Pages**（免费、零服务器、自动 HTTPS），不再自购/自管服务器。

## 一、先看全景：GitHub Pages 是怎么工作的

> 类比"把装修好的房子交给物业的公共展览厅"：文章都放在 GitHub 的**仓库**里，GitHub Pages 自动把构建好的网页挂到公网（`你的用户名.github.io`），全世界都能访问。

|环节|干什么|对应章节|
| ---------------| ----------------------------------| ----------|
|1. 你的文章|写 Markdown 放进仓库 `source/_posts/`|三、五|
|2. 自动构建|GitHub Actions 运行 `hexo g` 生成网页|四|
|3. 托管公布|GitHub Pages 把网页挂到 `user.github.io`|四|
|4. 自定义域名|`blogs.yanghanlin.cn`​ 指向 `user.github.io`|六、DNS|
|5. 访问者|浏览器输域名 → 解析 → 打开网页|六、七|

- 域名规划不变：**博客 =**  **​`blogs.yanghanlin.cn`​**​ **（子域）** ；**主页 =**  **​`yanghanlin.cn`​**​ **（后续再加，可以绑另一个 Pages/仓库）** ；
- **不再需要**：Rock5B+ 服务器、Nginx、Cloudflare Tunnel、SSH 部署——它们的学习价值另见 Linux/SSH 专项，此处不展开。

## 二、准备：GitHub 账号与仓库

> 一切从"一个 GitHub 账号 + 一个仓库"开始。Pages 官方免费域名是 `用户名.github.io`，我们先让它在默认域名下能访问，再加自定义域名。

|准备项|怎么做|
| -------------| ---------------------------------------------------------------|
|注册 GitHub|github.com → 注册账号 → 手机号/邮箱验证|
|开启 2FA|Settings → Password and authentication → **Two-factor authentication**（账号安全第一层）|
|建仓库|New repository → 名称写 `你的用户名.github.io`​（`<username>.github.io` 规则）→ Public|

- **为什么仓库名必须叫**  **​`<username>.github.io`​**​：GitHub 看到这个名字就自动知道"这是 Pages 站点"，默认直接给你 `https://<username>.github.io`；
- 易错：用户名里的大写/特殊字符、仓库 Public/Private（Public 才能给所有人访问）；2FA 不开容易被盗号删站。

## 三、Hexo + Butterfly 骨架（初始包，不用手写页面）

> 在**你自己电脑**或 **GitHub 网页端 Codespaces** 里，用 `hexo init` 生成骨架（官方脚手架），装 Butterfly 主题，然后把整个项目推到仓库；之后服务端（GitHub Actions）负责构建。

**本地生成（任选其一；不会本地也能用网页端）** ：

```bash
# 本地（已装 Node 18+）
npm install -g hexo-cli
hexo init myblog && cd myblog
npm install hexo-theme-butterfly
nano _config.yml        # 设 theme: butterfly、站点名/描述、url: https://blogs.yanghanlin.cn
```

**把项目推上 GitHub（初次）** ：

```bash
git init && git add . && git commit -m "init blog"
git branch -M main
git remote add origin https://github.com/你的用户名/你的用户名.github.io.git
git push -u origin main
```

- 目录关键物（讲透）：`source/_posts/`​=文章稿纸；`themes/butterfly/`​=皮肤；`_config.yml`​=总开关；`public/`​=`hexo g` 编译出的成品（线上看到的就是它）；
- **不想装本地**：GitHub 网页端 → 仓库 → Add file → 上传/新建，或网页打开 Codespaces 云端编辑器，等效；
- 易错：`_config.yml`​ 里 `url`​ 先写占位 `https://你的用户名.github.io`​，装完自定义域再改 `https://blogs.yanghanlin.cn`。

## 四、GitHub Actions：自动构建 + 发布（核心机制）

> GitHub Actions 是 GitHub 的"流水线工人"：仓库每次收到 push，就按你写好的工作流（`.github/workflows/*.yml`​）自动干活——这里就是"装依赖 → `hexo g`​ → 把 `public/` 推到 Pages"。

**为什么需要它**：GitHub Pages 只服务"编译好的网页"，不运行代码；所以必须有人（Actions）在你写完文章后自动把 Hexo 编译出来。**这同时实现了"在线写文章→自动发布"** 。

**工作流文件（放仓库**  **​`.github/workflows/deploy.yml`​**​ **）** ：

```yaml
name: Deploy blog
on:
  push:
    branches: [main]              # 每次推 main 就触发
permissions:
  contents: write
jobs:
  build-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npx hexo g            # 编译 public/
      - uses: peaceiris/actions-gh-pages@v4
        with:
          publish_dir: ./public    # 把编译结果发布到 gh-pages
          publish_branch: gh-pages
```

**启用 Pages**：

```text
仓库 → Settings → Pages
  → Source 选 "Deploy from a branch" → 分支选 gh-pages/(root)
  → Save
首次 push 后约 1-2 分钟 → 访问 https://你的用户名.github.io 应看到博客
```

- 易错：第一次 push 后要等 Actions 跑完 + Pages 生效；看到 404 先看 **Actions 是否绿色成功**、Pages 分支是否选对；
- 之后流程 = 改文章 → push → Actions 自动发布（全程不用你碰服务器）。

## 五、在线写文章并发布（需求不变：登录后在网页写）

> 你的需求是"公网登录身份 → 在网站/编辑器里直接写文章→发布"。GitHub 版本地等效：**登录 GitHub（身份认证）→ 网页/云端编辑器直接写 Markdown → 保存=commit → 自动触发 Actions 构建发布**。不需要命令行，不需要本地环境。

**三种"在线写"方式（推荐第一种）** ：

|方式|操作|适合|
| ---------------------------| --------------------------------------------------------------------------| ------------------|
|GitHub 网页编辑|仓库 `source/_posts/x.md` → 铅笔图标编辑 → 写 Markdown → Commit changes（可写提交说明）|快速小改、零依赖|
|Codespaces 云端 IDE|仓库 → Code → Codespaces → 云端完整编辑器写文章、`hexo new`、预览|完整开发体验|
|GitHub Actions 自动化预览|开启 Pages 部署后，访问 `https://你的用户名.github.io` 就是线上预览|给别人看成品|

**发布链路（讲透）** ：

```text
登录 GitHub → 打开仓库 source/_posts/文章.md → 网页编辑/新建
   → Commit（身份已认证，GitHub 记录操作人）
   → 自动触发 Actions（hexo g 重新编译）
   → GitHub Pages 更新 → blogs 域名（或 user.github.io）显示新文章
```

- **文章格式**：开头是 Front-matter（标题/日期/标签等元信息），下面是 Markdown 正文：

```markdown
---
title: 我的第一篇
date: 2026-08-31 10:00:00
tags: [生活]
---
正文写在这里，随意用 Markdown。
```

- 易错：文件名建议 `2026-08-31-我的第一篇.md`​ 类带日期，好排序；Commit 直接推到 `main`​（不想被直接推可开 PR 分支策略，进阶再学）；**身份认证由 GitHub 账号承担**——务必开 2FA、别把账号借人。

## 六、域名与 DNS 解析：让 blogs.yanghanlin.cn 指向它

> 默认域名 `user.github.io`​ 能用，但你要用**自己的域名** **​`blogs.yanghanlin.cn`​**​。原理和之前一样：DNS 把 `blogs.` 这名字"指向" GitHub 的地址。

**为什么用 CNAME 而不是 A/AAAA**：GitHub Pages 的服务器 IP 会变，绑 IP 会断；`CNAME` 是"别名指向"，让 GitHub 自己解析到正确的服务器，稳定。

**两步配置**：

|步|在哪|填什么|
| ----| ---------------------------------------------------| ---------------------------------------------|
|1|阿里云 云解析 DNS → 添加记录|主机记录 `blogs`​、类型 **CNAME**、记录值 `你的用户名.github.io.`（末尾点别漏）|
|2|GitHub 仓库 → Settings → Pages → Custom domain|填 `blogs.yanghanlin.cn` → Save|

**为什么两步缺一不可**：① DNS 让"名字→GitHub";② GitHub 的 Custom domain 让它"认领"这个域名并自动申请证书；做完 GitHub 会提示"DNS check 通过"。

**验证与生效**：

```bash
dig blogs.yanghanlin.cn            # 应返回 => 你的用户名.github.io 相关（或 CNAME 链）
curl -I https://blogs.yanghanlin.cn   # 应为 200
```

- TTL/缓存：DNS 改动生效要几分钟至几小时（阿里云 TTL 设小一点，如 600s 更快）；期间 404/无法访问属正常，先 `dig` 确认解析链。
- **主页规划不变**：根域 `yanghanlin.cn`​ 后续做主页（可再建一个 Pages 仓库绑根域，或先用占位页）；本期只绑 `blogs`。
- 易错：CNAME 记录值末尾别忘点；GitHub Custom domain 填 `blogs.yanghanlin.cn`​（不要带 `https://`​）；先确保 `user.github.io` 本身能访问，再挂域名。

## 七、HTTPS 与加密（GitHub 自动帮你加密）

> 别人访问你的博客时，浏览器与 GitHub 之间要加密。GitHub Pages **自动**为 `user.github.io` 与自定义域名申请证书——你要做的只是开启"强制 HTTPS"。

**在仓库 Settings → Pages → Enforce HTTPS 勾上**。GithHub 会自动为 `blogs.yanghanlin.cn` 配 Let's Encrypt 证书，自动续期，不用自己管 Certbot。

**底层（了解即可，帮助理解"为什么安全")** ：

|概念|一句话|
| ------------| ------------------------------------------------------------------|
|明文 HTTP|像发明信片，沿途都能看|
|对称加密|一把钥匙加解密，快|
|非对称加密|公钥加密私钥解，用于安全送钥匙|
|TLS|先非对称"递钥匙"验证身份，再对称加密传数据——HTTPS 就是这个组合|

- 易错：勾 Enforce HTTPS 前要等证书签发成功（DNS 先作对）；若出现"证书给错域名"，通常是你把 `user.github.io` 大写/带协议的串填进 Custom domain。

## 八、为什么选 GitHub Pages（对比，讲清取舍）

> 你之前考虑板卡自托管，现在用 GitHub Pages。把两类方案摆开看，含优点与代价，心里有数。

|对比项|GitHub Pages（选用）|Rock5B+ 自托管|
| ----------| ---------------------------------| ------------------------------|
|费用|免费|电费/网络/设备（已购不计）|
|运维|零（GitHub 管服务器/证书/备份）|要自己管 Nginx/TLS/安全/断电|
|上线速度|push 后 1-3 分钟|要装服务、配置域名|
|HTTPS|自动|自装 Certbot/Tunnel|
|在线写作|登录 GitHub 网页/云端编辑|登录 hexo-admin 后台|
|自由度|受平台规则（静态、公开仓库）|完全自主（可跑后台/数据库）|
|可靠性|GitHub 全球 CDN，很稳|宿舍断电/断网会下线|

**代价与适配**：GitHub Pages 只放**静态站**（Hexo 正好是静态站，完全适合）；不能跑动态后台——你的"在线写文章发布"用"登录 GitHub 网页编辑 + Actions 自动发布"达成同一体验；若未来要动态功能（评论库/表单），可接第三方评论（Waline/Giscus）或后续再上板卡。

## 九、安全与账号保护

> 服务器不用自己守了，但**账号就是你的服务器**——GitHub 账号被偷 = 网站被改/删除。安全重心从"服务器加固"变成"账号加固 + 内容备份"。

|措施|为什么|怎么做|
| -------------------| ----------------------| ------------------------------------------|
|开启 2FA|防密码泄露被盗号|Settings → 2FA（App 验证器）|
|强密码/管理器|弱密码一撞就开|密码管理器生成随机长密码|
|仓库权限最小化|防误删/被外协破坏|Settings → Collaborators 管好协作者|
|内容本地备份|远程被删能恢复|git clone 一份到本地/NAS；或定期 `git pull` 归档|
|不用共享账号|出问题无法溯源|每台设备用自己账号|
|留意 Actions 安全|第三方 action 有风险|只用官方/知名 action；不把密钥写进 yml|

- 易错：不要把 GitHub Token 提交进仓库；收到"验证异常"邮件先看官方域名再点链接（防钓鱼）。

## 十、日常开发与运维（很快，因为托管了）

|场景|怎么做|
| ---------------| -----------------------------------------------------------------------------------------|
|写文章|GitHub 网页编辑 `source/_posts/*.md` → Commit（或 Codespaces）→ 自动发布|
|本地预览|本地 `hexo s`(装了 Hexo 的话)，或直接看线上|
|改主题/配置|改 `_config.yml`​/`themes` → push → Actions 重新构建|
|看发布日志|仓库 → Actions → 点那次运行看日志（失败原因很直观）|
|域名续费/到期|阿里云续费；DNS 别停（博客依赖它）|
|内容备份|本地 `git clone`​ 留底；或 NAS 定时 `git pull`|
|故障排查顺序|① Actions 是否绿 ② Pages 是否选对分支 ③ dig 域名 ④ curl https ⑤ 浏览器强刷（缓存）|

## 十一、验收与自测（附答案）

1. **为什么 GitHub Pages 不用自己维护服务器？**  答：GitHub 负责运行、证书、可用性与备份；你只负责"内容+配置"，push 即发布，天然零运维。
2.  **"在线写文章发布"在新方案里怎么实现？**  答：登录 GitHub（身份认证）→ 网页/云端编辑器写 Markdown → Commit 触发 Actions（自动 `hexo g` 编译）→ Pages 更新；全程浏览器即可，不用命令行。
3. **自定义域名为什么用 CNAME 而非 A/AAAA？**  答：GitHub 服务器 IP 不固定；CNAME 是"名字→别名"，让 GitHub 自己解析到最新服务器 IP，不会因 IP 变化而断；且 Pages 的 Custom domain 用它认领域名并自动签证书。
4. **发布后没更新/404 最可能是什么？**  答：① Actions 那次运行失败（看 workflow 日志）；② Pages 分支没选 `gh-pages`​；③ DNS/Custom domain 未生效（`dig` 验证）；④ 浏览器缓存（强刷）。
5. **如果我想给根域 yanghanlin.cn 做主页呢？**  答：再建一个 Pages 仓库（或同仓库多分支）放主页，在阿里云把根域 `@`​/`www`​ 作 CNAME 指向该 Pages，并在其仓库 Custom domain 填 `yanghanlin.cn`​；与博客 `blogs` 互不干扰（本期先不做，占位即可）。

<section class="siyuan-references" aria-label="文档引用">

## 文档关系

### 反向引用
- [待学习](/siyuan/待学习/)
- [学习笔记](/siyuan/)

</section>
