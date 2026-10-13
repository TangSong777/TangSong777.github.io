import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { generateKeyPairSync, sign } from 'node:crypto';
import { normalizeArticlePath, normalizeAutoSaveMinutes, normalizeSiyuanPrivacyRules, parseGitPaths, repositoryLocalBlockers, repositorySnapshotBlockers, resolveInside, safeSlug, scanSensitive, validateAndSanitizeImage, verifyAccessJwtWithKeys } from './server.mjs';

test('自动保存间隔只接受合理的整数分钟', () => {
  assert.equal(normalizeAutoSaveMinutes(3), 3);
  assert.equal(normalizeAutoSaveMinutes('30'), 30);
  assert.throws(() => normalizeAutoSaveMinutes(0));
  assert.throws(() => normalizeAutoSaveMinutes(1.5));
  assert.throws(() => normalizeAutoSaveMinutes(1441));
});

test('思源隐私规则去空、去重并拒绝过短隐私词', () => {
  assert.deepEqual(normalizeSiyuanPrivacyRules({
    excludedDocuments: [' 网络/路由器.md ', '网络\\路由器.md'],
    privateValues: ['192.168.1.1', '192.168.1.1', 'abc'],
  }), { excludedDocuments: ['网络/路由器.md'], privateValues: ['192.168.1.1'] });
});

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

const articleRepository = {
  branch: 'main',
  origin: 'git@github.com:TangSong777/TangSong777.github.io.git',
  pushUrls: ['git@github.com:TangSong777/TangSong777.github.io.git'],
  hasIdentity: true,
  behind: 0,
  ahead: 0,
};

test('仓库中与本次文章无关的改动不再阻断上传', () => {
  assert.equal(repositorySnapshotBlockers(articleRepository), '');
  // 同步状态尚未计算时只做本地检查。
  assert.equal(repositorySnapshotBlockers({ ...articleRepository, behind: null, ahead: null }), '');
});

test('工作区存在无关改动（含已暂存内容）时本地检查不再阻断上传', async () => {
  const root = await mkdtemp(join(tmpdir(), 'article-studio-local-'));
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
  try {
    git('init', '--quiet', '-b', 'main');
    git('config', 'user.name', 'Test');
    git('config', 'user.email', 'test@example.invalid');
    git('remote', 'add', 'origin', 'git@github.com:TangSong777/TangSong777.github.io.git');
    await writeFile(join(root, 'article.md'), '# 初稿\n');
    git('add', '--', '.');
    git('commit', '--quiet', '-m', 'init');

    // 工作台之外：已跟踪文件被改动并已暂存，另外还有一个未跟踪文件。
    await writeFile(join(root, 'article.md'), '# 更新\n');
    await writeFile(join(root, 'notes.txt'), 'untracked\n');
    git('add', '--', 'article.md');

    const { local, blocker } = await repositoryLocalBlockers(root);
    assert.equal(local.branch, 'main');
    assert.equal(local.origin, 'git@github.com:TangSong777/TangSong777.github.io.git');
    assert.equal(blocker, '');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('发布前仍会阻断错误分支、未授权远端、缺失身份与同步异常', () => {
  assert.match(repositorySnapshotBlockers({ ...articleRepository, branch: 'dev' }), /main 分支/);
  assert.match(repositorySnapshotBlockers({ ...articleRepository, origin: 'git@github.com:someone/other.git' }), /授权/);
  assert.match(repositorySnapshotBlockers({ ...articleRepository, pushUrls: [] }), /授权/);
  assert.match(repositorySnapshotBlockers({ ...articleRepository, hasIdentity: false }), /提交身份/);
  assert.match(repositorySnapshotBlockers({ ...articleRepository, behind: 2 }), /较新的提交/);
  assert.match(repositorySnapshotBlockers({ ...articleRepository, ahead: 1 }), /未推送提交/);
});

test('上传文章只提交文章路径，仓库其他改动与已暂存内容保持原样', async () => {
  const root = await mkdtemp(join(tmpdir(), 'article-studio-publish-'));
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
  try {
    git('init', '--quiet');
    git('config', 'user.name', 'Test');
    git('config', 'user.email', 'test@example.invalid');
    await mkdir(join(root, 'source/_posts'), { recursive: true });
    await mkdir(join(root, 'tools'), { recursive: true });
    const article = 'source/_posts/示例.md';
    await writeFile(join(root, article), '# 初稿\n');
    await writeFile(join(root, 'tools/server.mjs'), 'old\n');
    git('add', '--', '.');
    git('commit', '--quiet', '-m', 'init');

    // 工作台之外：无关代码改动、已暂存的代码改动和一个未跟踪文件。
    await writeFile(join(root, article), '# 更新\n');
    await writeFile(join(root, 'tools/server.mjs'), 'changed\n');
    await writeFile(join(root, 'notes.txt'), 'untracked\n');
    git('add', '--', 'tools/server.mjs');

    const pathspecs = [article];
    git('add', '-A', '--', ...pathspecs);
    // 只校验文章路径范围内的暂存内容，索引里的其他文件不算越界。
    assert.deepEqual(parseGitPaths(git('diff', '--cached', '--name-only', '-z', '--', ...pathspecs)), pathspecs);
    assert.ok(parseGitPaths(git('diff', '--cached', '--name-only', '-z')).includes('tools/server.mjs'));

    git('commit', '--only', '-m', 'docs(article): 更新《示例》', '--', ...pathspecs);
    assert.deepEqual(parseGitPaths(git('diff-tree', '--root', '--no-commit-id', '--name-only', '-z', '-r', 'HEAD')), pathspecs);
    const status = git('status', '--short');
    assert.match(status, /tools\/server\.mjs/);
    assert.match(status, /notes\.txt/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
