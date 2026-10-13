# Rock 5B+ 温度长期采集

用于连续记录 SoC 各热区温度、风扇档位、CPU 频率、负载、内存与 NVMe(SSD) 温度，
输出 CSV，便于事后绘制曲线做热分析。

## 运行

以普通用户（radxa）即可，SoC 温度、风扇档位、频率、负载、内存都能读：

```bash
mkdir -p /srv/blog/logs/thermal
cd /srv/blog/repo
nohup node tools/thermal-log/thermal-log.mjs --duration-hours 5 --interval-seconds 60 \
  > /srv/blog/logs/thermal/runner.log 2>&1 &
echo $! > /srv/blog/logs/thermal/runner.pid
```

- 参数：`--duration-hours`（默认 5）、`--interval-seconds`（默认 60）、`--out`（默认
  `/srv/blog/logs/thermal/thermal-<时间>.csv`）、`--once`（立刻采一行并打印，验证用）。
- 到时自动退出；也可随时停止：`kill $(cat /srv/blog/logs/thermal/runner.pid)`。

验证是否在写入：

```bash
tail -3 /srv/blog/logs/thermal/thermal-*.csv
wc -l /srv/blog/logs/thermal/thermal-*.csv
```

## SSD（NVMe）温度

本机内核**没有编译 `nvme-hwmon`**（`modules.builtin` 里只有 `nvme-core.ko`、`nvme.ko`），
所以 `/sys/class/hwmon` 里没有 SSD 温度；同时未安装 `nvme-cli`/`smartmontools`，
且 `/dev/nvme0` 是 `600 root:root`（radxa 不在 `disk` 组）。因此默认采集到的
`ssd_c` 为空、`ssd_source=unavailable`。

脚本会在每次采样时重新探测，**放开权限后无需重启采集器**，后续样本自动带上 SSD 温度。
一次性放开（需要 sudo）：

```bash
sudo apt-get update && sudo apt-get install -y nvme-cli
sudo setfacl -m u:radxa:r /dev/nvme0          # 立即生效
# 可选：重启后依然生效
sudo tee /etc/udev/rules.d/99-nvme-radxa-read.rules >/dev/null <<'EOF'
ACTION=="add", KERNEL=="nvme0", SUBSYSTEM=="nvme", RUN+="/usr/bin/setfacl -m u:radxa:r /dev/nvme0"
EOF
```

注意：`/dev/nvme0` 是 NVMe 管理设备，给它读权限意味着持有者可执行 NVMe 管理类命令。
只想偶尔看温度而不放开权限时，直接用 `sudo nvme smart-log /dev/nvme0 | grep -i temperature`。

## CSV 列

| 列 | 含义 |
| --- | --- |
| `timestamp` / `iso` | Unix 秒 / ISO8601 时间 |
| `uptime_s` | 系统运行秒数 |
| `soc_c` … `npu_c` | 7 个热区温度（°C） |
| `max_c` | 上述最大值，风扇脚本用它决策 |
| `pwm` | 风扇 PWM（0=停，128=50%，255=100%） |
| `load1/5/15` | 系统负载 |
| `mem_avail_mb` | 可用内存（MB） |
| `cpu0_mhz` / `cpu4_mhz` / `cpu6_mhz` | 三个 cpufreq 域当前频率（A55 / A76×2 / A76×2） |
| `ssd_c` | NVMe 温度（读不到时为空） |
| `ssd_source` | `hwmon` / `nvme-cli` / `smartctl` / `unavailable` |

## 绘图与分析

```bash
python plot-thermal.py thermal-YYYY-MM-DD.csv [输出.xlsx]
```

生成 xlsx：`data` 表（数值化的原始数据 + 4 张折线图：各域温度、风扇与负载、CPU 频率、
SSD 温度）与 `report` 表（各域 min/平均/max、`max_c` 超过 55/60/65/70/75/80/85 °C 的
样本占比、风扇运行占比与平均档位、SSD 温度区间、内存与负载区间）。

判断标准参考：长期 ≤ 75 °C 属良好，理想 ≤ 65 °C；内核 critical 保护在 115 °C。
