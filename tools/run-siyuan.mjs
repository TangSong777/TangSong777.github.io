#!/usr/bin/env node

import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { withRepositoryLock } from './siyuan-task-lock.mjs';

const toolsDir = path.dirname(fileURLToPath(import.meta.url));
const blogDir = path.dirname(toolsDir);
const mode = process.argv[2] ?? 'check';
const node = process.execPath;
const npm = 'npm';

function run(command, args) {
  const result = spawnSync(command, args, { cwd: blogDir, stdio: 'inherit' });
  if (result.error) {
    console.error(`无法启动 ${command}：${result.error.message}`);
    process.exit(result.error.code === 'ENOENT' ? 127 : 1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}

async function main() {
  if (!['check', 'dry-run', 'refresh'].includes(mode)) {
    console.error('用法：node tools/run-siyuan.mjs check|dry-run|refresh');
    process.exitCode = 2;
    return;
  }
  if (mode === 'dry-run') {
    run(node, [path.join(toolsDir, 'import-siyuan-notes.mjs'), '--dry-run']);
    return;
  }
  if (mode === 'check') {
    run(node, [path.join(toolsDir, 'check-siyuan-knowledge-base.mjs'), '--require-public']);
    return;
  }

  await withRepositoryLock(async () => {
    run(node, [path.join(toolsDir, 'import-siyuan-notes.mjs')]);
    run(npm, ['run', 'clean']);
    run(npm, ['run', 'build']);
    run(node, [path.join(toolsDir, 'check-siyuan-knowledge-base.mjs'), '--require-public']);
  });
}

main().catch((error) => {
  console.error(`[失败] ${error.stack || error.message}`);
  process.exitCode = 1;
});
