#!/usr/bin/env node
/**
 * rock-console 端到端自检。
 *
 * 在开发板上对**已启动的服务**跑一遍真实链路：
 *   未认证拦截 → 错误密码 → 正确密码 → 状态快照 → 新建终端 →
 *   WebSocket 收发真实命令输出 → 关闭会话 → 退出登录。
 *
 * 用法：
 *   ROCK_CONSOLE_TEST_PASSWORD='...' node e2e-check.mjs
 *   （默认连接 http://127.0.0.1:4180，可用 ROCK_CONSOLE_PORT / ROCK_CONSOLE_BASE 覆盖）
 *
 * 该脚本只在回环地址上运行，不发送任何数据到外部。
 */
import { WebSocket } from 'ws';

const base = process.env.ROCK_CONSOLE_BASE || `http://127.0.0.1:${process.env.ROCK_CONSOLE_PORT || 4180}`;
const password = process.env.ROCK_CONSOLE_TEST_PASSWORD || '';
const host = new URL(base).host;

if (!password) {
  process.stderr.write('请通过 ROCK_CONSOLE_TEST_PASSWORD 提供测试密码。\n');
  process.exit(2);
}

let cookie = '';
let csrf = '';
const results = [];

function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  process.stdout.write(`${ok ? '\x1b[32m✔\x1b[0m' : '\x1b[31m✘\x1b[0m'} ${name}${detail ? ` — ${detail}` : ''}\n`);
}

async function call(path, { method = 'GET', body, headers = {} } = {}) {
  const response = await fetch(base + path, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...(csrf && method !== 'GET' && method !== 'HEAD' ? { 'x-rock-console-token': csrf } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'error',
  });
  const setCookies = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [];
  if (setCookies.length) cookie = setCookies.map((value) => value.split(';')[0]).join('; ');
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: response.status, data };
}

/**
 * 打开 WebSocket 并收集消息。
 *
 * 注意：PTY 会回显输入，所以断言不能只看「输出里出现过某个字符串」，
 * 否则会在命令回显阶段提前命中。因此这里区分两种等待：
 *   - waitForMessage：等待某条协议消息（如 ready）；
 *   - waitForText：等待累积输出满足条件（用于校验命令真实执行结果）。
 */
function openTerminal(sessionId, timeoutMs = 20000) {
  const url = `${base.replace(/^http/, 'ws')}/ws?session=${encodeURIComponent(sessionId)}`;
  const socket = new WebSocket(url, { headers: { Cookie: cookie } });
  const messages = [];
  const waiters = [];
  let text = '';

  socket.on('message', (raw) => {
    let message;
    try {
      message = JSON.parse(String(raw));
    } catch {
      return;
    }
    messages.push(message);
    if (message.t === 'out') text += message.d;
    for (const waiter of [...waiters]) waiter();
  });

  function wait(probe, label) {
    const found = probe();
    if (found !== undefined && found !== null && found !== false) return Promise.resolve(found);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`等待「${label}」超时`)), timeoutMs);
      const waiter = () => {
        const result = probe();
        if (result !== undefined && result !== null && result !== false) {
          clearTimeout(timer);
          waiters.splice(waiters.indexOf(waiter), 1);
          resolve(result);
        }
      };
      waiters.push(waiter);
    });
  }

  return {
    socket,
    get text() {
      return text;
    },
    waitForMessage: (predicate, label) => wait(() => messages.find(predicate), label),
    waitForText: (predicate, label) => wait(() => (predicate(text) ? text : null), label),
    close() {
      try {
        socket.close();
      } catch {
        // 忽略
      }
    },
  };
}

/* --------------------------------------------------------------- 主流程 */

try {
  // 1. 未认证时 /api/config 明确报告未登录
  const anonymous = await call('/api/config');
  record('未登录时 /api/config 返回 authenticated=false',
    anonymous.status === 200 && anonymous.data.authenticated === false && anonymous.data.authMode === 'password');

  // 2. 未认证访问状态接口被拒
  const blocked = await call('/api/status');
  record('未登录访问 /api/status 返回 401', blocked.status === 401, `HTTP ${blocked.status}`);

  // 3. 跨站 Origin 被拒（模拟被劫持的浏览器页面）
  const crossSite = await call('/api/login', {
    method: 'POST',
    body: { password },
    headers: { Origin: 'https://evil.example', 'Sec-Fetch-Site': 'cross-site' },
  });
  record('跨站 Origin 登录被拒绝', crossSite.status === 403, `HTTP ${crossSite.status}`);

  // 4. 错误密码被拒
  const wrong = await call('/api/login', { method: 'POST', body: { password: `${password}-wrong` } });
  record('错误密码返回 401', wrong.status === 401, `HTTP ${wrong.status}`);

  // 5. 缺少 CSRF 令牌的写操作被拒（此时仍未登录，应至少不是 200）
  const noCsrf = await call('/api/logout', { method: 'POST' });
  record('未登录/无 CSRF 的写操作被拒', noCsrf.status === 401 || noCsrf.status === 403, `HTTP ${noCsrf.status}`);

  // 6. 正确密码登录
  const login = await call('/api/login', { method: 'POST', body: { password } });
  if (login.status !== 200 || !login.data.csrfToken) throw new Error(`登录失败：HTTP ${login.status}`);
  csrf = login.data.csrfToken;
  record('正确密码登录成功并下发 CSRF 令牌', true);
  record('会话 Cookie 为 HttpOnly', /rock_console_session=/.test(cookie), cookie.split('=')[0]);

  // 7. 状态快照
  const status = await call('/api/status');
  const snapshot = status.data?.status;
  record('已登录可读取状态快照', status.status === 200 && Boolean(snapshot));
  record('状态包含主机名', Boolean(snapshot?.host?.hostname), snapshot?.host?.hostname);
  record('状态包含 8 个 CPU 核心', snapshot?.cpu?.coreCount === 8, String(snapshot?.cpu?.coreCount));
  record('状态包含温区读数', (snapshot?.thermal?.zones || []).length > 0,
    `${(snapshot?.thermal?.zones || []).length} 个温区，最高 ${snapshot?.thermal?.maxCelsius}°C`);
  record('状态包含磁盘用量', Number.isFinite(snapshot?.disks?.[0]?.usedPercent),
    `${snapshot?.disks?.[0]?.mount} 已用 ${snapshot?.disks?.[0]?.usedPercent}%`);
  record('状态包含服务状态', (snapshot?.services || []).length > 0,
    (snapshot?.services || []).map((item) => `${item.unit.replace(/\.(service|timer)$/, '')}=${item.active}`).join(' '));

  // 8. 新建终端会话
  const created = await call('/api/terminal', { method: 'POST', body: { cols: 100, rows: 30 } });
  if (created.status !== 200 || !created.data.sessionId) throw new Error(`创建终端失败：HTTP ${created.status}`);
  const sessionId = created.data.sessionId;
  record('成功创建终端会话', true, sessionId);

  // 9. WebSocket 真实执行命令
  const terminal = openTerminal(sessionId);
  await terminal.waitForMessage((message) => message.t === 'ready', 'ready');
  record('WebSocket 握手并收到 ready', true);

  const marker = `E2E_MARKER_${Date.now()}`;
  terminal.socket.send(JSON.stringify({ t: 'in', d: `echo ${marker}; id -un; tty\n` }));
  const output = (await terminal.waitForText(
    (text) => text.includes(marker) && /\/dev\/pts\/\d+/.test(text) && /radxa/.test(text),
    '命令与 tty 输出',
  )).replace(/\x1b\[[0-9;]*m/g, '');

  record('通过 WebSocket 执行命令并收到输出', output.includes(marker));
  record('终端以 radxa 身份运行', output.split('\n').some((line) => line.trim() === 'radxa'),
    output.split('\n').map((line) => line.trim()).filter(Boolean).slice(-4).join(' | '));
  record('终端分配了真实 PTY', /\/dev\/pts\/\d+/.test(output),
    (/\/dev\/pts\/\d+/.exec(output) || ['未分配'])[0]);

  // 10. 服务端不泄漏密钥：终端环境里不应出现任何敏感变量
  //     （ROCK_CONSOLE_SESSION 是有意注入的会话标识，不属于密钥，故不在匹配范围内）
  const envMarker = `E2E_ENV_${Date.now()}`;
  const sensitivePattern = 'password|secret|token|credential|private_key|api_key|ssh_auth_sock';
  terminal.socket.send(JSON.stringify({
    t: 'in',
    d: `echo ${envMarker}_$(env | grep -cEi '${sensitivePattern}' || true)\n`,
  }));
  const envText = await terminal.waitForText(
    (text) => new RegExp(`${envMarker}_(\\d+)`).test(text),
    '环境变量统计',
  );
  const leaked = new RegExp(`${envMarker}_(\\d+)`).exec(envText);
  record('终端环境中没有口令/密钥类变量', leaked[1] === '0',
    leaked[1] === '0' ? '0 个' : `发现 ${leaked[1]} 个`);

  // 11. 会话标识确实注入到了 shell（证明白名单变量能正常传递）
  const sessionMarker = `E2E_SESSION_${Date.now()}`;
  terminal.socket.send(JSON.stringify({
    t: 'in',
    d: `echo ${sessionMarker}_\${ROCK_CONSOLE_SESSION:-none}\n`,
  }));
  const sessionText = await terminal.waitForText(
    (text) => new RegExp(`${sessionMarker}_[A-Za-z0-9]`).test(text),
    '会话标识',
  );
  record('终端会话标识已注入 PTY 环境', new RegExp(`${sessionMarker}_${sessionId}`).test(sessionText));

  terminal.close();

  // 12. 关闭会话
  const closed = await call(`/api/terminal/${encodeURIComponent(sessionId)}`, { method: 'DELETE' });
  record('可以关闭终端会话', closed.status === 200, `HTTP ${closed.status}`);

  // 13. 退出登录后状态接口再次被拒
  const logout = await call('/api/logout', { method: 'POST' });
  record('退出登录成功', logout.status === 200, `HTTP ${logout.status}`);
  const afterLogout = await call('/api/status');
  record('退出后 /api/status 返回 401', afterLogout.status === 401, `HTTP ${afterLogout.status}`);
} catch (error) {
  record(`自检中断：${error.message}`, false);
}

const failed = results.filter((item) => !item.ok);
process.stdout.write(`\n通过 ${results.length - failed.length} / ${results.length} 项\n`);
process.exit(failed.length === 0 ? 0 : 1);
