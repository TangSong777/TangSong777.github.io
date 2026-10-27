#!/usr/bin/env node
/**
 * 重置全站共享的 TOTP 密钥（两站共用），账户名为 Rock5b+。
 *
 * 用法：node reset-totp.mjs
 * 运行后按输出的链接/密钥在手机验证器里添加「Rock5b+」，
 * 然后 sudo systemctl restart rock-console article-studio。
 *
 * 旧账户会立即失效；密钥只打印在终端里，不要截图外传。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { generateSecret, otpAuthUri, totp } from './totp.mjs';

const path = '/srv/blog/config/sso.env';
const text = readFileSync(path, 'utf8');
const secret = generateSecret();

let updated;
if (/^YANGHANLIN_TOTP_SECRET=.*$/m.test(text)) {
  updated = text.replace(/^YANGHANLIN_TOTP_SECRET=.*$/m, `YANGHANLIN_TOTP_SECRET=${secret}`);
} else {
  updated = `${text.trimEnd()}\nYANGHANLIN_TOTP_SECRET=${secret}\n`;
}
writeFileSync(path, updated, { mode: 0o600 });

const uri = otpAuthUri(secret, { issuer: 'Rock5b+', account: 'radxa' });

console.log('');
console.log('已重置共享 TOTP 密钥：' + path);
console.log('');
console.log('在手机验证器里添加账户「Rock5b+」，可以用这个链接：');
console.log('');
console.log(uri);
console.log('');
console.log('密钥（手动输入时用）：' + secret);
console.log('当前验证码（核对用）：' + totp(secret));
console.log('');
console.log('然后重启两站：');
console.log('  sudo systemctl restart rock-console article-studio');
console.log('');
console.log('如果之后加错了验证码进不去，删除共享密钥即可退回单密码：');
console.log("  sudo sed -i '/^YANGHANLIN_TOTP_SECRET=/d' /srv/blog/config/sso.env");
console.log('  sudo systemctl restart rock-console article-studio');
