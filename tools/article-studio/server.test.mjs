import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateKeyPairSync, sign } from 'node:crypto';
import { normalizeArticlePath, resolveInside, safeSlug, scanSensitive, validateAndSanitizeImage, verifyAccessJwtWithKeys } from './server.mjs';

test('safeSlug 保留中文并清理路径字符', () => {
  assert.equal(safeSlug('  我的 / 文章?.md  '), '我的-文章-.md');
  assert.throws(() => safeSlug(' ../ '));
});

test('resolveInside 拒绝目录穿越', async () => {
  const root = await mkdtemp(join(tmpdir(), 'article-studio-'));
  try {
    assert.equal(resolveInside(root, 'notes/test.md', '.md'), join(root, 'notes', 'test.md'));
    assert.throws(() => resolveInside(root, '../secret.md', '.md'));
    assert.throws(() => resolveInside(root, 'test.txt', '.md'));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('文章工作台拒绝修改思源自动生成目录', () => {
  assert.throws(() => normalizeArticlePath('siyuan/笔记.md'));
  assert.throws(() => normalizeArticlePath('.hidden/文章.md'));
  assert.equal(normalizeArticlePath('随笔/文章.md'), '随笔/文章.md');
});

test('敏感信息分为阻断与提醒', async () => {
  const findings = await scanSensitive('邮箱 user@example.com\nsecret_key=abcdefghijklmnop\n地址 192.168.6.5');
  assert.ok(findings.some((item) => item.severity === 'block' && item.label === '疑似通用密钥'));
  assert.ok(findings.some((item) => item.severity === 'warning' && item.label === '电子邮箱'));
  assert.ok(findings.some((item) => item.severity === 'warning' && item.label === '私有 IPv4 地址'));
});

test('PNG 上传会移除文本元数据块', () => {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const chunk = (type, data = Buffer.alloc(0)) => {
    const output = Buffer.alloc(12 + data.length);
    output.writeUInt32BE(data.length, 0);
    output.write(type, 4, 'ascii');
    data.copy(output, 8);
    return output;
  };
  const image = Buffer.concat([signature, chunk('IHDR', Buffer.alloc(13)), chunk('tEXt', Buffer.from('Author\0Private')), chunk('IEND')]);
  const clean = validateAndSanitizeImage(image, 'image/png');
  assert.equal(clean.includes(Buffer.from('tEXt')), false);
  assert.equal(clean.includes(Buffer.from('IEND')), true);
});

test('Cloudflare Access JWT 同时校验签名、AUD 和邮箱', () => {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const kid = 'test-key';
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const header = encode({ alg: 'RS256', kid });
  const payload = encode({
    iss: 'https://example.cloudflareaccess.com', aud: ['article-studio'],
    email: 'owner@example.com', sub: 'user-1', exp: 2_000_000_000,
  });
  const signature = sign('RSA-SHA256', Buffer.from(`${header}.${payload}`), privateKey).toString('base64url');
  const token = `${header}.${payload}.${signature}`;
  const keys = [{ ...publicKey.export({ format: 'jwk' }), kid }];
  const config = {
    issuer: 'https://example.cloudflareaccess.com', audience: 'article-studio',
    emails: new Set(['owner@example.com']), now: 1_900_000_000,
  };
  assert.equal(verifyAccessJwtWithKeys(token, keys, config).email, 'owner@example.com');
  assert.throws(() => verifyAccessJwtWithKeys(token, keys, { ...config, audience: 'wrong' }));
  assert.throws(() => verifyAccessJwtWithKeys(token, keys, { ...config, emails: new Set(['other@example.com']) }));
});
