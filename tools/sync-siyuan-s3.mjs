#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { createClient } from './export-siyuan-notebook.mjs';

const logPath = '/srv/siyuan/workspace/temp/siyuan.log';

// SiYuan 3.8.1 performSync returns code=0 even for a failed download.
// Require its fresh completion log AFTER post-processing, not just HTTP 200.
// The source adapter is pinned to 3.8.1 in createClient().
export async function syncFromS3() {
  const {api,config} = await createClient();
  if (!config.sync?.enabled || config.sync.provider !== 2 || config.sync.mode !== 3) {
    throw new Error('Rock 必须启用 S3，且同步模式必须为“完全手动”(3)');
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    const before = await fs.stat(logPath);
    const start = Date.now();
    console.log('[同步] 从 S3 下载；等待思源完成索引和后处理');
    await api('/api/sync/performSync',{upload:false},20 * 60 * 1000);
    const after = await fs.stat(logPath);
    if (before.ino !== after.ino || after.size < before.size || after.size - before.size > 16 * 1024 ** 2) {
      throw new Error('同步期间日志轮转或日志量异常，无法确认结果；本次停止发布');
    }
    const handle = await fs.open(logPath,'r');
    let delta;
    try {
      const buffer = Buffer.alloc(after.size - before.size);
      await handle.read(buffer,0,buffer.length,before.size);
      delta = buffer.toString('utf8');
    } finally { await handle.close(); }
    const success = delta.lastIndexOf('download data repo phases [');
    const failed = delta.lastIndexOf('sync data repo download failed:');
    if (success >= 0 && success > failed) {
      const info = await api('/api/sync/getSyncInfo');
      if (!Number.isFinite(info.synced) || info.synced < start) throw new Error('同步完成时间未更新，停止发布');
      const conflictCounts = [...delta.matchAll(/conflicts=(\d+)/g)].map(m=>Number(m[1]));
      if (conflictCounts.some(n=>n>0)) throw new Error('本次同步出现冲突，请先在思源中检查；停止发布');
      console.log('[同步完成] 已收到本次下载及后处理完成证据');
      return {synced:info.synced,completedAt:new Date().toISOString()};
    }
    if (failed >= 0 || /sync repo failed:|sync data repo .*failed:/i.test(delta)) {
      throw new Error('S3 下载失败；详细原因请在思源设置中查看（避免日志泄露凭据）');
    }
    // The kernel deduplicates the same remote snapshot for one minute.
    // Retry only a completed request with no completion evidence, never a timed-out request.
    if (attempt === 0) {
      console.log('[同步] 本次可能被一分钟去重窗口合并；65 秒后重新确认');
      await delay(65000);
    }
  }
  throw new Error('没有得到本次 S3 下载成功证据，停止导出与发布');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  syncFromS3().catch(e=>{console.error(`[同步失败] ${e.message}`);process.exitCode=1;});
}
