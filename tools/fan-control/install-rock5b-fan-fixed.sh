#!/bin/sh
# 安装 Rock 5B+ 固定占空比风扇服务（oneshot：开机写一次 PWM 后退出，无常驻进程）。
#
# 用法：sudo bash tools/fan-control/install-rock5b-fan-fixed.sh
#
# 会做三件事：
#   1. 安装 /usr/local/sbin/rock5b-fan-fixed 与 rock5b-fan-fixed.service
#   2. 停用旧的常驻温控服务 rock5b-fan-control.service（unit 文件保留，可随时 enable 恢复）
#   3. enable + 立即执行一次，使当前转速立刻变为目标值
set -eu

if [ "$(id -u)" -ne 0 ]; then
  echo "请使用 sudo bash tools/fan-control/install-rock5b-fan-fixed.sh" >&2
  exit 1
fi

repo=/srv/blog/repo
src="$repo/tools/fan-control"

for file in rock5b-fan-fixed.sh rock5b-fan-fixed.service; do
  test -f "$src/$file" || { echo "缺少 $src/$file" >&2; exit 1; }
done

install -o root -g root -m 0755 "$src/rock5b-fan-fixed.sh" /usr/local/sbin/rock5b-fan-fixed
install -o root -g root -m 0644 "$src/rock5b-fan-fixed.service" /etc/systemd/system/rock5b-fan-fixed.service

if [ -f /etc/systemd/system/rock5b-fan-control.service ]; then
  systemctl disable --now rock5b-fan-control.service 2>/dev/null || true
  echo "已停用旧的常驻服务 rock5b-fan-control.service（unit 文件保留，可随时 enable 恢复温控）"
fi

systemctl daemon-reload
systemctl enable rock5b-fan-fixed.service
systemctl restart rock5b-fan-fixed.service
sleep 1

echo
echo "=== 服务状态 ==="
systemctl --no-pager --full status rock5b-fan-fixed.service | head -18
echo
echo "=== 当前 PWM ==="
for dir in /sys/class/hwmon/hwmon*; do
  [ "$(cat "$dir/name" 2>/dev/null || true)" = pwmfan ] && echo "$(basename "$dir") pwm1=$(cat "$dir/pwm1")"
done
