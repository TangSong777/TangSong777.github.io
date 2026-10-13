import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DEFAULT_CONFIG, decidePwm, findPwmFan, levelPwm, parseConfig, parseLevels, readMaxTempC } from './fan-control.mjs';

test('低于启动阈值时风扇保持停止', () => {
  assert.deepEqual(decidePwm({ tempC: 33, running: false, config: DEFAULT_CONFIG }), { pwm: 0, running: false });
  assert.deepEqual(decidePwm({ tempC: 54.9, running: false, config: DEFAULT_CONFIG }), { pwm: 0, running: false });
});

test('达到启动阈值才启动，并按温度分级', () => {
  assert.deepEqual(decidePwm({ tempC: 55, running: false, config: DEFAULT_CONFIG }), { pwm: 64, running: true });
  assert.deepEqual(decidePwm({ tempC: 62, running: true, config: DEFAULT_CONFIG }), { pwm: 128, running: true });
  assert.deepEqual(decidePwm({ tempC: 70, running: true, config: DEFAULT_CONFIG }), { pwm: 192, running: true });
  assert.deepEqual(decidePwm({ tempC: 90, running: true, config: DEFAULT_CONFIG }), { pwm: 255, running: true });
});

test('迟滞区间内不会启停抖动', () => {
  // 运行中降到迟滞区间：继续运行，只降档
  assert.deepEqual(decidePwm({ tempC: 50, running: true, config: DEFAULT_CONFIG }), { pwm: 64, running: true });
  // 运行中降到停止阈值：停止
  assert.deepEqual(decidePwm({ tempC: 45, running: true, config: DEFAULT_CONFIG }), { pwm: 0, running: false });
  // 停止状态下升到迟滞区间：保持停止
  assert.deepEqual(decidePwm({ tempC: 50, running: false, config: DEFAULT_CONFIG }), { pwm: 0, running: false });
});

test('档位按温度上限递增选取', () => {
  const config = { ...DEFAULT_CONFIG, levels: [{ belowC: 60, pwm: 64 }, { belowC: Infinity, pwm: 255 }] };
  assert.equal(levelPwm(20, config), 64);
  assert.equal(levelPwm(59.9, config), 64);
  assert.equal(levelPwm(60, config), 255);
});

test('配置可覆盖阈值与档位，并拒绝非法值', () => {
  const config = parseConfig('ON_TEMP_C=60\nOFF_TEMP_C=48\nPOLL_SECONDS=10\nPWM_LEVELS=62:80,70:255\n');
  assert.equal(config.onTempC, 60);
  assert.equal(config.offTempC, 48);
  assert.equal(config.pollSeconds, 10);
  assert.deepEqual(config.levels, [{ belowC: 62, pwm: 80 }, { belowC: 70, pwm: 255 }]);
  assert.throws(() => parseConfig('ON_TEMP_C=45\nOFF_TEMP_C=50\n'), /OFF_TEMP_C/);
  assert.throws(() => parseConfig('POLL_SECONDS=0\n'), /POLL_SECONDS/);
  assert.throws(() => parseLevels('70:255,60:128'), /递增/);
  assert.throws(() => parseLevels('60:300'), /0-255/);
  assert.throws(() => parseLevels(''), /不能为空/);
});

test('hwmon 探测只认 pwmfan 设备', async () => {
  const root = await mkdtemp(join(tmpdir(), 'fan-control-hwmon-'));
  try {
    await mkdir(join(root, 'hwmon0'), { recursive: true });
    await writeFile(join(root, 'hwmon0/name'), 'soc_thermal\n');
    await mkdir(join(root, 'hwmon1'), { recursive: true });
    await writeFile(join(root, 'hwmon1/name'), 'pwmfan\n');
    await writeFile(join(root, 'hwmon1/pwm1'), '255\n');
    await writeFile(join(root, 'hwmon1/pwm1_enable'), '1\n');
    await mkdir(join(root, 'hwmon2'), { recursive: true });
    await writeFile(join(root, 'hwmon2/name'), 'pwmfan\n'); // 缺少 pwm1，应被跳过
    assert.equal(findPwmFan(root), join(root, 'hwmon1'));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('温度取所有热区的最大值并忽略其他节点', async () => {
  const root = await mkdtemp(join(tmpdir(), 'fan-control-thermal-'));
  try {
    await mkdir(join(root, 'thermal_zone0'), { recursive: true });
    await writeFile(join(root, 'thermal_zone0/temp'), '33200\n');
    await mkdir(join(root, 'thermal_zone1'), { recursive: true });
    await writeFile(join(root, 'thermal_zone1/temp'), '41500\n');
    await mkdir(join(root, 'cooling_device0'), { recursive: true });
    assert.equal(readMaxTempC(root), 41.5);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
