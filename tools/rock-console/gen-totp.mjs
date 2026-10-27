#!/usr/bin/env node
/**
 * 生成 rock-console 的 TOTP 密钥。
 *
 * 用法：node gen-totp.mjs
 * 输出一行 ROCK_CONSOLE_TOTP_SECRET=... 和一条 otpauth:// 链接。
 * 把密钥行写入配置后重启服务，再用手机验证器扫描/录入链接。
 */
import { generateSecret, otpAuthUri, totp } from './totp.mjs';

const secret = generateSecret();
const uri = otpAuthUri(secret);

console.log('');
console.log('把下面这一行追加到 /srv/blog/config/rock-console.env：');
console.log('');
console.log(`ROCK_CONSOLE_TOTP_SECRET=${secret}`);
console.log('');
console.log('重启服务：sudo systemctl restart rock-console');
console.log('');
console.log('在手机验证器 App 里手动输入密钥，或打开这个链接：');
console.log('');
console.log(uri);
console.log('');
console.log(`当前验证码（用于确认配置是否正确）：${totp(secret)}`);
console.log('');
console.log('注意：密钥等于第二因素本身，不要截图外传；换手机前先保留它。');
