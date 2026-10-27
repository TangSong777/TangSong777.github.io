#!/usr/bin/env bash
#
# 卸载 rock-console 服务。
# 默认只停服务并移除 systemd 单元，保留配置文件与审计日志，便于回滚或重装。
# 加 --purge 时一并删除配置与审计日志。
set -euo pipefail

UNIT_NAME=rock-console.service
UNIT_PATH="/etc/systemd/system/$UNIT_NAME"
CONFIG_FILE=/srv/blog/config/rock-console.env
AUDIT_FILE=/srv/blog/state/rock-console-audit.log

log() { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m错误：\033[0m %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "请用 sudo 运行：sudo bash $0"

if systemctl list-unit-files | grep -q "^$UNIT_NAME"; then
  log "停止并禁用 $UNIT_NAME"
  systemctl disable --now "$UNIT_NAME" || true
fi
if [ -f "$UNIT_PATH" ]; then
  log "移除 $UNIT_PATH"
  rm -f "$UNIT_PATH"
fi

log "停止并移除 rknpu 负载导出定时器"
systemctl disable --now rock-console-npu.timer 2>/dev/null || true
rm -f /etc/systemd/system/rock-console-npu.timer /etc/systemd/system/rock-console-npu.service
systemctl daemon-reload

if [ "${1:-}" = "--purge" ]; then
  log "删除配置与审计日志"
  rm -f "$CONFIG_FILE" "$AUDIT_FILE"
  log "注意：应用目录未被删除，如需彻底清理请手动删除 tools/rock-console。"
else
  log "已保留 $CONFIG_FILE 与 $AUDIT_FILE（加 --purge 可一并删除）"
fi

cat <<'EOF'

提醒：Cloudflare Zero Trust 控制台里 server.yanghanlin.cn 的 Public Hostname
仍然指向本机端口，需要手动删除该路由（删除后不影响 editor.yanghanlin.cn）。
EOF
