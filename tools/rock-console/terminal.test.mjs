import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createTerminalManager, sanitizeEnvironment } from './terminal.mjs';

/** 可编程的假 PTY：记录写入/尺寸变化，并允许测试主动推送输出与退出。 */
function createFakeSpawn() {
  const children = [];
  function spawnPty(file, args, options) {
    const handlers = { data: [], exit: [] };
    const child = {
      file,
      args,
      options,
      written: '',
      resized: [],
      killed: false,
      onData: (fn) => handlers.data.push(fn),
      onExit: (fn) => handlers.exit.push(fn),
      write: (data) => { child.written += data; },
      resize: (cols, rows) => child.resized.push([cols, rows]),
      kill: () => { child.killed = true; },
      emit: (text) => handlers.data.forEach((fn) => fn(text)),
      exit: (code) => handlers.exit.forEach((fn) => fn({ exitCode: code })),
    };
    children.push(child);
    return child;
  }
  return { spawnPty, children };
}

function managerOptions(extra = {}) {
  const fake = createFakeSpawn();
  const events = [];
  const manager = createTerminalManager({
    spawnPty: fake.spawnPty,
    audit: (event) => events.push(event),
    envSource: {},
    ...extra,
  });
  return { manager, fake, events };
}

/* ---------------------------------------------------------- 环境变量清洗 */

test('sanitizeEnvironment 剔除服务密钥，保留普通变量', () => {
  const env = sanitizeEnvironment({
    PATH: '/usr/bin',
    HOME: '/home/radxa',
    ROCK_CONSOLE_PASSWORD_HASH: 'scrypt$deadbeef$cafe',
    ROCK_CONSOLE_SESSION_SECRET: 'super-secret',
    ARTICLE_STUDIO_PASSWORD_HASH: 'scrypt$aa$bb',
    GITHUB_TOKEN: 'ghp_xxx',
    AWS_SECRET_ACCESS_KEY: 'aws',
    SSH_AUTH_SOCK: '/run/agent.sock',
    MY_PRIVATE_KEY: 'pem',
    NORMAL_VALUE: 'ok',
  });

  assert.equal(env.PATH, '/usr/bin');
  assert.equal(env.HOME, '/home/radxa');
  assert.equal(env.NORMAL_VALUE, 'ok');

  // SSH_AUTH_SOCK 也在剔除之列：公网可达的终端不应借用服务账号的 SSH 代理身份
  for (const leaked of [
    'ROCK_CONSOLE_PASSWORD_HASH',
    'ROCK_CONSOLE_SESSION_SECRET',
    'ARTICLE_STUDIO_PASSWORD_HASH',
    'GITHUB_TOKEN',
    'AWS_SECRET_ACCESS_KEY',
    'MY_PRIVATE_KEY',
    'SSH_AUTH_SOCK',
  ]) {
    assert.equal(leaked in env, false, `${leaked} 不应传入终端`);
  }
});

test('sanitizeEnvironment 强制设定 TERM 并允许覆盖', () => {
  const env = sanitizeEnvironment({ TERM: 'dumb' }, { ROCK_CONSOLE_SESSION: 't1' });
  assert.equal(env.TERM, 'xterm-256color');
  assert.equal(env.COLORTERM, 'truecolor');
  assert.equal(env.ROCK_CONSOLE_SESSION, 't1');
});

/* -------------------------------------------------------------- 会话生命周期 */

test('创建会话时传递安全的 PTY 参数并记录审计', () => {
  const { manager, fake, events } = managerOptions();
  const session = manager.createSession({ cols: 120, rows: 40, source: '203.0.113.5' });

  assert.equal(fake.children.length, 1);
  const child = fake.children[0];
  assert.equal(child.options.cols, 120);
  assert.equal(child.options.rows, 40);
  assert.equal(child.options.name, 'xterm-256color');
  assert.equal('ROCK_CONSOLE_PASSWORD_HASH' in child.options.env, false);

  assert.equal(session.cols, 120);
  assert.equal(session.readOnly, false);
  assert.equal(manager.size, 1);
  assert.ok(events.some((event) => event.event === 'session-open' && event.sessionId === session.id));
});

test('会话尺寸被限制在合理范围', () => {
  const { manager, fake } = managerOptions();
  manager.createSession({ cols: 5000, rows: 1 });
  assert.equal(fake.children[0].options.cols, 500);
  assert.equal(fake.children[0].options.rows, 5);

  manager.createSession({ cols: -10, rows: 9999 });
  assert.equal(fake.children[1].options.cols, 20);
  assert.equal(fake.children[1].options.rows, 200);
});

test('并发会话数量受上限约束', () => {
  const { manager } = managerOptions({ maxSessions: 2 });
  manager.createSession({});
  manager.createSession({});
  assert.throws(() => manager.createSession({}), (error) => error.code === 'TOO_MANY_SESSIONS');
});

/* ------------------------------------------------------------------ 输入输出 */

test('可写会话把输入转发给 PTY', () => {
  const { manager, fake } = managerOptions();
  const session = manager.createSession({});
  assert.equal(session.write('ls -la\n'), true);
  assert.equal(fake.children[0].written, 'ls -la\n');
});

test('只读会话拒绝输入并留下审计记录', () => {
  const { manager, fake, events } = managerOptions();
  const session = manager.createSession({ readOnly: true });
  assert.equal(session.write('rm -rf /\n'), false);
  assert.equal(fake.children[0].written, '');
  assert.ok(events.some((event) => event.event === 'input-rejected' && event.reason === 'read-only'));
});

test('输出被广播给订阅者，并可回放给新订阅者', () => {
  const { manager, fake } = managerOptions();
  const session = manager.createSession({});
  const received = [];
  const unsubscribe = session.subscribe((text) => received.push(text));

  fake.children[0].emit('hello\n');
  assert.deepEqual(received, ['hello\n']);
  assert.equal(session.replay(), 'hello\n');

  unsubscribe();
  fake.children[0].emit('after\n');
  assert.deepEqual(received, ['hello\n']);
  assert.equal(session.replay(), 'hello\nafter\n');
});

test('回放缓冲超过上限时丢弃最旧内容', () => {
  const { manager, fake } = managerOptions({ scrollbackBytes: 10 });
  const session = manager.createSession({});
  fake.children[0].emit('12345678');
  fake.children[0].emit('abcdefgh');
  assert.equal(session.replay(), 'abcdefgh');
  assert.ok(Buffer.byteLength(session.replay()) <= 10);
});

/* -------------------------------------------------------------------- 尺寸 */

test('resize 只在尺寸变化时下发，并做边界收敛', () => {
  const { manager, fake } = managerOptions();
  const session = manager.createSession({ cols: 100, rows: 30 });

  assert.equal(session.resize(100, 30), true);
  assert.deepEqual(fake.children[0].resized, []);

  assert.equal(session.resize(140, 45), true);
  assert.deepEqual(fake.children[0].resized, [[140, 45]]);
  assert.equal(session.cols, 140);

  // 传 0 表示「该维度不变」，列数则收敛到上限
  session.resize(9999, 0);
  assert.deepEqual(fake.children[0].resized[1], [500, 45]);
  assert.equal(session.cols, 500);
  assert.equal(session.rows, 45);
});

/* ------------------------------------------------------------ 关闭与超时 */

test('会话退出后从管理器移除并广播退出提示', () => {
  const { manager, fake, events } = managerOptions();
  const session = manager.createSession({});
  manager.getSession(session.id);

  fake.children[0].exit(0);
  assert.equal(manager.size, 0);
  assert.equal(manager.getSession(session.id), null);
  assert.match(session.replay(), /退出码 0/);
  assert.ok(events.some((event) => event.event === 'session-exit' && event.exitCode === 0));
});

test('空闲超时会话被自动关闭，活跃会话保留', () => {
  let now = 1_000_000;
  const { manager, fake } = managerOptions({ idleTimeoutMs: 60_000, clock: () => now });

  const idle = manager.createSession({});
  now += 10_000;
  const active = manager.createSession({});
  now += 55_000;
  active.write('keep-alive\n'); // 刷新 lastActivityAt

  now += 10_000;
  assert.equal(manager.sweep(now), 1);
  assert.equal(manager.getSession(idle.id), null);
  assert.ok(manager.getSession(active.id));
  assert.match(idle.replay(), /空闲/);
  assert.equal(fake.children[0].killed, true);
});

test('idleTimeoutMs 为 0 时不做超时回收', () => {
  let now = 0;
  const { manager } = managerOptions({ idleTimeoutMs: 0, clock: () => now });
  manager.createSession({});
  now += 10 * 24 * 3600 * 1000;
  assert.equal(manager.sweep(now), 0);
  assert.equal(manager.size, 1);
});

test('closeAll 关闭全部会话并标记原因', () => {
  const { manager, fake } = managerOptions();
  manager.createSession({});
  manager.createSession({});
  manager.closeAll('shutdown');
  assert.equal(manager.size, 0);
  assert.ok(fake.children.every((child) => child.killed));
});

test('对已关闭会话的写入与尺寸调整都是空操作', () => {
  const { manager } = managerOptions();
  const session = manager.createSession({});
  session.close('test');
  assert.equal(session.write('x'), false);
  assert.equal(session.resize(80, 24), false);
});

test('list 返回可序列化的会话元数据', () => {
  const { manager } = managerOptions();
  const session = manager.createSession({ cols: 90, rows: 25, readOnly: true });
  const list = manager.list();
  assert.equal(list.length, 1);
  assert.deepEqual(
    { id: list[0].id, readOnly: list[0].readOnly, cols: list[0].cols, rows: list[0].rows },
    { id: session.id, readOnly: true, cols: 90, rows: 25 },
  );
});

test('审计回调抛错不影响终端功能', () => {
  const fake = createFakeSpawn();
  const manager = createTerminalManager({
    spawnPty: fake.spawnPty,
    audit: () => { throw new Error('审计后端故障'); },
    envSource: {},
  });
  const session = manager.createSession({});
  assert.equal(session.write('ok\n'), true);
  assert.equal(fake.children[0].written, 'ok\n');
});
