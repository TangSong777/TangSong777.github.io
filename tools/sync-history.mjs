#!/usr/bin/env node
/**
 * 同步《岁月史书》独立站点：导出 → 导入 → 生成。
 * 由 publish-siyuan-notes.mjs 在每次定时发布末尾调用，也可单独运行。
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const repo = '/srv/blog/repo';
const historySite = '/srv/blog/history-site';

async function step(label, args, timeout) {
  process.stdout.write(`[岁月史书] ${label}... `);
  await run(process.execPath, args, { timeout, maxBuffer: 32 * 1024 * 1024 });
  console.log('完成');
}

await step('导出', [`${repo}/tools/export-history.mjs`], 600_000);
await step('导入', [
  `${repo}/tools/import-siyuan-notes.mjs`,
  '--blog', historySite,
  '--source', '/srv/blog/history-source',
  '--notebook-title', '岁月史书',
  '--privacy-rules', `${historySite}/.none.json`,
], 600_000);
await step('生成', [`${repo}/tools/generate-history.mjs`], 600_000);

console.log('[岁月史书] 同步完成');
