import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, readdir, stat, rename } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { networkInterfaces } from 'node:os';
import Hexo from 'hexo';

const studioDir = dirname(fileURLToPath(import.meta.url));
const repoDir = resolve(studioDir, '..', '..');
const postsDir = join(repoDir, 'source', '_posts');
const imagesDir = join(repoDir, 'source', 'images', 'posts');
const publicDir = join(studioDir, 'public');
const networkMode = process.argv.includes('--network');
const host = networkMode ? '0.0.0.0' : '127.0.0.1';
const requestedPort = Number(process.env.ARTICLE_STUDIO_PORT || 4173);
const csrfToken = randomBytes(24).toString('hex');
const accessKey = networkMode ? randomBytes(18).toString('base64url') : '';
const maxBodyBytes = 25 * 1024 * 1024;
const renameStateFile = join(repoDir, '.article-studio-renames.json');
let previewHexoPromise;
let previewAssetPromise;
let previewRenderQueue = Promise.resolve();

function send(res, status, body, contentType = 'application/json; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': contentType,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-src 'self'; connect-src 'self'",
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
  return req.headers['x-article-studio-token'] === csrfToken;
}

function requireNetworkAccess(req) {
  return !networkMode || req.headers['x-article-studio-key'] === accessKey;
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

function resolveInside(base, relPath, extension = '') {
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
      await runChecked('npm.cmd', ['run', 'build'], 'Hexo 预览样式构建');
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
  await writeFile(renameStateFile, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function safeSlug(value) {
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
    'image/webp': '.webp', 'image/svg+xml': '.svg', 'image/avif': '.avif',
  };
  const expectedExt = extensionByMime[mime];
  if (!expectedExt) throw new Error('仅支持 PNG、JPEG、GIF、WebP、SVG 和 AVIF 图片。');
  const raw = String(value || 'image').normalize('NFKC').replace(/[<>:"/\\|?*\x00-\x1F]/g, '-');
  const base = raw.replace(/\.[^.]+$/, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^[.-]+|[. ]+$/g, '') || 'image';
  return `${Date.now()}-${base}${expectedExt}`;
}

function scanSensitive(content) {
  const body = stripFrontMatter(content);
  const rules = [
    ['疑似 ZeroTier 网络 ID', /\b[0-9a-fA-F]{16}\b/g],
    ['疑似私钥', /-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/g],
    ['疑似 GitHub Token', /\b(?:ghp|github_pat)_[A-Za-z0-9_]{20,}\b/g],
    ['疑似通用密钥', /\b(?:api[_-]?key|access[_-]?token|secret)\s*[:=]\s*['"]?[A-Za-z0-9_\-]{12,}/gi],
  ];
  return rules.flatMap(([label, regex]) => {
    const matches = [...body.matchAll(regex)];
    return matches.slice(0, 3).map((match) => ({
      label,
      line: body.slice(0, match.index).split('\n').length,
      sample: `${match[0].slice(0, 4)}…${match[0].slice(-4)}`,
    }));
  });
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

async function saveArticle(articlePath, content) {
  const target = resolveInside(postsDir, articlePath, '.md');
  if (typeof content !== 'string' || content.length === 0) throw new Error('文章内容不能为空。');
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content.replace(/\r?\n/g, '\n'), 'utf8');
  return target;
}

async function routeApi(req, res, url) {
  if (req.method === 'GET' && url.pathname === '/api/config') {
    return send(res, 200, { ok: true, token: csrfToken, repo: repoDir });
  }

  if (req.method === 'GET' && url.pathname === '/api/articles') {
    return send(res, 200, { ok: true, articles: await walkMarkdown(postsDir) });
  }

  if (req.method === 'GET' && url.pathname === '/api/article') {
    const articlePath = url.searchParams.get('path');
    const target = resolveInside(postsDir, articlePath, '.md');
    if (!existsSync(target)) return fail(res, 404, '文章不存在。');
    return send(res, 200, { ok: true, path: normalizeRelativePath(articlePath), content: await readFile(target, 'utf8') });
  }

  if (req.method !== 'GET' && !requireLocalMutation(req)) return fail(res, 403, '本地会话校验失败，请刷新页面。');

  if (req.method === 'POST' && url.pathname === '/api/create') {
    const data = await readJson(req);
    const slug = safeSlug(data.slug);
    const articlePath = `${slug}.md`;
    const target = resolveInside(postsDir, articlePath, '.md');
    if (existsSync(target)) return fail(res, 409, '同名文章已经存在。');
    const now = new Date();
    const localDate = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    }).format(now).replace(',', '');
    const title = String(data.title || slug).replace(/[\r\n]/g, ' ').trim();
    const content = `---\ntitle: ${title}\ndate: ${localDate}\nupdated: ${localDate}\ncategories:\ntags:\ndescription:\n---\n\n在这里写文章摘要。\n\n<!-- more -->\n\n在这里继续写正文。\n`;
    await saveArticle(articlePath, content);
    return send(res, 201, { ok: true, path: articlePath, content });
  }

  if (req.method === 'POST' && url.pathname === '/api/save') {
    const data = await readJson(req);
    await saveArticle(data.path, data.content);
    return send(res, 200, { ok: true, message: '文章已保存到本地。', warnings: scanSensitive(data.content) });
  }

  if (req.method === 'POST' && url.pathname === '/api/preview') {
    const data = await readJson(req);
    return send(res, 200, { ok: true, html: await renderWithHexo(data.content) });
  }

  if (req.method === 'POST' && url.pathname === '/api/rename') {
    const data = await readJson(req);
    const oldPath = normalizeRelativePath(data.path);
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
    await writeFile(newTarget, content, 'utf8');

    const renameState = await readRenameState();
    const originalPath = renameState[oldPath]?.originalPath || oldPath;
    delete renameState[oldPath];
    renameState[newPath] = { originalPath, renamedAt: new Date().toISOString() };
    await writeRenameState(renameState);

    return send(res, 200, { ok: true, path: newPath, content, message: '文章文件名和图片路径已更新。' });
  }

  if (req.method === 'POST' && url.pathname === '/api/image') {
    const data = await readJson(req);
    const articlePath = normalizeRelativePath(data.articlePath);
    resolveInside(postsDir, articlePath, '.md');
    const mime = String(data.mime || '');
    const fileName = safeImageName(data.name, mime);
    const base64 = String(data.data || '').replace(/^data:[^;]+;base64,/, '');
    const bytes = Buffer.from(base64, 'base64');
    if (!bytes.length) throw new Error('图片内容为空。');
    if (bytes.length > 20 * 1024 * 1024) throw new Error('单张图片不能超过 20 MB。');
    const articleSlug = safeSlug(articlePath.replace(/\.md$/i, '').replaceAll('/', '-'));
    const folder = resolveInside(imagesDir, articleSlug);
    await mkdir(folder, { recursive: true });
    await writeFile(join(folder, fileName), bytes);
    return send(res, 201, { ok: true, markdownPath: `/images/posts/${articleSlug}/${encodeURIComponent(fileName)}` });
  }

  if (req.method === 'POST' && url.pathname === '/api/publish') {
    const data = await readJson(req);
    await saveArticle(data.path, data.content);
    const warnings = scanSensitive(data.content);
    if (warnings.length && !data.confirmWarnings) {
      return send(res, 409, { ok: false, code: 'SENSITIVE_WARNING', message: '检测到可能的敏感内容，请检查后确认。', warnings });
    }

    const articlePath = normalizeRelativePath(data.path);
    const articleSlug = safeSlug(articlePath.replace(/\.md$/i, '').replaceAll('/', '-'));
    const repoArticle = toPosix(relative(repoDir, resolveInside(postsDir, articlePath, '.md')));
    const imageFolder = toPosix(relative(repoDir, resolveInside(imagesDir, articleSlug)));
    const pathspecs = [repoArticle];
    if (existsSync(join(repoDir, imageFolder))) pathspecs.push(imageFolder);
    const renameState = await readRenameState();
    const renameInfo = renameState[articlePath];
    if (renameInfo?.originalPath) {
      const originalArticle = toPosix(relative(repoDir, resolveInside(postsDir, renameInfo.originalPath, '.md')));
      const originalSlug = safeSlug(renameInfo.originalPath.replace(/\.md$/i, '').replaceAll('/', '-'));
      const originalImageFolder = toPosix(relative(repoDir, resolveInside(imagesDir, originalSlug)));
      if ((await run('git', ['ls-files', '--error-unmatch', '--', originalArticle])).code === 0) pathspecs.push(originalArticle);
      if ((await run('git', ['ls-files', '--error-unmatch', '--', originalImageFolder])).code === 0) pathspecs.push(originalImageFolder);
    }

    await runChecked('npm.cmd', ['run', 'clean'], '清理 Hexo 缓存');
    const build = await runChecked('npm.cmd', ['run', 'build'], 'Hexo 构建检查');
    await runChecked('git', ['add', '--', ...pathspecs], '暂存文章');
    const diff = await run('git', ['diff', '--cached', '--quiet', '--', ...pathspecs]);
    let committed = false;
    let commitOutput = '没有需要提交的新改动。';
    if (diff.code === 1) {
      const title = frontMatterValue(data.content, 'title') || articleSlug;
      const message = String(data.message || `Publish article: ${title}`).replace(/[\r\n]/g, ' ').trim();
      const commit = await runChecked('git', ['commit', '--only', '-m', message, '--', ...pathspecs], 'Git 提交');
      committed = true;
      commitOutput = commit.stdout.trim();
    } else if (diff.code !== 0) {
      throw Object.assign(new Error('无法检查 Git 改动。'), { details: diff.stderr });
    }
    const push = await runChecked('git', ['push'], 'Git 推送');
    if (renameInfo) {
      delete renameState[articlePath];
      await writeRenameState(renameState);
    }
    return send(res, 200, {
      ok: true,
      message: committed ? '文章已构建、提交并推送。GitHub Actions 将继续部署。' : '没有新改动，已确认远端同步。',
      logs: [build.stdout, commitOutput, push.stdout, push.stderr].filter(Boolean).join('\n').trim(),
      warnings,
    });
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
    if (url.pathname.startsWith('/api/')) {
      if (!requireNetworkAccess(req)) {
        fail(res, 401, '手机访问密钥无效，请使用启动终端显示的完整链接。');
        return;
      }
      const handled = await routeApi(req, res, url);
      if (handled === false) fail(res, 404, '接口不存在。');
      return;
    }
    if (!await routeStatic(req, res, url)) fail(res, 404, '页面不存在。');
  } catch (error) {
    console.error(error);
    fail(res, 500, error.message || '本地工具发生错误。', error.details || '');
  }
});

server.listen(requestedPort, host, async () => {
  const address = server.address();
  const localUrl = `http://127.0.0.1:${address.port}${networkMode ? `/?key=${accessKey}` : ''}`;
  console.log(`\n文章工作台已启动：${localUrl}`);
  if (networkMode) {
    console.log('\n手机模式已开启。请让手机连接可信 Wi-Fi 或 ZeroTier，然后打开以下临时链接：');
    const addresses = Object.values(networkInterfaces()).flat().filter((item) => item && item.family === 'IPv4' && !item.internal && isPrivateIPv4(item.address));
    for (const item of addresses) console.log(`  http://${item.address}:${address.port}/?key=${accessKey}`);
    if (!addresses.length) console.log('  未发现可信的局域网 IPv4 地址，请检查 Wi-Fi 或 ZeroTier 连接。');
    console.log('\n该链接包含本次启动的临时密钥，请勿转发。不要把此端口映射到公网。');
  } else {
    console.log('仅监听本机地址。');
  }
  console.log('按 Ctrl+C 停止。\n');
  if (!process.argv.includes('--no-open') && process.platform === 'win32') {
    const child = spawn('cmd.exe', ['/d', '/s', '/c', `start "" "${localUrl}"`], { detached: true, stdio: 'ignore', windowsHide: true });
    child.unref();
  }
});

server.on('close', async () => {
  if (previewHexoPromise) {
    try { await (await previewHexoPromise).exit(); } catch { /* 退出时无需阻断 */ }
  }
});
