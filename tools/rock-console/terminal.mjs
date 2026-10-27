/**
 * rock-console 终端会话管理。
 *
 * 安全要点：
 *   - PTY 以服务自身的用户身份运行（radxa），因此 Web 终端与 SSH 权限相同，
 *     不会额外提权；
 *   - 环境变量会被清洗：任何 ROCK_CONSOLE_* 以及名字里带 PASSWORD/SECRET/TOKEN/
 *     KEY/CREDENTIAL/AUTH 的变量都不会传进 shell，避免在终端里 `env` 出服务密钥；
 *   - 每个会话有独立的输出回放缓冲，重连可恢复屏幕内容；
 *   - 可选的只读会话拒绝一切输入，用于"只看不动"的观察场景；
 *   - 会话数量与空闲时长都有限制，避免隧道被用来堆积常驻 shell。
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const DEFAULT_SCROLLBACK_BYTES = 256 * 1024;

/** 需要从 shell 环境中剔除的变量名模式。 */
const SENSITIVE_ENV_PATTERN = /(?:^ROCK_CONSOLE_)|(?:PASSWORD|PASSWD|SECRET|TOKEN|CREDENTIAL|PRIVATE_KEY|_KEY$|^AWS_|AUTH)/i;

/** 无论原环境如何，都显式设定的安全默认值。 */
function baseEnvironment(source, extra) {
  const env = {};
  for (const [key, value] of Object.entries(source || {})) {
    if (typeof value !== 'string') continue;
    if (SENSITIVE_ENV_PATTERN.test(key)) continue;
    env[key] = value;
  }
  return {
    ...env,
    TERM: 'xterm-256color',
    COLORTERM: 'truecolor',
    LANG: env.LANG || 'C.UTF-8',
    LC_ALL: env.LC_ALL || 'C.UTF-8',
    ...extra,
  };
}

/** 导出以便单测断言密钥不会泄漏到 PTY 环境。 */
export function sanitizeEnvironment(source, extra = {}) {
  return baseEnvironment(source, extra);
}

function defaultSpawn(file, args, options) {
  const pty = require('node-pty');
  return pty.spawn(file, args, options);
}

/**
 * 创建终端管理器。
 *
 * @param {object} options
 * @param {string} options.shell            默认 /bin/bash
 * @param {string[]} options.shellArgs      默认 ['-l']
 * @param {number} options.maxSessions      并发会话上限
 * @param {number} options.idleTimeoutMs    空闲超时（0 表示不超时）
 * @param {number} options.scrollbackBytes  每会话输出回放缓冲上限
 * @param {Function} options.audit          审计回调 (event) => void
 * @param {Function} options.spawnPty       注入点，便于测试
 */
export function createTerminalManager({
  shell = process.env.SHELL || '/bin/bash',
  shellArgs = ['-l'],
  cwd = process.env.HOME || '/',
  maxSessions = 2,
  idleTimeoutMs = 30 * 60 * 1000,
  scrollbackBytes = DEFAULT_SCROLLBACK_BYTES,
  audit = () => {},
  spawnPty = defaultSpawn,
  clock = () => Date.now(),
  idFactory = null,
  envSource = process.env,
  extraEnv = {},
} = {}) {
  const sessions = new Map();
  const makeId = idFactory || (() => `t${clock().toString(36)}${Math.random().toString(36).slice(2, 8)}`);

  function emit(event) {
    try {
      audit({ at: new Date(clock()).toISOString(), ...event });
    } catch {
      // 审计失败绝不能影响终端本身
    }
  }

  function createSession({ cols = 100, rows = 30, readOnly = false, source = 'unknown', label = '' } = {}) {
    if (sessions.size >= maxSessions) {
      const error = new Error(`终端会话数已达上限（${maxSessions}）`);
      error.code = 'TOO_MANY_SESSIONS';
      throw error;
    }
    const safeCols = Math.min(500, Math.max(20, Number(cols) || 100));
    const safeRows = Math.min(200, Math.max(5, Number(rows) || 30));
    const id = makeId();
    const child = spawnPty(shell, shellArgs, {
      name: 'xterm-256color',
      cols: safeCols,
      rows: safeRows,
      cwd,
      env: sanitizeEnvironment(envSource, { ...extraEnv, ROCK_CONSOLE_SESSION: id }),
    });

    const session = {
      id,
      readOnly: Boolean(readOnly),
      cols: safeCols,
      rows: safeRows,
      createdAt: clock(),
      lastActivityAt: clock(),
      subscribers: new Set(),
      chunks: [],
      bufferedBytes: 0,
      closed: false,
      exitCode: null,
      source,
      label,
    };

    session.append = (text) => {
      session.chunks.push(text);
      session.bufferedBytes += Buffer.byteLength(text);
      while (session.bufferedBytes > scrollbackBytes && session.chunks.length > 1) {
        session.bufferedBytes -= Buffer.byteLength(session.chunks.shift());
      }
      for (const subscriber of session.subscribers) {
        try {
          subscriber(text);
        } catch {
          session.subscribers.delete(subscriber);
        }
      }
    };

    session.replay = () => session.chunks.join('');

    session.subscribe = (listener) => {
      session.subscribers.add(listener);
      return () => session.subscribers.delete(listener);
    };

    session.write = (data) => {
      if (session.closed) return false;
      session.lastActivityAt = clock();
      if (session.readOnly) {
        emit({ event: 'input-rejected', sessionId: id, reason: 'read-only', bytes: Buffer.byteLength(String(data)) });
        return false;
      }
      try {
        child.write(String(data));
        return true;
      } catch {
        return false;
      }
    };

    session.resize = (nextCols, nextRows) => {
      if (session.closed) return false;
      const width = Math.min(500, Math.max(20, Number(nextCols) || session.cols));
      const height = Math.min(200, Math.max(5, Number(nextRows) || session.rows));
      if (width === session.cols && height === session.rows) return true;
      session.cols = width;
      session.rows = height;
      session.lastActivityAt = clock();
      try {
        child.resize(width, height);
        emit({ event: 'resize', sessionId: id, cols: width, rows: height });
        return true;
      } catch {
        return false;
      }
    };

    session.close = (reason = 'closed') => {
      if (session.closed) return;
      session.closed = true;
      try {
        child.kill();
      } catch {
        // 进程可能已经退出
      }
      sessions.delete(id);
      emit({ event: 'session-close', sessionId: id, reason, durationMs: clock() - session.createdAt });
    };

    child.onData((text) => {
      session.lastActivityAt = clock();
      session.append(text);
    });
    child.onExit(({ exitCode }) => {
      session.exitCode = exitCode;
      session.append(`\r\n\x1b[33m[会话结束，退出码 ${exitCode}]\x1b[0m\r\n`);
      session.closed = true;
      sessions.delete(id);
      emit({ event: 'session-exit', sessionId: id, exitCode, durationMs: clock() - session.createdAt });
    });

    sessions.set(id, session);
    emit({ event: 'session-open', sessionId: id, readOnly: session.readOnly, cols: safeCols, rows: safeRows, source, label });
    return session;
  }

  function getSession(id) {
    return sessions.get(String(id || '')) || null;
  }

  /** 关闭空闲超时的会话，返回关闭数量。 */
  function sweep(now = clock()) {
    if (!idleTimeoutMs) return 0;
    let closed = 0;
    for (const session of [...sessions.values()]) {
      const idleFor = now - session.lastActivityAt;
      if (idleFor > idleTimeoutMs) {
        const minutes = Math.round(idleFor / 60000);
        session.append(`\r\n\x1b[33m[空闲 ${minutes} 分钟，会话已自动断开]\x1b[0m\r\n`);
        session.close('idle-timeout');
        closed += 1;
      }
    }
    return closed;
  }

  function closeAll(reason = 'shutdown') {
    for (const session of [...sessions.values()]) session.close(reason);
  }

  return {
    createSession,
    getSession,
    sweep,
    closeAll,
    get size() {
      return sessions.size;
    },
    list: () => [...sessions.values()].map((session) => ({
      id: session.id,
      readOnly: session.readOnly,
      cols: session.cols,
      rows: session.rows,
      createdAt: session.createdAt,
      lastActivityAt: session.lastActivityAt,
    })),
  };
}
