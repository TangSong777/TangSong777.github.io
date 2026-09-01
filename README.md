# 学习与思考：Hexo 博客与思源知识库

这个项目由两套彼此独立、视觉统一的内容组成：

- 普通博客文章位于 `source/_posts`，出现在首页时间线与归档页。
- 思源学习笔记位于 `source/siyuan`，以完整文档树、目录和双向引用的形式展示，不进入博客时间线。

主题使用 NexT.Muse。所有定制都放在项目自己的配置、脚本和样式中，没有直接修改 `node_modules`，所以升级主题后仍可保留。

## 一、环境与目录

建议环境：

- Windows 10/11
- Node.js 20
- PowerShell 5.1 或 PowerShell 7
- Git
- 思源笔记桌面端

当前默认路径：

```text
思源导出目录：D:\桌面\tmp\学习笔记.md
Hexo 项目目录：D:\WorkSpace\MyServer\MyBlog
```

首次安装依赖：

```powershell
cd D:\WorkSpace\MyServer\MyBlog
npm ci
```

## 二、从思源导出

在思源中选择“学习笔记”笔记本并导出 Markdown。推荐设置：

- 添加文档标题：开启
- 包含子文档：开启
- 包含关联文档：关闭
- 添加 YAML front matter：开启
- 移除资源文件名中的 ID：开启
- 行级备注：关闭
- 引用：脚注与锚点哈希
- 嵌入块：引述块
- 标签包裹符号：`# 标签 #`

导出完成后，目录大致应为：

```text
学习笔记.md\
├─ assets\
├─ Python笔记\
├─ Python笔记.md
├─ daily note\
└─ daily note.md
```

不要把导出的原始目录直接复制进 `source`。转换脚本会统一生成 URL、资源链接、front matter、目录数据和双向引用。

## 三、隐私检查（发布前必须做）

导入器会自动处理已知的个人路由配置、ZeroTier Network ID、私网 IP 和非示例邮箱，但自动规则不能替代人工检查。

如果有必须隐藏的固定值：

```powershell
Copy-Item .\tools\siyuan-private-values.example.txt .\tools\siyuan-private-values.txt
notepad .\tools\siyuan-private-values.txt
```

在文件中每行写一个原始字符串，例如设备 ID、网络 ID、用户名、内网域名或其他凭据。真实文件已被 `.gitignore` 排除，不会提交到 Git。导入器会把命中的内容替换为 `[已隐藏]`。

还应人工搜索这些内容：

- 密码、Token、API Key、Cookie、私钥
- 邮箱、手机号、真实住址和学校内部信息
- 公网 IP、内网拓扑、Wi-Fi 名称与密码
- ZeroTier、Tailscale 等组网标识
- 截图中的账号、通知、文件路径和设备名

图片中的隐私无法由当前脚本自动识别，发布前必须逐张检查。

## 四、转换与更新

### 推荐的一键流程

先停止正在运行的 `hexo server`，然后执行：

```powershell
cd D:\WorkSpace\MyServer\MyBlog
npm run siyuan:dry-run
npm run siyuan:refresh
```

`siyuan:dry-run` 只扫描和转换到内存，不写文件。确认没有异常后，`siyuan:refresh` 会：

1. 读取全部 Markdown 文档。
2. 建立文档名、相对路径和思源块 ID 索引。
3. 清理敏感信息。
4. 转换双链、Markdown 文档链接和块引用。
5. 将资源链接统一改为 `/images/siyuan/...`。
6. 生成 `source/siyuan/**/index.md`。
7. 生成正向引用与反向引用。
8. 生成左侧全文档树数据。
9. 清理并构建 Hexo。
10. 运行结构、链接、资源和隐私检查。

转换报告写入 `siyuan-import-report.txt`。警告不会被静默忽略，尤其要关注“缺失资源”和“找不到引用目标”。

### 自定义路径或排除日记

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\Import-SiyuanNotes.ps1 `
  -SourceDir 'D:\其他位置\学习笔记.md' `
  -BlogDir 'D:\WorkSpace\MyServer\MyBlog' `
  -ExcludeDailyNote $true
```

脚本是幂等的：重复执行只会重建 `source/siyuan`、`source/images/siyuan`、`source/js/siyuan-data.js` 和导入报告，不会修改 `source/_posts` 中的普通博客。

## 五、转换规则

### 页面和分类

源文件：

```text
Python笔记\算法专项.md
```

生成页面：

```text
source\siyuan\Python笔记\算法专项\index.md
```

公开 URL：

```text
/siyuan/Python笔记/算法专项/
```

页面使用 `layout: page` 和 `type: siyuan-note`，因此不会混入文章首页和文章归档。分类由笔记本名称和目录层级生成。

### 图片

思源 `assets` 中的文件复制到：

```text
source\images\siyuan
```

Markdown 中的图片统一引用 `/images/siyuan/...`。生成网页时，正文图片自动带有 `loading="lazy"` 和 `decoding="async"`，减少首屏资源占用。

### 文档引用

- `[[文档名]]` 会解析为对应知识库页面。
- 普通 `.md` 相对链接会转换为站内 URL。
- `siyuan://blocks/...` 会通过块 ID 索引定位到目标页面和块。
- 块锚点会保留，打开引用时自动滚动到块并短暂高亮。
- 每页末尾生成“本文引用”和“反向引用”。
- 无法解析的引用会进入导入报告，不会伪造目标。

同名文档无法唯一解析时，应在思源中改为相对路径链接，或者给文档使用唯一名称。

## 六、本地预览

如果刚完成导入：

```powershell
npm run preview
```

然后打开 `http://localhost:4000`。重点检查：

- 首页、学习笔记和归档的主内容是否居中。
- 左侧文档树是否保留滚动位置与展开状态。
- 搜索能否显示匹配文档及其父级路径。
- 右侧目录是否能滚动到完整内容并跟随当前标题。
- 跨文档引用是否进入正确页面并聚焦正确块。
- 手机宽度下左侧目录是否可打开、点遮罩或按 Esc 关闭。
- 系统暗色模式和键盘 Tab 导航是否可用。

单独执行验收：

```powershell
npm run siyuan:check
```

严格模式会把缺失图片等警告也视为失败：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\Test-SiyuanKnowledgeBase.ps1 -Strict
```

## 七、发布到 GitHub Pages

确认 `_config.yml` 中的站点地址与仓库一致：

```yaml
url: https://tangsong777.github.io
root: /
```

当前仓库是用户主页仓库 `TangSong777.github.io`，所以根路径为 `/`。如果以后改成项目仓库，例如 `username.github.io/blog`，需要把 `url` 改为完整地址，并把所有自定义根路径一并验证；迁移前建议先在本地测试。

提交并推送：

```powershell
git status
git add .
git commit -m "Update blog and Siyuan knowledge base"
git push origin main
```

`.github/workflows/pages.yml` 会在 GitHub Actions 中执行锁定依赖安装、干净构建、知识库验收和 Pages 发布。也可以在 GitHub Actions 页面手动触发。

如果使用自定义域名，在 `source/CNAME` 中只写域名，不带协议和路径，同时把 `_config.yml` 的 `url` 改为该 HTTPS 地址。

## 八、日常内容工作流

### 写普通博客

```powershell
npx hexo new post "文章标题"
```

编辑 `source/_posts` 中的新文件，预览后提交。普通文章按时间线展示。

### 更新学习笔记

1. 在思源中维护内容和双链。
2. 重新导出整个“学习笔记”笔记本，覆盖临时导出目录。
3. 更新私密值清单（如有）。
4. 运行 `npm run siyuan:dry-run`。
5. 运行 `npm run siyuan:refresh`。
6. 阅读 `siyuan-import-report.txt` 并本地预览。
7. 提交并推送。

不要手工长期修改 `source/siyuan` 内的生成文件，因为下次导入会覆盖。永久修改应在思源源文档、导入脚本或样式脚本中完成。

## 九、定制文件说明

```text
_config.yml                              Hexo 站点、URL 与主题配置
_config.next.yml                         NexT 菜单、侧栏、目录与动画配置
scripts/siyuan-knowledge.js              按页面类型注入资源、图片懒加载
source/js/site-shell.js                  普通页面模式与无障碍跳转
source/js/siyuan-knowledge.js             首页和知识库交互
source/css/siyuan-knowledge.css           全站统一视觉与响应式布局
source/_data/styles.styl                  NexT 小范围覆盖
tools/Import-SiyuanNotes.ps1              思源转换器
tools/Test-SiyuanKnowledgeBase.ps1        自动验收
tools/siyuan-private-values.example.txt   私密值清单模板
siyuan-import-report.txt                  最近一次导入报告
```

升级 NexT 时只更新 npm 依赖，不要把定制写入 `node_modules/hexo-theme-next`。

## 十、常见问题

### 左侧目录切换页面后回到顶部

目录滚动位置和手动展开状态保存在当前浏览器标签页的 `sessionStorage` 中。关闭标签页会自然清除；如果状态异常，可在开发者工具中清除这两个键：

```text
siyuan-knowledge-tree-scroll
siyuan-knowledge-tree-expanded
```

### 页面引用能打开，但没有聚焦

确认链接末尾含完整块 ID，例如：

```text
/siyuan/目标文档/#20260803024557-b279qkz
```

然后检查目标生成文件中是否存在相同 ID 的 `siyuan-block-anchor`。若不存在，通常是源文档没有导出该块锚点，需回到思源修正引用方式后重新导出。

### 图片显示为破图

查看 `siyuan-import-report.txt` 的“缺失资源”。如果原导出目录的 `assets` 中也没有该文件，应在思源中重新插入图片并重新导出；不要只向生成目录补图，否则下次更新仍会丢失。

### 构建时大量出现文件重复或监听警告

不要在 `hexo server` 正在监听时重建整个知识库。先按 `Ctrl+C` 停止服务，完成导入和构建后再启动预览。

### 恢复与回滚

所有源代码和生成笔记都应纳入 Git。出现问题时先查看：

```powershell
git status
git diff
```

不要用会清空未提交工作的命令。优先从上一笔正常提交创建临时分支进行对照，确认后再修复。
