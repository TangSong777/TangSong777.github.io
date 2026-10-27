# rock-console —— Rock 5B+ 状态面板与 Web 终端

在公网通过 `https://server.yanghanlin.cn` 实时查看 Rock 5B+ 的开发板状态，并获得一个可交互的终端。
部署形态与 `editor.yanghanlin.cn` 上的 article-studio 完全一致：

```
浏览器 ──HTTPS──▶ Cloudflare 边缘 ──出站隧道──▶ cloudflared（Rock 上）
                                                      │
                                                      ▼
                                         http://127.0.0.1:4180
                                                      │
                                        rock-console（Node，仅回环监听）
                                          ├── 状态采集：/proc、/sys（只读）
                                          └── 终端：node-pty → bash（radxa 身份）
```

**Rock 上不开放任何入站端口。** cloudflared 主动向 Cloudflare 建立出站连接，
应用本身只绑定 `127.0.0.1`，与 article-studio 的做法相同。

---

## 一、安全模型

| 层次 | 措施 |
| --- | --- |
| 网络 | 服务硬编码只监听 `127.0.0.1`（不可通过环境变量改成 `0.0.0.0`）；不修改防火墙、不做端口转发 |
| 边缘 | Cloudflare Tunnel 出站连接；可选叠加 Cloudflare Access 做第二因素 |
| 认证 | scrypt 口令派生值（`scrypt$salt$hash`）+ HMAC-SHA256 会话 Cookie（`HttpOnly` `SameSite=Lax`，HTTPS 下带 `Secure`） |
| 防跨站 | 所有写操作要求同源（`Origin` 与 `Host` 一致）+ `Sec-Fetch-Site` 校验 + `x-rock-console-token` CSRF 令牌 |
| 防爆破 | 同一来源 15 分钟内失败 8 次后锁定 15 分钟 |
| 提权 | systemd `NoNewPrivileges=true` + `RestrictSUIDSGID=true`，Web 终端**无法**通过 sudo 提权 |
| 密钥隔离 | 终端环境变量剔除 `ROCK_CONSOLE_*`、`*PASSWORD*`、`*SECRET*`、`*TOKEN*`、`*KEY*`、`SSH_AUTH_SOCK` 等，`env` 里看不到服务密钥 |
| 会话管控 | 并发终端数上限（默认 2）、空闲自动断开（默认 30 分钟）、输出回放缓冲上限 |
| 审计 | 会话创建/关闭/退出、登录成败、CSRF 拒绝等写入 JSON Lines 审计文件 |
| 响应头 | 严格 CSP（`default-src 'self'`）、`X-Frame-Options: DENY`、`nosniff`、`no-referrer` |
| 前端 | 不含任何凭据，不引用任何 CDN，`noindex` 禁止搜索引擎收录 |

### 明确的能力边界

- **Web 终端 = 一次 SSH 登录。** 它以 `radxa` 身份运行，能读写该账号可访问的文件（`/srv/blog`、`/home/radxa`）。
  这是"终端操作"的必然结果，不是配置疏漏。
- **可以提权（2026-10-21 起）。** 按用户要求关闭了 `NoNewPrivileges` 与 `RestrictSUIDSGID`，
  终端里 `sudo` 可提权到 root（需 radxa 的 sudo 密码）。
- **系统目录可写。** `ProtectSystem` 与 `ReadWritePaths` 已关闭，等同一次 `SSH + sudo -i`。
- **边界提醒：** 现在「Web 密码 + 动态验证码 + sudo 密码」即可完全控制主机。
  建议 sudo 密码与 Web 密码不同；若要回到旧边界，恢复 `/root/rock-console.service.bak-*`
  并重启服务。
- **口令与会话密钥只存在于** `/srv/blog/config/rock-console.env`（权限 600，属主 radxa），
  不属于 Git 仓库，不出现在服务日志和本 README 中。

---

## 二、安装

两条路径功能相同，差别在**是否需要 root** 与**加固程度**。

### 路径 A：用户级安装（不需要 sudo，推荐先跑通）

```bash
ssh rock5b+
cd /srv/blog/repo/tools/rock-console

# 依赖只装一次
npm install --no-audit --no-fund && npm run bundle

bash install-user-service.sh
```

脚本会：启用 `linger`（免登录开机自启）→ 交互式设置访问密码（不回显、不进 shell 历史）
→ 写入 `~/.config/rock-console/rock-console.env`（600）→ 安装
`~/.config/systemd/user/rock-console.service` 并 `enable --now` → 健康检查。

日常命令都要带 `--user`：

```bash
systemctl --user status rock-console
journalctl --user -u rock-console -f
systemctl --user restart rock-console
```

**用户级 systemd 的能力边界（在本机实测）**

| 选项 | 用户级是否可用 |
| --- | --- |
| `NoNewPrivileges`、`PrivateTmp`、`UMask` | ✅ |
| `ProtectKernelTunables`、`ProtectControlGroups`、`ProtectHostname`、`ProtectProc` | ✅ |
| `RestrictSUIDSGID`、`RestrictNamespaces`、`RestrictRealtime`、`LockPersonality` | ✅ |
| `RestrictAddressFamilies` | ✅ |
| `ProtectSystem`、`ProtectHome` | ❌ 用户管理器不支持 |
| **`ProtectClock`** | ❌ **会让服务以 `status=218 (CAPABILITIES)` 启动失败，不要加** |

### 路径 B：系统级安装（需要 sudo，加固更完整）

```bash
ssh rock5b+
cd /srv/blog/repo
sudo bash tools/rock-console/install-rock-console.sh
```

相比路径 A 多出 `ProtectSystem=strict` + `ReadWritePaths`，即终端**写不了 `/etc`、`/usr`**
等系统目录。配置文件位于 `/srv/blog/config/rock-console.env`。

> 两条路径都会占用同一个端口，不要同时启用。从 A 升级到 B：
> `systemctl --user disable --now rock-console` 之后再跑系统级安装。

### 公共前提

仓库里需有 `tools/rock-console/` 目录；Node ≥ 20.19。
开发板当前为 Node v22.23.2 / Debian 12 / aarch64，`node-pty` 与 `ws` 均已验证可用。

之后按下一节在 Cloudflare 控制台添加域名。

---

## 三、Cloudflare 配置（现有隧道是控制台托管型）

Rock 上的 cloudflared 以 `--token-file /etc/cloudflared/token` 运行，属于
**Dashboard 托管隧道**，本地没有 `config.yml`。因此 `server.yanghanlin.cn`
的路由只能在 Cloudflare 控制台添加：

1. 打开 **Cloudflare Zero Trust → Networks → Tunnels**。
2. 选择承载 `editor.yanghanlin.cn` 的那条隧道（`rock5b-article-studio`），点 **Edit / Configure**。
3. 切到 **Public Hostname** 选项卡 → **Add a public hostname**：
   - **Subdomain**：`server`
   - **Domain**：`yanghanlin.cn`
   - **Path**：留空
   - **Service → Type**：`HTTP`
   - **Service → URL**：`127.0.0.1:4180`
   - **Additional application settings / HTTP Settings**：全部保持默认
     （**不要**把 `127.0.0.1:4180` 填进 Host Header，也不要填自定义 Hostname —
     历史上 editor 的截图里出现过这种错填）。
4. **Save**。Cloudflare 会自动创建一条指向 `<隧道ID>.cfargotunnel.com` 的
   CNAME（代理开启，橙云）。若已存在同名 `server` 记录，先删除或改成这条。

### 可选的第二层防护（推荐）

Web 终端能在开发板上执行命令，只靠一个密码属于单因素。建议叠加 Cloudflare Access：

1. **Zero Trust → Access → Applications → Add an application → Self-hosted**。
2. Application domain 填 `server.yanghanlin.cn`。
3. 添加策略：**Allow** → **Emails** → 你自己的邮箱（或用 One-time PIN 登录）。
4. 保存后，访问会先经过 Cloudflare 身份验证，再看到 rock-console 的密码页。

这样即使密码泄露，攻击者仍拿不到 Cloudflare 之后的入口。
**注意：这不会替换应用内密码**，两层都要保留。

---

## 四、配置项

全部放在 `/srv/blog/config/rock-console.env`，改完执行
`sudo systemctl restart rock-console.service`。

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `ROCK_CONSOLE_PORT` | `4180` | 监听端口（始终只绑定 127.0.0.1） |
| `ROCK_CONSOLE_PASSWORD_HASH` | 必填 | `scrypt$salt$hash`，由 `npm run hash-password` 生成 |
| `ROCK_CONSOLE_SESSION_SECRET` | 必填 | ≥32 字符随机会话密钥 |
| `ROCK_CONSOLE_SESSION_HOURS` | `12` | 登录有效期 |
| `ROCK_CONSOLE_MAX_SESSIONS` | `2` | 并发终端数上限 |
| `ROCK_CONSOLE_IDLE_MINUTES` | `30` | 终端空闲断开；`0` 表示不超时 |
| `ROCK_CONSOLE_ALLOW_WRITE` | `1` | 设为 `0` 时**所有**终端强制只读（只能看输出，不能输入） |
| `ROCK_CONSOLE_UNITS` | 见下 | 状态页监视的 systemd 单元，逗号分隔 |
| `ROCK_CONSOLE_MOUNTS` | `/` | 磁盘用量挂载点，逗号分隔 |
| `ROCK_CONSOLE_AUDIT_FILE` | `/srv/blog/state/rock-console-audit.log` | 审计日志路径 |
| `ROCK_CONSOLE_STATUS_INTERVAL_MS` | `2000` | 状态推送间隔（1000–10000）。本机已设为 `1000`；`systemctl`/`docker` 这类子进程采集每 5 秒刷新一次，避免同步阻塞终端 |

默认监视单元：`article-studio.service`、`cloudflared.service`、
`rock5b-fan-control.service`、`rock-console.service`、`siyuan-notes-publish.timer`、`docker.service`。

### 只读模式

不想给公网任何输入能力时：

```bash
sudo sed -i 's/^ROCK_CONSOLE_ALLOW_WRITE=.*/ROCK_CONSOLE_ALLOW_WRITE=0/' /srv/blog/config/rock-console.env
sudo systemctl restart rock-console.service
```

此时页面仍可看状态、看日志、看终端输出，但键盘输入被服务端拒绝（并有审计记录）。

---

## 五、运维

```bash
systemctl status rock-console.service
journalctl -u rock-console.service -f
sudo systemctl restart rock-console.service

# 审计日志（JSON Lines，权限 600）
sudo tail -f /srv/blog/state/rock-console-audit.log

# 改密码（重新生成哈希后替换文件中该行）
cd /srv/blog/repo/tools/rock-console && npm run hash-password

# 完全卸载（保留配置）／连配置一起删
sudo bash tools/rock-console/uninstall-rock-console.sh
sudo bash tools/rock-console/uninstall-rock-console.sh --purge
```

---

## 六、验证

```bash
cd /srv/blog/repo/tools/rock-console

# 一键跑完整验证（临时端口 4199 + 临时测试口令，不读取也不改动正式配置）
bash verify-on-device.sh

# 或分开跑
npm test                                                # 单元测试（认证、采集、会话管理，54 项）
ROCK_CONSOLE_TEST_PASSWORD='你的密码' node e2e-check.mjs  # 端到端自检（需服务已在本机运行）
```

`e2e-check.mjs` 会真实走一遍：未认证拦截 → 跨站 Origin 拒绝 → 错误密码 →
正确密码 → 状态快照 → 新建终端 → WebSocket 执行 `echo`/`id -un`/`tty` →
确认环境里没有 `ROCK_CONSOLE_*` 密钥 → 关闭会话 → 退出登录。

---

## 七、故障排查

| 现象 | 排查方向 |
| --- | --- |
| 域名打不开 | 控制台 Public Hostname 是否保存成功；`systemctl status cloudflared`；`curl -sS localhost:4180/api/config` |
| 打开是 502 | 源服务没起来：`journalctl -u rock-console -n 50`，确认端口与 Public Hostname 里的端口一致 |
| 一直要求登录 | 浏览器是否禁用了 Cookie；`ROCK_CONSOLE_SESSION_SECRET` 是否被改动导致旧 Cookie 失效 |
| 登录提示频繁 | 触发了失败限流，等 15 分钟；或重启服务清除计数 |
| 终端连不上 | 并发会话已满（默认 2）；或会话空闲已断开，点「新建会话」重连 |
| 终端里 `env` 看不到某些变量 | 这是有意的密钥隔离，见「安全模型」 |
| 读取服务日志失败 | 服务账号不在 `systemd-journal` 组时，`journalctl` 只能读同一 UID 启动的服务（`cloudflared` 等 root 服务会返回空）。本机已执行 `sudo usermod -aG systemd-journal radxa` 并重启服务；重装系统后需要重做 |

### NPU 占用一直显示 100%？

这是 **RK3588 + 6.1 内核的驱动问题，不是真实负载**：`/sys/class/devfreq/fdab0000.npu/load`
恒报 `100@1000000000Hz`，而真实利用率在 `/sys/kernel/debug/rknpu/load`
（`NPU load: Core0: 0%, Core1: 0%, Core2: 0%`）。debugfs 根目录是 `0700 root`，
服务账号 `radxa` 读不到。

处理方式：仓库自带 `npu-load-export.sh` 与 `rock-console-npu.timer`，由 root
每 2 秒把真实值写到 `/run/rock-console/npu-load`，采集层优先读该文件，面板显示
三核各自的利用率。若定时器未启用，面板会退回 devfreq 值并标注“驱动未上报真实值”。

核对：

```bash
sudo cat /sys/kernel/debug/rknpu/load   # 真实值
cat /run/rock-console/npu-load          # 服务读到的值，应一致
systemctl list-timers rock-console-npu.timer
```

副作用：由于 devfreq 假报 100%，`rknpu_ondemand` 会把 NPU 频率锁在最高 1GHz。
这是驱动行为，应用层无法修正；若只是想省电，可把该节点的 governor 改为
`userspace` 并固定低频，但真正跑 NPU 时需要改回来。

---

## 八、目录结构

```
rock-console/
├── server.mjs               HTTP + WebSocket 服务、路由、安全头
├── metrics-worker.mjs       采集线程（避免同步采集阻塞终端）
├── npu-load-export.sh       root 导出 rknpu debugfs 的真实负载
├── rock-console-npu.timer   每 2 秒触发上面的导出
├── rock-console-npu.service 导出单元（oneshot）
├── auth.mjs                 口令派生、会话票据、CSRF、限流（纯函数、可单测）
├── metrics.mjs              /proc 与 /sys 采集（只读、失败降级为 null）
├── terminal.mjs             PTY 会话管理、环境变量清洗、回放缓冲、空闲回收
├── hash-password.mjs        交互式生成口令派生值与会话密钥
├── e2e-check.mjs            端到端自检
├── vendor-entry.js          xterm.js 打包入口
├── public/                  前端（原生 JS，无框架、无 CDN）
├── rock-console.service     systemd 单元
├── install-rock-console.sh  安装脚本
└── uninstall-rock-console.sh
```
