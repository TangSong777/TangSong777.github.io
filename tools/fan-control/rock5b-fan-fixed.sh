#!/bin/sh
# 把 Rock 5B+ 的 pwm-fan 固定在指定占空比，写完即退出（配合 oneshot 服务使用）。
#
# 用法：rock5b-fan-fixed [PWM] [脉冲秒数]
#   PWM        0-255，默认 160（约 63%）
#   脉冲秒数   从静止起转时先全速运转的时间，默认 1.5 秒；0 表示不用脉冲
#
# 说明：本机 Radxa Heatsink 4012 是 2-Pin 5V 风扇，靠 PWM 斩波供电调速。实测 128（50%）
# 冷启动不可靠（即便先给全速脉冲，落到 128 后也维持不住），160（63%）可稳定启动并维持，
# 因此默认 160。
set -eu

HWMON_ROOT=${FAN_HWMON_ROOT:-/sys/class/hwmon}
PWM=${1:-160}
PULSE_SECONDS=${2:-1.5}

if [ "$PWM" = "" ] || [ "$PWM" -gt 255 ] 2>/dev/null; then
  echo "PWM 必须是 0-255 的整数：$PWM" >&2
  exit 2
fi

for dir in "$HWMON_ROOT"/hwmon*; do
  [ -d "$dir" ] || continue
  [ "$(cat "$dir/name" 2>/dev/null || true)" = "pwmfan" ] || continue
  if [ ! -w "$dir/pwm1" ]; then
    echo "没有写入 $dir/pwm1 的权限（需要 root）" >&2
    exit 3
  fi
  echo 1 > "$dir/pwm1_enable"
  if [ "$PWM" -lt 255 ] && [ "$PULSE_SECONDS" != "0" ]; then
    echo 255 > "$dir/pwm1"
    sleep "$PULSE_SECONDS"
  fi
  echo "$PWM" > "$dir/pwm1"
  echo "已把 $(basename "$dir") 固定在 pwm1=$PWM（约 $(( PWM * 100 / 255 ))%）"
  exit 0
done

echo "未找到 pwmfan 的 hwmon 设备；请确认 pwm_fan 模块已加载" >&2
exit 1
