# 文章工作台

这是仅用于维护普通博客文章的 Markdown 工作台。它直接读写 `source/_posts/`，但拒绝访问由思源自动发布链路维护的 `source/_posts/siyuan/`。预览内容由项目当前的 Hexo 渲染器生成，并加载生成站点的 NexT 样式。

## 本地开发

```bash
npm run article:studio
npm run article:studio:test
```

`article:studio` 只监听 `127.0.0.1:4173`。临时可信局域网调试可运行 `npm run article:studio:mobile`，此模式会生成一次性 URL 密钥；不要做公网端口映射。

## Rock 正式运行

正式环境采用两层保护：Cloudflare Access 先完成身份登录，工作台服务再验证每个请求携带的 Access JWT（签名、签发者、AUD 与邮箱白名单）。服务本身始终只监听 Rock 的 `127.0.0.1:4173`，公网只能经 Cloudflare Tunnel 到达。

1. 将 `article-studio.env.example` 复制为 Rock 上的 `/srv/blog/config/article-studio.env`，填写真实 Team Domain、Application AUD 和允许登录的邮箱，并将权限设为 `600`。
2. 将 `tools/systemd/article-studio.service` 安装到 `/etc/systemd/system/`，执行 daemon-reload 后启用服务。
3. 在 Cloudflare Tunnel 中把专用主机名映射到 `http://localhost:4173`。
4. 为同一主机名创建 Self-hosted Access Application，只允许维护者身份；从应用设置中复制 AUD 到环境文件。
5. 验证公网未登录会被 Access 拦截，登录后的 `/api/config` 返回当前邮箱，并确认 Rock 的 4173 端口没有监听在局域网地址上。

真实邮箱、AUD、Tunnel token 和 Cloudflare 凭据不得写入仓库。

本机模式准备完环境文件后，可用以下命令一次安装/更新 systemd 服务：

```bash
cd /srv/blog/repo
sudo bash tools/install-article-studio-rock.sh
```

## 发布安全边界

- 发布前先进行敏感信息扫描与完整 Hexo 构建。
- 私钥、GitHub Token、通用密钥和私密值词表命中项会强制阻断；私网 IP、邮箱和疑似 ZeroTier ID 需要人工确认。
- 只允许当前文章、对应图片目录以及本次重命名产生的旧路径进入 Git 提交。
- 只允许 `main` 分支和指定 GitHub 仓库，远端落后、异常暂存或范围外修改都会中止发布。
- 与思源定时发布共用 `/srv/blog/locks/publish.lock`，避免两个流程同时操作仓库。
- 未发布的普通文章和文章图片可以保留为工作区草稿；思源定时任务会容许这些路径保持未提交，但任何主题、脚本、配置或思源生成目录的异常改动仍会阻断自动发布。
- Git 推送中断时在 `/srv/blog/state/article-pending-push.json` 留下校验记录；下次上传先验证并补推送，不会盲目提交第二次。
- 图片按文件签名校验，PNG/JPEG/WebP 会清除常见元数据；不接受 SVG 和 AVIF。
- 手机浏览器会保存当前文章的本地恢复草稿，服务端保存成功后自动清理。
