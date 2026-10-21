#!/usr/bin/env node
// 隐私规则保存后的自动重发布：重新导入笔记、构建、校验、提交并推送生成目录。
// 只触碰生成目录（source/siyuan、source/images/siyuan、source/js/siyuan-data.js），
// 不会提交仓库中的其他改动。
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { withRepositoryLock } from './siyuan-task-lock.mjs';

const repo = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const generated = ['source/siyuan', 'source/images/siyuan', 'source/js/siyuan-data.js'];

function run(command, args, env = process.env) {
  const result = spawnSync(command, args, { cwd: repo, stdio: 'inherit', env });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} 退出码 ${result.status}`);
}

const gitEnv = {
  ...process.env,
  GIT_SSH_COMMAND:
    `ssh -i ${process.env.HOME}/.ssh/id_ed25519_blog_publish -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new`,
};

await withRepositoryLock(async () => {
  run(process.execPath, ['tools/import-siyuan-notes.mjs']);
  run('npm', ['run', 'clean']);
  run('npm', ['run', 'build']);
  run(process.execPath, ['tools/check-siyuan-knowledge-base.mjs', '--require-public']);

  run('git', ['add', '-A', ...generated]);
  const status = spawnSync('git', ['status', '--porcelain', '--', ...generated], {
    cwd: repo,
    encoding: 'utf8',
  });
  if (!String(status.stdout || '').trim()) {
    console.log('[发布] 生成目录没有变化，无需提交');
    return;
  }

  run('git', [
    '-c', 'user.name=YangHanLin',
    '-c', 'user.email=tangsong777@users.noreply.github.com',
    'commit', '-m', 'docs(notes): 按隐私规则更新公开笔记',
    '--', ...generated,
  ]);
  run('git', ['push', 'origin', 'main'], gitEnv);
  console.log('[发布] 已提交并推送，GitHub Actions 将继续部署');
});

console.log('[完成] 隐私规则重发布结束');
