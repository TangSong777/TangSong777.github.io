import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, createHmac, scryptSync } from 'node:crypto';

import {
  SESSION_COOKIE,
  clientKey,
  createLoginLimiter,
  createSessionToken,
  hashPassword,
  isSameOriginRequest,
  isSecureRequest,
  parseCookies,
  sessionCookie,
  verifyPassword,
  verifySessionToken,
} from './auth.mjs';

/* -------------------------------------------------------------- 口令 */

test('hashPassword / verifyPassword 往返成功', () => {
  const hash = hashPassword('correct horse battery staple');
  assert.match(hash, /^scrypt\$[a-f0-9]{64}\$[a-f0-9]{128}$/);
  assert.equal(verifyPassword('correct horse battery staple', hash), true);
});

test('verifyPassword 拒绝错误口令与畸形哈希', () => {
  const hash = hashPassword('right-password');
  assert.equal(verifyPassword('wrong-password', hash), false);
  assert.equal(verifyPassword('', hash), false);
  assert.equal(verifyPassword('right-password', ''), false);
  assert.equal(verifyPassword('right-password', 'scrypt$zz$zz'), false);
  assert.equal(verifyPassword('right-password', 'plaintext'), false);
  assert.equal(verifyPassword('x', 'scrypt$' + 'a'.repeat(64) + '$' + 'b'.repeat(127)), false);
});

test('相同口令每次散列结果不同（salt 随机）', () => {
  assert.notEqual(hashPassword('same'), hashPassword('same'));
});

test('verifyPassword 接受 article-studio 生成的历史格式', () => {
  // 模拟既有部署：salt 为 32 字节 hex，派生值 64 字节 hex
  const salt = randomBytes(32);
  const derived = scryptSync('legacy-pass', salt, 64).toString('hex');
  assert.equal(verifyPassword('legacy-pass', `scrypt$${salt.toString('hex')}$${derived}`), true);
});

/* ------------------------------------------------------------ 会话票据 */

test('会话票据可验证、可解出过期时间', () => {
  const secret = randomBytes(32).toString('base64url');
  const now = Date.now();
  const token = createSessionToken(secret, 3600, now);
  const payload = verifySessionToken(token, secret, now + 1000);
  assert.ok(payload);
  assert.equal(payload.exp, Math.floor(now / 1000) + 3600);
});

test('过期票据被拒绝', () => {
  const secret = 'x'.repeat(40);
  const token = createSessionToken(secret, 60, Date.now() - 120_000);
  assert.equal(verifySessionToken(token, secret), null);
});

test('篡改载荷或签名被拒绝', () => {
  const secret = 'y'.repeat(40);
  const token = createSessionToken(secret, 600);
  const [payload, signature] = token.split('.');

  const forgedPayload = Buffer.from(JSON.stringify({ exp: 9999999999, nonce: 'x' })).toString('base64url');
  assert.equal(verifySessionToken(`${forgedPayload}.${signature}`, secret), null);
  assert.equal(verifySessionToken(`${payload}.${Buffer.from('nope').toString('base64url')}`, secret), null);
  assert.equal(verifySessionToken(token, 'z'.repeat(40)), null);
  assert.equal(verifySessionToken('', secret), null);
  assert.equal(verifySessionToken(token, ''), null);
});

test('签名比较对长度不匹配的输入保持安全', () => {
  const secret = 'k'.repeat(40);
  const token = createSessionToken(secret, 600);
  const [, signature] = token.split('.');
  const shortSig = signature.slice(0, 10);
  assert.equal(verifySessionToken(`abc.${shortSig}`, secret), null);
});

/* --------------------------------------------------------------- Cookie */

test('parseCookies 解析常规 Cookie 并忽略畸形项', () => {
  const cookies = parseCookies(`${SESSION_COOKIE}=abc%2Edef; other=1; broken; =novalue`);
  assert.equal(cookies.get(SESSION_COOKIE), 'abc.def');
  assert.equal(cookies.get('other'), '1');
  assert.equal(cookies.has('broken'), false);
});

test('sessionCookie 属性完整且 https 下带 Secure', () => {
  const insecure = sessionCookie('tok', { maxAge: 100, secure: false });
  assert.match(insecure, /^rock_console_session=tok; Max-Age=100; Path=\/; HttpOnly; SameSite=Lax$/);
  assert.ok(!insecure.includes('Secure'));

  const secure = sessionCookie('tok', { maxAge: 100, secure: true });
  assert.ok(secure.includes('Secure'));
});

test('sessionCookie 对退出清理使用 Max-Age=0', () => {
  assert.ok(sessionCookie('', { maxAge: 0, secure: true }).includes('Max-Age=0'));
  assert.ok(sessionCookie('', { maxAge: -5, secure: true }).includes('Max-Age=0'));
});

/* ------------------------------------------------------- 同源与 HTTPS */

test('isSameOriginRequest 只接受同源请求', () => {
  assert.equal(isSameOriginRequest({ headers: { host: 'server.yanghanlin.cn', origin: 'https://server.yanghanlin.cn' } }), true);
  assert.equal(isSameOriginRequest({ headers: { host: 'server.yanghanlin.cn' } }), true);
  assert.equal(isSameOriginRequest({ headers: { host: 'server.yanghanlin.cn', origin: 'https://evil.example' } }), false);
  assert.equal(isSameOriginRequest({ headers: { host: 'server.yanghanlin.cn', origin: 'not-a-url' } }), false);
  assert.equal(isSameOriginRequest({ headers: { host: 'a', origin: 'https://a', 'sec-fetch-site': 'cross-site' } }), false);
  assert.equal(isSameOriginRequest({ headers: { host: 'a', origin: 'https://a', 'sec-fetch-site': 'none' } }), true);
});

test('isSecureRequest 识别 Cloudflare 的两种标记', () => {
  assert.equal(isSecureRequest({ headers: { 'x-forwarded-proto': 'https' } }), true);
  assert.equal(isSecureRequest({ headers: { 'x-forwarded-proto': 'http' } }), false);
  assert.equal(isSecureRequest({ headers: { 'cf-visitor': '{"scheme":"https"}' } }), true);
  assert.equal(isSecureRequest({ headers: {} }), false);
});

/* ------------------------------------------------------------ 登录限流 */

test('登录限流在达到阈值后锁定，成功后清零', () => {
  const limiter = createLoginLimiter({ maxAttempts: 3, windowMs: 60_000, lockMs: 60_000 });
  const now = 1_000_000;

  assert.equal(limiter.check('1.2.3.4', now).allowed, true);
  limiter.recordFailure('1.2.3.4', now);
  limiter.recordFailure('1.2.3.4', now);
  assert.equal(limiter.check('1.2.3.4', now).allowed, true);

  limiter.recordFailure('1.2.3.4', now);
  const locked = limiter.check('1.2.3.4', now);
  assert.equal(locked.allowed, false);
  assert.equal(locked.retryAfterSeconds, 60);
  assert.equal(limiter.check('1.2.3.4', now + 61_000).allowed, true);

  limiter.recordSuccess('1.2.3.4');
  assert.equal(limiter.size, 0);
});

test('登录限流按来源隔离，且 prune 回收过期记录', () => {
  const limiter = createLoginLimiter({ maxAttempts: 2, windowMs: 1000, lockMs: 1000 });
  limiter.recordFailure('a', 0);
  limiter.recordFailure('a', 0);
  assert.equal(limiter.check('a', 0).allowed, false);
  assert.equal(limiter.check('b', 0).allowed, true);
  assert.equal(limiter.prune(10_000), 1);
  assert.equal(limiter.size, 0);
});

/* ------------------------------------------------------------ 来源标识 */

test('clientKey 优先使用 Cloudflare 提供的真实客户端地址', () => {
  assert.equal(clientKey({ headers: { 'cf-connecting-ip': '203.0.113.9' }, socket: { remoteAddress: '127.0.0.1' } }), '203.0.113.9');
  assert.equal(clientKey({ headers: { 'x-forwarded-for': '198.51.100.7, 10.0.0.1' }, socket: {} }), '198.51.100.7');
  assert.equal(clientKey({ headers: {}, socket: { remoteAddress: '127.0.0.1' } }), '127.0.0.1');
  assert.equal(clientKey({ headers: {}, socket: {} }), 'unknown');
});

test('createSessionToken 缺少密钥时明确报错', () => {
  assert.throws(() => createSessionToken('', 60), /会话密钥/);
});

test('手工构造的有效签名可以通过验证（防止实现被意外改坏）', () => {
  const secret = 's'.repeat(40);
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 600 })).toString('base64url');
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  assert.ok(verifySessionToken(`${payload}.${signature}`, secret));
});
