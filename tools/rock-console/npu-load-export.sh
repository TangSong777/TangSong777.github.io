#!/bin/sh
# 以 root 读取 rknpu 的真实三核利用率（debugfs），导出到 radxa 可读位置。
#
# 背景：/sys/class/devfreq/fdab0000.npu/load 在 RK3588 + 6.1 内核上恒报 100%，
# 而 /sys/kernel/debug/rknpu/load 才是真实值（空闲时 0%）。debugfs 根目录是
# 0700 root，rock-console 以 radxa 身份运行、读不到，因此用 root 定时导出。
set -eu

SRC=/sys/kernel/debug/rknpu/load
DIR=/run/rock-console
DST="$DIR/npu-load"

mkdir -p "$DIR"
chmod 755 "$DIR"

[ -r "$SRC" ] || exit 0

tmp="$(mktemp "$DIR/.npu-load.XXXXXX")"
# shellcheck disable=SC2064
trap "rm -f '$tmp'" EXIT INT TERM
cat "$SRC" > "$tmp"
chmod 644 "$tmp"
mv -f "$tmp" "$DST"
trap - EXIT INT TERM
