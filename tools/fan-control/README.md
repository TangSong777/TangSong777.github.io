# Rock 5B+ 温控风扇（迟滞启停 + 分级调速）

## 为什么需要它

Rock 5B+ 的板载风扇走 `pwm-fan` 驱动，设备树 `cooling-levels` 把档位映射为
`0 → 0`、`1 → 64`、`2 → 128`、`3 → 192`、`4 → 255`。Radxa 镜像默认把它钉在
`pwm1 = 255`（100% 占空比）+ `pwm1_enable = 1`（手动模式），而内核各 thermal zone
的 `policy` 是 `user_space`，系统里也没有任何风扇服务，所以 **风扇会一直全速运转**。

本工具用一个小的用户态守护进程接管调速，行为是：

- 温度 **≥ `ON_TEMP_C`（默认 55°C）才启动**；
- 温度 **≤ `OFF_TEMP_C`（默认 45°C）才停止**（两者之差即迟滞区间，避免频繁启停）；
- 运行中按温度分级调速：`< 60°C → 25%`、`< 66°C → 50%`、`< 73°C → 75%`、更高 → `100%`；
- 只写 `pwm-fan` 的 hwmon 接口，**不改设备树、不改内核参数**，停用服务即可恢复原状。

## 安装

```bash
cd /srv/blog/repo && sudo git pull --ff-only && sudo chown -R radxa:radxa .git
sudo bash tools/fan-control/install-rock5b-fan-control.sh
```

安装脚本会：把 `fan-control.mjs` 装到 `/usr/local/sbin/`、在 `/etc/rock5b-fan-control.conf`
写入默认配置（已存在则不覆盖）、安装并启用 `rock5b-fan-control.service`。

## 常用操作

```bash
# 看服务状态与日志
systemctl status rock5b-fan-control.service
journalctl -u rock5b-fan-control.service -n 30 --no-pager -o cat

# 只决策一次并应用（不改配置文件）
sudo node /usr/local/sbin/rock5b-fan-control.mjs --once
# 只看决策、不写硬件
node /usr/local/sbin/rock5b-fan-control.mjs --once --dry-run

# 改阈值/档位后重启生效
sudo editor /etc/rock5b-fan-control.conf
sudo systemctl restart rock5b-fan-control.service

# 临时全速（例如跑编译压测前）
echo 255 | sudo tee /sys/class/hwmon/hwmon*/pwm1 >/dev/null
# 临时静音（关掉风扇）
echo 0 | sudo tee /sys/class/hwmon/hwmon*/pwm1 >/dev/null

# 停用/卸载
sudo systemctl disable --now rock5b-fan-control.service
sudo rm -f /etc/systemd/system/rock5b-fan-control.service /usr/local/sbin/rock5b-fan-control.mjs
sudo systemctl daemon-reload
```

卸载后如果想恢复出厂时的“全速”状态：

```bash
echo 1 | sudo tee /sys/class/hwmon/hwmon*/pwm1_enable >/dev/null
echo 255 | sudo tee /sys/class/hwmon/hwmon*/pwm1 >/dev/null
```

## 配置说明

`/etc/rock5b-fan-control.conf` 的键：

| 键 | 含义 |
| --- | --- |
| `ON_TEMP_C` | 启动阈值（默认 55） |
| `OFF_TEMP_C` | 停止阈值（默认 45，必须小于 `ON_TEMP_C`） |
| `POLL_SECONDS` | 采样间隔（默认 5） |
| `PWM_LEVELS` | 运行中的分级转速，`温度上限:PWM` 逗号分隔，温度上限严格递增 |

想让风扇更早介入、或更安静，只改这一行即可，例如“60°C 启动、50°C 停止、最多 50% 转速”：

```ini
ON_TEMP_C=60
OFF_TEMP_C=50
PWM_LEVELS=70:64,999:128
```

## 原理与安全边界

- 温度取 `/sys/class/thermal/thermal_zone*/temp` 的**最大值**（soc、大小核、GPU、NPU 等各域）。
- 转速通过 `pwm1` 写入；同时把 `pwm1_enable` 固定为 `1`（手动模式），避免与内核 thermal
  的 cooling device 争抢。
- 写失败时会尝试切到全速保护；读不到温度时保持当前转速不动。
- 服务由 systemd `Restart=always` 守护，进程异常退出后会自动重启并按当前温度重新决策。
- 默认档位下风扇只在 55°C 以上才转；机器空闲（30-35°C）时完全停转，也就没有噪音。

## 验证

```bash
node --test tools/fan-control/fan-control.test.mjs   # 迟滞逻辑与配置解析单元测试
node tools/fan-control/fan-control.mjs --once --dry-run   # 用真实温度打印一次决策
```
