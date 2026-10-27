/**
 * rock-console 认证模块。
 *
 * 安全模型与 /srv/blog/repo/tools/article-studio/server.mjs 保持一致：
 *   - 口令只以 scrypt 派生值（scrypt$salt$hash）存在于 root/radxa 可读的 EnvironmentFile 中；
 *   - 登录成功后签发 HMAC-SHA256 无状态会话票据，放进 HttpOnly + SameSite=Lax Cookie；
 *   - 状态变更请求要求同源 + CSRF 令牌（双重提交）；
 *   - 同一来源连续失败达到阈值后临时锁定。
 *
 * 本模块不读取任何环境变量、不写日志，纯函数便于单元测试。
 */
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE = 'rock_console_session';

const SCRYPT_KEYLEN = 64;
const HEX_128 = /^[a-f0-9]{128}$/i;
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

/** 解析 Cookie 头为 Map，忽略畸形项而不是抛错。 */
export function parseCookies(header) {
  const cookies = new Map();
  for (const part of String(header || '').split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const name = part.slice(0, index).trim();
    if (!name) continue;
    const raw = part.slice(index + 1).trim();
    try {
      cookies.set(name, decodeURIComponent(raw));
    } catch {
      cookies.set(name, raw);
    }
  }
  return cookies;
}

/** 生成可与 verifyPassword 对照的口令派生值；salt 缺省为 32 字节随机数。 */
export function hashPassword(password, salt = randomBytes(32)) {
  if (!Buffer.isBuffer(salt) || salt.length < 16) throw new Error('salt 必须是至少 16 字节的 Buffer');
  const derived = scryptSync(String(password), salt, SCRYPT_KEYLEN, SCRYPT_OPTIONS);
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}

/** 常数时间校验口令；格式非法、口令为空或类型不符一律返回 false。 */
export function verifyPassword(password, passwordHash) {
  const parts = String(passwordHash || '').split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, saltHex, expectedHex] = parts;
  if (!/^[a-f0-9]{32,}$/i.test(saltHex) || !HEX_128.test(expectedHex)) return false;
  let actual;
  try {
    actual = scryptSync(String(password ?? ''), Buffer.from(saltHex, 'hex'), SCRYPT_KEYLEN, SCRYPT_OPTIONS);
  } catch {
    return false;
  }
  const expected = Buffer.from(expectedHex, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** 签发会话票据：base64url(payload).base64url(HMAC)。 */
export function createSessionToken(secret, maxAgeSeconds, now = Date.now()) {
  if (!secret) throw new Error('缺少会话密钥');
  const issuedAt = Math.floor(now / 1000);
  const payload = Buffer.from(JSON.stringify({
    iat: issuedAt,
    exp: issuedAt + maxAgeSeconds,
    nonce: randomBytes(24).toString('base64url'),
  })).toString('base64url');
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

/** 校验会话票据：签名必须匹配且未过期，否则返回 null。 */
export function verifySessionToken(token, secret, now = Date.now()) {
  const [payload, signature] = String(token || '').split('.');
  if (!payload || !signature || !secret) return null;
  const expected = createHmac('sha256', secret).update(payload).digest();
  let supplied;
  try {
    supplied = Buffer.from(signature, 'base64url');
  } catch {
    return null;
  }
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!Number.isFinite(data?.exp) || data.exp < Math.floor(now / 1000)) return null;
    return data;
  } catch {
    return null;
  }
}

/** 判断请求是否经由 HTTPS 到达（Cloudflare 会带上这两个头之一）。 */
export function isSecureRequest(req) {
  const proto = String(req?.headers?.['x-forwarded-proto'] || '').toLowerCase();
  if (proto.split(',')[0].trim() === 'https') return true;
  try {
    return JSON.parse(String(req?.headers?.['cf-visitor'] || '{}')).scheme === 'https';
  } catch {
    return false;
  }
}

/** 构造会话 Cookie；只有确认走 HTTPS 时才加 Secure，避免本地 http 调试时丢 Cookie。 */
export function sessionCookie(token, { maxAge, secure }) {
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    `Max-Age=${Math.max(0, Math.floor(maxAge))}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

/**
 * 同源校验：用于所有非 GET 请求，配合 CSRF 令牌阻止跨站发起的操作。
 * Origin 与 Host 必须一致；带 Sec-Fetch-Site 时只接受 same-origin / none。
 */
export function isSameOriginRequest(req) {
  const host = String(req?.headers?.host || '');
  const origin = req?.headers?.origin;
  if (origin) {
    let originHost;
    try {
      originHost = new URL(String(origin)).host;
    } catch {
      return false;
    }
    if (!host || originHost !== host) return false;
  }
  const site = String(req?.headers?.['sec-fetch-site'] || '').toLowerCase();
  if (site && site !== 'same-origin' && site !== 'none') return false;
  return true;
}

/**
 * 登录失败限流：同一来源在 windowMs 内失败 maxAttempts 次后锁定，直到 lockUntil。
 * 成功登录清除计数；过期记录在 prune 时回收，避免 Map 无限增长。
 */
export function createLoginLimiter({ maxAttempts = 8, windowMs = 15 * 60 * 1000, lockMs = 15 * 60 * 1000 } = {}) {
  const attempts = new Map();

  function entry(key, now) {
    const current = attempts.get(key);
    if (!current || current.resetAt <= now) {
      const fresh = { count: 0, resetAt: now + windowMs, lockedUntil: 0 };
      attempts.set(key, fresh);
      return fresh;
    }
    return current;
  }

  return {
    /** 返回 { allowed, retryAfterSeconds }。 */
    check(key, now = Date.now()) {
      const record = attempts.get(key);
      if (!record) return { allowed: true, retryAfterSeconds: 0 };
      if (record.lockedUntil > now) {
        return { allowed: false, retryAfterSeconds: Math.ceil((record.lockedUntil - now) / 1000) };
      }
      if (record.resetAt <= now) return { allowed: true, retryAfterSeconds: 0 };
      return { allowed: true, retryAfterSeconds: 0 };
    },
    recordFailure(key, now = Date.now()) {
      const record = entry(key, now);
      record.count += 1;
      if (record.count >= maxAttempts) record.lockedUntil = now + lockMs;
      return record;
    },
    recordSuccess(key) {
      attempts.delete(key);
    },
    /** 清理已过期记录，返回清除条数。 */
    prune(now = Date.now()) {
      let removed = 0;
      for (const [key, record] of attempts) {
        if (record.resetAt <= now && record.lockedUntil <= now) {
          attempts.delete(key);
          removed += 1;
        }
      }
      return removed;
    },
    get size() {
      return attempts.size;
    },
  };
}

/**
 * 取得用于限流的来源标识。经 Cloudflare Tunnel 到达时 socket 地址恒为回环，
 * 因此优先采用 CF-Connecting-IP；否则退回 socket 地址。
 */
export function clientKey(req) {
  const cf = String(req?.headers?.['cf-connecting-ip'] || '').trim();
  if (cf) return cf.slice(0, 64);
  const forwarded = String(req?.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
  if (forwarded) return forwarded.slice(0, 64);
  return String(req?.socket?.remoteAddress || 'unknown');
}
