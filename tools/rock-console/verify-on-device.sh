#!/usr/bin/env bash
#
# rock-console 设备端一键验证。
#
# 完全隔离于正式部署：
#   - 使用临时端口（默认 4199）与临时测试口令，不读取也不修改
#     /srv/blog/config/rock-console.env；
#   - 不安装、不启停任何 systemd 服务；
#   - 结束后自动杀掉临时进程并清理测试期文件。
#
# 依次执行：装依赖 → 打包前端 → 单元测试 → 起临时服务 → 端到端自检。
set -uo pipefail

APP="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${ROCK_CONSOLE_VERIFY_PORT:-4199}"
TEST_PASSWORD='e2e-test-password'
LOG=/tmp/rock-console-verify.log
AUDIT=/tmp/rock-console-verify-audit.log

cd "$APP" || exit 1

echo "=== 1/5 安装依赖 ==="
npm install --no-audit --no-fund 2>&1 | tail -4

echo "=== 2/5 打包前端 ==="
npm run bundle 2>&1 | tail -4
ls -la public/vendor/ 2>&1

echo "=== 3/5 单元测试 ==="
npm test 2>&1 | tail -8
UNIT=${PIPESTATUS[0]}

echo "=== 4/5 启动临时服务（端口 $PORT，仅回环） ==="
export ROCK_CONSOLE_PORT="$PORT"
export ROCK_CONSOLE_PASSWORD_HASH="$(node -e "import('$APP/auth.mjs').then(m=>process.stdout.write(m.hashPassword('$TEST_PASSWORD')))")"
export ROCK_CONSOLE_SESSION_SECRET="$(node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('base64url'))")"
export ROCK_CONSOLE_AUDIT_FILE="$AUDIT"

rm -f "$LOG" "$AUDIT"
node server.mjs --no-open > "$LOG" 2>&1 &
PID=$!
echo "临时进程 pid=$PID"
sleep 3

echo "=== 5/5 端到端自检 ==="
ROCK_CONSOLE_TEST_PASSWORD="$TEST_PASSWORD" ROCK_CONSOLE_PORT="$PORT" node e2e-check.mjs
E2E=$?

echo
echo "=== 端口绑定检查（必须只有 127.0.0.1:$PORT） ==="
ss -tln | grep ":$PORT" || echo "未找到绑定"

kill "$PID" 2>/dev/null
wait "$PID" 2>/dev/null
rm -f "$LOG" "$AUDIT"

echo
echo "单元测试结果码：$UNIT ；端到端结果码：$E2E"
[ "$UNIT" -eq 0 ] && [ "$E2E" -eq 0 ]
