import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';

// All publishing/refresh entry points share this kernel-managed Linux lock.
// flock releases the lock when the command exits, including crashes/reboots.
export async function withRepositoryLock(action) {
  if (process.platform !== 'linux') throw new Error('此工具仅在 Rock Linux 上运行');
  if (process.env.SIYUAN_TASK_LOCK_HELD === '1') return action();
  await fs.mkdir('/srv/blog/locks',{recursive:true,mode:0o700});
  const status = await new Promise((resolve,reject) => {
    const child = spawn('flock',['--exclusive','--nonblock','--conflict-exit-code','75',
      '/srv/blog/locks/publish.lock',process.execPath,...process.argv.slice(1)],{
      stdio:'inherit', env:{...process.env,SIYUAN_TASK_LOCK_HELD:'1'},
    });
    child.once('error',reject);
    child.once('exit',(code)=>resolve(code ?? 1));
  });
  if (status === 75) console.error('[忙碌] 已有刷新或发布任务，稍后再试');
  process.exitCode = status;
}
