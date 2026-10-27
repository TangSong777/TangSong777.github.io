/**
 * 采集工作线程。
 *
 * metrics.mjs 的 snapshot() 是同步的：每秒要读几十个 /proc 与 /sys 文件，
 * 每 5 秒还要 spawnSync 一次 systemctl 与 docker。放在主线程会阻塞事件循环，
 * 表现为 Web 终端输入一阵一阵卡顿（实测 6–27ms，慢命中 85–135ms）。
 *
 * 这里把采集整体搬进 worker_threads，主线程只接收已序列化的快照并广播。
 */
import { parentPort, workerData } from 'node:worker_threads';
import { createMetricsCollector } from './metrics.mjs';

const collector = createMetricsCollector({
  units: workerData?.units || [],
  mounts: workerData?.mounts || ['/'],
  includeDocker: workerData?.includeDocker !== false,
  slowTtlMs: Number(workerData?.slowTtlMs) || 5000,
});

const intervalMs = Math.min(10000, Math.max(250, Number(workerData?.intervalMs) || 1000));

function tick() {
  try {
    parentPort.postMessage({ type: 'snapshot', snapshot: collector.snapshot() });
  } catch (error) {
    parentPort.postMessage({ type: 'error', message: String(error?.message || error) });
  }
}

tick();
setInterval(tick, intervalMs);
