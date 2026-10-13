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
写入默认配置（已存在则不覆盖）、把配置文件的属主交给 `radxa`（方便日常调阈值）、
安装并启用 `rock5b-fan-control.service`。

## 常用操作

```bash
# 看服务状态与日志（服务以 root 运行，看日志需要 sudo）
systemctl status rock5b-fan-control.service
sudo journalctl -u rock5b-fan-control.service -n 30 --no-pager -o cat

# 只决策一次并应用
sudo node /usr/local/sbin/rock5b-fan-control.mjs --once
# 只看决策、不写硬件
node /usr/local/sbin/rock5b-fan-control.mjs --once --dry-run

# 改阈值/档位：保存即生效，无需重启服务（服务会热加载配置）
sudo editor /etc/rock5b-fan-control.conf
# 若配置属于 radxa，也可直接编辑
editor /etc/rock5b-fan-control.conf

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
| `START_PULSE_MS` | 启动脉冲时长（默认 1500，0 表示关闭） |
| `PWM_LEVELS` | 运行中的分级转速，`温度上限:PWM` 逗号分隔，温度上限严格递增 |

改完保存即生效：服务每次采样都会比较配置文件的修改时间/大小，变化时热加载；
若新配置非法，会继续沿用上一份有效配置并记录错误。

**本机实测**：这块板子的风扇在 25% 占空比下**无法启动**（会看起来“没转”，
导致温度反而一路升到 58°C 以上），50% 能正常启动。因此默认档位的最低档设为 128（50%），
并启用启动脉冲：需要散热时先全速转 1.5 秒把扇叶带起来，再落到目标档位。

调整示例——“60°C 启动、50°C 停止、最高 50% 转速”：

```ini
ON_TEMP_C=60
OFF_TEMP_C=50
START_PULSE_MS=1500
PWM_LEVELS=70:96,999:128
```

## 原理与安全边界

- 温度取 `/sys/class/thermal/thermal_zone*/temp` 的**最大值**（soc、大小核、GPU、NPU 等各域）。
- 转速通过 `pwm1` 写入；同时把 `pwm1_enable` 固定为 `1`（手动模式），避免与内核 thermal
  的 cooling device 争抢。
- 启动脉冲只在「从停止转入运行」时使用一次，运行中调速不会重复冲高。
- 写失败时会尝试切到全速保护；读不到温度时保持当前转速不动。
- 服务由 systemd `Restart=always` 守护，进程异常退出后会自动重启并按当前温度重新决策。
- 空闲被动散热平衡点约 52–58°C，因此设为 55°C 启动时，风扇通常会以最低档长期低速运转；
  想更安静就抬高 `ON_TEMP_C`，想更凉就降低它。

## 验证

```bash
node --test tools/fan-control/fan-control.test.mjs   # 迟滞逻辑、启动脉冲与配置解析单元测试
node tools/fan-control/fan-control.mjs --once --dry-run   # 用真实温度打印一次决策
```
