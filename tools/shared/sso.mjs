/**
 * 跨子域单点登录（SSO）票据。
 *
 * server.yanghanlin.cn 与 editor.yanghanlin.cn 共享同一个 YANGHANLIN_SSO_SECRET，
 * 票据放在 Domain=.yanghanlin.cn 的 HttpOnly Cookie 里。任一站点登录成功后签发，
 * 另一个站点可以直接验证它，因此无需再次输入密码和动态验证码。
 *
 * 注意：Cookie 带 Domain 后会被浏览器发送给 yanghanlin.cn 的所有子域（包括
 * blogs）。它带 HttpOnly，页面脚本读不到；blogs 是静态站，不会记录请求头。
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const SSO_COOKIE = 'yanghanlin_sso';

export function createSsoToken(secret, maxAgeSeconds, now = Date.now(), sub = 'radxa') {
  if (!secret) throw new Error('缺少 SSO 密钥');
  const issuedAt = Math.floor(now / 1000);
  const payload = Buffer.from(JSON.stringify({
    sub,
    iat: issuedAt,
    exp: issuedAt + maxAgeSeconds,
    nonce: randomBytes(12).toString('base64url'),
  })).toString('base64url');
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function verifySsoToken(token, secret, now = Date.now()) {
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

/** 只有访问 *.yanghanlin.cn 时才加 Domain；本地回环调试不加，否则 Cookie 不会被保存。 */
export function ssoCookieDomain(host) {
  const value = String(host || '').toLowerCase().split(':')[0];
  return value === 'yanghanlin.cn' || value.endsWith('.yanghanlin.cn') ? '.yanghanlin.cn' : '';
}

export function ssoCookie(token, { maxAge, secure = true, host = '' } = {}) {
  const parts = [
    `${SSO_COOKIE}=${encodeURIComponent(token)}`,
    `Max-Age=${Math.max(0, Math.floor(maxAge))}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
  ];
  const domain = ssoCookieDomain(host);
  if (domain) parts.push(`Domain=${domain}`);
  if (secure) parts.push('Secure');
  return parts.join('; ');
}
