#!/usr/bin/env node
// Rock 5B+ 温度与系统状态长期采集器。
//
// 连续采样 SoC 各热区温度、风扇档位、CPU 频率、负载、内存与 NVMe(SSD) 温度，
// 以 CSV 逐行追加，便于事后绘制曲线做热分析。
//
// 用法：
//   node thermal-log.mjs                                  # 默认 5 小时，每 60 秒一次
//   node thermal-log.mjs --duration-hours 8 --interval-seconds 30
//   node thermal-log.mjs --once                           # 立刻采一次（验证用）
//   node thermal-log.mjs --out /srv/blog/logs/thermal/a.csv
//
// NVMe 温度按三种途径自动探测，任一可用即可：内核 hwmon(nvme) → nvme-cli → smartctl。
// 都不可用时该列记为空并标注 ssd_source=unavailable；权限放开后无需重启，后续样本自动带上。
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

const THERMAL_ROOT = process.env.THERMAL_ROOT || '/sys/class/thermal';
const HWMON_ROOT = process.env.THERMAL_HWMON_ROOT || '/sys/class/hwmon';
const NVME_DEVICE = process.env.THERMAL_NVME_DEVICE || '/dev/nvme0';
const CPU_PROBES = ['cpu0', 'cpu4', 'cpu6'];

export const ZONE_KEYS = ['soc', 'bigcore0', 'bigcore1', 'littlecore', 'center', 'gpu', 'npu'];

export function columns() {
  return [
    'timestamp', 'iso', 'uptime_s',
    ...ZONE_KEYS.map((name) => `${name}_c`),
    'max_c', 'pwm', 'load1', 'load5', 'load15', 'mem_avail_mb',
    ...CPU_PROBES.map((name) => `${name}_mhz`),
    'ssd_c', 'ssd_source',
  ];
}

function readText(file) {
  try {
    return readFileSync(file, 'utf8').trim();
  } catch {
    return null;
  }
}

function readNumberFile(file) {
  const text = readText(file);
  if (text === null) return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

// 各热区温度（摄氏度），按设备树里的 type 名归到固定列；读不到的域记 null。
export function readZoneTemps(root = THERMAL_ROOT) {
  const zones = Object.fromEntries(ZONE_KEYS.map((name) => [name, null]));
  let entries;
  try {
    entries = readdirSync(root);
  } catch {
    return { zones, max: null };
  }
  for (const entry of entries) {
    if (!/^thermal_zone\d+$/.test(entry)) continue;
    const dir = `${root}/${entry}`;
    const type = readText(`${dir}/type`);
    if (!type) continue;
    const key = type.replace(/-thermal$/, '').toLowerCase();
    if (!(key in zones)) continue;
    const raw = readNumberFile(`${dir}/temp`);
    if (raw === null) continue;
    zones[key] = raw / 1000;
  }
  const values = Object.values(zones).filter((value) => value !== null);
  return { zones, max: values.length ? Math.max(...values) : null };
}

export function readFanPwm(root = HWMON_ROOT) {
  let entries;
  try {
    entries = readdirSync(root);
  } catch {
    return null;
  }
  for (const entry of entries) {
    const dir = `${root}/${entry}`;
    if (readText(`${dir}/name`) !== 'pwmfan') continue;
    return readNumberFile(`${dir}/pwm1`);
  }
  return null;
}

function findExecutable(names) {
  const dirs = (process.env.PATH || '').split(':').filter(Boolean).concat(['/usr/sbin', '/usr/bin', '/sbin', '/bin']);
  for (const name of names) {
    for (const dir of dirs) {
      const candidate = `${dir}/${name}`;
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}

// NVMe 温度：hwmon → nvme-cli → smartctl，全部失败返回 null。
export function readSsdTemp(root = HWMON_ROOT, device = NVME_DEVICE) {
  let entries = [];
  try {
    entries = readdirSync(root);
  } catch {
    entries = [];
  }
  for (const entry of entries) {
    const dir = `${root}/${entry}`;
    const name = readText(`${dir}/name`);
    if (!name || !name.startsWith('nvme')) continue;
    const raw = readNumberFile(`${dir}/temp1_input`);
    if (raw !== null) return { c: raw / 1000, source: 'hwmon' };
  }

  const nvme = findExecutable(['nvme']);
  if (nvme) {
    try {
      const out = execFileSync(nvme, ['smart-log', device, '-o', 'json'], { encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'] });
      const temperature = JSON.parse(out).temperature;
      if (Number.isFinite(temperature)) {
        // NVMe SMART 的 temperature 字段是开尔文。
        return { c: temperature > 200 ? temperature - 273.15 : temperature, source: 'nvme-cli' };
      }
    } catch {
      // 权限不足或设备不存在，换下一种途径。
    }
  }

  const smartctl = findExecutable(['smartctl']);
  if (smartctl) {
    try {
      const out = execFileSync(smartctl, ['-A', '-j', device], { encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'] });
      const current = JSON.parse(out)?.temperature?.current;
      if (Number.isFinite(current)) return { c: current, source: 'smartctl' };
    } catch {
      // 同上。
    }
  }
  return { c: null, source: 'unavailable' };
}

function readCpuMhz(name) {
  const khz = readNumberFile(`/sys/devices/system/cpu/${name}/cpufreq/scaling_cur_freq`);
  return khz === null ? null : Math.round(khz / 1000);
}

function readMemAvailableMb() {
  const text = readText('/proc/meminfo');
  if (!text) return null;
  const match = text.match(/^MemAvailable:\s+(\d+) kB$/m);
  return match ? Math.round(Number(match[1]) / 1024) : null;
}

export function sampleOnce() {
  const { zones, max } = readZoneTemps();
  const ssd = readSsdTemp();
  const loadavg = (readText('/proc/loadavg') || '').split(/\s+/);
  const now = new Date();
  return {
    timestamp: Math.floor(now.getTime() / 1000),
    iso: now.toISOString(),
    uptime_s: Number((readText('/proc/uptime') || '0').split(/\s+/)[0]) || 0,
    ...Object.fromEntries(ZONE_KEYS.map((name) => [`${name}_c`, zones[name]])),
    max_c: max,
    pwm: readFanPwm(),
    load1: Number(loadavg[0]) || 0,
    load5: Number(loadavg[1]) || 0,
    load15: Number(loadavg[2]) || 0,
    mem_avail_mb: readMemAvailableMb(),
    ...Object.fromEntries(CPU_PROBES.map((name) => [`${name}_mhz`, readCpuMhz(name)])),
    ssd_c: ssd.c === null ? null : Math.round(ssd.c * 10) / 10,
    ssd_source: ssd.source,
  };
}

export function toCsvRow(sample) {
  return columns().map((key) => {
    const value = sample[key];
    return value === null || value === undefined ? '' : String(value);
  }).join(',');
}

function parseArgs(list) {
  const args = {
    durationHours: 5,
    intervalSeconds: 60,
    once: false,
    help: false,
    out: `/srv/blog/logs/thermal/thermal-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.csv`,
  };
  for (let index = 0; index < list.length; index += 1) {
    const item = list[index];
    if (item === '--once') args.once = true;
    else if (item === '--help' || item === '-h') args.help = true;
    else if (item === '--duration-hours') args.durationHours = Number(list[++index]);
    else if (item === '--interval-seconds') args.intervalSeconds = Number(list[++index]);
    else if (item === '--out') args.out = list[++index];
    else throw new Error(`未知参数：${item}`);
  }
  if (!(args.durationHours > 0)) throw new Error('--duration-hours 必须大于 0');
  if (!(args.intervalSeconds >= 1)) throw new Error('--interval-seconds 至少为 1');
  if (!args.out) throw new Error('--out 需要一个文件路径');
  return args;
}

function printUsage() {
  console.log(`Rock 5B+ 温度长期采集器

  node thermal-log.mjs [--duration-hours 5] [--interval-seconds 60] [--out 路径] [--once]

  --duration-hours    运行多少小时后自动退出（默认 5）
  --interval-seconds  采样间隔秒数（默认 60）
  --out               CSV 输出路径（默认 /srv/blog/logs/thermal/thermal-<时间>.csv）
  --once              立刻采一次并打印，不写文件`);
}

export function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printUsage();
    return 0;
  }
  if (args.once) {
    const sample = sampleOnce();
    console.log(toCsvRow(sample));
    return 0;
  }

  mkdirSync(dirname(args.out), { recursive: true, mode: 0o755 });
  if (!existsSync(args.out)) appendFileSync(args.out, `${columns().join(',')}\n`);

  const deadline = Date.now() + args.durationHours * 3600 * 1000;
  console.log(`[采集] 开始：每 ${args.intervalSeconds} 秒一行，持续 ${args.durationHours} 小时，输出 ${args.out}`);
  let count = 0;
  let stopped = false;
  let timer = null;

  const finish = (reason) => {
    if (stopped) return;
    stopped = true;
    if (timer) clearTimeout(timer);
    console.log(`[采集] 结束（${reason}）：共写入 ${count} 行，文件 ${args.out}`);
    process.exit(0);
  };

  const tick = () => {
    try {
      const sample = sampleOnce();
      appendFileSync(args.out, `${toCsvRow(sample)}\n`);
      count += 1;
      if (count === 1 || count % 10 === 0) {
        console.log(`[采集] 第 ${count} 行：max=${sample.max_c}°C pwm=${sample.pwm} ssd=${sample.ssd_c ?? 'N/A'}(${sample.ssd_source})`);
      }
    } catch (error) {
      console.error(`[采集] 采样失败：${error.message}`);
    }
    if (Date.now() >= deadline) {
      finish('已到设定时长');
      return;
    }
    timer = setTimeout(tick, args.intervalSeconds * 1000);
  };

  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => finish(`收到 ${signal}`));
  tick();
  return 0;
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) process.exitCode = main();
