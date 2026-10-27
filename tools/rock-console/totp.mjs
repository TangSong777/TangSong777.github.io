/**
 * TOTP（RFC 6238）实现：与 Google Authenticator / Microsoft Authenticator 等
 * 通用验证器 App 兼容。密钥只存在于服务器与用户手机，不涉及任何外部服务。
 *
 * 算法：HMAC-SHA1、30 秒步长、6 位数字；校验时允许前后各一个步长的时间漂移。
 */
import { createHmac, randomBytes } from 'node:crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export const TOTP_STEP_SECONDS = 30;
export const TOTP_DIGITS = 6;

/** RFC 4648 base32 编码（无填充，验证器 App 通用格式）。 */
export function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

/** 解析 base32；忽略分隔符与大小写。 */
export function base32Decode(input) {
  const clean = String(input || '').replace(/[^A-Z2-7]/gi, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const output = [];
  for (const char of clean) {
    const index = ALPHABET.indexOf(char);
    if (index < 0) continue;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}

/** 生成 160 位随机密钥（base32 字符串）。 */
export function generateSecret(bytes = 20) {
  return base32Encode(randomBytes(bytes));
}

/** 计算某一时刻的 TOTP 数字串。 */
export function totp(secret, { now = Date.now(), step = TOTP_STEP_SECONDS, digits = TOTP_DIGITS } = {}) {
  const key = base32Decode(secret);
  if (key.length === 0) return '';
  const counter = Math.floor(now / 1000 / step);
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', key).update(buffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = ((digest[offset] & 0x7f) << 24)
    | (digest[offset + 1] << 16)
    | (digest[offset + 2] << 8)
    | digest[offset + 3];
  return String(binary % 10 ** digits).padStart(digits, '0');
}

/** 校验用户输入的验证码；允许前后一个时间步长的时钟漂移。 */
export function verifyTotp(secret, code, { now = Date.now(), window = 1 } = {}) {
  const normalized = String(code || '').replace(/\s+/g, '');
  if (!new RegExp(`^\\d{${TOTP_DIGITS}}$`).test(normalized)) return false;
  for (let offset = -window; offset <= window; offset += 1) {
    if (totp(secret, { now: now + offset * TOTP_STEP_SECONDS * 1000 }) === normalized) return true;
  }
  return false;
}

/** 生成 otpauth:// 链接，可直接在手机上打开或手动录入验证器。 */
export function otpAuthUri(secret, { issuer = 'Rock Console', account = 'radxa' } = {}) {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`;
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(TOTP_DIGITS),
    period: String(TOTP_STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
