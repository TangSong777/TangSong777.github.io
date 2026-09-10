import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, readdir, stat, rename, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { createPublicKey, randomBytes, verify as verifySignature } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { networkInterfaces } from 'node:os';
import Hexo from 'hexo';

const studioDir = dirname(fileURLToPath(import.meta.url));
const repoDir = resolve(studioDir, '..', '..');
const postsDir = join(repoDir, 'source', '_posts');
const imagesDir = join(repoDir, 'source', 'images', 'posts');
const publicDir = join(studioDir, 'public');
const networkMode = process.argv.includes('--network');
const authMode = String(process.env.ARTICLE_STUDIO_AUTH_MODE || (networkMode ? 'key' : 'local')).toLowerCase();
if (!['local', 'key', 'cloudflare'].includes(authMode)) throw new Error('ARTICLE_STUDIO_AUTH_MODE 只允许 local、key 或 cloudflare');
const host = authMode === 'key' ? '0.0.0.0' : '127.0.0.1';
const requestedPort = Number(process.env.ARTICLE_STUDIO_PORT || 4173);
const csrfToken = randomBytes(24).toString('hex');
const accessKey = authMode === 'key' ? randomBytes(24).toString('base64url') : '';
const maxBodyBytes = 25 * 1024 * 1024;
const renameStateFile = join(repoDir, '.article-studio-renames.json');
const privateValuesFile = join(repoDir, 'tools', 'siyuan-private-values.txt');
const articlePendingFile = '/srv/blog/state/article-pending-push.json';
const publishLockFile = '/srv/blog/locks/publish.lock';
const lockHolderFile = join(studioDir, 'lock-holder.mjs');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const allowedRemotes = new Set([
  'git@github.com:TangSong777/TangSong777.github.io.git',
  'https://github.com/TangSong777/TangSong777.github.io.git',
]);
const cloudflareIssuer = String(process.env.CF_ACCESS_TEAM_DOMAIN || '').replace(/\/$/, '');
const cloudflareAudience = String(process.env.CF_ACCESS_AUD || '').trim();
const allowedEmails = new Set(String(process.env.ARTICLE_STUDIO_ALLOWED_EMAILS || '')
  .split(',').map((item) => item.trim().toLowerCase()).filter(Boolean));
if (authMode === 'cloudflare' && (!cloudflareIssuer.startsWith('https://') || !cloudflareAudience || !allowedEmails.size)) {
  throw new Error('Cloudflare 模式必须设置 CF_ACCESS_TEAM_DOMAIN、CF_ACCESS_AUD 和 ARTICLE_STUDIO_ALLOWED_EMAILS');
}
let previewHexoPromise;
let previewAssetPromise;
let previewRenderQueue = Promise.resolve();
let cloudflareKeysCache;
let localPublishing = false;
let publishRequestActive = false;

function send(res, status, body, contentType = 'application/json; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': contentType,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Content-Security-Policy': "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-src 'self'; connect-src 'self'",
  });
  res.end(contentType.startsWith('application/json') ? JSON.stringify(body) : body);
  return true;
}

function fail(res, status, message, details = '') {
  send(res, status, { ok: false, message, details });
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBodyBytes) throw new Error('请求内容超过 25 MB，请压缩图片后重试。');
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    throw new Error('请求数据格式无效。');
  }
}

function requireLocalMutation(req) {
  const origin = req.headers.origin;
  const hostHeader = req.headers.host;
  const sameOrigin = !origin || (() => {
    try { return new URL(origin).host === hostHeader; } catch { return false; }
  })();
  const fetchSite = String(req.headers['sec-fetch-site'] || 'same-origin');
  return sameOrigin
    && ['same-origin', 'none'].includes(fetchSite)
    && req.headers['x-article-studio-token'] === csrfToken;
}

function isLoopback(address) {
  return ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(String(address || ''));
}

function decodeJwtPart(value) {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
}

async function cloudflareKeys() {
  if (cloudflareKeysCache?.expiresAt > Date.now()) return cloudflareKeysCache.keys;
  const response = await fetch(`${cloudflareIssuer}/cdn-cgi/access/certs`, {
    headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10000), redirect: 'error',
  });
  if (!response.ok) throw new Error(`Cloudflare Access 公钥读取失败：HTTP ${response.status}`);
  const data = await response.json();
  const keys = Array.isArray(data.keys) ? data.keys : [];
  if (!keys.length) throw new Error('Cloudflare Access 没有返回可用公钥');
  cloudflareKeysCache = { keys, expiresAt: Date.now() + 60 * 60 * 1000 };
  return keys;
}

export function verifyAccessJwtWithKeys(token, keys, { issuer, audience, emails, now = Math.floor(Date.now() / 1000) }) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw new Error('缺少有效的 Cloudflare Access JWT');
  let header;
  let payload;
  try {
    header = decodeJwtPart(parts[0]);
    payload = decodeJwtPart(parts[1]);
  } catch {
    throw new Error('Cloudflare Access JWT 格式无效');
  }
  if (header.alg !== 'RS256' || !header.kid) throw new Error('Cloudflare Access JWT 算法或密钥标识无效');
  const key = keys.find((item) => item.kid === header.kid);
  if (!key) throw new Error('Cloudflare Access JWT 使用了未知公钥，请刷新后重试');
  const publicKey = typeof key === 'string'
    ? key
    : createPublicKey({ key, format: 'jwk' });
  const valid = verifySignature('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), publicKey, Buffer.from(parts[2], 'base64url'));
  if (!valid) throw new Error('Cloudflare Access JWT 签名无效');
  if (!Number.isFinite(payload.exp) || payload.exp < now - 30) throw new Error('Cloudflare Access 登录已过期');
  if (Number.isFinite(payload.nbf) && payload.nbf > now + 30) throw new Error('Cloudflare Access JWT 尚未生效');
  if (String(payload.iss || '').replace(/\/$/, '') !== issuer) throw new Error('Cloudflare Access JWT 签发者不匹配');
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!audiences.includes(audience)) throw new Error('Cloudflare Access JWT audience 不匹配');
  const email = String(payload.email || '').trim().toLowerCase();
  if (!emails.has(email)) throw new Error('当前 Cloudflare 身份没有工作台权限');
  return { email, subject: String(payload.sub || '') };
}

export async function verifyCloudflareAccessJwt(token) {
  let keys = await cloudflareKeys();
  try {
    return verifyAccessJwtWithKeys(token, keys, {
      issuer: cloudflareIssuer, audience: cloudflareAudience, emails: allowedEmails,
    });
  } catch (error) {
    if (!String(error.message).includes('未知公钥')) throw error;
    cloudflareKeysCache = undefined;
    keys = await cloudflareKeys();
    return verifyAccessJwtWithKeys(token, keys, {
      issuer: cloudflareIssuer, audience: cloudflareAudience, emails: allowedEmails,
    });
  }
}

async function authenticateRequest(req) {
  if (authMode === 'local') {
    if (!isLoopback(req.socket.remoteAddress)) throw new Error('本地模式只允许回环地址访问');
    return { mode: 'local', email: '' };
  }
  if (authMode === 'key') {
    if (req.url?.startsWith('/api/') && req.headers['x-article-studio-key'] !== accessKey) throw new Error('临时访问密钥无效');
    return { mode: 'key', email: '' };
  }
  const identity = await verifyCloudflareAccessJwt(req.headers['cf-access-jwt-assertion']);
  return { mode: 'cloudflare', ...identity };
}

function isPrivateIPv4(address) {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  return parts[0] === 10
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 192 && parts[1] === 168)
    || (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127)
    || (parts[0] === 198 && (parts[1] === 18 || parts[1] === 19));
}

function normalizeRelativePath(value) {
  return String(value || '').replaceAll('\\', '/').replace(/^\/+/, '');
}

export function normalizeArticlePath(value) {
  const normalized = normalizeRelativePath(value);
  const parts = normalized.split('/');
  if (parts.some((part) => !part || part === '.' || part === '..' || part.startsWith('.'))) throw new Error('文章路径包含不允许的目录。');
  if (parts[0].toLowerCase() === 'siyuan') throw new Error('思源笔记目录由自动发布链路维护，文章工作台不能修改。');
  return normalized;
}

export function resolveInside(base, relPath, extension = '') {
  const normalized = normalizeRelativePath(relPath);
  if (!normalized || normalized.includes('\0')) throw new Error('文件路径不能为空。');
  if (extension && extname(normalized).toLowerCase() !== extension) throw new Error(`只允许 ${extension} 文件。`);
  const target = resolve(base, normalized);
  const prefix = resolve(base) + sep;
  if (!target.startsWith(prefix)) throw new Error('文件路径超出允许目录。');
  return target;
}

function toPosix(value) {
  return value.split(sep).join('/');
}

function stripFrontMatter(markdown) {
  return markdown.replace(/^---\s*\r?\n[\s\S]*?\r?\n---\s*(?:\r?\n|$)/, '');
}

async function ensurePreviewAssets() {
  if (previewAssetPromise) return previewAssetPromise;
  previewAssetPromise = (async () => {
    const finalCss = join(repoDir, 'public', 'css', 'main.css');
    const styleInputs = [
      join(repoDir, '_config.yml'),
      join(repoDir, '_config.next.yml'),
      join(repoDir, 'source', '_data', 'styles.styl'),
    ].filter((item) => existsSync(item));
    const cssTime = existsSync(finalCss) ? (await stat(finalCss)).mtimeMs : 0;
    const newestInput = Math.max(0, ...await Promise.all(styleInputs.map(async (item) => (await stat(item)).mtimeMs)));
    if (!cssTime || newestInput > cssTime) {
      console.log('正在生成与最终网站一致的预览样式…');
      await runChecked(npmCommand, ['run', 'build'], 'Hexo 预览样式构建');
    }
  })();
  return previewAssetPromise;
}

async function renderWithHexo(markdown) {
  await ensurePreviewAssets();
  if (!previewHexoPromise) {
    previewHexoPromise = (async () => {
      const instance = new Hexo(repoDir, { silent: true });
      await instance.init();
      return instance;
    })();
  }
  const renderTask = async () => {
    const instance = await previewHexoPromise;
    const rendered = await instance.post.render(null, {
      content: stripFrontMatter(String(markdown || '')),
      engine: 'markdown',
    });
    return rendered.content;
  };
  previewRenderQueue = previewRenderQueue.then(renderTask, renderTask);
  return previewRenderQueue;
}

function frontMatterValue(markdown, key) {
  const match = markdown.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return '';
  const line = match[1].split(/\r?\n/).find((item) => item.match(new RegExp(`^${key}\\s*:`)));
  return line ? line.replace(new RegExp(`^${key}\\s*:\\s*`), '').replace(/^['"]|['"]$/g, '').trim() : '';
}

async function walkMarkdown(dir, base = dir) {
  if (!existsSync(dir)) return [];
  const output = [];
  for (const item of await readdir(dir, { withFileTypes: true })) {
    if (item.name.startsWith('.')) continue;
    if (item.isDirectory() && item.name.toLowerCase() === 'siyuan') continue;
    const full = join(dir, item.name);
    if (item.isDirectory()) output.push(...await walkMarkdown(full, base));
    else if (item.isFile() && extname(item.name).toLowerCase() === '.md') {
      const info = await stat(full);
      const content = await readFile(full, 'utf8');
      output.push({
        path: toPosix(relative(base, full)),
        title: frontMatterValue(content, 'title') || item.name.replace(/\.md$/i, ''),
        date: frontMatterValue(content, 'date'),
        updatedAt: info.mtime.toISOString(),
      });
    }
  }
  return output.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

async function readRenameState() {
  if (!existsSync(renameStateFile)) return {};
  try {
    return JSON.parse(await readFile(renameStateFile, 'utf8'));
  } catch {
    return {};
  }
}

async function writeRenameState(value) {
  await writeAtomic(renameStateFile, `${JSON.stringify(value, null, 2)}\n`);
}

async function writeAtomic(target, content) {
  const temporary = `${target}.${process.pid}.${randomBytes(5).toString('hex')}.tmp`;
  await writeFile(temporary, content, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
  try {
    await rename(temporary, target);
  } catch (error) {
    await unlink(temporary).catch(() => {});
    throw error;
  }
}

function yamlString(value) {
  return JSON.stringify(String(value || '').replace(/[\r\n]+/g, ' ').trim());
}

export function safeSlug(value) {
  const slug = String(value || '')
    .normalize('NFKC')
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[.-]+|[. ]+$/g, '');
  if (!slug) throw new Error('请输入有效的文章 slug。');
  return slug;
}

function safeImageName(value, mime) {
  const extensionByMime = {
    'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif',
    'image/webp': '.webp',
  };
  const expectedExt = extensionByMime[mime];
  if (!expectedExt) throw new Error('仅支持 PNG、JPEG、GIF 和 WebP 图片；SVG/AVIF 不进入文章上传目录。');
  const raw = String(value || 'image').normalize('NFKC').replace(/[<>:"/\\|?*\x00-\x1F]/g, '-');
  const base = raw.replace(/\.[^.]+$/, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^[.-]+|[. ]+$/g, '') || 'image';
  return `${Date.now()}-${randomBytes(4).toString('hex')}-${base}${expectedExt}`;
}

function stripJpegMetadata(bytes) {
  const output = [bytes.subarray(0, 2)];
  let offset = 2;
  while (offset + 4 <= bytes.length && bytes[offset] === 0xff) {
    const marker = bytes[offset + 1];
    if (marker === 0xda || marker === 0xd9) {
      output.push(bytes.subarray(offset));
      return Buffer.concat(output);
    }
    if (marker === 0x00 || marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) {
      output.push(bytes.subarray(offset, offset + 2));
      offset += 2;
      continue;
    }
    const length = bytes.readUInt16BE(offset + 2);
    const end = offset + 2 + length;
    if (length < 2 || end > bytes.length) throw new Error('JPEG 分段结构无效。');
    if (![0xe1, 0xed, 0xfe].includes(marker)) output.push(bytes.subarray(offset, end));
    offset = end;
  }
  throw new Error('JPEG 没有有效的图像数据段。');
}

function stripPngMetadata(bytes) {
  const output = [bytes.subarray(0, 8)];
  let offset = 8;
  let hasIend = false;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const end = offset + 12 + length;
    if (end > bytes.length) throw new Error('PNG 数据块长度无效。');
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    if (!['tEXt', 'zTXt', 'iTXt', 'eXIf'].includes(type)) output.push(bytes.subarray(offset, end));
    offset = end;
    if (type === 'IEND') { hasIend = true; break; }
  }
  if (!hasIend || offset !== bytes.length) throw new Error('PNG 结尾结构无效。');
  return Buffer.concat(output);
}

function stripWebpMetadata(bytes) {
  const chunks = [];
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const type = bytes.toString('ascii', offset, offset + 4);
    const length = bytes.readUInt32LE(offset + 4);
    const end = offset + 8 + length + (length % 2);
    if (end > bytes.length) throw new Error('WebP 数据块长度无效。');
    if (!['EXIF', 'XMP '].includes(type)) {
      const chunk = Buffer.from(bytes.subarray(offset, end));
      if (type === 'VP8X' && length >= 1) chunk[8] &= ~0x0c;
      chunks.push(chunk);
    }
    offset = end;
  }
  if (offset !== bytes.length || !chunks.length) throw new Error('WebP 结构无效。');
  const body = Buffer.concat(chunks);
  const header = Buffer.alloc(12);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(body.length + 4, 4);
  header.write('WEBP', 8, 'ascii');
  return Buffer.concat([header, body]);
}

export function validateAndSanitizeImage(bytes, mime) {
  if (!Buffer.isBuffer(bytes) || !bytes.length) throw new Error('图片内容为空。');
  if (bytes.length > 20 * 1024 * 1024) throw new Error('单张图片不能超过 20 MB。');
  if (mime === 'image/png') {
    if (!bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) throw new Error('文件内容不是有效的 PNG。');
    return stripPngMetadata(bytes);
  }
  if (mime === 'image/jpeg') {
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) throw new Error('文件内容不是有效的 JPEG。');
    return stripJpegMetadata(bytes);
  }
  if (mime === 'image/gif') {
    const signature = bytes.toString('ascii', 0, 6);
    if (!['GIF87a', 'GIF89a'].includes(signature) || bytes.at(-1) !== 0x3b) throw new Error('文件内容不是有效的 GIF。');
    return bytes;
  }
  if (mime === 'image/webp') {
    if (bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WEBP') throw new Error('文件内容不是有效的 WebP。');
    return stripWebpMetadata(bytes);
  }
  throw new Error('图片 MIME 类型不受支持。');
}

async function loadPrivateValues() {
  if (!existsSync(privateValuesFile)) return [];
  return (await readFile(privateValuesFile, 'utf8'))
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter((item) => item && !item.startsWith('#') && item.length >= 4);
}

export async function scanSensitive(content) {
  const body = String(content || '');
  const rules = [
    ['block', '私钥', /-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/g],
    ['block', 'GitHub Token', /\b(?:ghp|github_pat)_[A-Za-z0-9_]{20,}\b/g],
    ['block', '疑似通用密钥', /\b(?:api[_-]?key|access[_-]?token|secret(?:[_-]?key)?)\s*[:=]\s*['"]?[A-Za-z0-9_\-]{12,}/gi],
    ['warning', '疑似 ZeroTier 网络 ID', /\b[0-9a-fA-F]{16}\b/g],
    ['warning', '私有 IPv4 地址', /\b(?:10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2})\b/g],
    ['warning', '电子邮箱', /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi],
  ];
  const findings = rules.flatMap(([severity, label, regex]) => {
    const matches = [...body.matchAll(regex)];
    return matches.slice(0, 3).map((match) => ({
      severity, label,
      line: body.slice(0, match.index).split('\n').length,
      sample: severity === 'block' ? '内容已隐藏' : `${match[0].slice(0, 3)}…${match[0].slice(-3)}`,
    }));
  });
  for (const value of await loadPrivateValues()) {
    let start = 0;
    while (findings.length < 40) {
      const index = body.indexOf(value, start);
      if (index < 0) break;
      findings.push({
        severity: 'block', label: '命中项目私密值词表',
        line: body.slice(0, index).split('\n').length, sample: '内容已隐藏',
      });
      start = index + value.length;
    }
  }
  return findings.slice(0, 40);
}

function run(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: repoDir,
      windowsHide: true,
      shell: false,
      env: process.env,
      ...options,
    });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (data) => { stdout += data.toString(); });
    child.stderr?.on('data', (data) => { stderr += data.toString(); });
    child.on('error', reject);
    child.on('close', (code) => resolvePromise({ code, stdout, stderr }));
  });
}

async function runChecked(command, args, label) {
  const result = await run(command, args);
  if (result.code !== 0) {
    const error = new Error(`${label}失败。`);
    error.details = `${result.stdout}\n${result.stderr}`.trim();
    throw error;
  }
  return result;
}

async function git(...args) {
  return (await runChecked('git', args, `Git ${args[0]}`)).stdout.trim();
}

async function writeJsonAtomic(target, value) {
  await mkdir(dirname(target), { recursive: true, mode: 0o700 });
  const temporary = `${target}.${process.pid}.${randomBytes(5).toString('hex')}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
  await rename(temporary, target);
}

async function withPublishLock(action) {
  if (localPublishing) throw new Error('已有文章发布任务正在运行，请稍后再试。');
  localPublishing = true;
  if (process.platform !== 'linux') {
    try { return await action(); } finally { localPublishing = false; }
  }
  await mkdir(dirname(publishLockFile), { recursive: true, mode: 0o700 });
  const child = spawn('flock', [
    '--exclusive', '--nonblock', '--conflict-exit-code', '75',
    publishLockFile, process.execPath, lockHolderFile,
  ], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  let stderr = '';
  child.stderr.on('data', (data) => { if (stderr.length < 2048) stderr += data; });
  try {
    await new Promise((resolvePromise, reject) => {
      const timer = setTimeout(() => reject(new Error('等待发布锁超时。')), 5000);
      child.stdout.once('data', (data) => {
        clearTimeout(timer);
        if (String(data).includes('LOCKED')) resolvePromise();
        else reject(new Error('发布锁握手失败。'));
      });
      child.once('exit', (code) => {
        clearTimeout(timer);
        reject(new Error(code === 75 ? '笔记刷新或其他文章发布正在运行，请稍后再试。' : `无法获取发布锁：${stderr.trim() || `退出码 ${code}`}`));
      });
      child.once('error', reject);
    });
    return await action();
  } finally {
    child.stdin.end();
    await new Promise((resolvePromise) => {
      if (child.exitCode !== null) return resolvePromise();
      child.once('exit', resolvePromise);
      setTimeout(() => { child.kill(); resolvePromise(); }, 2000);
    });
    localPublishing = false;
  }
}

function articleGitPaths(articlePath, originalPath = '') {
  const paths = [];
  for (const item of [articlePath, originalPath].filter(Boolean)) {
    const normalized = normalizeArticlePath(item);
    const slug = safeSlug(normalized.replace(/\.md$/i, '').replaceAll('/', '-'));
    paths.push(toPosix(relative(repoDir, resolveInside(postsDir, normalized, '.md'))));
    paths.push(toPosix(relative(repoDir, resolveInside(imagesDir, slug))));
  }
  return [...new Set(paths)];
}

function pathAllowed(name, roots) {
  const normalized = normalizeRelativePath(name);
  return roots.some((root) => normalized === root || normalized.startsWith(`${root}/`));
}

function ordinaryArticleDraftPath(name) {
  const normalized = normalizeRelativePath(name);
  const parts = normalized.split('/');
  if (parts.some((part) => !part || part === '.' || part === '..' || part.startsWith('.'))) return false;
  if (normalized.startsWith('source/images/posts/')) return true;
  return normalized.startsWith('source/_posts/') && parts[2]?.toLowerCase() !== 'siyuan';
}

async function workingTreePaths() {
  const [tracked, untracked, staged] = await Promise.all([
    git('diff', '--name-only'),
    git('ls-files', '--others', '--exclude-standard'),
    git('diff', '--cached', '--name-only'),
  ]);
  return {
    dirty: [...new Set(`${tracked}\n${untracked}`.split('\n').map((item) => item.trim()).filter(Boolean))],
    staged: staged.split('\n').map((item) => item.trim()).filter(Boolean),
  };
}

async function verifyRepositoryForArticle(allowedPaths) {
  if (await git('branch', '--show-current') !== 'main') throw new Error('文章发布只允许在 main 分支运行。');
  const origin = await git('remote', 'get-url', 'origin');
  const pushUrls = (await git('remote', 'get-url', '--push', '--all', 'origin')).split('\n').filter(Boolean);
  if (!allowedRemotes.has(origin) || pushUrls.length !== 1 || !allowedRemotes.has(pushUrls[0])) throw new Error('Git origin 不是唯一授权的博客仓库。');
  if (!await git('config', 'user.name') || !await git('config', 'user.email')) throw new Error('Git 提交身份尚未配置。');
  await git('fetch', '--prune', 'origin', 'main');
  const [behind, ahead] = (await git('rev-list', '--left-right', '--count', 'origin/main...HEAD')).split(/\s+/).map(Number);
  if (behind) throw new Error('GitHub 有较新的提交，请先更新 Rock 仓库再发布文章。');
  if (ahead) throw new Error('Rock 存在未推送提交，且没有可验证的文章待推送记录。');
  const status = await workingTreePaths();
  if (status.staged.length) throw new Error('Git 暂存区已有内容，请人工检查后再发布。');
  const unexpected = status.dirty.filter((name) => !ordinaryArticleDraftPath(name));
  if (unexpected.length) throw new Error(`仓库存在普通文章草稿之外的修改：${unexpected.slice(0, 5).join('、')}`);
}

async function pushPendingArticle() {
  if (!existsSync(articlePendingFile)) return false;
  const pending = JSON.parse(await readFile(articlePendingFile, 'utf8'));
  if (!/^[0-9a-f]{40}$/.test(pending.commit || '') || await git('rev-parse', 'HEAD') !== pending.commit) throw new Error('文章待推送记录与当前 HEAD 不一致，需要人工检查。');
  await git('fetch', '--prune', 'origin', 'main');
  if (await git('rev-parse', 'origin/main') === pending.commit) {
    await unlink(articlePendingFile);
    return true;
  }
  const commits = (await git('rev-list', 'origin/main..HEAD')).split('\n').filter(Boolean);
  if (commits.length !== 1 || commits[0] !== pending.commit) throw new Error('文章待推送记录之外还有本地提交。');
  const names = (await git('diff-tree', '--root', '--no-commit-id', '--name-only', '-r', pending.commit)).split('\n').filter(Boolean);
  if (!names.length || names.some((name) => !pathAllowed(name, pending.allowedPaths || []))) throw new Error('待推送文章提交包含白名单之外的文件。');
  if (!/^(?:feat|fix|docs)\(article\):/.test(await git('log', '-1', '--format=%s'))) throw new Error('待推送提交说明不是文章提交格式。');
  await git('push', 'origin', 'HEAD:main');
  await unlink(articlePendingFile);
  return true;
}

async function publishCurrentArticle(data, warnings) {
  return withPublishLock(async () => {
    const pendingPushed = await pushPendingArticle();
    const articlePath = normalizeArticlePath(data.path);
    const renameState = await readRenameState();
    const renameInfo = renameState[articlePath];
    const allowedPaths = articleGitPaths(articlePath, renameInfo?.originalPath);
    await verifyRepositoryForArticle(allowedPaths);

    await runChecked(npmCommand, ['run', 'clean'], '清理 Hexo 缓存');
    const build = await runChecked(npmCommand, ['run', 'build'], 'Hexo 构建检查');
    const articleRepoPath = toPosix(relative(repoDir, resolveInside(postsDir, articlePath, '.md')));
    const articleSlug = safeSlug(articlePath.replace(/\.md$/i, '').replaceAll('/', '-'));
    const imageRoot = toPosix(relative(repoDir, resolveInside(imagesDir, articleSlug)));
    const pathspecs = [articleRepoPath];
    if (existsSync(join(repoDir, imageRoot))) pathspecs.push(imageRoot);
    if (renameInfo?.originalPath) {
      const originalPaths = articleGitPaths('', renameInfo.originalPath);
      for (const name of originalPaths) {
        if ((await run('git', ['ls-files', '--error-unmatch', '--', name])).code === 0) pathspecs.push(name);
      }
    }

    await runChecked('git', ['add', '-A', '--', ...pathspecs], '暂存当前文章');
    const stagedNames = (await git('diff', '--cached', '--name-only')).split('\n').filter(Boolean);
    if (stagedNames.some((name) => !pathAllowed(name, allowedPaths))) {
      await run('git', ['restore', '--staged', '--', ...pathspecs]);
      throw new Error('暂存区包含当前文章白名单之外的文件。');
    }
    const diff = await run('git', ['diff', '--cached', '--quiet', '--', ...pathspecs]);
    if (diff.code === 0) {
      return {
        committed: false, pendingPushed, warnings,
        logs: [build.stdout, pendingPushed ? '已补推送上次经过验证的文章提交。' : '没有需要提交的新改动。'].filter(Boolean).join('\n').trim(),
      };
    }
    if (diff.code !== 1) throw new Error('无法检查文章 Git 改动。');
    await git('diff', '--cached', '--check');
    const title = frontMatterValue(data.content, 'title') || articleSlug;
    const tracked = (await run('git', ['cat-file', '-e', `HEAD:${articleRepoPath}`])).code === 0;
    const fallback = tracked ? `docs(article): 更新《${title}》` : `feat(article): 发布《${title}》`;
    const message = String(data.message || fallback).replace(/[\r\n]/g, ' ').trim();
    if (!/^(?:feat|fix|docs)\(article\):\s+\S/.test(message)) {
      await run('git', ['restore', '--staged', '--', ...pathspecs]);
      throw new Error('提交说明必须以 feat(article):、fix(article): 或 docs(article): 开头。');
    }
    let commit;
    try {
      commit = await runChecked('git', [
        'commit', '--only', '-m', message,
        '-m', '更新普通文章 Markdown 与关联图片；已通过敏感信息检查和 Hexo 构建。',
        '--', ...pathspecs,
      ], 'Git 提交');
    } catch (error) {
      await run('git', ['restore', '--staged', '--', ...pathspecs]);
      throw error;
    }
    const commitHash = await git('rev-parse', 'HEAD');
    await writeJsonAtomic(articlePendingFile, {
      commit: commitHash, allowedPaths, articlePath, createdAt: new Date().toISOString(),
    });
    try {
      const push = await runChecked('git', ['push', 'origin', 'HEAD:main'], 'Git 推送');
      await unlink(articlePendingFile);
      if (renameInfo) {
        delete renameState[articlePath];
        await writeRenameState(renameState);
      }
      return {
        committed: true, pendingPushed, commitHash, warnings,
        logs: [build.stdout, commit.stdout, push.stdout, push.stderr].filter(Boolean).join('\n').trim(),
      };
    } catch (error) {
      error.message = `${error.message} 本地提交 ${commitHash.slice(0, 8)} 已保留；再次点击上传会先安全重试推送。`;
      throw error;
    }
  });
}

async function saveArticle(articlePath, content) {
  const target = resolveInside(postsDir, normalizeArticlePath(articlePath), '.md');
  if (typeof content !== 'string' || content.length === 0) throw new Error('文章内容不能为空。');
  if (Buffer.byteLength(content, 'utf8') > 4 * 1024 * 1024) throw new Error('单篇 Markdown 不能超过 4 MB。');
  await mkdir(dirname(target), { recursive: true });
  await writeAtomic(target, content.replace(/\r?\n/g, '\n'));
  return target;
}

async function routeApi(req, res, url, identity) {
  if (req.method === 'GET' && url.pathname === '/api/config') {
    return send(res, 200, {
      ok: true, token: csrfToken, authMode,
      identity: identity.email ? { email: identity.email } : null,
    });
  }

  if (req.method === 'GET' && url.pathname === '/api/articles') {
    return send(res, 200, { ok: true, articles: await walkMarkdown(postsDir) });
  }

  if (req.method === 'GET' && url.pathname === '/api/article') {
    const articlePath = normalizeArticlePath(url.searchParams.get('path'));
    const target = resolveInside(postsDir, articlePath, '.md');
    if (!existsSync(target)) return fail(res, 404, '文章不存在。');
    return send(res, 200, { ok: true, path: normalizeRelativePath(articlePath), content: await readFile(target, 'utf8') });
  }

  if (req.method !== 'GET' && !requireLocalMutation(req)) return fail(res, 403, '本地会话校验失败，请刷新页面。');
  if (req.method !== 'GET' && publishRequestActive && url.pathname !== '/api/publish') {
    return fail(res, 423, '文章正在构建并上传，请完成后再修改内容。');
  }

  if (req.method === 'POST' && url.pathname === '/api/create') {
    const data = await readJson(req);
    const slug = safeSlug(String(data.slug || '').replace(/\.md$/i, ''));
    const articlePath = `${slug}.md`;
    const target = resolveInside(postsDir, articlePath, '.md');
    if (existsSync(target)) return fail(res, 409, '同名文章已经存在。');
    const now = new Date();
    const localDate = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    }).format(now).replace(',', '');
    const title = String(data.title || slug).replace(/[\r\n]/g, ' ').trim();
    const content = `---\ntitle: ${yamlString(title)}\ndate: ${localDate}\nupdated: ${localDate}\ncategories:\ntags:\ndescription: \"\"\n---\n\n在这里写文章摘要。\n\n<!-- more -->\n\n在这里继续写正文。\n`;
    await saveArticle(articlePath, content);
    return send(res, 201, { ok: true, path: articlePath, content });
  }

  if (req.method === 'POST' && url.pathname === '/api/save') {
    const data = await readJson(req);
    await saveArticle(data.path, data.content);
    return send(res, 200, { ok: true, message: '文章已保存到本地。', warnings: await scanSensitive(data.content) });
  }

  if (req.method === 'POST' && url.pathname === '/api/preview') {
    const data = await readJson(req);
    return send(res, 200, { ok: true, html: await renderWithHexo(data.content) });
  }

  if (req.method === 'POST' && url.pathname === '/api/rename') {
    const data = await readJson(req);
    const oldPath = normalizeArticlePath(data.path);
    const oldTarget = resolveInside(postsDir, oldPath, '.md');
    if (!existsSync(oldTarget)) return fail(res, 404, '原文章文件不存在。');

    const requestedName = String(data.fileName || '').replace(/\.md$/i, '');
    const newName = `${safeSlug(requestedName)}.md`;
    const parent = oldPath.includes('/') ? oldPath.slice(0, oldPath.lastIndexOf('/') + 1) : '';
    const newPath = `${parent}${newName}`;
    const newTarget = resolveInside(postsDir, newPath, '.md');
    if (oldPath.toLowerCase() === newPath.toLowerCase()) {
      return send(res, 200, { ok: true, path: oldPath, content: await readFile(oldTarget, 'utf8'), message: '文件名没有变化。' });
    }
    if (existsSync(newTarget)) return fail(res, 409, '目标文件名已经存在。');

    const oldSlug = safeSlug(oldPath.replace(/\.md$/i, '').replaceAll('/', '-'));
    const newSlug = safeSlug(newPath.replace(/\.md$/i, '').replaceAll('/', '-'));
    const oldImageDir = resolveInside(imagesDir, oldSlug);
    const newImageDir = resolveInside(imagesDir, newSlug);
    if (existsSync(oldImageDir) && existsSync(newImageDir)) return fail(res, 409, '新文件名对应的图片目录已经存在。');

    await rename(oldTarget, newTarget);
    if (existsSync(oldImageDir)) await rename(oldImageDir, newImageDir);
    let content = await readFile(newTarget, 'utf8');
    content = content.replaceAll(`/images/posts/${oldSlug}/`, `/images/posts/${newSlug}/`);
    await writeAtomic(newTarget, content);

    const renameState = await readRenameState();
    const originalPath = renameState[oldPath]?.originalPath || oldPath;
    delete renameState[oldPath];
    renameState[newPath] = { originalPath, renamedAt: new Date().toISOString() };
    await writeRenameState(renameState);

    return send(res, 200, { ok: true, path: newPath, content, message: '文章文件名和图片路径已更新。' });
  }

  if (req.method === 'POST' && url.pathname === '/api/image') {
    const data = await readJson(req);
    const articlePath = normalizeArticlePath(data.articlePath);
    resolveInside(postsDir, articlePath, '.md');
    const mime = String(data.mime || '');
    const fileName = safeImageName(data.name, mime);
    const base64 = String(data.data || '').replace(/^data:[^;]+;base64,/, '');
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64) || base64.length % 4 !== 0) throw new Error('图片 Base64 数据无效。');
    const bytes = validateAndSanitizeImage(Buffer.from(base64, 'base64'), mime);
    const articleSlug = safeSlug(articlePath.replace(/\.md$/i, '').replaceAll('/', '-'));
    const folder = resolveInside(imagesDir, articleSlug);
    await mkdir(folder, { recursive: true });
    await writeFile(join(folder, fileName), bytes, { flag: 'wx', mode: 0o600 });
    return send(res, 201, { ok: true, markdownPath: `/images/posts/${articleSlug}/${encodeURIComponent(fileName)}` });
  }

  if (req.method === 'POST' && url.pathname === '/api/publish') {
    if (publishRequestActive) return fail(res, 423, '已有文章发布任务正在运行，请稍后再试。');
    publishRequestActive = true;
    try {
      const data = await readJson(req);
      await saveArticle(data.path, data.content);
      const warnings = await scanSensitive(data.content);
      const blocked = warnings.filter((item) => item.severity === 'block');
      if (blocked.length) {
        return send(res, 422, { ok: false, code: 'SENSITIVE_BLOCK', message: '检测到禁止公开的敏感内容，必须删除后才能发布。', warnings });
      }
      if (warnings.length && !data.confirmWarnings) {
        return send(res, 409, { ok: false, code: 'SENSITIVE_WARNING', message: '检测到可能的敏感内容，请检查后确认。', warnings });
      }

      const result = await publishCurrentArticle(data, warnings);
      return send(res, 200, {
        ok: true,
        message: result.committed
          ? '文章已构建、提交并推送。GitHub Actions 将继续部署。'
          : result.pendingPushed
            ? '已安全补推送上次的文章提交；当前文章没有新改动。'
            : '当前文章没有需要提交的新改动。',
        logs: result.logs,
        warnings,
      });
    } finally {
      publishRequestActive = false;
    }
  }

  return false;
}

const mimeTypes = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.avif': 'image/avif',
};

async function routeStatic(req, res, url) {
  let target;
  if (url.pathname.startsWith('/images/')) {
    target = resolveInside(join(repoDir, 'source'), decodeURIComponent(url.pathname.slice(1)));
  } else if (url.pathname.startsWith('/site-preview/')) {
    target = resolveInside(join(repoDir, 'public'), decodeURIComponent(url.pathname.slice('/site-preview/'.length)));
  } else {
    const pathname = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
    target = resolveInside(publicDir, pathname);
  }
  if (!existsSync(target) || !(await stat(target)).isFile()) return false;
  return send(res, 200, await readFile(target), mimeTypes[extname(target).toLowerCase()] || 'application/octet-stream');
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${host}`);
    let identity;
    try {
      identity = await authenticateRequest(req);
    } catch (error) {
      fail(res, 401, error.message || '身份验证失败。');
      return;
    }
    if (url.pathname.startsWith('/api/')) {
      const handled = await routeApi(req, res, url, identity);
      if (handled === false) fail(res, 404, '接口不存在。');
      return;
    }
    if (!await routeStatic(req, res, url)) fail(res, 404, '页面不存在。');
  } catch (error) {
    console.error(error);
    fail(res, 500, error.message || '本地工具发生错误。', error.details || '');
  }
});

export function startServer() {
  return server.listen(requestedPort, host, async () => {
  const address = server.address();
  const localUrl = `http://127.0.0.1:${address.port}${authMode === 'key' ? `/?key=${accessKey}` : ''}`;
  console.log(`\n文章工作台已启动：${localUrl}`);
  if (authMode === 'key') {
    console.log('\n手机模式已开启。请让手机连接可信 Wi-Fi 或 ZeroTier，然后打开以下临时链接：');
    const addresses = Object.values(networkInterfaces()).flat().filter((item) => item && item.family === 'IPv4' && !item.internal && isPrivateIPv4(item.address));
    for (const item of addresses) console.log(`  http://${item.address}:${address.port}/?key=${accessKey}`);
    if (!addresses.length) console.log('  未发现可信的局域网 IPv4 地址，请检查 Wi-Fi 或 ZeroTier 连接。');
    console.log('\n该链接包含本次启动的临时密钥，请勿转发。不要把此端口映射到公网。');
  } else if (authMode === 'cloudflare') {
    console.log('Cloudflare Access 身份验证已启用；服务仅监听本机地址。');
  } else {
    console.log('仅监听本机地址。');
  }
  console.log('按 Ctrl+C 停止。\n');
  if (!process.argv.includes('--no-open') && process.platform === 'win32') {
    const child = spawn('cmd.exe', ['/d', '/s', '/c', `start "" "${localUrl}"`], { detached: true, stdio: 'ignore', windowsHide: true });
    child.unref();
  }
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) startServer();

server.on('close', async () => {
  if (previewHexoPromise) {
    try { await (await previewHexoPromise).exit(); } catch { /* 退出时无需阻断 */ }
  }
});
