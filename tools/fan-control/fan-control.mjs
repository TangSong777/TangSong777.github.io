#!/usr/bin/env node
// Rock 5B+ 温控风扇守护进程。
//
// 硬件背景：板载风扇走 pwm-fan 驱动（PWM 通道 fd8b0020.pwm），设备树 cooling-levels
// 把档位映射为 0 → 0、1 → 64、2 → 128、3 → 192、4 → 255。Radxa 镜像默认把它钉在
// pwm1=255（100% 占空比）+ pwm1_enable=1（手动模式），而内核 thermal zone 的 policy
// 是 user_space，没有任何程序按温度调速，所以风扇会一直全速运转。
//
// 本守护进程自己做迟滞温控：
//   - 只有温度 ≥ ON_TEMP_C 才启动，只有温度 ≤ OFF_TEMP_C 才停止；
//   - 运行中按温度分级调速（默认 25% / 50% / 75% / 100%）；
//   - 只写 pwm-fan 的 hwmon 接口，不改设备树、不改内核参数，停用服务即恢复原状。
//
// 用法：
//   node fan-control.mjs                       # 常驻守护（systemd 使用）
//   node fan-control.mjs --once                # 只决策一次并应用，然后退出
//   node fan-control.mjs --dry-run             # 只打印决策，不写硬件
//   node fan-control.mjs --config /etc/rock5b-fan-control.conf
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const THERMAL_ROOT = process.env.FAN_THERMAL_ROOT || '/sys/class/thermal';
const HWMON_ROOT = process.env.FAN_HWMON_ROOT || '/sys/class/hwmon';

export const DEFAULT_CONFIG = {
  onTempC: 55,
  offTempC: 45,
  pollSeconds: 5,
  startPulseMs: 1500,
  levels: [
    { belowC: 60, pwm: 64 },
    { belowC: 66, pwm: 128 },
    { belowC: 73, pwm: 192 },
    { belowC: Infinity, pwm: 255 },
  ],
};

function readNumber(value, key) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`${key} 不是有效数字：${value}`);
  return number;
}

export function parseLevels(value) {
  const levels = [];
  for (const item of String(value).split(',')) {
    const trimmed = item.trim();
    if (!trimmed) continue;
    const [below, pwm] = trimmed.split(':').map((part) => part.trim());
    const belowC = Number(below);
    const pwmValue = Number(pwm);
    if (!Number.isFinite(belowC) || !Number.isFinite(pwmValue)) throw new Error(`PWM_LEVELS 片段无效：${trimmed}`);
    if (!Number.isInteger(pwmValue) || pwmValue < 0 || pwmValue > 255) throw new Error(`PWM 必须是 0-255 的整数：${trimmed}`);
    if (levels.length && belowC <= levels[levels.length - 1].belowC) throw new Error('PWM_LEVELS 的温度上限必须严格递增');
    levels.push({ belowC, pwm: pwmValue });
  }
  if (!levels.length) throw new Error('PWM_LEVELS 不能为空');
  return levels;
}

export function parseConfig(text, base = DEFAULT_CONFIG) {
  const config = { ...base, levels: base.levels.map((level) => ({ ...level })) };
  for (const line of String(text).split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator < 0) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    if (key === 'ON_TEMP_C') config.onTempC = readNumber(value, 'ON_TEMP_C');
    else if (key === 'OFF_TEMP_C') config.offTempC = readNumber(value, 'OFF_TEMP_C');
    else if (key === 'POLL_SECONDS') config.pollSeconds = readNumber(value, 'POLL_SECONDS');
    else if (key === 'START_PULSE_MS') config.startPulseMs = readNumber(value, 'START_PULSE_MS');
    else if (key === 'PWM_LEVELS') config.levels = parseLevels(value);
  }
  if (!(config.offTempC < config.onTempC)) throw new Error('OFF_TEMP_C 必须小于 ON_TEMP_C，否则迟滞区间不成立');
  if (!(config.pollSeconds >= 1)) throw new Error('POLL_SECONDS 至少为 1 秒');
  if (!(config.startPulseMs >= 0 && config.startPulseMs <= 10000)) throw new Error('START_PULSE_MS 必须在 0-10000 毫秒之间');
  return config;
}

// 运行中的转速档位：取第一个「温度上限大于当前温度」的档位。
export function levelPwm(tempC, config) {
  for (const level of config.levels) if (tempC < level.belowC) return level.pwm;
  return config.levels[config.levels.length - 1].pwm;
}

// 迟滞决策：停止状态下只有达到 ON_TEMP_C 才启动；运行状态下只有降到 OFF_TEMP_C
// 才停止，中间区间维持运行并只调整档位，避免温度在阈值附近来回抖动。
export function decidePwm({ tempC, running, config }) {
  if (running) {
    if (tempC <= config.offTempC) return { pwm: 0, running: false };
    return { pwm: levelPwm(tempC, config), running: true };
  }
  if (tempC >= config.onTempC) return { pwm: levelPwm(tempC, config), running: true };
  return { pwm: 0, running: false };
}

// 需要散热时，若目标档位低于全速，先给一个全速脉冲把扇叶带起来，再落到目标档位。
// 低占空比常常无法让静止的风扇启动（实测这块板子的风扇 25% 就带不动），脉冲能显著
// 降低可用的最低维持档位，从而更安静。
export function planActions({ started, decision, config }) {
  const actions = [];
  if (started && decision.pwm > 0 && decision.pwm < 255 && config.startPulseMs > 0) {
    actions.push({ pwm: 255, delayMs: config.startPulseMs });
  }
  actions.push({ pwm: decision.pwm, delayMs: 0 });
  return actions;
}

// 配置文件被改写后无需重启服务：比较修改时间与大小即可判断是否需要重新加载。
export function configChanged(previous, current) {
  if (previous === null || current === null) return false;
  return previous.mtimeMs !== current.mtimeMs || previous.size !== current.size;
}

export function readMaxTempC(root = THERMAL_ROOT) {
  let names;
  try {
    names = readdirSync(root);
  } catch {
    return null;
  }
  let max = null;
  for (const name of names) {
    if (!/^thermal_zone\d+$/.test(name)) continue;
    try {
      const value = Number(readFileSync(`${root}/${name}/temp`, 'utf8').trim());
      if (Number.isFinite(value)) max = max === null ? value / 1000 : Math.max(max, value / 1000);
    } catch {
      // 个别热区可能不可读，忽略即可。
    }
  }
  return max;
}

export function findPwmFan(root = HWMON_ROOT) {
  let names;
  try {
    names = readdirSync(root);
  } catch {
    return null;
  }
  for (const name of names) {
    const dir = `${root}/${name}`;
    try {
      if (readFileSync(`${dir}/name`, 'utf8').trim() !== 'pwmfan') continue;
    } catch {
      continue;
    }
    if (!existsSync(`${dir}/pwm1`) || !existsSync(`${dir}/pwm1_enable`)) return null;
    return dir;
  }
  return null;
}

function statOf(file) {
  try {
    const item = statSync(file);
    return { mtimeMs: item.mtimeMs, size: item.size };
  } catch {
    return null;
  }
}

export function describeLevels(config) {
  return config.levels.map((level) => `${level.belowC === Infinity ? '更高' : level.belowC}→${level.pwm}`).join(' ');
}

function sleepMs(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function parseArgs(list) {
  const args = { once: false, dryRun: false, help: false, config: process.env.FAN_CONTROL_CONFIG || '/etc/rock5b-fan-control.conf' };
  for (let index = 0; index < list.length; index += 1) {
    const item = list[index];
    if (item === '--once') args.once = true;
    else if (item === '--dry-run') args.dryRun = true;
    else if (item === '--help' || item === '-h') args.help = true;
    else if (item === '--config') {
      if (!list[index + 1]) throw new Error('--config 需要一个配置文件路径');
      args.config = list[index + 1];
      index += 1;
    } else throw new Error(`未知参数：${item}`);
  }
  return args;
}

function loadConfig(file) {
  if (!existsSync(file)) return { ...DEFAULT_CONFIG, levels: DEFAULT_CONFIG.levels.map((level) => ({ ...level })) };
  return parseConfig(readFileSync(file, 'utf8'));
}

function printUsage() {
  console.log(`Rock 5B+ 温控风扇守护

  node fan-control.mjs [--config 路径] [--once] [--dry-run]

  --once      只决策一次并应用，然后退出（便于验证）
  --dry-run   只打印决策，不写 sysfs
  --config    配置文件路径，默认 ${process.env.FAN_CONTROL_CONFIG || '/etc/rock5b-fan-control.conf'}`);
}

export function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printUsage();
    return 0;
  }
  let config = loadConfig(args.config);
  let configStat = statOf(args.config);
  const pwmDir = findPwmFan();
  if (!pwmDir) {
    console.error('[风扇] 未找到 pwmfan 的 hwmon 设备，风扇不可控；请确认 pwm_fan 模块已加载。');
    return 1;
  }
  const pwmPath = `${pwmDir}/pwm1`;
  const enablePath = `${pwmDir}/pwm1_enable`;
  let running = false;
  let lastPwm = null;

  const writeIfChanged = (path, value) => {
    const current = existsSync(path) ? readFileSync(path, 'utf8').trim() : null;
    if (current === String(value)) return;
    writeFileSync(path, String(value));
  };

  const apply = (pwm, tempC, reason) => {
    try {
      if (!args.dryRun) {
        writeIfChanged(enablePath, 1);
        writeIfChanged(pwmPath, pwm);
      }
      lastPwm = pwm;
      console.log(`[风扇] 温度 ${tempC.toFixed(1)}°C → PWM ${pwm}（${Math.round((pwm / 255) * 100)}%）${reason}`);
    } catch (error) {
      console.error(`[风扇] 写入 ${pwmPath} 失败：${error.message}；尝试切到全速保护`);
      try {
        writeFileSync(pwmPath, '255');
      } catch {
        // 保持现状，等待下一次重试。
      }
    }
  };

  const reloadIfChanged = () => {
    const current = statOf(args.config);
    if (!configChanged(configStat, current)) return;
    try {
      config = loadConfig(args.config);
      console.log(`[风扇] 配置已热加载：启动 ${config.onTempC}°C，停止 ${config.offTempC}°C，轮询 ${config.pollSeconds}s，档位 ${describeLevels(config)}，启动脉冲 ${config.startPulseMs}ms`);
    } catch (error) {
      console.error(`[风扇] 配置热加载失败，继续沿用上一份有效配置：${error.message}`);
    }
    configStat = current;
  };

  const tick = () => {
    reloadIfChanged();
    const tempC = readMaxTempC();
    if (tempC === null) {
      console.error('[风扇] 读不到任何 thermal zone 温度，保持当前转速');
      return;
    }
    const wasRunning = running;
    const decision = decidePwm({ tempC, running, config });
    running = decision.running;
    const started = decision.running && !wasRunning;
    const reason = started ? '(启动)' : (wasRunning && !decision.running ? '(停止)' : '');
    if (decision.pwm === lastPwm && !started) return;
    for (const action of planActions({ started, decision, config })) {
      if (action.delayMs > 0) sleepMs(action.delayMs);
      apply(action.pwm, tempC, reason);
    }
  };

  console.log(`[风扇] 启动：启动阈值 ${config.onTempC}°C，停止阈值 ${config.offTempC}°C，轮询 ${config.pollSeconds}s，档位 ${describeLevels(config)}，启动脉冲 ${config.startPulseMs}ms`);
  let timer = null;
  let stopped = false;
  const schedule = () => {
    if (stopped) return;
    timer = setTimeout(() => {
      tick();
      schedule();
    }, config.pollSeconds * 1000);
  };
  tick();
  if (args.once) return 0;
  schedule();

  for (const signal of ['SIGTERM', 'SIGINT']) {
    process.on(signal, () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      console.log(`[风扇] 收到 ${signal}，退出（保持当前转速 PWM=${lastPwm}）`);
      process.exit(0);
    });
  }
  return 0;
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) process.exitCode = main();
