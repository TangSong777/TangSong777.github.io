#!/bin/sh
set -eu

if [ "$(id -u)" -ne 0 ]; then
  echo "请使用 sudo bash tools/install-article-studio-rock.sh" >&2
  exit 1
fi

repo=/srv/blog/repo
config=/srv/blog/config/article-studio.env
unit_source="$repo/tools/systemd/article-studio.service"
unit_target=/etc/systemd/system/article-studio.service

test -f "$unit_source" || { echo "缺少 $unit_source" >&2; exit 1; }
test -f "$config" || { echo "缺少 $config，请先创建工作台环境配置" >&2; exit 1; }

chown radxa:radxa "$config"
chmod 600 "$config"
install -o root -g root -m 0644 "$unit_source" "$unit_target"
systemctl daemon-reload
systemctl enable --now article-studio.service
systemctl --no-pager --full status article-studio.service

echo
echo "工作台服务已启用。正式公网开放前仍需配置 Cloudflare Tunnel 与 Access。"

