#!/usr/bin/env node
/**
 * 生成 rock-console 的密码派生值与会话密钥。
 *
 * 用法（在交互式终端中运行，密码不会回显、不进入 shell 历史、不写入日志）：
 *   node hash-password.mjs
 *
 * 输出两行 KEY=VALUE，交给 install-rock-console.sh 写入
 * /srv/blog/config/rock-console.env（权限 600）。
 */
import { randomBytes } from 'node:crypto';
import { hashPassword } from './auth.mjs';

const MIN_LENGTH = 12;

/** 关闭回显读取一行输入；Ctrl-C 退出，退格可用。 */
function promptHidden(question) {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    if (!stdin.isTTY) {
      reject(new Error('本命令需要在交互式终端中运行（stdin 不是 TTY）。'));
      return;
    }
    process.stderr.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    let value = '';
    const cleanup = () => {
      stdin.removeListener('data', onData);
      stdin.setRawMode(false);
      stdin.pause();
      process.stderr.write('\n');
    };
    const onData = (chunk) => {
      for (const char of chunk) {
        if (char === '\r' || char === '\n' || char === '\u0004') {
          cleanup();
          resolve(value);
          return;
        }
        if (char === '\u0003') {
          cleanup();
          process.stderr.write('已取消。\n');
          process.exit(130);
        }
        if (char === '\u007f' || char === '\b') {
          value = value.slice(0, -1);
          continue;
        }
        if (char >= ' ') value += char;
      }
    };
    stdin.on('data', onData);
  });
}

const password = await promptHidden(`请设置 rock-console 访问密码（至少 ${MIN_LENGTH} 位）：`);
if (password.length < MIN_LENGTH) {
  process.stderr.write(`密码太短，至少需要 ${MIN_LENGTH} 位。\n`);
  process.exit(1);
}
const confirmation = await promptHidden('请再次输入以确认：');
if (password !== confirmation) {
  process.stderr.write('两次输入不一致。\n');
  process.exit(1);
}

process.stdout.write(`ROCK_CONSOLE_PASSWORD_HASH=${hashPassword(password)}\n`);
process.stdout.write(`ROCK_CONSOLE_SESSION_SECRET=${randomBytes(32).toString('base64url')}\n`);
process.stderr.write('\n已生成。请把上面两行写入 /srv/blog/config/rock-console.env 并设置权限 600。\n');
