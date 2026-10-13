#!/bin/sh
# 安装 Rock 5B+ 温控风扇服务（需要 root）。
set -eu

if [ "$(id -u)" -ne 0 ]; then
  echo "请使用 sudo bash tools/fan-control/install-rock5b-fan-control.sh" >&2
  exit 1
fi

repo=/srv/blog/repo
src="$repo/tools/fan-control"

for file in fan-control.mjs rock5b-fan-control.service rock5b-fan-control.conf.example; do
  test -f "$src/$file" || { echo "缺少 $src/$file" >&2; exit 1; }
done

install -o root -g root -m 0755 "$src/fan-control.mjs" /usr/local/sbin/rock5b-fan-control.mjs

if [ -f /etc/rock5b-fan-control.conf ]; then
  echo "保留已有配置 /etc/rock5b-fan-control.conf（如需重置，先删除该文件）"
else
  install -o root -g root -m 0644 "$src/rock5b-fan-control.conf.example" /etc/rock5b-fan-control.conf
  echo "已写入默认配置 /etc/rock5b-fan-control.conf"
fi
# 配置交给服务运行用户持有，便于日常调阈值；脚本本身仍为 root 只读。
chown radxa:radxa /etc/rock5b-fan-control.conf

install -o root -g root -m 0644 "$src/rock5b-fan-control.service" /etc/systemd/system/rock5b-fan-control.service
systemctl daemon-reload
systemctl enable --now rock5b-fan-control.service
sleep 3

echo
echo "=== 服务状态 ==="
systemctl --no-pager --full status rock5b-fan-control.service | head -25
echo
echo "=== 最近日志 ==="
journalctl -u rock5b-fan-control.service -n 10 --no-pager -o cat
