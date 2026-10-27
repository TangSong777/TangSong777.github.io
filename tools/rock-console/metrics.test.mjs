import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import {
  computeCpuUsage,
  computeNetRates,
  createMetricsCollector,
  parseDevfreqLoad,
  parseMemInfo,
  parseNetDev,
  parseProcStat,
  parseRknpuLoad,
  readCpuFreq,
  readDevfreq,
  readDisks,
  readHwmon,
  readServiceStates,
  readThermalZones,
} from './metrics.mjs';

/** 在临时目录里造一套 /proc、/sys 的替身。 */
function createFixture() {
  const root = mkdtempSync(join(tmpdir(), 'rock-console-metrics-'));
  const write = (relative, content) => {
    const target = join(root, relative);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content);
  };
  return { root, write, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

/* -------------------------------------------------------------- /proc/stat */

test('parseProcStat 解析总体与每核计数', () => {
  const parsed = parseProcStat([
    'cpu  100 0 50 1000 20 0 5 0 0 0',
    'cpu0 25 0 12 250 5 0 1 0 0 0',
    'cpu1 25 0 12 250 5 0 1 0 0 0',
    'intr 12345',
    '',
  ].join('\n'));

  assert.equal(parsed.total.total, 1175);
  assert.equal(parsed.total.busy, 155);
  assert.equal(parsed.perCore.length, 2);
  assert.equal(parsed.perCore[1].total, 293);
});

test('parseProcStat 忽略畸形输入而不是抛错', () => {
  const parsed = parseProcStat('cpu 1 2\ncpuX nonsense\nrandom text');
  assert.equal(parsed.total, null);
  assert.equal(parsed.perCore.length, 0);
  assert.deepEqual(parseProcStat(''), { total: null, perCore: [] });
  assert.deepEqual(parseProcStat(null), { total: null, perCore: [] });
});

test('computeCpuUsage 由两次采样求占用率', () => {
  const previous = parseProcStat('cpu  100 0 50 1000 20 0 5 0 0 0\ncpu0 50 0 25 500 10 0 2 0 0 0');
  const current = parseProcStat('cpu  200 0 100 2000 40 0 10 0 0 0\ncpu0 100 0 50 1000 20 0 4 0 0 0');
  const usage = computeCpuUsage(previous, current);
  assert.equal(usage.total, 13.2);
  assert.equal(usage.cores.length, 1);
  // 单核 jiffies 增量与总体不同，占用率自然也不同（77/587）
  assert.equal(usage.cores[0], 13.1);
});

test('computeCpuUsage 对缺失或零间隔采样返回 null', () => {
  const a = parseProcStat('cpu  100 0 50 1000 20 0 5 0 0 0');
  assert.equal(computeCpuUsage(null, a).total, null);
  assert.equal(computeCpuUsage(a, a).total, null);
  assert.equal(computeCpuUsage(a, null).total, null);
});

/* --------------------------------------------------------------- meminfo */

test('parseMemInfo 换算为字节并给出使用率', () => {
  const memory = parseMemInfo([
    'MemTotal:        8031484 kB',
    'MemFree:         5031484 kB',
    'MemAvailable:    6031484 kB',
    'Buffers:          100000 kB',
    'Cached:          1000000 kB',
    'SwapTotal:             0 kB',
    'SwapFree:              0 kB',
  ].join('\n'));

  assert.equal(memory.totalBytes, 8031484 * 1024);
  assert.equal(memory.availableBytes, 6031484 * 1024);
  assert.equal(memory.cachedBytes, 1000000 * 1024);
  assert.equal(memory.usedPercent, 24.9);
  assert.equal(memory.swapTotalBytes, 0);
});

test('parseMemInfo 对空输入返回空字段', () => {
  const memory = parseMemInfo('');
  assert.equal(memory.totalBytes, null);
  assert.equal(memory.usedPercent, null);
});

/* ------------------------------------------------------------ 温度/hwmon */

test('readThermalZones 读取各温区并给出最高温', () => {
  const fixture = createFixture();
  try {
    fixture.write('thermal/thermal_zone0/type', 'soc-thermal\n');
    fixture.write('thermal/thermal_zone0/temp', '51769\n');
    fixture.write('thermal/thermal_zone1/type', 'gpu-thermal\n');
    fixture.write('thermal/thermal_zone1/temp', '49923\n');
    fixture.write('thermal/thermal_zone1/policy', 'step_wise\n');

    const thermal = readThermalZones(join(fixture.root, 'thermal'));
    assert.equal(thermal.zones.length, 2);
    assert.equal(thermal.zones[0].type, 'soc-thermal');
    assert.equal(thermal.zones[0].celsius, 51.77);
    assert.equal(thermal.zones[1].policy, 'step_wise');
    assert.equal(thermal.maxCelsius, 51.77);
  } finally {
    fixture.cleanup();
  }
});

test('readThermalZones 对越界读数与缺失目录降级', () => {
  const fixture = createFixture();
  try {
    fixture.write('thermal/thermal_zone0/type', 'broken\n');
    fixture.write('thermal/thermal_zone0/temp', '999999999\n');
    const thermal = readThermalZones(join(fixture.root, 'thermal'));
    assert.equal(thermal.zones[0].celsius, null);
    assert.equal(thermal.maxCelsius, null);

    assert.deepEqual(readThermalZones(join(fixture.root, 'does-not-exist')), { zones: [], maxCelsius: null });
  } finally {
    fixture.cleanup();
  }
});

test('readHwmon 抽出风扇与供电通道', () => {
  const fixture = createFixture();
  try {
    fixture.write('hwmon/hwmon8/name', 'pwmfan\n');
    fixture.write('hwmon/hwmon8/pwm1', '128\n');
    fixture.write('hwmon/hwmon8/pwm1_enable', '1\n');
    fixture.write('hwmon/hwmon7/name', 'tcpm_source_psy_4_0022\n');
    fixture.write('hwmon/hwmon7/voltage_now', '20000000\n');
    fixture.write('hwmon/hwmon7/current_now', '1500000\n');

    const hwmon = readHwmon(join(fixture.root, 'hwmon'));
    assert.equal(hwmon.chips.length, 2);
    assert.deepEqual(hwmon.fan, { name: 'pwmfan', pwm: 128, enable: 1, rpm: null });
    assert.equal(hwmon.power.voltageMicroVolts, 20000000);
    assert.equal(hwmon.power.currentMicroAmps, 1500000);
    assert.equal(hwmon.power.watts, 30);
  } finally {
    fixture.cleanup();
  }
});

/* --------------------------------------------------------------- devfreq */

test('parseDevfreqLoad 解析 load@freq 格式', () => {
  assert.deepEqual(parseDevfreqLoad('13@300000000Hz'), { loadPercent: 13, freqHz: 300000000 });
  assert.deepEqual(parseDevfreqLoad('100@1000000000Hz\n'), { loadPercent: 100, freqHz: 1000000000 });
  assert.deepEqual(parseDevfreqLoad('garbage'), { loadPercent: null, freqHz: null });
  assert.deepEqual(parseDevfreqLoad(undefined), { loadPercent: null, freqHz: null });
});

test('readDevfreq 汇总 NPU/GPU/DMC 负载', () => {
  const fixture = createFixture();
  try {
    fixture.write('devfreq/fdab0000.npu/load', '100@1000000000Hz\n');
    fixture.write('devfreq/fdab0000.npu/cur_freq', '1000000000\n');
    fixture.write('devfreq/fdab0000.npu/governor', 'simple_ondemand\n');
    fixture.write('devfreq/fb000000.gpu/cur_freq', '300000000\n');

    // 显式指向 fixture 内不存在的导出文件，避免读到宿主机的真实 /run 文件。
    const devices = readDevfreq(join(fixture.root, 'devfreq'), join(fixture.root, 'npu-load'));
    assert.equal(devices.length, 2);
    const npu = devices.find((device) => device.device === 'fdab0000.npu');
    assert.equal(npu.loadPercent, 100);
    assert.equal(npu.loadSuspect, true);
    assert.equal(npu.governor, 'simple_ondemand');
    const gpu = devices.find((device) => device.device === 'fb000000.gpu');
    assert.equal(gpu.currentHz, 300000000);
    assert.equal(gpu.loadPercent, null);
  } finally {
    fixture.cleanup();
  }
});

test('parseRknpuLoad 解析 rknpu debugfs 的三核利用率', () => {
  assert.deepEqual(parseRknpuLoad('NPU load:  Core0:  0%, Core1:  0%, Core2:  0%,'), {
    cores: [0, 0, 0],
    loadPercent: 0,
  });
  assert.deepEqual(parseRknpuLoad('Core0: 100%, Core1: 50%, Core2: 0%'), {
    cores: [100, 50, 0],
    loadPercent: 50,
  });
  assert.equal(parseRknpuLoad('garbage'), null);
  assert.equal(parseRknpuLoad(''), null);
});

test('readDevfreq 优先采用 debugfs 导出的真实 NPU 负载', () => {
  const fixture = createFixture();
  try {
    fixture.write('devfreq/fdab0000.npu/load', '100@1000000000Hz\n');
    fixture.write('devfreq/fdab0000.npu/cur_freq', '1000000000\n');
    fixture.write('npu-load', 'NPU load:  Core0:  0%, Core1:  5%, Core2: 10%,\n');

    const devices = readDevfreq(join(fixture.root, 'devfreq'), join(fixture.root, 'npu-load'));
    const npu = devices.find((device) => device.device === 'fdab0000.npu');
    assert.equal(npu.loadPercent, 5);
    assert.deepEqual(npu.cores, [0, 5, 10]);
    assert.equal(npu.loadSource, 'rknpu-debugfs');
    assert.equal(npu.loadSuspect, undefined);
  } finally {
    fixture.cleanup();
  }
});

/* -------------------------------------------------------------- cpufreq */

test('readCpuFreq 汇总策略与每核频率', () => {
  const fixture = createFixture();
  try {
    fixture.write('cpu/cpufreq/policy0/scaling_governor', 'ondemand\n');
    fixture.write('cpu/cpufreq/policy0/scaling_cur_freq', '1800000\n');
    fixture.write('cpu/cpufreq/policy0/scaling_max_freq', '2352000\n');
    fixture.write('cpu/cpufreq/policy0/affected_cpus', '0 1 2 3\n');
    fixture.write('cpu/cpu0/cpufreq/scaling_cur_freq', '1800000\n');
    fixture.write('cpu/cpu4/cpufreq/scaling_cur_freq', '2352000\n');

    const freq = readCpuFreq(join(fixture.root, 'cpu'));
    assert.equal(freq.policies.length, 1);
    assert.equal(freq.policies[0].governor, 'ondemand');
    assert.equal(freq.policies[0].currentKhz, 1800000);
    assert.equal(freq.policies[0].relatedCpus, '0 1 2 3');
    assert.deepEqual(freq.cores, [
      { cpu: 0, currentKhz: 1800000 },
      { cpu: 4, currentKhz: 2352000 },
    ]);
  } finally {
    fixture.cleanup();
  }
});

/* ------------------------------------------------------------ 网络 / 磁盘 */

test('parseNetDev 跳过 lo 并解析计数', () => {
  const interfaces = parseNetDev([
    'Inter-|   Receive                                                |  Transmit',
    ' face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed',
    '    lo: 1000 10 0 0 0 0 0 0 1000 10 0 0 0 0 0 0',
    'enP4p65s0: 2000 20 1 0 0 0 0 0 3000 30 2 0 0 0 0 0',
  ].join('\n'));

  assert.equal('lo' in interfaces, false);
  assert.equal(interfaces.enP4p65s0.rxBytes, 2000);
  assert.equal(interfaces.enP4p65s0.txBytes, 3000);
  assert.equal(interfaces.enP4p65s0.rxErrors, 1);
});

test('computeNetRates 按间隔换算速率，首次采样不下发速率', () => {
  const first = parseNetDev('enP4p65s0: 1000 10 0 0 0 0 0 0 2000 20 0 0 0 0 0 0');
  const second = parseNetDev('enP4p65s0: 3000 30 0 0 0 0 0 0 6000 60 0 0 0 0 0 0');

  const initial = computeNetRates(null, first, 0);
  assert.equal(initial[0].rxBytesPerSecond, null);
  assert.equal(initial[0].rxBytesTotal, 1000);

  const rates = computeNetRates(first, second, 2000);
  assert.equal(rates[0].rxBytesPerSecond, 1000);
  assert.equal(rates[0].txBytesPerSecond, 2000);
  assert.deepEqual(computeNetRates(first, null, 2000), []);
});

test('readDisks 报告挂载点用量，无效挂载点降级', () => {
  const fixture = createFixture();
  try {
    const [disk] = readDisks([fixture.root]);
    assert.equal(disk.mount, fixture.root);
    assert.ok(disk.totalBytes > 0);
    assert.ok(disk.usedPercent >= 0 && disk.usedPercent <= 100);

    const [broken] = readDisks([join(fixture.root, 'no-such-dir')]);
    assert.equal(broken.error, 'unavailable');
  } finally {
    fixture.cleanup();
  }
});

/* -------------------------------------------------------------- 服务状态 */

test('readServiceStates 按顺序映射 systemctl 输出', () => {
  const runner = () => ({ stdout: 'active\ninactive\nunknown\n', stderr: '', status: 3, error: null });
  const states = readServiceStates(['a.service', 'b.service', 'c.service'], runner);
  assert.deepEqual(states.map((item) => item.active), ['active', 'inactive', 'unknown']);
});

test('readServiceStates 在 systemctl 不可用时给出错误标记', () => {
  const runner = () => ({ stdout: '', stderr: '', status: null, error: 'spawn systemctl ENOENT' });
  const states = readServiceStates(['a.service'], runner);
  assert.equal(states[0].active, null);
  assert.match(states[0].error, /ENOENT/);
  assert.deepEqual(readServiceStates([], runner), []);
});

/* ------------------------------------------------------------ 完整快照 */

test('createMetricsCollector 组装完整快照并在第二次采样后给出占用率', () => {
  const fixture = createFixture();
  try {
    fixture.write('proc/stat', 'cpu  100 0 50 1000 20 0 5 0 0 0\ncpu0 25 0 12 250 5 0 1 0 0 0\n');
    fixture.write('proc/meminfo', 'MemTotal: 1000 kB\nMemAvailable: 400 kB\n');
    fixture.write('proc/loadavg', '0.15 0.10 0.05 1/234 5678\n');
    fixture.write('proc/uptime', '12345.67 98765.43\n');
    fixture.write('proc/net/dev', 'enP4p65s0: 1000 10 0 0 0 0 0 0 2000 20 0 0 0 0 0 0\n');
    fixture.write('proc/version', 'Linux version 6.1.84-8-rk2410 (runner@build) #8 SMP\n');
    fixture.write('proc/cpuinfo', 'Hardware\t: Rockchip (Device Tree)\n');
    fixture.write('proc/device-tree/compatible', 'radxa,rock-5b-plus\0rockchip,rk3588\0');
    fixture.write('thermal/thermal_zone0/type', 'soc-thermal\n');
    fixture.write('thermal/thermal_zone0/temp', '51769\n');
    fixture.write('hwmon/hwmon8/name', 'pwmfan\n');
    fixture.write('hwmon/hwmon8/pwm1', '128\n');
    fixture.write('devfreq/fdab0000.npu/load', '50@1000000000Hz\n');
    fixture.write('cpu/cpufreq/policy0/scaling_governor', 'ondemand\n');
    fixture.write('cpu/cpufreq/policy0/scaling_cur_freq', '1800000\n');

    let tick = 0;
    const collector = createMetricsCollector({
      procRoot: join(fixture.root, 'proc'),
      thermalRoot: join(fixture.root, 'thermal'),
      hwmonRoot: join(fixture.root, 'hwmon'),
      devfreqRoot: join(fixture.root, 'devfreq'),
      npuLoadFile: join(fixture.root, 'npu-load'),
      cpuRoot: join(fixture.root, 'cpu'),
      mounts: [fixture.root],
      units: ['article-studio.service'],
      includeDocker: false,
      hostname: 'rock-5b-plus',
      clock: () => 1_700_000_000_000 + (tick += 2000),
      runner: (command) => (command === 'systemctl'
        ? { stdout: 'active\n', stderr: '', status: 0, error: null }
        : { stdout: '', stderr: '', status: 1, error: null }),
    });

    const first = collector.snapshot();
    assert.equal(first.cpu.usagePercent, null); // 首次采样没有基线
    assert.equal(first.memory.usedPercent, 60);
    assert.equal(first.load.one, 0.15);
    assert.equal(first.uptimeSeconds, 12345.7);
    assert.equal(first.thermal.maxCelsius, 51.77);
    assert.equal(first.hwmon.fan.pwm, 128);
    assert.equal(first.devfreq[0].loadPercent, 50);
    assert.equal(first.cpu.policies[0].governor, 'ondemand');
    assert.equal(first.host.hostname, 'rock-5b-plus');
    assert.equal(first.host.kernel.startsWith('Linux version 6.1.84'), true);
    assert.equal(first.cpu.model, 'radxa,rock-5b-plus');
    assert.deepEqual(first.services, [{ unit: 'article-studio.service', active: 'active', since: null }]);
    assert.equal(first.disks[0].mount, fixture.root);
    assert.equal(first.networks[0].rxBytesPerSecond, null);

    // 第二次采样：cpu 计数增长，网络计数增长
    fixture.write('proc/stat', 'cpu  200 0 100 2000 40 0 10 0 0 0\ncpu0 50 0 25 500 10 0 2 0 0 0\n');
    fixture.write('proc/net/dev', 'enP4p65s0: 3000 30 0 0 0 0 0 0 6000 60 0 0 0 0 0 0\n');

    const second = collector.snapshot();
    assert.equal(second.cpu.usagePercent, 13.2);
    assert.equal(second.networks[0].rxBytesPerSecond, 1000);
    assert.equal(second.networks[0].txBytesPerSecond, 2000);
    assert.equal(typeof second.collectedAt, 'string');
    assert.doesNotThrow(() => JSON.stringify(second));
  } finally {
    fixture.cleanup();
  }
});

test('createMetricsCollector 在数据源全部缺失时仍返回可序列化快照', () => {
  const collector = createMetricsCollector({
    procRoot: '/nonexistent-proc',
    thermalRoot: '/nonexistent-thermal',
    hwmonRoot: '/nonexistent-hwmon',
    devfreqRoot: '/nonexistent-devfreq',
    cpuRoot: '/nonexistent-cpu',
    mounts: ['/nonexistent-mount'],
    units: [],
    includeDocker: false,
    hostname: 'test',
    runner: () => ({ stdout: '', stderr: '', status: 1, error: null }),
  });

  const snapshot = collector.snapshot();
  assert.equal(snapshot.cpu.usagePercent, null);
  assert.equal(snapshot.memory, null);
  assert.deepEqual(snapshot.thermal.zones, []);
  assert.deepEqual(snapshot.devfreq, []);
  assert.deepEqual(snapshot.services, []);
  assert.equal(snapshot.disks[0].error, 'unavailable');
  assert.doesNotThrow(() => JSON.stringify(snapshot));
});
