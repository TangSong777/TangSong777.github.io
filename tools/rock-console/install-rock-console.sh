#!/usr/bin/env bash
#
# 在 Rock 5B+ 上安装并启用 rock-console（状态面板 + Web 终端）。
#
# 行为：
#   1. 校验 Node 版本与运行用户；
#   2. 首次安装时交互式设置访问密码，写入 /srv/blog/config/rock-console.env（600）；
#   3. 安装依赖、打包前端资源；
#   4. 安装并启用 rock-console.service（仅监听 127.0.0.1）；
#   5. 做一次本地健康检查。
#
# 本脚本不会改动 Cloudflare Tunnel、DNS 或防火墙；
# 公网域名需要在 Cloudflare Zero Trust 控制台单独添加（见 README）。
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_DIR=/srv/blog/config
CONFIG_FILE="$CONFIG_DIR/rock-console.env"
UNIT_NAME=rock-console.service
UNIT_PATH="/etc/systemd/system/$UNIT_NAME"
RUN_USER=radxa
PORT="${ROCK_CONSOLE_PORT:-4180}"

log()  { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m警告：\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m错误：\033[0m %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "请用 sudo 运行：sudo bash $0"
[ -f "$APP_DIR/server.mjs" ] || die "在 $APP_DIR 找不到 server.mjs"

# ---------------------------------------------------------------- 1. 前置检查
command -v node >/dev/null || die "找不到 node"
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 20 ] || die "需要 Node 20.19 或更高版本，当前为 $(node -v)"
id "$RUN_USER" >/dev/null 2>&1 || die "运行用户 $RUN_USER 不存在"

# ---------------------------------------------------------------- 2. 配置文件
if [ ! -f "$CONFIG_FILE" ]; then
  log "首次安装：生成 $CONFIG_FILE"
  mkdir -p "$CONFIG_DIR"
  chmod 700 "$CONFIG_DIR"
  log "接下来请设置访问密码（输入不会回显，也不会进入 shell 历史）"
  {
    echo "# rock-console 配置"
    echo "# 本文件含口令派生值与会话密钥：保持 600 权限，不要复制进 Git 仓库或聊天记录。"
    echo "# 修改端口/会话数后执行： sudo systemctl restart $UNIT_NAME"
    node "$APP_DIR/hash-password.mjs"
    echo "ROCK_CONSOLE_PORT=$PORT"
    echo "ROCK_CONSOLE_SESSION_HOURS=12"
    echo "ROCK_CONSOLE_MAX_SESSIONS=2"
    echo "ROCK_CONSOLE_IDLE_MINUTES=30"
    echo "ROCK_CONSOLE_ALLOW_WRITE=1"
    echo "ROCK_CONSOLE_AUDIT_FILE=/srv/blog/state/rock-console-audit.log"
  } > "$CONFIG_FILE"
  grep -q '^ROCK_CONSOLE_PASSWORD_HASH=scrypt\$' "$CONFIG_FILE" \
    || { rm -f "$CONFIG_FILE"; die "密码未设置成功，请重新运行本脚本。"; }
  chown "$RUN_USER:$RUN_USER" "$CONFIG_FILE"
  chmod 600 "$CONFIG_FILE"
  log "已写入 $CONFIG_FILE（权限 600）"
else
  log "复用已有配置 $CONFIG_FILE"
fi

# 补齐缺省项（不覆盖用户已设置的值）。
# 只含口令两行的最小配置也必须能直接启动：server.mjs 有内置默认值，
# 这里同步写回文件，便于日后按 README 直接改。
add_default() {
  grep -q "^$1=" "$CONFIG_FILE" || echo "$1=$2" >> "$CONFIG_FILE"
}
add_default ROCK_CONSOLE_PORT "$PORT"
add_default ROCK_CONSOLE_SESSION_HOURS 12
add_default ROCK_CONSOLE_MAX_SESSIONS 2
add_default ROCK_CONSOLE_IDLE_MINUTES 30
add_default ROCK_CONSOLE_ALLOW_WRITE 1
add_default ROCK_CONSOLE_AUDIT_FILE /srv/blog/state/rock-console-audit.log
chmod 600 "$CONFIG_FILE"

# 以配置文件中的端口为准，避免两处不一致。
# 注意：pipefail 下 grep 未命中会返回 1，必须容错，否则 set -e 直接退出。
PORT_LINE="$(grep -E '^ROCK_CONSOLE_PORT=' "$CONFIG_FILE" | tail -1 || true)"
PORT="$(printf '%s' "$PORT_LINE" | cut -d= -f2 | tr -d '[:space:]')"
PORT="${PORT:-4180}"

# ---------------------------------------------------------------- 3. 依赖与前端
log "安装依赖（含打包工具）"
( cd "$APP_DIR" && npm install --no-audit --no-fund >/dev/null )
log "打包前端资源"
( cd "$APP_DIR" && npm run bundle >/dev/null )
log "清理开发依赖"
( cd "$APP_DIR" && npm prune --omit=dev >/dev/null )
chown -R "$RUN_USER:$RUN_USER" "$APP_DIR"

# 规范化权限：从 Windows 经 scp 传输可能带来 0707 之类的目录权限
find "$APP_DIR" -maxdepth 1 -type d -exec chmod 755 {} +
find "$APP_DIR/public" -type d -exec chmod 755 {} +
find "$APP_DIR" -maxdepth 1 -type f \( -name '*.mjs' -o -name '*.json' -o -name '*.md' -o -name '*.service' \) -exec chmod 644 {} +
find "$APP_DIR/public" -type f -exec chmod 644 {} +
chmod 755 "$APP_DIR"/*.sh

# ---------------------------------------------------------------- 4. systemd
log "安装 $UNIT_PATH"
sed -e "s#/srv/blog/repo/tools/rock-console#$APP_DIR#g" \
    -e "s#/srv/blog/config/rock-console.env#$CONFIG_FILE#g" \
    "$APP_DIR/$UNIT_NAME" > "$UNIT_PATH"
chmod 644 "$UNIT_PATH"

# rknpu 的 devfreq load 在 RK3588 上恒报 100%，真实值只在 debugfs，
# 而 debugfs 是 0700 root。用 root 定时导出成 radxa 可读的文件。
log "安装 rknpu 负载导出定时器"
chmod 755 "$APP_DIR/npu-load-export.sh"
sed -e "s#/srv/blog/repo/tools/rock-console#$APP_DIR#g" \
    "$APP_DIR/rock-console-npu.service" > /etc/systemd/system/rock-console-npu.service
sed -e "s#/srv/blog/repo/tools/rock-console#$APP_DIR#g" \
    "$APP_DIR/rock-console-npu.timer" > /etc/systemd/system/rock-console-npu.timer
chmod 644 /etc/systemd/system/rock-console-npu.service /etc/systemd/system/rock-console-npu.timer

systemctl daemon-reload
systemctl enable --now "$UNIT_NAME" >/dev/null
systemctl enable --now rock-console-npu.timer >/dev/null

# ---------------------------------------------------------------- 5. 健康检查
log "等待服务就绪"
for _ in $(seq 1 20); do
  if curl -fsS --max-time 3 "http://127.0.0.1:$PORT/api/config" >/dev/null 2>&1; then
    log "服务已在 127.0.0.1:$PORT 响应"
    break
  fi
  sleep 1
done

if ! curl -fsS --max-time 3 "http://127.0.0.1:$PORT/api/config" >/dev/null 2>&1; then
  warn "健康检查失败，最近日志："
  journalctl -u "$UNIT_NAME" -n 30 --no-pager -o cat || true
  die "服务未就绪，请检查上面的日志。"
fi

# ---------------------------------------------------------------- 收尾
echo
log "本机监听确认（应只出现 127.0.0.1:$PORT，不应出现 0.0.0.0）："
ss -tlnp 2>/dev/null | grep -E ":$PORT\b" || warn "未在 ss 输出中找到端口 $PORT"

cat <<EOF

安装完成。下一步：
  1. 在 Cloudflare Zero Trust 控制台把 server.yanghanlin.cn 指向 http://127.0.0.1:$PORT
     （现有隧道 cloudflared 是控制台托管型，本地没有 config.yml，路由只能在控制台添加）。
  2. 浏览器打开 https://server.yanghanlin.cn，用刚设置的密码登录。

常用命令：
  systemctl status $UNIT_NAME
  journalctl -u $UNIT_NAME -f
  sudo systemctl restart $UNIT_NAME
  sudo bash $APP_DIR/uninstall-rock-console.sh
EOF
