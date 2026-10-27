#!/usr/bin/env node
/**
 * 为 rock-console 启用 TOTP 双因素：生成密钥并写入配置文件。
 *
 * 用法：node setup-totp.mjs
 * 运行后把输出的 otpauth 链接在手机验证器里打开（或手动输入密钥），
 * 然后 sudo systemctl restart rock-console。
 *
 * 密钥会打印在终端里，只应出现在你自己面前；不要截图外传。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { generateSecret, otpAuthUri, totp } from './totp.mjs';

const configPath = '/srv/blog/config/rock-console.env';
const text = readFileSync(configPath, 'utf8');

if (/^ROCK_CONSOLE_TOTP_SECRET=.+/m.test(text)) {
  console.error('配置里已经有 TOTP 密钥了。');
  console.error('要重新生成：先手动删除 ROCK_CONSOLE_TOTP_SECRET 那一行，再运行本脚本。');
  process.exit(1);
}

const secret = generateSecret();
const updated = `${text.trimEnd()}\nROCK_CONSOLE_TOTP_SECRET=${secret}\n`;
writeFileSync(configPath, updated, { mode: 0o600 });

console.log('');
console.log('已写入 ' + configPath);
console.log('');
console.log('在手机验证器 App 里添加这个账户（打开链接或手动输入密钥）：');
console.log('');
console.log(otpAuthUri(secret));
console.log('');
console.log('密钥：' + secret);
console.log('当前验证码（用于核对）：' + totp(secret));
console.log('');
console.log('然后重启服务：sudo systemctl restart rock-console');
console.log('');
console.log('提醒：这个密钥等于第二因素本身。换手机前先保存它，否则只能登录服务器删除该配置行恢复单因素。');
