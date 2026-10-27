#!/usr/bin/env bash
#
# 以 radxa 用户身份安装 rock-console（用户级 systemd，**不需要 sudo**）。
#
# 适用场景：拿不到 root 密码，或者希望先快速跑起来。
#   - 服务以 radxa 身份运行，监听 127.0.0.1:4180；
#   - 借助 loginctl enable-linger，无需登录也会开机自启；
#   - 相比系统级安装少了 ProtectSystem=strict（用户管理器不支持该能力），
#     所以 Web 终端对「radxa 本来就能写的路径」没有额外限制。
#     拿到 sudo 后可改用 install-rock-console.sh 升级为系统级服务。
#
# 口令：交互式输入，不回显、不进 shell 历史。自动化场景可预先设置
#       ROCK_CONSOLE_PASSWORD_HASH / ROCK_CONSOLE_SESSION_SECRET 跳过提示。
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_DIR="$HOME/.config/rock-console"
CONFIG_FILE="$CONFIG_DIR/rock-console.env"
STATE_DIR="$HOME/.local/state/rock-console"
UNIT_DIR="$HOME/.config/systemd/user"
UNIT_NAME=rock-console.service
UNIT_PATH="$UNIT_DIR/$UNIT_NAME"
PORT="${ROCK_CONSOLE_PORT:-4180}"

log()  { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m警告：\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m错误：\033[0m %s\n' "$*" >&2; exit 1; }

export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"

# ---------------------------------------------------------------- 前置检查
[ "$(id -u)" -ne 0 ] || die "本脚本是用户级安装，请以 radxa 身份运行（不要加 sudo）。"
command -v node >/dev/null || die "找不到 node"
[ -f "$APP_DIR/server.mjs" ] || die "在 $APP_DIR 找不到 server.mjs"
systemctl --user show-environment >/dev/null 2>&1 \
  || die "用户级 systemd 不可用（缺少 XDG_RUNTIME_DIR 或未通过 logind 登录）。请用 SSH 登录后再运行。"
[ -d "$APP_DIR/node_modules" ] || die "依赖未安装，请先在 $APP_DIR 执行：npm install"

# ---------------------------------------------------------------- 开机自启
if ! loginctl show-user "$(id -un)" 2>/dev/null | grep -q 'Linger=yes'; then
  log "启用 linger（免登录自启）"
  loginctl enable-linger "$(id -un)" 2>/dev/null \
    || warn "enable-linger 失败；服务只在你有登录会话时运行。"
fi

# ---------------------------------------------------------------- 配置
mkdir -p "$CONFIG_DIR" "$STATE_DIR"
chmod 700 "$CONFIG_DIR" "$STATE_DIR"

if [ -n "${ROCK_CONSOLE_PASSWORD_HASH:-}" ] && [ -n "${ROCK_CONSOLE_SESSION_SECRET:-}" ]; then
  log "使用环境变量提供的口令派生值与会话密钥"
  {
    echo "# rock-console 配置（用户级安装）"
    echo "# 含口令派生值与会话密钥：保持 600，不要复制进 Git 或聊天记录。"
    echo "ROCK_CONSOLE_PASSWORD_HASH=$ROCK_CONSOLE_PASSWORD_HASH"
    echo "ROCK_CONSOLE_SESSION_SECRET=$ROCK_CONSOLE_SESSION_SECRET"
  } > "$CONFIG_FILE"
elif [ -f "$CONFIG_FILE" ]; then
  log "复用已有配置 $CONFIG_FILE"
else
  log "首次安装：设置访问密码（输入不回显，也不会进入 shell 历史）"
  {
    echo "# rock-console 配置（用户级安装）"
    echo "# 含口令派生值与会话密钥：保持 600，不要复制进 Git 或聊天记录。"
    node "$APP_DIR/hash-password.mjs"
  } > "$CONFIG_FILE"
fi

# 补齐缺省项（不覆盖用户已设置的值）
add_default() {
  grep -q "^$1=" "$CONFIG_FILE" || echo "$1=$2" >> "$CONFIG_FILE"
}
add_default ROCK_CONSOLE_PORT "$PORT"
add_default ROCK_CONSOLE_SESSION_HOURS 12
add_default ROCK_CONSOLE_MAX_SESSIONS 2
add_default ROCK_CONSOLE_IDLE_MINUTES 30
add_default ROCK_CONSOLE_ALLOW_WRITE 1
add_default ROCK_CONSOLE_AUDIT_FILE "$STATE_DIR/audit.log"

grep -q '^ROCK_CONSOLE_PASSWORD_HASH=scrypt\$' "$CONFIG_FILE" \
  || { rm -f "$CONFIG_FILE"; die "密码未设置成功，请重新运行。"; }
chmod 600 "$CONFIG_FILE"

PORT="$(grep -E '^ROCK_CONSOLE_PORT=' "$CONFIG_FILE" | tail -1 | cut -d= -f2 | tr -d '[:space:]')"
PORT="${PORT:-4180}"

# ---------------------------------------------------------------- 单元文件
log "安装 $UNIT_PATH"
mkdir -p "$UNIT_DIR"
sed -e "s#__APP_DIR__#$APP_DIR#g" \
    -e "s#__CONFIG_FILE__#$CONFIG_FILE#g" \
    "$APP_DIR/rock-console.user.service" > "$UNIT_PATH"
chmod 644 "$UNIT_PATH"

systemctl --user daemon-reload
systemctl --user enable --now "$UNIT_NAME"

# ---------------------------------------------------------------- 健康检查
log "等待服务就绪"
for _ in $(seq 1 20); do
  curl -fsS --max-time 3 "http://127.0.0.1:$PORT/api/config" >/dev/null 2>&1 && break
  sleep 1
done

if ! curl -fsS --max-time 3 "http://127.0.0.1:$PORT/api/config" >/dev/null 2>&1; then
  warn "健康检查失败，最近日志："
  journalctl --user -u "$UNIT_NAME" -n 30 --no-pager -o cat || true
  die "服务未就绪。"
fi
log "服务已在 127.0.0.1:$PORT 响应"

echo
log "监听确认（应只有 127.0.0.1:$PORT）："
ss -tln | grep ":$PORT" || warn "未在 ss 输出中找到端口 $PORT"

cat <<EOF

用户级安装完成。服务状态：
  systemctl --user status $UNIT_NAME
  journalctl --user -u $UNIT_NAME -f
  systemctl --user restart $UNIT_NAME

还需要在 Cloudflare 控制台把域名指向 http://127.0.0.1:$PORT（见 README）。

拿到 sudo 后可升级为系统级服务（额外获得 ProtectSystem=strict 等加固）：
  sudo bash $APP_DIR/install-rock-console.sh
EOF
