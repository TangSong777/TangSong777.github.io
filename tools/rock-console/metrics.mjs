/**
 * rock-console 状态采集模块。
 *
 * 设计约束：
 *   - 只读 /proc、/sys 与只读命令，绝不写入硬件或系统状态；
 *   - 任何单个数据源读取失败都降级为 null，不影响整份快照；
 *   - 需要差分的量（CPU 占用、网络速率）由采集器缓存上一次采样，
 *     纯计算部分抽成可单测的独立函数。
 */
import { existsSync, readFileSync, readdirSync, statSync, statfsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const readText = (path) => {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
};

const readNumber = (path) => {
  const text = readText(path);
  if (text === null) return null;
  const value = Number.parseFloat(text.trim());
  return Number.isFinite(value) ? value : null;
};

const listDirs = (path) => {
  try {
    return readdirSync(path, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
      .map((entry) => entry.name)
      .sort();
  } catch {
    return [];
  }
};

const round = (value, digits = 2) => (Number.isFinite(value) ? Number(value.toFixed(digits)) : null);

/* ------------------------------------------------------------------ CPU */

/** 解析 /proc/stat 的 cpu 行，返回 jiffies 计数（不含 guest 细分）。 */
export function parseProcStat(text) {
  const result = { total: null, perCore: [] };
  for (const line of String(text || '').split('\n')) {
    const match = /^cpu(\d*)\s+(.*)$/.exec(line.trim());
    if (!match) continue;
    const fields = match[2].trim().split(/\s+/).map(Number);
    if (fields.length < 4 || fields.some((value) => !Number.isFinite(value))) continue;
    const [user, nice, system, idle, iowait = 0, irq = 0, softirq = 0, steal = 0] = fields;
    const total = user + nice + system + idle + iowait + irq + softirq + steal;
    const busy = total - idle - iowait;
    const sample = { total, busy, idle, iowait, user, system, nice, irq, softirq, steal };
    if (match[1] === '') result.total = sample;
    else result.perCore[Number(match[1])] = sample;
  }
  return result;
}

/** 由两次 /proc/stat 采样求占用率（百分比，0-100）。 */
export function computeCpuUsage(previous, current) {
  const usage = (a, b) => {
    if (!a || !b) return null;
    const totalDelta = b.total - a.total;
    const busyDelta = b.busy - a.busy;
    if (totalDelta <= 0) return null;
    return round(Math.min(100, Math.max(0, (busyDelta / totalDelta) * 100)), 1);
  };
  const cores = [];
  const length = Math.max(previous?.perCore?.length || 0, current?.perCore?.length || 0);
  for (let index = 0; index < length; index += 1) {
    cores.push(usage(previous?.perCore?.[index], current?.perCore?.[index]));
  }
  return { total: usage(previous?.total, current?.total), cores };
}

export function readProcStat(procRoot = '/proc') {
  const text = readText(`${procRoot}/stat`);
  return text === null ? null : parseProcStat(text);
}

/** RK3588 三簇：policy0 小核、policy4/policy6 大核。 */
export function readCpuFreq(cpuRoot = '/sys/devices/system/cpu') {
  const policies = [];
  for (const name of listDirs(`${cpuRoot}/cpufreq`)) {
    if (!/^policy\d+$/.test(name)) continue;
    const base = `${cpuRoot}/cpufreq/${name}`;
    policies.push({
      policy: name,
      governor: readText(`${base}/scaling_governor`)?.trim() || null,
      currentKhz: readNumber(`${base}/scaling_cur_freq`) ?? readNumber(`${base}/cpuinfo_cur_freq`),
      minKhz: readNumber(`${base}/scaling_min_freq`),
      maxKhz: readNumber(`${base}/scaling_max_freq`),
      relatedCpus: readText(`${base}/affected_cpus`)?.trim() || null,
    });
  }
  const cores = [];
  for (const name of listDirs(cpuRoot)) {
    if (!/^cpu\d+$/.test(name)) continue;
    cores.push({
      cpu: Number(name.slice(3)),
      currentKhz: readNumber(`${cpuRoot}/${name}/cpufreq/scaling_cur_freq`),
    });
  }
  cores.sort((a, b) => a.cpu - b.cpu);
  return { policies, cores };
}

/* -------------------------------------------------------------- 内存/负载 */

export function parseMemInfo(text) {
  const values = {};
  for (const line of String(text || '').split('\n')) {
    const match = /^(\w+(?:\(\w+\))?):\s+(\d+)(?:\s+kB)?\s*$/.exec(line.trim());
    if (match) values[match[1]] = Number(match[2]);
  }
  const kb = (key) => (Number.isFinite(values[key]) ? values[key] : null);
  const totalKb = kb('MemTotal');
  const availableKb = kb('MemAvailable');
  return {
    totalBytes: totalKb === null ? null : totalKb * 1024,
    availableBytes: availableKb === null ? null : availableKb * 1024,
    freeBytes: kb('MemFree') === null ? null : kb('MemFree') * 1024,
    cachedBytes: kb('Cached') === null ? null : kb('Cached') * 1024,
    buffersBytes: kb('Buffers') === null ? null : kb('Buffers') * 1024,
    swapTotalBytes: kb('SwapTotal') === null ? null : kb('SwapTotal') * 1024,
    swapFreeBytes: kb('SwapFree') === null ? null : kb('SwapFree') * 1024,
    usedPercent: totalKb && availableKb !== null
      ? round(((totalKb - availableKb) / totalKb) * 100, 1)
      : null,
  };
}

export function readMemInfo(procRoot = '/proc') {
  const text = readText(`${procRoot}/meminfo`);
  return text === null ? null : parseMemInfo(text);
}

export function readLoadAvg(procRoot = '/proc') {
  const text = readText(`${procRoot}/loadavg`);
  if (text === null) return null;
  const [one, five, fifteen, entities] = String(text).trim().split(/\s+/);
  const [running, total] = String(entities || '').split('/');
  return {
    one: Number(one) || 0,
    five: Number(five) || 0,
    fifteen: Number(fifteen) || 0,
    running: Number(running) || 0,
    processes: Number(total) || 0,
  };
}

/** 读取系统启动时刻（Unix 秒），用于「上次重启」展示。 */
export function readBootTime(procRoot = '/proc') {
  const text = readText(`${procRoot}/stat`);
  if (!text) return null;
  const matched = text.match(/^btime\s+(\d+)$/m);
  return matched ? Number(matched[1]) : null;
}

export function readUptime(procRoot = '/proc') {
  const text = readText(`${procRoot}/uptime`);
  if (text === null) return null;
  const seconds = Number.parseFloat(String(text).trim().split(/\s+/)[0]);
  return Number.isFinite(seconds) ? { seconds: round(seconds, 1) } : null;
}

/* ------------------------------------------------------------------ 温度 */

/** 读取全部 thermal zone；temp 文件是毫摄氏度。 */
export function readThermalZones(thermalRoot = '/sys/class/thermal') {
  const zones = [];
  for (const name of listDirs(thermalRoot)) {
    if (!/^thermal_zone\d+$/.test(name)) continue;
    const base = `${thermalRoot}/${name}`;
    const milli = readNumber(`${base}/temp`);
    zones.push({
      zone: name,
      type: readText(`${base}/type`)?.trim() || name,
      celsius: milli === null || Math.abs(milli) > 200000 ? null : round(milli / 1000, 2),
      policy: readText(`${base}/policy`)?.trim() || null,
    });
  }
  const readings = zones.map((zone) => zone.celsius).filter((value) => value !== null);
  return {
    zones,
    maxCelsius: readings.length ? round(Math.max(...readings), 2) : null,
  };
}

/** hwmon 通道：风扇 PWM、USB-C PD 供电等。 */
export function readHwmon(hwmonRoot = '/sys/class/hwmon') {
  const chips = [];
  for (const name of listDirs(hwmonRoot)) {
    if (!/^hwmon\d+$/.test(name)) continue;
    const base = `${hwmonRoot}/${name}`;
    const chip = { hwmon: name, name: readText(`${base}/name`)?.trim() || name };
    for (const channel of listDirs(base)) {
      if (channel.startsWith('.')) continue;
      const value = readNumber(`${base}/${channel}`);
      if (value !== null) chip[channel] = value;
    }
    for (const file of ['pwm1', 'pwm1_enable', 'fan1_input', 'temp1_input', 'voltage_now', 'current_now', 'power1_input']) {
      const value = readNumber(`${base}/${file}`);
      if (value !== null) chip[file] = value;
    }
    chips.push(chip);
  }
  const fan = chips.find((chip) => /pwmfan|fan/i.test(chip.name)) || null;
  const power = chips.find((chip) => /tcpm|typec|usb|battery|ac/i.test(chip.name)) || null;
  return {
    chips,
    fan: fan ? { name: fan.name, pwm: fan.pwm1 ?? null, enable: fan.pwm1_enable ?? null, rpm: fan.fan1_input ?? null } : null,
    power: power
      ? {
        name: power.name,
        voltageMicroVolts: power.voltage_now ?? null,
        currentMicroAmps: power.current_now ?? null,
        watts: power.voltage_now && power.current_now
          ? round((power.voltage_now / 1e6) * (power.current_now / 1e6), 2)
          : null,
      }
      : null,
  };
}

/* ------------------------------------------------ NPU/GPU/内存控制器负载 */

/** devfreq 的 load 形如 13@300000000Hz。 */
export function parseDevfreqLoad(text) {
  const match = /^(\d+)@(\d+)Hz/.exec(String(text || '').trim());
  if (!match) return { loadPercent: null, freqHz: null };
  return { loadPercent: Number(match[1]), freqHz: Number(match[2]) };
}

/** root 定时导出的 rknpu 真实利用率文件（见 npu-load-export.sh）。 */
const DEFAULT_NPU_LOAD_FILE = '/run/rock-console/npu-load';

/**
 * 解析 rknpu debugfs 的真实三核利用率：
 *   "NPU load:  Core0:  0%, Core1:  0%, Core2:  0%,"
 *
 * RK3588 + 6.1 内核上 /sys/class/devfreq/fdab0000.npu/load 恒报 100%，
 * 真实值只能从 debugfs 读，因此以该文件为准。
 */
export function parseRknpuLoad(text) {
  const cores = [...String(text || '').matchAll(/Core(\d+):\s*(\d+)%/g)].map((match) => Number(match[2]));
  if (cores.length === 0) return null;
  const average = cores.reduce((sum, value) => sum + value, 0) / cores.length;
  return { cores, loadPercent: Math.round(average * 10) / 10 };
}

export function readDevfreq(devfreqRoot = '/sys/class/devfreq', npuLoadFile = DEFAULT_NPU_LOAD_FILE) {
  const devices = [];
  for (const name of listDirs(devfreqRoot)) {
    const base = `${devfreqRoot}/${name}`;
    const parsed = parseDevfreqLoad(readText(`${base}/load`));
    const device = {
      device: name,
      currentHz: readNumber(`${base}/cur_freq`) ?? parsed.freqHz,
      minHz: readNumber(`${base}/min_freq`),
      maxHz: readNumber(`${base}/max_freq`),
      governor: readText(`${base}/governor`)?.trim() || null,
      loadPercent: parsed.loadPercent,
      loadSource: 'devfreq',
    };
    if (/npu/i.test(name)) {
      const real = parseRknpuLoad(readText(npuLoadFile));
      if (real) {
        device.loadPercent = real.loadPercent;
        device.cores = real.cores;
        device.loadSource = 'rknpu-debugfs';
      } else if (parsed.loadPercent === 100) {
        // 无真实来源且 devfreq 报满：标记为疑似驱动未上报，避免面板误导。
        device.loadSuspect = true;
      }
    }
    devices.push(device);
  }
  return devices;
}

/* ------------------------------------------------------------ 网络 / 磁盘 */

export function parseNetDev(text) {
  const interfaces = {};
  for (const line of String(text || '').split('\n')) {
    const match = /^\s*([^:]+):\s*(.*)$/.exec(line);
    if (!match) continue;
    const name = match[1].trim();
    if (name === 'lo') continue;
    const fields = match[2].trim().split(/\s+/).map(Number);
    if (fields.length < 16 || fields.some((value) => !Number.isFinite(value))) continue;
    interfaces[name] = {
      rxBytes: fields[0],
      rxPackets: fields[1],
      rxErrors: fields[2],
      rxDropped: fields[3],
      txBytes: fields[8],
      txPackets: fields[9],
      txErrors: fields[10],
      txDropped: fields[11],
    };
  }
  return interfaces;
}

export function computeNetRates(previous, current, elapsedMs) {
  const rates = [];
  if (!current) return rates;
  const seconds = elapsedMs > 0 ? elapsedMs / 1000 : 0;
  for (const [name, counters] of Object.entries(current)) {
    const before = previous?.[name];
    const delta = (key) => (before && seconds > 0 ? Math.max(0, counters[key] - before[key]) / seconds : null);
    rates.push({
      name,
      rxBytesPerSecond: delta('rxBytes'),
      txBytesPerSecond: delta('txBytes'),
      rxBytesTotal: counters.rxBytes,
      txBytesTotal: counters.txBytes,
      rxErrors: counters.rxErrors,
      txErrors: counters.txErrors,
    });
  }
  rates.sort((a, b) => a.name.localeCompare(b.name));
  return rates;
}

export function readNetDev(procRoot = '/proc') {
  const text = readText(`${procRoot}/net/dev`);
  return text === null ? null : parseNetDev(text);
}

/** 读取 IPv4 地址映射（网卡名 → 地址），用于在面板上直接看到每块网卡的 IP。 */
let addressCacheAt = 0;
let addressCacheValue = {};

/** 按网卡名推断用途分类，供前端分组展示。 */
export function classifyInterface(name) {
  const iface = String(name || '');
  if (/^zt[0-9a-z]+$/i.test(iface)) return 'zerotier';
  if (/^(en|eth|eno|ens|enp)/i.test(iface)) return 'wired';
  if (/^(wl|wlan|wlp|wifi)/i.test(iface)) return 'wireless';
  if (/^(lo$|veth|docker|br-|virbr|vnet|tun|tap|wg)/i.test(iface)) return 'virtual';
  return 'other';
}

/**
 * 读取各网卡的 IPv4 / IPv6 地址。
 * 返回 { 网卡名: { ipv4: [...], ipv6: [...] } }，IPv6 已剔除链路本地地址。
 */
export function readInterfaceAddresses(runner = defaultRunner) {
  const now = Date.now();
  if (now - addressCacheAt < 60000) return addressCacheValue;
  addressCacheAt = now;

  const result = runner('ip', ['-o', 'addr', 'show'], { timeout: 5000 });
  if (result.error || result.status !== 0) return {};
  const map = {};
  for (const line of String(result.stdout || '').split('\n')) {
    const matched = /^\d+:\s+(\S+)\s+(inet6?)\s+([^\s/]+)/.exec(line);
    if (!matched) continue;
    const [, name, family, address] = matched;
    if (!map[name]) map[name] = { ipv4: [], ipv6: [] };
    if (family === 'inet') {
      map[name].ipv4.push(address);
    } else if (!/^fe80:/i.test(address)) {
      map[name].ipv6.push(address);
    }
  }
  addressCacheValue = map;
  return map;
}

/** 远程串流状态：ZeroTier 虚拟网卡地址 + Moonlight 客户端进程。 */
/**
 * 解析 Moonlight 运行日志，提取串流参数与累计统计。
 * 日志由启动脚本重定向到固定路径，超过 5 MB 会轮转。
 */
/** 读取 Moonlight 记录的主机地址，用于网络探测。 */
function readMoonlightHost() {
  const confPath = '/home/radxa/.config/Moonlight Game Streaming Project/Moonlight.conf';
  const text = readText(confPath);
  const matched = text ? text.match(/localaddress=(\d+\.\d+\.\d+\.\d+)/) : null;
  return matched ? matched[1] : null;
}

// 网络探测结果缓存，避免每秒都发 ICMP
let rttCacheAt = 0;
let rttCacheValue = null;

/** 到串流主机的网络往返延迟（毫秒），10 秒内复用上次结果。 */
function measureMoonlightRtt(runner = defaultRunner) {
  const now = Date.now();
  if (now - rttCacheAt < 10000) return rttCacheValue;

  rttCacheAt = now;
  rttCacheValue = null;

  const host = readMoonlightHost();
  if (!host) return null;

  const result = runner('ping', ['-c', '1', '-W', '1', host], { timeout: 3000 });
  const matched = String(result.stdout || '').match(/time=([\d.]+)\s*ms/);
  if (matched) rttCacheValue = Number(matched[1]);
  return rttCacheValue;
}

export function readMoonlightStats(runner = defaultRunner) {
  const logPath = '/home/radxa/.cache/moonlight-live.log';

  const pgrep = runner('pgrep', ['-af', 'app/moonlight'], { timeout: 3000 });
  const lines = String(pgrep.stdout || '').trim().split('\n').filter(Boolean);
  if (lines.length === 0) return { running: false, streaming: false };

  const streaming = lines.some((line) => line.includes(' stream '));
  const stats = { running: true, streaming };

  // 运行时长
  const pid = lines[0].split(/\s+/)[0];
  const ps = runner('ps', ['-o', 'etimes=', '-p', pid], { timeout: 3000 });
  const elapsed = Number(String(ps.stdout || '').trim());
  if (Number.isFinite(elapsed) && elapsed > 0) stats.elapsedSeconds = elapsed;

  // 只读文件尾部 256 KB，避免长日志整文件载入
  let text = '';
  try {
    if (existsSync(logPath)) {
      const raw = readFileSync(logPath);
      text = raw.length > 262144 ? raw.subarray(raw.length - 262144).toString('utf8') : raw.toString('utf8');
    }
  } catch {
    return stats;
  }
  if (!text) return stats;

  // 分辨率与目标帧率
  const video = [...text.matchAll(/Video stream is (\d+)x(\d+)x(\d+)/g)];
  if (video.length > 0) {
    const last = video[video.length - 1];
    stats.width = Number(last[1]);
    stats.height = Number(last[2]);
    stats.targetFps = Number(last[3]);
  }

  // 视频码率
  const bitrate = [...text.matchAll(/Video bitrate: (\d+) kbps/g)];
  if (bitrate.length > 0) stats.bitrateKbps = Number(bitrate[bitrate.length - 1][1]);

  // 累计丢帧
  const drops = [...text.matchAll(/Network dropped (\d+) frame/g)];
  if (drops.length > 0) {
    stats.droppedFrames = drops.reduce((sum, matched) => sum + Number(matched[1]), 0);
  }

  // 最新帧号 → 平均到达帧率
  const frames = [...text.matchAll(/frame[s]? (\d+)/g)];
  if (frames.length > 0) {
    stats.lastFrame = Number(frames[frames.length - 1][1]);
    if (Number.isFinite(elapsed) && elapsed > 5 && stats.lastFrame > 0) {
      stats.actualFps = Math.round(stats.lastFrame / elapsed);
    }
  }

  const rtt = measureMoonlightRtt(runner);
  if (Number.isFinite(rtt)) stats.rttMs = rtt;

  return stats;
}

/**
 * 读取串流会话事件，聚合今日统计与上一次会话。
 *
 * 事件由两部分写入：
 *   · moonlight-stream.sh 启动时写 start（source=script）
 *   · moonlight-watchdog.sh 检测到进程消失时写 stop，并附带统计快照
 */
/**
 * 把会话按时间聚合成「时间段」。
 * 相邻两段间隔不超过 gapMinutes 就视为同一次连续使用，合并成一块。
 *
 * 用途：一天里反复断开重连十次，面板上应该显示「一段 2 小时的使用，断联 9 次」，
 * 而不是十条零散记录。
 */
export function buildTimeSegments(sessions, gapMinutes = 5) {
  const gapMs = gapMinutes * 60 * 1000;
  const blocks = [];
  let current = null;

  for (const session of sessions) {
    if (!current) {
      current = { startMs: session.startMs, endMs: session.endMs, sessions: [session] };
      continue;
    }
    if (session.startMs - current.endMs <= gapMs) {
      current.endMs = session.endMs;
      current.sessions.push(session);
      continue;
    }
    blocks.push(current);
    current = { startMs: session.startMs, endMs: session.endMs, sessions: [session] };
  }
  if (current) blocks.push(current);

  return blocks.map((block) => {
    const last = block.sessions[block.sessions.length - 1];
    const totalStream = block.sessions.reduce((sum, item) => sum + (item.durationSeconds || 0), 0);
    const weightedBitrate = block.sessions.reduce(
      (sum, item) => sum + (item.bitrateKbps || 0) * (item.durationSeconds || 0),
      0,
    );
    const avgBitrateKbps = totalStream > 0 ? Math.round(weightedBitrate / totalStream) : null;
    const fpsMatch = /x([0-9]+)$/.exec(last.resolution || '');
    const fps = fpsMatch ? Number(fpsMatch[1]) : null;
    const droppedFrames = block.sessions.reduce((sum, item) => sum + (item.droppedFrames || 0), 0);
    const expectedFrames = fps && totalStream > 0 ? fps * totalStream : null;
    return {
      startMs: block.startMs,
      endMs: block.endMs,
      wallSeconds: Math.max(0, Math.round((block.endMs - block.startMs) / 1000)),
      sessionCount: block.sessions.length,
      streamSeconds: totalStream,
      disconnects: Math.max(0, block.sessions.length - 1),
      resolution: last.resolution || null,
      bitrateKbps: last.bitrateKbps ?? null,
      avgBitrateKbps,
      fps,
      droppedFrames,
      droppedRate: expectedFrames ? Math.min(100, Math.round((droppedFrames / expectedFrames) * 1000) / 10) : null,
      trafficMB: avgBitrateKbps && totalStream ? Math.round((avgBitrateKbps * totalStream) / 8 / 1024) : null,
    };
  });
}

/**
 * 按自然日拆分时段（今天/昨天/前天），每条从当天 00:00 到次日 00:00。
 * 跨天的会话裁剪到当天区间内，再按 gapMinutes 合并。
 */
export function buildDailySegments(sessions, days = 3, gapMinutes = 45) {
  const list = Array.isArray(sessions) ? sessions : [];
  const result = [];
  const now = new Date();
  for (let i = 0; i < days; i += 1) {
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i).getTime();
    const dayEnd = dayStart + 86400000;
    const clipped = [];
    for (const session of list) {
      const startMs = Math.max(session.startMs, dayStart);
      const endMs = Math.min(session.endMs, dayEnd);
      if (endMs > startMs) {
        clipped.push({
          ...session,
          startMs,
          endMs,
          durationSeconds: Math.round((endMs - startMs) / 1000),
        });
      }
    }
    result.push({ dayStart, segments: buildTimeSegments(clipped, gapMinutes) });
  }
  return result;
}

const MOONLIGHT_LIVE_LOG = '/home/radxa/.cache/moonlight-live.log';
let liveStatsCache = { mtimeMs: -1, size: -1, value: null };

/**
 * 解析 Moonlight 客户端日志（~/.cache/moonlight-live.log），提炼最近一场的实测画质：
 * 分辨率/码率/到达与渲染帧率/IDR 请求次数/首帧延迟/解码器/连接地址。
 * 按 mtime+size 缓存，日志不变时不重复读盘。
 */
export function readMoonlightLiveStats() {
  const empty = {
    available: false,
    resolution: null,
    bitrateKbps: null,
    incomingFps: null,
    decodingFps: null,
    renderingFps: null,
    idrRequests: 0,
    firstPacketMs: null,
    decoder: null,
    endpoint: null,
  };
  try {
    if (!existsSync(MOONLIGHT_LIVE_LOG)) return empty;
    const stat = statSync(MOONLIGHT_LIVE_LOG);
    if (
      liveStatsCache.value &&
      liveStatsCache.mtimeMs === stat.mtimeMs &&
      liveStatsCache.size === stat.size
    ) {
      return liveStatsCache.value;
    }
    const raw = readFileSync(MOONLIGHT_LIVE_LOG, 'utf8');
    const tail = raw.slice(-512 * 1024);
    const pick = (re) => {
      const hit = tail.match(re);
      return hit ? hit[1] : null;
    };
    const lastFps = (label) => {
      const hits = [...tail.matchAll(new RegExp(`${label} frame rate[^:]*: ([0-9.]+) FPS`, 'g'))];
      return hits.length ? Number(hits[hits.length - 1][1]) : null;
    };
    const value = {
      available: true,
      resolution: pick(/Video stream is ([0-9]+x[0-9]+x[0-9]+)/),
      bitrateKbps: Number(pick(/Video bitrate: ([0-9]+) kbps/)) || null,
      incomingFps: lastFps('Incoming'),
      decodingFps: lastFps('Decoding'),
      renderingFps: lastFps('Rendering'),
      idrRequests: (raw.match(/IDR frame request sent/g) || []).length,
      firstPacketMs: Number(pick(/Received first video packet after ([0-9]+) ms/)) || null,
      decoder: (() => { const hits = [...raw.matchAll(/decoder for (h264_rkmpp|hevc_rkmpp)/g)]; return hits.length ? hits[hits.length - 1][1] : null; })(),
      endpoint: (() => { const hits = [...raw.matchAll(/Executing request: "https:\/\/([^/"]+)/g)]; return hits.length ? hits[hits.length - 1][1] : null; })(),
    };
    liveStatsCache = { mtimeMs: stat.mtimeMs, size: stat.size, value };
    return value;
  } catch {
    return empty;
  }
}

export function readMoonlightEvents() {
  const eventPath = '/home/radxa/.cache/moonlight-events.jsonl';
  const result = {
    todaySessions: 0,
    todaySeconds: 0,
    todayDisconnects: 0,
    todayWatchdogRestarts: 0,
    lastSession: null,
    currentSession: null,
    recentEvents: [],
  };

  let lines = [];
  try {
    if (!existsSync(eventPath)) return result;
    const raw = readFileSync(eventPath, 'utf8');
    lines = raw.split('\n').filter(Boolean).slice(-800);
  } catch {
    return result;
  }

  const events = [];
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      const ts = Date.parse(parsed.ts);
      if (Number.isFinite(ts)) events.push({ ...parsed, tsMs: ts });
    } catch {
      // 单行损坏不影响整体
    }
  }
  events.sort((a, b) => a.tsMs - b.tsMs);

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  const sessions = [];
  let open = null;

  for (const ev of events) {
    if (ev.event === 'start') {
      open = ev;
    } else if (ev.event === 'stop') {
      if (!open) continue;
      sessions.push({
        startMs: open.tsMs,
        endMs: ev.tsMs,
        durationSeconds: Number(ev.elapsedSeconds) || Math.round((ev.tsMs - open.tsMs) / 1000),
        host: open.host || ev.host || null,
        resolution: ev.resolution || null,
        bitrateKbps: ev.bitrateKbps ?? null,
        droppedFrames: ev.droppedFrames ?? null,
      });
      open = null;
    } else if (ev.event === 'watchdog_restart' && ev.tsMs >= todayStart) {
      result.todayWatchdogRestarts += 1;
    }
  }

  for (const session of sessions) {
    if (session.startMs >= todayStart) {
      result.todaySessions += 1;
      result.todaySeconds += session.durationSeconds;
    }
  }

  // 断联次数：今日的 start 总数减一（第一次连接不算断联）
  const todayStarts = events.filter((ev) => ev.event === 'start' && ev.tsMs >= todayStart).length;
  result.todayDisconnects = Math.max(0, todayStarts - 1);

  // 上一段已结束的会话
  if (sessions.length > 0) {
    const last = sessions[sessions.length - 1];
    result.lastSession = {
      startMs: last.startMs,
      endMs: last.endMs,
      durationSeconds: last.durationSeconds,
      host: last.host,
      resolution: last.resolution,
      bitrateKbps: last.bitrateKbps,
      droppedFrames: last.droppedFrames,
    };
  }

  // 正在进行的会话（还没有 stop）
  if (open) {
    result.currentSession = {
      startMs: open.tsMs,
      host: open.host || null,
    };
  }

  result.recentEvents = events.slice(-6).map((ev) => ({
    ts: ev.ts,
    event: ev.event,
    reason: ev.reason || null,
  }));

  // 按时间段聚合（相邻会话间隔 45 分钟内视为同一次使用）
  result.segments = buildTimeSegments(sessions, 45);
  result.dailySegments = buildDailySegments(sessions, 3, 45);
  result.quality = readMoonlightLiveStats();

  return result;
}

export function readStreamState(runner = defaultRunner) {
  const addresses = readInterfaceAddresses(runner);
  const zeroTierAddress = Object.entries(addresses)
    .find(([name]) => name.startsWith('zt'))?.[1]?.ipv4?.[0] || null;

  const moonlight = readMoonlightStats(runner);
  return {
    zeroTierAddress,
    moonlightRunning: moonlight.running,
    moonlightStreaming: moonlight.streaming,
    ...moonlight,
    events: readMoonlightEvents(),
  };
}

export function readDisks(mounts = ['/']) {
  return mounts.map((mount) => {
    try {
      const stats = statfsSync(mount);
      const totalBytes = stats.blocks * stats.bsize;
      const freeBytes = stats.bavail * stats.bsize;
      return {
        mount,
        filesystemType: String(stats.type),
        totalBytes,
        freeBytes,
        usedBytes: totalBytes - freeBytes,
        usedPercent: totalBytes > 0 ? round(((totalBytes - freeBytes) / totalBytes) * 100, 1) : null,
      };
    } catch {
      return { mount, error: 'unavailable' };
    }
  });
}

/* -------------------------------------------------------------- 服务/容器 */

const DEFAULT_UNITS = [
  'article-studio.service',
  'cloudflared.service',
  'history-site.service',
  'rock5b-fan-fixed.service',
  'rock-console.service',
  'siyuan-notes-publish.service',
  'siyuan-notes-publish.timer',
  'docker.service',
];

/** 批量查询 systemd 单元状态；systemctl 输出顺序与入参一致。 */
/**
 * 读取各单元的启动时间或最后状态变化时间。
 * 常驻服务用 ActiveEnterTimestamp；oneshot 结束后该字段会被清空，
 * 回退到 StateChangeTimestamp（最后一次状态切换的时刻）。
 */
export function readUnitActiveSince(units, runner = defaultRunner) {
  if (!units.length) return new Map();

  const result = runner(
    'systemctl',
    ['show', ...units, '-p', 'Id', '-p', 'ActiveEnterTimestamp', '-p', 'StateChangeTimestamp'],
    { timeout: 5000 },
  );
  if (result.error || result.status !== 0) return new Map();

  const map = new Map();
  let current = null;
  const flush = () => {
    if (current?.id) map.set(current.id, current);
    current = null;
  };

  for (const line of String(result.stdout || '').split('\n')) {
    if (!line.trim()) { flush(); continue; }
    const index = line.indexOf('=');
    if (index <= 0) continue;
    if (!current) current = {};

    const key = line.slice(0, index);
    const value = line.slice(index + 1).trim();

    if (key === 'Id') current.id = value;
    else if (key === 'ActiveEnterTimestamp') current.activeSince = value || null;
    else if (key === 'StateChangeTimestamp') current.stateChanged = value || null;
  }
  flush();
  return map;
}

export function readServiceStates(units = DEFAULT_UNITS, runner = defaultRunner) {
  if (!units.length) return [];
  const result = runner('systemctl', ['is-active', ...units], { timeout: 5000 });
  if (result.error) {
    return units.map((unit) => ({ unit, active: null, error: String(result.error) }));
  }
  const lines = String(result.stdout || '').split('\n').map((line) => line.trim());
  const memory = readUnitMemory(units, runner);
  const timers = readTimerStates(units, runner);
  const since = readUnitActiveSince(units, runner);

  // 若存在同名 timer（<name>.service → <name>.timer），把它的上次触发时间
  // 作为该服务的"上次运行时间"。oneshot 结束后自身的时间戳会被清空，
  // 只有 timer 的 LastTriggerUSec 能准确反映实际执行时刻。
  const siblingTimers = units
    .filter((unit) => unit.endsWith('.service'))
    .map((unit) => unit.replace(/\.service$/, '.timer'))
    .filter((timerUnit) => !units.includes(timerUnit));
  const extraTimers = siblingTimers.length ? readTimerStates(siblingTimers, runner) : new Map();

  return units.map((unit, index) => {
    const times = since.get(unit) || null;
    const ownTimer = timers.get(unit) || null;

    // 同名 timer 可能已在 units 里（查过），也可能需要额外查询
    let sibling = null;
    if (unit.endsWith('.service')) {
      const timerUnit = unit.replace(/\.service$/, '.timer');
      sibling = timers.get(timerUnit) || extraTimers.get(timerUnit) || null;
    }

    // 上次运行时间：优先同名 timer 的触发时刻，其次自身 active 时间
    let lastRun = sibling?.last || null;
    if (!lastRun && times?.activeSince) lastRun = times.activeSince;

    // 下次运行时间：service 取同名 timer 的下次触发；timer 单元取自身
    const nextRun = unit.endsWith('.timer')
      ? (ownTimer?.next || null)
      : (sibling?.next || null);

    return {
      unit,
      active: lines[index] || 'unknown',
      since: times ? (times.activeSince || times.stateChanged || null) : null,
      lastRun,
      nextRun,
      memory: memory.get(unit) ?? null,
      timer: ownTimer,
    };
  });
}

function defaultRunner(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options });
  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    status: result.status,
    error: result.error ? result.error.message : null,
  };
}

export function readDockerContainers(runner = defaultRunner) {
  const result = runner('docker', ['ps', '--format', '{{.Names}}\t{{.Status}}\t{{.Image}}'], { timeout: 5000 });
  if (result.error || result.status !== 0) return null;
  return String(result.stdout || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, status, image] = line.split('\t');
      return { name, status, image };
    });
}

export function readJournalTail(unit, lines = 12, runner = defaultRunner) {
  const result = runner('journalctl', ['-u', unit, '-n', String(lines), '--no-pager', '-o', 'short-iso'], { timeout: 8000 });
  if (result.error || result.status !== 0) return null;
  return String(result.stdout || '').trim().split('\n').filter(Boolean);
}

/** 读取 journal 的结构化条目（-o json，每行一个 JSON 对象）。 */
export function readJournalEvents(unit, lines = 80, runner = defaultRunner) {
  const result = runner('journalctl', ['-u', unit, '-n', String(lines), '--no-pager', '-o', 'json'], { timeout: 8000 });
  if (result.error || result.status !== 0) return null;
  return String(result.stdout || '')
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

/** 读取单元的当前状态与是否开机自启。 */
/** 批量读取 systemd 单元的内存占用（Bytes），一次 systemctl 调用拿全部。 */
export function readUnitMemory(units, runner = defaultRunner) {
  if (!units.length) return new Map();
  const result = runner('systemctl', ['show', ...units, '-p', 'Id', '-p', 'MemoryCurrent'], { timeout: 5000 });
  if (result.error || result.status !== 0) return new Map();
  const map = new Map();
  let currentId = '';
  let currentMemory = null;
  const flush = () => {
    if (currentId) map.set(currentId, currentMemory);
    currentId = '';
    currentMemory = null;
  };
  for (const line of String(result.stdout || '').split('\n')) {
    if (!line.trim()) { flush(); continue; }
    const index = line.indexOf('=');
    if (index <= 0) continue;
    const key = line.slice(0, index);
    const value = line.slice(index + 1).trim();
    if (key === 'Id') currentId = value;
    else if (key === 'MemoryCurrent') currentMemory = /^\d+$/.test(value) ? Number(value) : null;
  }
  flush();
  return map;
}

/**
 * 读取 timer 单元的定时设置与下次触发时间。
 * systemctl show 多单元时按空行分段，这里逐段解析。
 */
export function readTimerStates(units, runner = defaultRunner) {
  const timers = units.filter((unit) => unit.endsWith('.timer'));
  if (!timers.length) return new Map();

  const result = runner(
    'systemctl',
    ['show', ...timers, '-p', 'Id', '-p', 'NextElapseUSecRealtime', '-p', 'TimersCalendar', '-p', 'LastTriggerUSec'],
    { timeout: 5000 },
  );
  if (result.error || result.status !== 0) return new Map();

  const map = new Map();
  let current = null;
  const flush = () => {
    if (current?.id) map.set(current.id, current);
    current = null;
  };

  for (const line of String(result.stdout || '').split('\n')) {
    if (!line.trim()) { flush(); continue; }
    const index = line.indexOf('=');
    if (index <= 0) continue;
    if (!current) current = { calendar: [] };

    const key = line.slice(0, index);
    const value = line.slice(index + 1).trim();

    if (key === 'Id') current.id = value;
    else if (key === 'NextElapseUSecRealtime') current.next = value || null;
    else if (key === 'LastTriggerUSec') current.last = value || null;
    else if (key === 'TimersCalendar') {
      const matched = value.match(/OnCalendar=(.+?)\s*;/);
      if (matched) {
        const hm = matched[1].match(/\d{2}:\d{2}/);
        current.calendar.push(hm ? hm[0] : matched[1].trim());
      }
    }
  }
  flush();
  return map;
}

export function readUnitStatus(unit, runner = defaultRunner) {
  const result = runner(
    'systemctl',
    ['show', unit, '-p', 'ActiveState', '-p', 'SubState', '-p', 'UnitFileState'],
    { timeout: 5000 },
  );
  if (result.error) return null;
  const fields = {};
  for (const line of String(result.stdout || '').split('\n')) {
    const index = line.indexOf('=');
    if (index > 0) fields[line.slice(0, index)] = line.slice(index + 1);
  }
  return {
    activeState: fields.ActiveState || null,
    subState: fields.SubState || null,
    unitFileState: fields.UnitFileState || null,
  };
}

/* ------------------------------------------------------------- 快照组装 */

/**
 * 采集器：持有上一次的 CPU/网络采样用于差分。
 * 两次 snapshot 之间的间隔由调用方控制（server 的 ROCK_CONSOLE_STATUS_INTERVAL_MS，本机设为 1000ms）。
 * systemctl / docker 走子进程，按 slowTtlMs（默认 5 秒）缓存，避免每秒同步阻塞事件循环。
 */
export function createMetricsCollector({
  procRoot = '/proc',
  thermalRoot = '/sys/class/thermal',
  hwmonRoot = '/sys/class/hwmon',
  devfreqRoot = '/sys/class/devfreq',
  npuLoadFile = DEFAULT_NPU_LOAD_FILE,
  cpuRoot = '/sys/devices/system/cpu',
  mounts = ['/'],
  units = DEFAULT_UNITS,
  runner = defaultRunner,
  includeDocker = true,
  clock = () => Date.now(),
  hostname,
  slowTtlMs = 5000,
} = {}) {
  let previousCpu = null;
  let previousCpuAt = 0;
  let previousNet = null;
  let previousNetAt = 0;

  // systemctl / docker 是 spawnSync，会同步阻塞事件循环。
  // 每秒都调用会把终端输入卡住，因此这两项按 slowTtlMs 缓存（默认 5 秒）。
  let lastServices = null;
  let lastDocker = null;
  let lastSlowAt = 0;
  let lastStream = null;
  let lastStreamAt = 0;

  function snapshot() {
    const now = clock();
    const cpuSample = readProcStat(procRoot);
    const cpuUsage = previousCpu && cpuSample
      ? computeCpuUsage(previousCpu, cpuSample)
      : { total: null, cores: [] };
    previousCpu = cpuSample;
    const cpuElapsed = previousCpuAt ? now - previousCpuAt : 0;
    previousCpuAt = now;

    const netSample = readNetDev(procRoot);
    const netElapsed = previousNetAt ? now - previousNetAt : 0;
    const networks = computeNetRates(previousNet, netSample, netElapsed);
    previousNet = netSample;
    previousNetAt = now;

    // 给每块网卡附上 IPv4 地址（同一批次读取，避免逐个 fork）
    if (networks.length > 0) {
      const addresses = readInterfaceAddresses(runner);
      for (const item of networks) {
        item.addresses = addresses[item.name] || { ipv4: [], ipv6: [] };
        item.kind = classifyInterface(item.name);
      }
    }

    const cpuFreq = readCpuFreq(cpuRoot);
    const thermal = readThermalZones(thermalRoot);
    const hwmon = readHwmon(hwmonRoot);

    if (lastServices === null || now - lastSlowAt >= slowTtlMs) {
      lastServices = readServiceStates(units, runner);
      lastDocker = includeDocker ? readDockerContainers(runner) : null;
      lastSlowAt = now;
    }

    // 串流状态涉及 pgrep/ps/读日志，按 5 秒缓存，避免每秒 fork
    if (lastStream === null || now - lastStreamAt >= 5000) {
      lastStream = readStreamState(runner);
      lastStreamAt = now;
    }

    return {
      collectedAt: new Date(now).toISOString(),
      uptimeSeconds: readUptime(procRoot)?.seconds ?? null,
      cpu: {
        usagePercent: cpuUsage.total,
        coreUsagePercent: cpuUsage.cores,
        coreCount: cpuSample?.perCore?.length ?? null,
        sampleIntervalMs: cpuElapsed || null,
        policies: cpuFreq.policies,
        cores: cpuFreq.cores,
        model: readText(`${procRoot}/device-tree/compatible`)?.trim().split('\0')[0]
          || readText(`${procRoot}/cpuinfo`)?.split('\n').find((line) => /Hardware|model name/i.test(line))?.split(':')[1]?.trim()
          || null,
      },
      memory: readMemInfo(procRoot),
      load: readLoadAvg(procRoot),
      thermal,
      hwmon,
      devfreq: readDevfreq(devfreqRoot, npuLoadFile),
      networks,
      stream: lastStream,
      bootTime: readBootTime(procRoot),
      disks: readDisks(mounts),
      services: lastServices,
      docker: lastDocker,
      host: {
        hostname: hostname || readText('/etc/hostname')?.trim() || null,
        kernel: readText(`${procRoot}/version`)?.trim() || null,
        osName: readOsName(),
      },
    };
  }

  return { snapshot };
}

function readOsName() {
  const text = readText('/etc/os-release');
  if (!text) return null;
  const match = /^PRETTY_NAME="?([^"\n]+)"?/m.exec(text);
  return match ? match[1] : null;
}

export { DEFAULT_UNITS, existsSync };
