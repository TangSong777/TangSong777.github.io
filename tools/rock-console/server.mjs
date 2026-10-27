#!/usr/bin/env node
/**
 * rock-console：Rock 5B+ 状态面板与 Web 终端。
 *
 * 部署模型与 manager.yanghanlin.cn 上的管理中心（article-studio）完全一致：
 *   Cloudflare 边缘 (HTTPS + 可选 Access) → 出站 Tunnel → cloudflared →
 *   本进程只监听 127.0.0.1:<port>，绝不直接对公网暴露。
 *
 * 本进程不写入任何硬件或系统状态：状态页纯采集，终端能力等同于一次 SSH 登录。
 */
import { createServer } from 'node:http';
import { brotliCompressSync, gzipSync, constants as zlibConstants } from 'node:zlib';
import { appendFileSync, mkdirSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { Worker } from 'node:worker_threads';
import { WebSocketServer } from 'ws';

import {
  SESSION_COOKIE,
  clientKey,
  createLoginLimiter,
  createSessionToken,
  isSameOriginRequest,
  isSecureRequest,
  parseCookies,
  sessionCookie,
  verifyPassword,
  verifySessionToken,
} from './auth.mjs';
import { DEFAULT_UNITS, createMetricsCollector, readJournalEvents, readUnitStatus } from './metrics.mjs';
import { createTerminalManager } from './terminal.mjs';
import { verifyTotp } from './totp.mjs';
import { SSO_COOKIE, createSsoToken, ssoCookie, verifySsoToken } from '../shared/sso.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = join(here, 'public');
const showHelp = process.argv.includes('--help') || process.argv.includes('-h');

/* --------------------------------------------------------------- 配置 */

const config = {
  // 监听地址刻意不可配置：本服务只允许经 Cloudflare Tunnel 从回环地址访问。
  host: '127.0.0.1',
  port: Number(process.env.ROCK_CONSOLE_PORT || 4180),
  passwordHash: String(process.env.ROCK_CONSOLE_PASSWORD_HASH || '').trim(),
  totpSecret: String(process.env.YANGHANLIN_TOTP_SECRET || process.env.ROCK_CONSOLE_TOTP_SECRET || '').trim(),
  ssoSecret: String(process.env.YANGHANLIN_SSO_SECRET || '').trim(),
  sessionSecret: String(process.env.ROCK_CONSOLE_SESSION_SECRET || '').trim(),
  sessionHours: Number(process.env.ROCK_CONSOLE_SESSION_HOURS || 12),
  maxSessions: Number(process.env.ROCK_CONSOLE_MAX_SESSIONS || 2),
  idleMinutes: Number(process.env.ROCK_CONSOLE_IDLE_MINUTES || 30),
  allowWrite: String(process.env.ROCK_CONSOLE_ALLOW_WRITE ?? '1') !== '0',
  units: String(process.env.ROCK_CONSOLE_UNITS || '').trim()
    ? String(process.env.ROCK_CONSOLE_UNITS).split(',').map((item) => item.trim()).filter(Boolean)
    : DEFAULT_UNITS,
  mounts: String(process.env.ROCK_CONSOLE_MOUNTS || '/').split(',').map((item) => item.trim()).filter(Boolean),
  auditFile: String(process.env.ROCK_CONSOLE_AUDIT_FILE || '').trim(),
  statusIntervalMs: Math.min(10000, Math.max(1000, Number(process.env.ROCK_CONSOLE_STATUS_INTERVAL_MS || 2000))),
  enabled: String(process.env.ROCK_CONSOLE_ENABLED ?? '1') !== '0',
};

if (showHelp) {
  process.stdout.write(`rock-console —— Rock 5B+ 状态面板与 Web 终端

启动方式：由 systemd 单元 rock-console.service 拉起（node server.mjs --no-open）

环境变量（放在 /srv/blog/config/rock-console.env，权限 600）：
  ROCK_CONSOLE_PORT               监听端口，默认 4180（仅绑定 127.0.0.1）
  ROCK_CONSOLE_PASSWORD_HASH      必填，scrypt$salt$hash，用 npm run hash-password 生成
  ROCK_CONSOLE_SESSION_SECRET     必填，随机会话密钥，至少 32 字符
  ROCK_CONSOLE_SESSION_HOURS      会话有效期，默认 12
  ROCK_CONSOLE_MAX_SESSIONS       并发终端数上限，默认 2
  ROCK_CONSOLE_IDLE_MINUTES       终端空闲断开时间，默认 30，0 表示不超时
  ROCK_CONSOLE_ALLOW_WRITE        设为 0 时所有终端强制只读
  ROCK_CONSOLE_UNITS              状态页监视的 systemd 单元，逗号分隔
  ROCK_CONSOLE_MOUNTS             磁盘使用率挂载点，逗号分隔，默认 /
  ROCK_CONSOLE_AUDIT_FILE         审计日志路径（JSON Lines，建议 600 权限）
  ROCK_CONSOLE_STATUS_INTERVAL_MS 状态推送间隔，默认 2000
  ROCK_CONSOLE_ENABLED            设为 0 时服务退回纯 503 维护页
`);
  process.exit(0);
}

function fatal(message) {
  process.stderr.write(`rock-console 启动失败：${message}\n`);
  process.exit(1);
}

if (!config.enabled) {
  process.stdout.write('rock-console 已被 ROCK_CONSOLE_ENABLED=0 停用。\n');
  process.exit(0);
}
if (!/^scrypt\$[a-f0-9]{32,}\$[a-f0-9]{128}$/i.test(config.passwordHash)) {
  fatal('ROCK_CONSOLE_PASSWORD_HASH 缺失或格式不对（应为 scrypt$salt$hash）。用 npm run hash-password 生成。');
}
if (config.sessionSecret.length < 32) {
  fatal('ROCK_CONSOLE_SESSION_SECRET 缺失或过短（至少 32 字符随机值）。');
}
if (!Number.isInteger(config.port) || config.port < 1024 || config.port > 65535) {
  fatal('ROCK_CONSOLE_PORT 必须是 1024-65535 之间的整数。');
}

const sessionMaxAgeSeconds = Math.max(300, config.sessionHours * 3600);
const csrfToken = randomBytes(24).toString('hex');
const loginLimiter = createLoginLimiter({ maxAttempts: 8, windowMs: 15 * 60 * 1000, lockMs: 15 * 60 * 1000 });

/* --------------------------------------------------------------- 审计 */

let auditStreamReady = false;
function audit(event) {
  const record = JSON.stringify({ at: new Date().toISOString(), ...event });
  if (config.auditFile) {
    try {
      if (!auditStreamReady) {
        mkdirSync(dirname(config.auditFile), { recursive: true, mode: 0o700 });
        auditStreamReady = true;
      }
      appendFileSync(config.auditFile, `${record}\n`, { mode: 0o600 });
    } catch {
      // 审计写入失败不影响服务
    }
  }
  if (process.env.NODE_ENV !== 'production' || /(?:session-open|session-close|session-exit|login-failure|login-locked)/.test(record)) {
    process.stdout.write(`audit ${record}\n`);
  }
}

/* --------------------------------------------------------------- 采集 */

const collector = createMetricsCollector({
  units: config.units,
  mounts: config.mounts,
});

// 采集在 worker 线程里跑，主线程只接收快照，避免阻塞 WebSocket 终端输入。
let latestSnapshot = null;
let metricsWorker = null;
let fallbackTimer = null;

function publishSnapshot(snapshot) {
  latestSnapshot = snapshot;
  if (subscribers.size > 0) broadcast(snapshot);
}

/** worker 首帧到达前（或线程不可用）用同步采集兜底。 */
const readSnapshot = () => latestSnapshot || collector.snapshot();

const terminals = createTerminalManager({
  maxSessions: config.maxSessions,
  idleTimeoutMs: config.idleMinutes > 0 ? config.idleMinutes * 60 * 1000 : 0,
  audit,
});

setInterval(() => terminals.sweep(), 60_000).unref();

/* --------------------------------------------------------------- 响应 */

const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Content-Security-Policy': [
    "default-src 'self'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "img-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self'",
    "connect-src 'self'",
  ].join('; '),
};

function sendJson(res, status, body, extraHeaders = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    ...securityHeaders,
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...extraHeaders,
  });
  res.end(payload);
  return true;
}

const fail = (res, status, message, extraHeaders = {}) => sendJson(res, status, { ok: false, message }, extraHeaders);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.json': 'application/json; charset=utf-8',
};

/* ---------------------------------------------------------- 静态资源压缩与缓存
   app.js 51 KB + styles.css 31 KB + xterm 相关脚本，原来既不压缩也只缓存 300 秒。
   文本资源按 Accept-Encoding 走 brotli/gzip；带 ?v= 的走一年 immutable；
   HTML 仍 no-store。 */

const COMPRESSIBLE = new Set(['.js', '.css', '.html', '.json', '.svg', '.txt', '.map', '.webmanifest']);
const compressCache = new Map();

function pickEncoding(req) {
  const header = String(req.headers['accept-encoding'] || '');
  if (/\bbr\b/.test(header)) return 'br';
  if (/\bgzip\b/.test(header)) return 'gzip';
  return '';
}

function encodeStaticBody(cacheKey, body, encoding) {
  const key = cacheKey + '|' + encoding;
  const cached = compressCache.get(key);
  if (cached) return cached;
  const encoded = encoding === 'br'
    ? brotliCompressSync(body, { params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 5 } })
    : gzipSync(body, { level: 6 });
  if (compressCache.size > 120) compressCache.clear();
  compressCache.set(key, encoded);
  return encoded;
}

async function serveStatic(req, res, pathname, search = '') {
  const relative = normalize(decodeURIComponent(pathname)).replace(/^([/\\])+/, '');
  const target = resolve(publicDir, relative === '' ? 'index.html' : relative);
  if (!target.startsWith(publicDir + sep) && target !== publicDir) return fail(res, 403, '禁止访问。');
  try {
    const info = await stat(target);
    if (!info.isFile()) return fail(res, 404, '未找到。');
    let body = await readFile(target);
    const ext = extname(target).toLowerCase();
    const isHtml = ext === '.html';
    const versioned = !isHtml && (/[?&]v=/.test(search) || /^\/(js|css|vendor)\//.test(pathname));
    const cacheControl = isHtml ? 'no-store' : (versioned ? 'public, max-age=31536000, immutable' : 'public, max-age=300');
    const etag = 'W/"' + info.size.toString(16) + '-' + Math.round(info.mtimeMs).toString(16) + '"';
    const headers = {
      ...securityHeaders,
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': cacheControl,
      ETag: etag,
      Vary: 'Accept-Encoding',
    };
    if (req.headers['if-none-match'] === etag) {
      res.writeHead(304, headers);
      res.end();
      return true;
    }
    if (COMPRESSIBLE.has(ext) && body.length > 1024) {
      const encoding = pickEncoding(req);
      if (encoding) {
        body = encodeStaticBody(target + ':' + Math.round(info.mtimeMs), body, encoding);
        headers['Content-Encoding'] = encoding;
      }
    }
    headers['Content-Length'] = body.length;
    res.writeHead(200, headers);
    res.end(body);
    return true;
  } catch {
    return fail(res, 404, '未找到。');
  }
}

async function readJsonBody(req, limit = 64 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error('请求体过大。');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

/* --------------------------------------------------------------- 认证 */

function currentSession(req) {
  const cookies = parseCookies(req.headers.cookie);
  const local = verifySessionToken(cookies.get(SESSION_COOKIE), config.sessionSecret);
  if (local) return local;
  // 本站没有会话时，接受另一站点签发的跨子域 SSO 票据。
  if (config.ssoSecret) {
    const sso = verifySsoToken(cookies.get(SSO_COOKIE), config.ssoSecret);
    if (sso) return sso;
  }
  return null;
}

/** 非 GET 请求统一要求：已登录 + 同源 + CSRF 令牌。 */
function authorizeMutation(req, res) {
  if (!currentSession(req)) {
    fail(res, 401, '未登录或会话已过期。');
    return false;
  }
  if (!isSameOriginRequest(req)) {
    audit({ event: 'csrf-origin-reject', path: req.url, origin: req.headers.origin || null });
    fail(res, 403, '请求来源不合法。');
    return false;
  }
  if (req.headers['x-rock-console-token'] !== csrfToken) {
    audit({ event: 'csrf-token-reject', path: req.url });
    fail(res, 403, '缺少或错误的 CSRF 令牌。');
    return false;
  }
  return true;
}

function requireSession(req, res) {
  if (currentSession(req)) return true;
  fail(res, 401, '未登录或会话已过期。');
  return false;
}

/* --------------------------------------------------------------- SSE */

const subscribers = new Set();

function broadcast(payload) {
  const frame = `event: status\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of [...subscribers]) {
    try {
      res.write(frame);
    } catch {
      subscribers.delete(res);
    }
  }
}

function startMetrics() {
  if (metricsWorker || fallbackTimer) return;
  try {
    metricsWorker = new Worker(new URL('./metrics-worker.mjs', import.meta.url), {
      workerData: {
        units: config.units,
        mounts: config.mounts,
        includeDocker: true,
        slowTtlMs: 5000,
        intervalMs: config.statusIntervalMs,
      },
    });
    metricsWorker.on('message', (message) => {
      if (message?.type === 'snapshot') return publishSnapshot(message.snapshot);
      if (message?.type === 'error') process.stderr.write(`状态采集失败：${message.message}\n`);
    });
    metricsWorker.on('error', (error) => {
      process.stderr.write(`采集线程异常，回退主线程：${error.message}\n`);
      metricsWorker = null;
      startFallbackTimer();
    });
    metricsWorker.unref();
  } catch (error) {
    process.stderr.write(`无法启动采集线程，回退主线程：${error.message}\n`);
    startFallbackTimer();
  }
}

/** Worker 不可用时的兜底：主线程按同样间隔采集。 */
function startFallbackTimer() {
  if (fallbackTimer) return;
  fallbackTimer = setInterval(() => {
    if (subscribers.size === 0) return;
    try {
      publishSnapshot(collector.snapshot());
    } catch (error) {
      process.stderr.write(`状态采集失败：${error.message}\n`);
    }
  }, config.statusIntervalMs);
  fallbackTimer.unref();
}

/* --------------------------------------------------------------- 服务活动 */

/** 单元名 → 中文名，用于把 systemd 的英文消息转成中文。 */
const SERVICE_LABELS = {
  'article-studio.service': '管理中心',
  'cloudflared.service': 'Cloudflare 隧道',
  'history-site.service': '岁月史书站点',
  'rock5b-fan-fixed.service': '风扇控制',
  'rock-console.service': '本面板',
  'siyuan-notes-publish.service': '学习笔记发布',
  'siyuan-notes-publish.timer': '发布定时器',
  'docker.service': 'Docker 引擎',
};

/** 去掉单元名末尾的标点，并尽量换成中文名。 */
function describeUnit(value) {
  const unit = String(value || '').replace(/[.,;:]+$/, '');
  return SERVICE_LABELS[unit] || unit;
}

/** cloudflared 的日志自带 "2026-..Z ERR " 前缀，摘要前先剥掉。 */
function stripJournalPrefix(text) {
  return String(text || '').replace(/^\d{4}-\d{2}-\d{2}T\S+\s+(?:ERR|INF|WRN|DBG|FTL|TRC)\s+/i, '').trim();
}

/**
 * 把 journal 的英文消息归纳成中文短句。
 * 返回 null 表示这条属于噪音（目标达成、切片创建、资源统计等），前端直接跳过。
 */
const JOURNAL_RULES = [
  [/^Started (\S+)/i, (m) => `已启动 ${describeUnit(m)}`],
  [/^Starting (\S+)/i, (m) => `正在启动 ${describeUnit(m)}`],
  [/^Stopping (\S+)/i, (m) => `正在停止 ${describeUnit(m)}`],
  [/^Stopped (\S+)/i, (m) => `已停止 ${describeUnit(m)}`],
  [/^Reloading\b/i, () => '正在重载配置'],
  [/^Reloaded (\S+)/i, (m) => `配置已重载（${describeUnit(m)}）`],
  [/^Failed to start (\S+)/i, (m) => `启动失败：${describeUnit(m)}`],
  [/failed with result '([^']+)'/i, (m) => `运行失败（${m}）`],
  [/^Scheduled restart job, restart counter is at (\d+)/i, (m) => `计划重启（第 ${m} 次）`],
  [/^Main process exited, code=([^,\s]+)/i, (m) => `主进程退出（${m}）`],
  [/^Registered tunnel connection.*location=(\w+)/i, (m) => `已建立隧道连接（节点 ${m}）`],
  [/canceled by remote with error code 0/i, () => '连接被远端正常关闭'],
  [/^Request failed error="([^"]+)"/i, (m) => `请求失败：${m}`],
  [/^error="([^"]+)"/i, (m) => `错误：${m}`],
  [/^Starting tunnel/i, () => '隧道启动中'],
  [/^Listening on/i, () => '开始监听'],
  [/^Reached target/i, () => null],
  [/^Created slice/i, () => null],
  [/^Consumed .+ CPU time/i, () => null],
  [/^Time spent on .+/i, () => null],
  [/^Closed .+\.$/i, () => null],
  [/^Initial protocol/i, () => null],
];

function summarizeJournalMessage(message) {
  const text = stripJournalPrefix(message);
  if (!text) return null;
  for (const [pattern, build] of JOURNAL_RULES) {
    const match = pattern.exec(text);
    if (match) return build(match[1]);
  }
  return text.length > 90 ? `${text.slice(0, 90)}…` : text;
}

// 服务活动缓存：前端自动刷新时复用最近结果，避免每两秒 fork 两个子进程
const ACTIVITY_CACHE_MS = 3000;
const activityCache = new Map();

function buildActivity(unit, lines) {
  const key = `${unit}|${lines}`;
  const cached = activityCache.get(key);
  if (cached && Date.now() - cached.at < ACTIVITY_CACHE_MS) return cached.value;

  const value = buildActivityUncached(unit, lines);
  if (value) activityCache.set(key, { at: Date.now(), value });

  for (const [entryKey, entry] of activityCache) {
    if (Date.now() - entry.at > ACTIVITY_CACHE_MS * 4) activityCache.delete(entryKey);
  }
  return value;
}

function buildActivityUncached(unit, lines) {
  const status = readUnitStatus(unit);
  const entries = readJournalEvents(unit, lines);
  if (entries === null) return null;

  const events = [];
  let errors = 0;
  let warnings = 0;
  for (const entry of entries) {
    const message = String(entry.MESSAGE ?? '');
    const summary = summarizeJournalMessage(message);
    if (summary === null) continue;

    const plain = stripJournalPrefix(message);
    const normalClose = /canceled by remote with error code 0/i.test(plain);
    const priority = Number(entry.PRIORITY ?? 6);
    let level = priority <= 3 ? 'error' : priority === 4 ? 'warn' : 'info';
    if (normalClose) level = 'info';
    else if (/(^|\s)(ERR|ERROR|FATAL|CRIT)\b|\bfailed\b|\berror=/i.test(plain)) level = 'error';
    else if (/(^|\s)(WRN|WARN)\b|\btimeout\b|\bretry\b/i.test(plain)) level = 'warn';

    if (level === 'error') errors += 1;
    if (level === 'warn') warnings += 1;
    const micros = Number(entry.__REALTIME_TIMESTAMP || 0);
    events.push({
      at: micros ? new Date(micros / 1000).toISOString() : null,
      level,
      summary,
      message: message.slice(0, 400),
    });
  }
  events.reverse();
  return { unit, status, stats: { total: events.length, errors, warnings }, events };
}

/* --------------------------------------------------------------- 路由 */

const server = createServer(async (req, res) => {
  let url;
  try {
    url = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);
  } catch {
    return fail(res, 400, '非法请求。');
  }
  const { pathname } = url;

  try {
    /* --- 会话信息：登录页需要知道当前状态，且只在这个响应里下发 CSRF 令牌 --- */
    if (pathname === '/api/config' && req.method === 'GET') {
      const authenticated = Boolean(currentSession(req));
      return sendJson(res, 200, {
        ok: true,
        authMode: 'password',
        authenticated,
        csrfToken: authenticated ? csrfToken : null,
        allowWrite: config.allowWrite,
        maxSessions: config.maxSessions,
        idleMinutes: config.idleMinutes,
        statusIntervalMs: config.statusIntervalMs,
        units: config.units,
        totpEnabled: Boolean(config.totpSecret),
      });
    }

    if (pathname === '/api/login' && req.method === 'POST') {
      if (!isSameOriginRequest(req)) return fail(res, 403, '请求来源不合法。');
      const key = clientKey(req);
      const gate = loginLimiter.check(key);
      if (!gate.allowed) {
        audit({ event: 'login-locked', source: key });
        return fail(res, 429, `尝试过于频繁，请 ${gate.retryAfterSeconds} 秒后再试。`, {
          'Retry-After': String(gate.retryAfterSeconds),
        });
      }
      const body = await readJsonBody(req);
      if (!verifyPassword(body.password, config.passwordHash)) {
        loginLimiter.recordFailure(key);
        audit({ event: 'login-failure', source: key });
        return fail(res, 401, '密码不正确。');
      }
      if (config.totpSecret) {
        const code = String(body.totp || '').replace(/\s+/g, '');
        if (!code) {
          return fail(res, 401, '请输入动态验证码。', { 'X-Rock-Console-Totp': 'required' });
        }
        if (!verifyTotp(config.totpSecret, code)) {
          loginLimiter.recordFailure(key);
          audit({ event: 'login-failure', source: key, reason: 'totp' });
          return fail(res, 401, '动态验证码不正确。');
        }
      }
      loginLimiter.recordSuccess(key);
      const token = createSessionToken(config.sessionSecret, sessionMaxAgeSeconds);
      audit({ event: 'login-success', source: key });
      const loginCookies = [
        sessionCookie(token, { maxAge: sessionMaxAgeSeconds, secure: isSecureRequest(req) }),
      ];
      if (config.ssoSecret) {
        loginCookies.push(ssoCookie(createSsoToken(config.ssoSecret, sessionMaxAgeSeconds), {
          maxAge: sessionMaxAgeSeconds,
          secure: isSecureRequest(req),
          host: req.headers.host,
        }));
      }
      return sendJson(res, 200, { ok: true, csrfToken }, { 'Set-Cookie': loginCookies });
    }

    if (pathname === '/api/logout' && req.method === 'POST') {
      if (!authorizeMutation(req, res)) return true;
      audit({ event: 'logout', source: clientKey(req) });
      const logoutCookies = [sessionCookie('', { maxAge: 0, secure: isSecureRequest(req) })];
      if (config.ssoSecret) {
        logoutCookies.push(ssoCookie('', { maxAge: 0, secure: isSecureRequest(req), host: req.headers.host }));
      }
      return sendJson(res, 200, { ok: true }, { 'Set-Cookie': logoutCookies });
    }

    if (pathname === '/api/status' && req.method === 'GET') {
      if (!requireSession(req, res)) return true;
      return sendJson(res, 200, { ok: true, status: readSnapshot() });
    }

    if (pathname === '/api/stream' && req.method === 'GET') {
      if (!requireSession(req, res)) return true;
      res.writeHead(200, {
        ...securityHeaders,
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-store, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      res.write(': connected\n\n');
      subscribers.add(res);
      startMetrics();
      try {
        res.write(`event: status\ndata: ${JSON.stringify(readSnapshot())}\n\n`);
      } catch {
        subscribers.delete(res);
      }
      const heartbeat = setInterval(() => {
        try {
          res.write(': ping\n\n');
        } catch {
          clearInterval(heartbeat);
          subscribers.delete(res);
        }
      }, 20_000);
      heartbeat.unref();
      req.on('close', () => {
        clearInterval(heartbeat);
        subscribers.delete(res);
      });
      return true;
    }

    if (pathname === '/api/activity' && req.method === 'GET') {
      if (!requireSession(req, res)) return true;
      const unit = String(url.searchParams.get('unit') || '');
      if (!config.units.includes(unit)) return fail(res, 400, '该单元不在监视列表中。');
      const lines = Math.min(200, Math.max(10, Number(url.searchParams.get('lines') || 80)));
      const activity = buildActivity(unit, lines);
      if (!activity) return fail(res, 502, '读取服务活动失败（需要 systemd-journal 组权限）。');
      return sendJson(res, 200, { ok: true, ...activity });
    }

    /* --- 终端会话：元数据经 HTTP 管理，数据流走 WebSocket --- */
    if (pathname === '/api/terminal' && req.method === 'GET') {
      if (!requireSession(req, res)) return true;
      return sendJson(res, 200, { ok: true, sessions: terminals.list(), allowWrite: config.allowWrite });
    }

    if (pathname === '/api/terminal' && req.method === 'POST') {
      if (!authorizeMutation(req, res)) return true;
      const body = await readJsonBody(req);
      const requested = Number(body.cols) || 100;
      const rows = Number(body.rows) || 30;
      // ROCK_CONSOLE_ALLOW_WRITE=0 时强制只读，忽略客户端请求。
      const readOnly = !config.allowWrite || Boolean(body.readOnly);
      const session = terminals.createSession({
        cols: requested,
        rows,
        readOnly,
        source: clientKey(req),
        label: String(body.label || '').slice(0, 64),
      });
      return sendJson(res, 200, { ok: true, sessionId: session.id, readOnly: session.readOnly });
    }

    if (pathname.startsWith('/api/terminal/') && req.method === 'DELETE') {
      if (!authorizeMutation(req, res)) return true;
      const id = pathname.slice('/api/terminal/'.length);
      const session = terminals.getSession(id);
      if (!session) return fail(res, 404, '会话不存在。');
      session.close('client-request');
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === 'GET' || req.method === 'HEAD') {
      if (pathname === '/') return serveStatic(req, res, '/index.html', url.search);
      return serveStatic(req, res, pathname, url.search);
    }

    return fail(res, 405, '不支持的请求方法。');
  } catch (error) {
    audit({ event: 'request-error', path: pathname, message: error.message });
    return fail(res, 500, `服务端错误：${error.message}`);
  }
});

/* --------------------------------------------------------- WebSocket */

const wss = new WebSocketServer({ noServer: true, maxPayload: 256 * 1024 });

function rejectUpgrade(socket, status, message) {
  socket.write(`HTTP/1.1 ${status} ${message}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
  socket.destroy();
}

server.on('upgrade', (req, socket, head) => {
  let pathname;
  try {
    pathname = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`).pathname;
  } catch {
    return rejectUpgrade(socket, 400, 'Bad Request');
  }
  if (pathname !== '/ws') return rejectUpgrade(socket, 404, 'Not Found');
  if (!currentSession(req)) return rejectUpgrade(socket, 401, 'Unauthorized');
  // 浏览器不会为 WebSocket 附带自定义头，因此 Origin 校验是这里唯一的跨站防线。
  if (!isSameOriginRequest(req)) {
    audit({ event: 'ws-origin-reject', origin: req.headers.origin || null });
    return rejectUpgrade(socket, 403, 'Forbidden');
  }
  return wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
});

wss.on('connection', (ws, req) => {
  const url = new URL(req.url || '/ws', `http://${req.headers.host || '127.0.0.1'}`);
  const sessionId = url.searchParams.get('session') || '';
  const session = terminals.getSession(sessionId);
  if (!session) {
    ws.send(JSON.stringify({ t: 'error', message: '终端会话不存在或已结束。' }));
    ws.close(1008, 'no-session');
    return;
  }

  const source = clientKey(req);
  audit({ event: 'ws-attach', sessionId: session.id, source });

  const unsubscribe = session.subscribe((text) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ t: 'out', d: text }));
  });
  ws.send(JSON.stringify({ t: 'ready', id: session.id, readOnly: session.readOnly, cols: session.cols, rows: session.rows }));
  const replay = session.replay();
  if (replay) ws.send(JSON.stringify({ t: 'out', d: replay }));

  let inputBytes = 0;
  ws.on('message', (raw) => {
    let message;
    try {
      message = JSON.parse(String(raw));
    } catch {
      return;
    }
    if (message.t === 'in') {
      const data = String(message.d ?? '');
      inputBytes += Buffer.byteLength(data);
      if (!session.write(data) && session.readOnly) {
        ws.send(JSON.stringify({ t: 'notice', message: '当前是只读会话，输入已被忽略。' }));
      }
      return;
    }
    if (message.t === 'resize') {
      session.resize(message.cols, message.rows);
      return;
    }
    if (message.t === 'ping') ws.send(JSON.stringify({ t: 'pong' }));
  });

  ws.on('close', () => {
    unsubscribe();
    audit({ event: 'ws-detach', sessionId: session.id, source, inputBytes });
  });
  ws.on('error', () => unsubscribe());
});

/* --------------------------------------------------------------- 启动 */

server.listen(config.port, config.host, () => {
  audit({ event: 'server-start', port: config.port, host: config.host, maxSessions: config.maxSessions, allowWrite: config.allowWrite });
  startMetrics();
  process.stdout.write([
    'rock-console 已启动',
    `  监听           http://${config.host}:${config.port}（仅回环，公网入口走 Cloudflare Tunnel）`,
    '  认证模式       password（scrypt + HMAC 会话 Cookie）',
    `  并发终端上限   ${config.maxSessions}`,
    `  终端可写       ${config.allowWrite ? '是' : '否（强制只读）'}`,
    `  空闲断开       ${config.idleMinutes > 0 ? `${config.idleMinutes} 分钟` : '不超时'}`,
    `  状态推送间隔   ${config.statusIntervalMs} ms`,
    `  监视单元       ${config.units.join(', ')}`,
    `  审计日志       ${config.auditFile || '仅 journal'}`,
    '',
  ].join('\n'));
});

function shutdown(signal) {
  audit({ event: 'server-stop', signal });
  terminals.closeAll(signal);
  if (metricsWorker) {
    metricsWorker.terminate().catch(() => {});
    metricsWorker = null;
  }
  if (fallbackTimer) clearInterval(fallbackTimer);
  for (const res of subscribers) {
    try {
      res.end();
    } catch {
      // 连接可能已经断开
    }
  }
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
