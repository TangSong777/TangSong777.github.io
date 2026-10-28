'use strict';
/**
 * rock-console 前端。
 * 不含任何凭据：登录后由服务端下发 CSRF 令牌并放在 HttpOnly Cookie 里维持会话。
 */

const state = {
  csrfToken: null,
  allowWrite: true,
  status: null,
  stream: null,
  terminal: null,
  fitAddon: null,
  socket: null,
  sessionId: null,
  readOnly: false,
  streamFailures: 0,
  logTimer: null,
  activity: null,
  activityCleared: true,
  fontSize: 13,
  localInputEnabled: true,
  localActive: true,
  localLine: '',
  echoSuppress: '',
};

const $ = (id) => document.getElementById(id);

try {
  const stored = Number(localStorage.getItem('rock-console.fontSize'));
  if (Number.isFinite(stored) && stored >= 11 && stored <= 18) state.fontSize = stored;
} catch {
  // 隐私模式下读不到，使用默认字号
}

/* ------------------------------------------------------------ 格式化 */

const THERMAL_LABELS = {
  'soc-thermal': 'SoC',
  'bigcore0-thermal': '大核簇 0',
  'bigcore1-thermal': '大核簇 1',
  'littlecore-thermal': '小核簇',
  'center-thermal': '中心',
  'gpu-thermal': 'GPU',
  'npu-thermal': 'NPU',
};

const DEVFREQ_LABELS = {
  dmc: '内存控制器 (DMC)',
  'fb000000.gpu': 'GPU (Mali-G610)',
  'fdab0000.npu': 'NPU (RKNN)',
};

/** systemd 单元的中文名（未列出的保持原名）。 */
const UNIT_LABELS = {
  'article-studio.service': '管理中心',
  'cloudflared.service': 'Cloudflare 隧道',
  'history-site.service': '岁月史书站点',
  'rock5b-fan-fixed.service': '风扇控制',
  'rock-console.service': '本面板',
  'siyuan-notes-publish.service': '学习笔记发布',
  'siyuan-notes-publish.timer': '发布定时器',
  'docker.service': 'Docker 引擎',
};

/** systemctl 状态值的中文显示。 */
const STATE_LABELS = {
  active: '运行中',
  inactive: '未运行',
  failed: '失败',
  activating: '启动中',
  deactivating: '停止中',
  reloading: '重载中',
  unknown: '未知',
};

const unitLabel = (unit) => UNIT_LABELS[unit] || unit.replace(/\.(service|timer)$/, '');
const stateLabel = (state) => STATE_LABELS[state] || state || '未知';

function formatMemory(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function fmtBytes(bytes) {
  if (!Number.isFinite(bytes)) return '--';
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(index === 0 || value >= 100 ? 0 : 1)} ${units[index]}`;
}

const fmtRate = (bytesPerSecond) => (Number.isFinite(bytesPerSecond) ? `${fmtBytes(bytesPerSecond)}/s` : '--');

function fmtDuration(seconds) {
  if (!Number.isFinite(seconds)) return '--';
  const total = Math.floor(seconds);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (days > 0) return `${days} 天 ${hours} 小时`;
  if (hours > 0) return `${hours} 小时 ${minutes} 分 ${secs} 秒`;
  return `${minutes} 分 ${secs} 秒`;
}

function fmtHz(hz) {
  if (!Number.isFinite(hz)) return '--';
  return hz >= 1e9 ? `${(hz / 1e9).toFixed(2)} GHz` : `${Math.round(hz / 1e6)} MHz`;
}

function fmtKhz(khz) {
  if (!Number.isFinite(khz)) return '--';
  return khz >= 1e6 ? `${(khz / 1e6).toFixed(2)} GHz` : `${Math.round(khz / 1000)} MHz`;
}

/** 设置指标进度条宽度与告警色阶。 */
function setBar(id, percent) {
  const bar = document.getElementById(id);
  if (!bar) return;
  const value = Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : 0;
  bar.style.width = `${value}%`;
  bar.dataset.level = value >= 92 ? 'bad' : value >= 80 ? 'warn' : '';
}

const fmtPercent = (value, digits = 1) => (Number.isFinite(value) ? value.toFixed(digits) : '--');

/**
 * 把 <dl> 填成「标签 / 值」列表。值可以是字符串，或 { text, title }。
 *
 * 状态每秒推送一帧，若每次都 replaceChildren 会持续制造 DOM 垃圾，
 * 主线程一忙，键盘输入就会发涩。这里按标签序列缓存节点，
 * 只有标签变化才重建，否则只改 textContent。
 */
const factsCache = new WeakMap();

function fillFacts(node, rows) {
  if (!node) return;
  const visible = rows.filter(([, value]) => value !== undefined && value !== null && value !== '');
  let cache = factsCache.get(node);
  const sameShape = Boolean(cache)
    && cache.labels.length === visible.length
    && cache.labels.every((label, index) => label === visible[index][0]);

  if (!sameShape) {
    node.replaceChildren();
    const labels = [];
    const values = [];
    for (const [label] of visible) {
      const dt = document.createElement('dt');
      dt.textContent = label;
      const dd = document.createElement('dd');
      node.append(dt, dd);
      labels.push(label);
      values.push(dd);
    }
    cache = { labels, values };
    factsCache.set(node, cache);
  }

  visible.forEach(([, value], index) => {
    const dd = cache.values[index];
    if (typeof value === 'object' && value.text !== undefined) {
      dd.textContent = String(value.text);
      if (value.title) dd.title = String(value.title);
    } else {
      dd.textContent = String(value);
    }
  });
}

function levelFor(percent, warn, bad) {
  if (!Number.isFinite(percent)) return null;
  if (percent >= bad) return 'bad';
  if (percent >= warn) return 'warn';
  return null;
}

/* -------------------------------------------------------------- 请求 */

async function api(path, options = {}) {
  const method = options.method || 'GET';
  const headers = { ...(options.headers || {}) };
  if (options.body) headers['Content-Type'] = 'application/json';
  if (method !== 'GET' && method !== 'HEAD') headers['x-rock-console-token'] = state.csrfToken || '';
  const response = await fetch(path, { credentials: 'same-origin', ...options, method, headers });
  let data = null;
  try {
    data = await response.json();
  } catch {
    data = { ok: false, message: `HTTP ${response.status}` };
  }
  if (!response.ok) {
    const error = new Error(data?.message || `HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

/* -------------------------------------------------------------- 视图 */

function showLogin(message = '') {
  $('login-view').hidden = false;
  $('console-view').hidden = true;
  $('login-message').textContent = message;
  $('password').value = '';
  if ($('totp')) $('totp').value = '';
  $('password').focus();
  if (state.stream) {
    state.stream.close();
    state.stream = null;
  }
}

function showConsole() {
  $('login-view').hidden = true;
  $('console-view').hidden = false;
  startStream();
  loadStatus();
}

$('login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = $('login-button');
  button.disabled = true;
  $('login-message').textContent = '';
  try {
    const payload = { password: $('password').value };
    if (!$('totp').hidden) payload.totp = $('totp').value.trim();
    const result = await api('/api/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    state.csrfToken = result.csrfToken;
    showConsole();
  } catch (error) {
    $('login-message').textContent = error.message;
    if (error.status === 401 && /验证码/.test(error.message) && !$('totp').hidden) {
      $('totp').value = '';
      $('totp').focus();
    } else {
      $('password').value = '';
      $('password').focus();
    }
  } finally {
    button.disabled = false;
  }
});

$('logout-button').addEventListener('click', async () => {
  try {
    await api('/api/logout', { method: 'POST' });
  } catch {
    // 即使请求失败也回到登录页
  }
  closeTerminal();
  state.csrfToken = null;
  showLogin('已退出登录。');
});

$('refresh-button').addEventListener('click', () => loadStatus());

/* ------------------------------------------------------------ 状态流 */

function setConnection(stateName, detail = '') {
  $('connection-dot').dataset.state = stateName;
  if (detail) $('updated-at').textContent = detail;
}

function startStream() {
  if (state.stream) return;
  const source = new EventSource('/api/stream');
  state.stream = source;
  source.addEventListener('status', (event) => {
    state.streamFailures = 0;
    setConnection('live', `更新于 ${new Date().toLocaleTimeString('zh-CN')}`);
    try {
      render(JSON.parse(event.data));
    } catch {
      // 忽略单帧解析错误
    }
  });
  source.onopen = () => {
    state.streamFailures = 0;
    setConnection('live');
  };
  source.onerror = async () => {
    state.streamFailures += 1;
    setConnection(state.streamFailures > 3 ? 'down' : 'connecting');
    if (state.streamFailures === 3) {
      // SSE 无法区分「网络抖动」和「会话过期」，此时主动确认一次登录状态
      try {
        const config = await api('/api/config');
        if (!config.authenticated) {
          source.close();
          state.stream = null;
          showLogin('会话已过期，请重新登录。');
        }
      } catch {
        // 网络本身不可用时保持重连
      }
    }
  };
}

async function loadStatus() {
  try {
    const result = await api('/api/status');
    render(result.status);
  } catch (error) {
    if (error.status === 401) showLogin('会话已过期，请重新登录。');
  }
}

/* -------------------------------------------------------------- 渲染 */

function render(status) {
  if (!status) return;
  state.status = status;

  const host = status.host || {};
  $('host-name').textContent = 'Rock 5B+ 控制台';
  $('host-detail').textContent = [
    host.hostname,
    host.osName,
    host.kernel ? host.kernel.split(' ').slice(0, 3).join(' ') : null,
  ].filter(Boolean).join(' · ');

  const interval = $('sidebar-interval');
  if (interval) {
    interval.textContent = Number.isFinite(status.cpu?.sampleIntervalMs)
      ? `${Math.round(status.cpu.sampleIntervalMs)} ms`
      : '--';
  }

  renderStream(status);
  renderCpu(status);
  renderThermal(status);
  renderMemory(status);
  renderDisk(status);
  renderNetwork(status);
  renderAccelerators(status);
  renderFan(status);
  renderSystem(status);
  renderServices(status);
  fillLogUnits(status);
}

/** 远程串流状态卡片：分辨率、码率、丢帧、时长。 */
const STREAM_EVENT_LABELS = {
  start: '开始串流',
  stop: '串流结束',
  watchdog_restart: '看门狗重启',
};

function streamEventLabel(event) {
  return STREAM_EVENT_LABELS[event] || event || '未知';
}

/** 把毫秒时间戳格式化成本地的「MM-DD HH:MM」。 */
function fmtClock(ms) {
  if (!Number.isFinite(ms)) return '--';
  const date = new Date(ms);
  const pad = (value) => String(value).padStart(2, '0');
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function renderStream(status) {
  const card = $('stream-card');
  if (!card) return;

  const stream = status.stream || {};
  const events = stream.events || {};
  const badge = $('stream-state');
  const facts = $('stream-facts');
  if (!badge || !facts) return;

  const streaming = Boolean(stream.streaming);
  const running = Boolean(stream.running);
  badge.dataset.state = streaming ? 'active' : 'inactive';
  badge.textContent = streaming ? '串流中' : (running ? '已启动' : '未运行');

  const rows = [];

  // ---- 当前会话（只在真的串流时显示实时指标）----
  if (streaming) {
    if (stream.width && stream.height) {
      rows.push(['分辨率', `${stream.width}×${stream.height}`]);
    }
    if (Number.isFinite(stream.targetFps)) {
      rows.push(['帧率目标', `${stream.targetFps} fps`]);
    }
    if (Number.isFinite(stream.actualFps) && stream.actualFps > 0) {
      rows.push(['实际到达', `${stream.actualFps} fps`]);
    }
    if (Number.isFinite(stream.bitrateKbps)) {
      rows.push(['视频码率', `${(stream.bitrateKbps / 1000).toFixed(0)} Mbps`]);
    }
    if (Number.isFinite(stream.rttMs)) {
      rows.push(['网络延迟', `${stream.rttMs.toFixed(1)} ms`]);
    }
    if (Number.isFinite(stream.droppedFrames)) {
      rows.push(['累计丢帧', `${stream.droppedFrames} 帧`]);
    }
    if (Number.isFinite(stream.elapsedSeconds)) {
      rows.push(['本次时长', fmtDuration(stream.elapsedSeconds)]);
    }
  } else if (running) {
    rows.push(['状态', '已启动，等待串流数据…']);
  }

  // ---- 今日统计 ----
  if (Number.isFinite(events.todaySessions) && events.todaySessions > 0) {
    rows.push(['今日会话', `${events.todaySessions} 段 · 共 ${fmtDuration(events.todaySeconds)}`]);
  }
  if (Number.isFinite(events.todayDisconnects) && events.todayDisconnects > 0) {
    rows.push(['今日断联', `${events.todayDisconnects} 次`]);
  }
  if (Number.isFinite(events.todayWatchdogRestarts) && events.todayWatchdogRestarts > 0) {
    rows.push(['看门狗重启', `${events.todayWatchdogRestarts} 次`]);
  }

  // ---- 上一次会话 ----
  const last = events.lastSession;
  if (last && Number.isFinite(last.startMs)) {
    rows.push(['上次会话', `${fmtClock(last.startMs)} 起 · ${fmtDuration(last.durationSeconds)}`]);
    const quality = [];
    if (last.resolution) quality.push(last.resolution);
    if (Number.isFinite(last.bitrateKbps)) quality.push(`${(last.bitrateKbps / 1000).toFixed(0)} Mbps`);
    if (quality.length) rows.push(['上次画质', quality.join(' · ')]);
    if (Number.isFinite(last.droppedFrames)) rows.push(['上次丢帧', `${last.droppedFrames} 帧`]);
  }

  // ---- 最近一条事件 ----
  if (Array.isArray(events.recentEvents) && events.recentEvents.length > 0) {
    const latest = events.recentEvents[events.recentEvents.length - 1];
    const ts = Date.parse(latest.ts);
    rows.push(['最近事件', `${fmtClock(ts)} ${streamEventLabel(latest.event)}`]);
  }

  if (rows.length === 0) {
    rows.push(['状态', '还没有串流记录']);
  }
  fillFacts(facts, rows);

  // 时段单独用表格展示，一行一个时间段
  renderSegments(events.segments || []);
}

/**
 * 渲染时段时间线：把每个时段画在一条横轴上，悬浮显示明细。
 */
function renderTimeline(segments) {
  const host = $('seg-timeline');
  if (!host) return;
  const list = segments.filter((seg) => Number.isFinite(seg.startMs) && Number.isFinite(seg.endMs));
  if (list.length === 0) {
    host.hidden = true;
    host.replaceChildren();
    return;
  }
  host.hidden = false;
  const start = Math.min(...list.map((seg) => seg.startMs));
  const end = Math.max(...list.map((seg) => seg.endMs));
  const span = Math.max(1, end - start);
  const track = document.createElement('div');
  track.className = 'seg-track';
  for (const seg of list) {
    const bar = document.createElement('span');
    bar.className = 'seg-bar';
    const left = ((seg.startMs - start) / span) * 100;
    const width = ((seg.endMs - seg.startMs) / span) * 100;
    bar.style.left = `${left.toFixed(2)}%`;
    bar.style.width = `${Math.max(0.35, width).toFixed(2)}%`;
    const startText = fmtClock(seg.startMs);
    const endText = fmtClock(seg.endMs).split(' ').pop();
    const parts = [`${seg.sessionCount} 段`, fmtDuration(seg.streamSeconds)];
    if (seg.disconnects > 0) parts.push(`断联 ${seg.disconnects} 次`);
    if (Number.isFinite(seg.droppedFrames) && seg.droppedFrames > 0) parts.push(`丢帧 ${seg.droppedFrames}`);
    bar.dataset.tip = `${startText}–${endText}\n${parts.join(' · ')}`;
    track.append(bar);
  }
  const scale = document.createElement('div');
  scale.className = 'seg-scale';
  const scaleStart = document.createElement('span');
  scaleStart.textContent = fmtClock(start);
  const scaleEnd = document.createElement('span');
  scaleEnd.textContent = fmtClock(end);
  scale.append(scaleStart, scaleEnd);
  host.replaceChildren(track, scale);
}

/**
 * 渲染「今日时段」表格：每行一个时间段，从早到晚排列。

 * 列固定为：时间段 / 会话数 / 串流时长 / 断联 / 丢帧
 */
function renderSegments(segments) {
  const block = $('seg-block');
  const tbody = $('seg-rows');
  if (!block || !tbody) return;

  const list = segments
    .filter((seg) => Number.isFinite(seg.startMs))
    .slice(-6);

  if (list.length === 0) {
    block.hidden = true;
    tbody.replaceChildren();
    return;
  }

  block.hidden = false;
  tbody.replaceChildren();
  renderTimeline(segments);

  const cell = (text, className) => {
    const td = document.createElement('td');
    if (className) td.className = className;
    td.textContent = text;
    return td;
  };

  for (const seg of list) {
    const tr = document.createElement('tr');
    const startText = fmtClock(seg.startMs);
    const endText = fmtClock(seg.endMs).split(' ').pop();

    tr.append(
      cell(`${startText}–${endText}`, 'seg-range'),
      cell(`${seg.sessionCount} 段`, 'seg-num'),
      cell(fmtDuration(seg.streamSeconds), 'seg-num'),
      cell(seg.disconnects > 0 ? `${seg.disconnects} 次` : '—', seg.disconnects > 0 ? 'seg-warn' : 'seg-dim'),
      cell(seg.droppedFrames > 0 ? String(seg.droppedFrames) : '—', seg.droppedFrames > 0 ? 'seg-num' : 'seg-dim'),
    );
    tbody.append(tr);
  }
}

function renderCpu(status) {
  const cpu = status.cpu || {};
  const total = $('cpu-total');
  total.textContent = fmtPercent(cpu.usagePercent);
  setBar('cpu-bar', cpu.usagePercent);
  total.parentElement.dataset.level = levelFor(cpu.usagePercent, 75, 92) || '';

  const container = $('cpu-cores');
  const usages = cpu.coreUsagePercent || [];
  if (container.children.length !== usages.length) {
    container.replaceChildren();
    container.style.gridTemplateColumns = `repeat(${Math.max(1, usages.length)}, minmax(0, 1fr))`;
    for (let index = 0; index < usages.length; index += 1) {
      const cell = document.createElement('div');
      cell.className = 'core';
      const bar = document.createElement('i');
      cell.append(bar, document.createTextNode(String(index)));
      container.append(cell);
    }
  }
  usages.forEach((usage, index) => {
    const cell = container.children[index];
    const bar = cell.firstChild;
    bar.style.height = `${Math.min(100, Math.max(0, usage || 0))}%`;
    bar.style.background = Number.isFinite(usage) && usage >= 85 ? 'var(--bad)' : '';
    cell.title = `CPU${index}：${fmtPercent(usage)}%`;
  });

  const policies = (cpu.policies || []).map((policy) => {
    const label = policy.relatedCpus
      ? `CPU ${policy.relatedCpus.replace(/\s+/g, ',')}`
      : String(policy.policy || 'CPU');
    return [label, { text: fmtKhz(policy.currentKhz), title: policy.governor || '' }];
  });
  fillFacts($('cpu-facts'), [
    ['核心数', cpu.coreCount ? `${cpu.coreCount} 核` : null],
    ...policies,
    ['型号', cpu.model],
  ]);
}

function renderThermal(status) {
  const thermal = status.thermal || {};
  const max = $('thermal-max');
  max.textContent = fmtPercent(thermal.maxCelsius, 1);
  max.parentElement.dataset.level = levelFor(thermal.maxCelsius, 65, 78) || '';
  fillFacts($('thermal-facts'), (thermal.zones || []).map((zone) => [
    THERMAL_LABELS[zone.type] || zone.type,
    zone.celsius === null ? '不可用' : `${zone.celsius} °C`,
  ]));
}

function renderMemory(status) {
  const memory = status.memory || {};
  const used = $('mem-used');
  used.textContent = fmtPercent(memory.usedPercent);
  setBar('mem-bar', memory.usedPercent);
  used.parentElement.dataset.level = levelFor(memory.usedPercent, 80, 92) || '';
  fillFacts($('mem-facts'), [
    ['总计', fmtBytes(memory.totalBytes)],
    ['已用', Number.isFinite(memory.totalBytes) && Number.isFinite(memory.availableBytes)
      ? fmtBytes(memory.totalBytes - memory.availableBytes) : null],
    ['可用', fmtBytes(memory.availableBytes)],
    ['缓存', fmtBytes(memory.cachedBytes)],
    ['交换分区', memory.swapTotalBytes ? `${fmtBytes(memory.swapTotalBytes - (memory.swapFreeBytes || 0))} / ${fmtBytes(memory.swapTotalBytes)}` : '未启用'],
  ]);
}

function renderDisk(status) {
  const disks = status.disks || [];
  const root = disks.find((disk) => disk.mount === '/') || disks[0];
  if (!root || root.error) {
    $('disk-used').textContent = '--';
    fillFacts($('disk-facts'), [['状态', '不可用']]);
    return;
  }
  const used = $('disk-used');
  used.textContent = fmtPercent(root.usedPercent);
  setBar('disk-bar', root.usedPercent);
  used.parentElement.dataset.level = levelFor(root.usedPercent, 80, 92) || '';
  fillFacts($('disk-facts'), [
    ['挂载点', root.mount],
    ['已用', fmtBytes(root.usedBytes)],
    ['可用', fmtBytes(root.freeBytes)],
    ['总计', fmtBytes(root.totalBytes)],
  ]);
}

const NET_KIND_LABELS = {
  wired: '有线',
  wireless: '无线',
  zerotier: '虚拟网',
  other: '其他',
  virtual: '本地虚拟',
};

const NET_KIND_ORDER = ['wired', 'wireless', 'zerotier', 'other', 'virtual'];

function renderNetwork(status) {
  const tbody = $('net-tbody');
  if (!tbody) return;

  const all = status.networks || [];
  const visible = all.filter((item) => item.kind !== 'virtual');
  const hidden = all.filter((item) => item.kind === 'virtual');

  const kindRank = { wired: 0, wireless: 1, zerotier: 2, other: 3 };
  visible.sort((a, b) => {
    const ra = kindRank[a.kind] ?? 9;
    const rb = kindRank[b.kind] ?? 9;
    return ra - rb || a.name.localeCompare(b.name);
  });

  const makeCell = (className, text) => {
    const td = document.createElement('td');
    if (className) td.className = className;
    td.textContent = text;
    return td;
  };

  tbody.replaceChildren();

  for (const item of visible) {
    const row = document.createElement('tr');

    const nameCell = document.createElement('td');
    const name = document.createElement('div');
    name.className = 'iface-name';
    name.textContent = item.name;
    const kind = document.createElement('div');
    kind.className = 'iface-kind iface-kind-' + (item.kind || 'other');
    kind.textContent = NET_KIND_LABELS[item.kind] || item.kind || '其他';
    nameCell.append(name, kind);

    const addresses = item.addresses || {};
    const v4Text = (addresses.ipv4 || []).join('\n') || '—';
    const v6Text = (addresses.ipv6 || []).join('\n') || '—';

    const errors = (item.rxErrors || 0) + (item.txErrors || 0);
    const downText = errors > 0
      ? `${fmtRate(item.rxBytesPerSecond)}（错 ${errors}）`
      : fmtRate(item.rxBytesPerSecond);

    row.append(
      nameCell,
      makeCell('addr', v4Text),
      makeCell('addr addr-v6', v6Text),
      makeCell('rate rate-down', downText),
      makeCell('rate rate-up', fmtRate(item.txBytesPerSecond)),
    );
    tbody.append(row);
  }

  if (visible.length === 0) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 5;
    cell.className = 'net-empty';
    cell.textContent = '暂无网卡数据';
    row.append(cell);
    tbody.append(row);
  }

  if (hidden.length > 0) {
    const row = document.createElement('tr');
    row.className = 'net-virtual-row';
    const cell = document.createElement('td');
    cell.colSpan = 5;
    cell.textContent = `${hidden.length} 个本地虚拟网卡已折叠（docker / bridge / veth，无需关注）`;
    row.append(cell);
    tbody.append(row);
  }

  const note = $('net-note');
  if (note) {
    const zeroTier = status.stream && status.stream.zeroTierAddress;
    if (zeroTier) {
      note.textContent = `ZeroTier 虚拟地址：${zeroTier}`;
      note.hidden = false;
    } else {
      note.hidden = true;
    }
  }
}

function renderAccelerators(status) {
  const rows = [];
  const coreGroups = [];
  for (const device of status.devfreq || []) {
    const label = DEVFREQ_LABELS[device.device] || device.device;
    const load = device.loadPercent === null ? '--' : `${device.loadPercent}%`;
    rows.push([label, `${load} · ${fmtHz(device.currentHz)}`]);
    if (Array.isArray(device.cores) && device.cores.length > 0) {
      coreGroups.push({ label, cores: device.cores });
    } else if (device.loadSuspect) {
      rows.push([`${label} 说明`, '驱动未上报真实值']);
    }
  }
  fillFacts($('devfreq-facts'), rows.length ? rows : [['状态', '暂无数据']]);

  const facts = $('devfreq-facts');
  facts.querySelectorAll('.core-loads').forEach((line) => line.remove());
  for (const group of coreGroups) {
    const line = document.createElement('div');
    line.className = 'core-loads';
    line.setAttribute('aria-label', `${group.label} 各核利用率`);
    for (const [index, value] of group.cores.entries()) {
      const cell = document.createElement('span');
      cell.textContent = `核${index}：${value}%`;
      line.append(cell);
    }
    facts.append(line);
  }
}

function renderFan(status) {
  const fan = (status.hwmon || {}).fan;
  const power = (status.hwmon || {}).power;
  fillFacts($('fan-facts'), [
    ['风扇 PWM', fan && Number.isFinite(fan.pwm) ? `${fan.pwm} / 255（${Math.round((fan.pwm / 255) * 100)}%）` : '不可用'],
    ['风扇转速', fan && Number.isFinite(fan.rpm) ? `${fan.rpm} RPM` : null],
    ['调速模式', fan && fan.enable === 1 ? '手动（由温控服务接管）' : fan ? '内核自动' : null],
    ['供电电压', power && Number.isFinite(power.voltageMicroVolts) ? `${(power.voltageMicroVolts / 1e6).toFixed(2)} V` : null],
    ['供电电流', power && Number.isFinite(power.currentMicroAmps) ? `${(power.currentMicroAmps / 1e6).toFixed(2)} A` : null],
    ['整机功耗', power && Number.isFinite(power.watts) ? `${power.watts} W` : null],
  ]);
}

function renderSystem(status) {
  const load = status.load || {};
  const kernel = String(status.host?.kernel || '');
  const kernelShort = kernel.replace(/^Linux version\s+/, '').split(' ')[0] || '';
  const bootAt = Number.isFinite(status.bootTime)
    ? new Date(status.bootTime * 1000).toLocaleString('zh-CN', { hour12: false })
    : null;
  fillFacts($('system-facts'), [
    ['开机时长', fmtDuration(status.uptimeSeconds)],
    ['上次重启', bootAt],
    ['负载 (1/5/15 分)', `${load.one ?? '--'} / ${load.five ?? '--'} / ${load.fifteen ?? '--'}`],
    ['进程数', load.processes ? `${load.processes}（运行 ${load.running}）` : null],
    ['内核', kernelShort ? { text: kernelShort, title: kernel } : null],
    ['采集时刻', status.collectedAt ? new Date(status.collectedAt).toLocaleTimeString('zh-CN') : null],
  ]);
}

/** 解析 systemd 输出的人类可读时间（含星期与本地时区缩写）。 */
function parseSystemdTime(value) {
  if (!value) return null;
  const cleaned = String(value)
    .replace(/^[A-Za-z]{3,}\s+/, '')
    .replace(/\s+[A-Z]{2,5}$/, '')
    .trim();
  if (!cleaned) return null;
  const parsed = new Date(cleaned.replace(' ', 'T'));
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}

/** 下次执行时刻：今天/明天/日期 + 时分。 */
function fmtNextAt(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const sameDay = (a, b) => a.toDateString() === b.toDateString();
  const tomorrow = new Date(now.getTime() + 86400000);
  const time = date.toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit' });
  if (sameDay(date, now)) return `今天 ${time}`;
  if (sameDay(date, tomorrow)) return `明天 ${time}`;
  return `${date.getMonth() + 1}/${date.getDate()} ${time}`;
}

/** 距离下次触发还有多久。 */
function fmtCountdown(ms) {
  if (!Number.isFinite(ms)) return '';
  if (ms <= 0) return '即将触发';

  const total = Math.floor(ms / 1000);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;

  if (days >= 1) return `${days} 天 ${hours} 小时后`;
  if (hours >= 1) return `${hours} 小时 ${minutes} 分 ${seconds} 秒后`;
  if (minutes >= 1) return `${minutes} 分 ${seconds} 秒后`;
  return `${seconds} 秒后`;
}

/**
 * 服务分组：按「运行方式 + 用途」归类。
 * 未列出的单元会自动落到「其他」，避免以后新增服务时被隐藏。
 */
const SERVICE_GROUPS = [
  {
    title: '网站服务',
    hint: '持续运行，对外提供页面',
    units: [
      'cloudflared.service',
      'history-site.service',
      'rock-console.service',
      'article-studio.service',
    ],
  },
  {
    title: '数据同步',
    hint: '按计划执行，跑完即退出',
    units: [
      'siyuan-notes-publish.timer',
      'siyuan-notes-publish.service',
    ],
  },
  {
    title: '系统基础',
    hint: '支撑上面所有服务的底座',
    units: [
      'docker.service',
      'rock5b-fan-fixed.service',
    ],
  },
];

function renderServices(status) {
  const body = $('service-rows');
  const services = status.services || [];
  if (services.length === 0) return;

  // 按分组排序，未列出的单元归入「其他」
  const known = new Set(SERVICE_GROUPS.flatMap((g) => g.units));
  const extras = services.filter((s) => !known.has(s.unit));

  const rows = [];
  for (const group of SERVICE_GROUPS) {
    rows.push({ type: 'group', title: group.title, hint: group.hint });
    for (const unit of group.units) {
      const service = services.find((s) => s.unit === unit);
      if (service) rows.push({ type: 'service', service });
    }
  }
  if (extras.length > 0) {
    rows.push({ type: 'group', title: '其他', hint: '' });
    for (const service of extras) rows.push({ type: 'service', service });
  }

  // 结构不变时只更新内容，避免每秒重建导致闪烁
  const signature = rows.map((r) => (r.type === 'group' ? `g:${r.title}` : `s:${r.service.unit}`)).join('|');
  if (body.dataset.signature !== signature) {
    body.replaceChildren();
    for (const row of rows) {
      if (row.type === 'group') {
        const groupTr = document.createElement('tr');
        groupTr.className = 'service-group-row';

        const cell = document.createElement('td');
        cell.colSpan = 7;

        const title = document.createElement('span');
        title.className = 'service-group-title';
        title.textContent = row.title;

        const hint = document.createElement('span');
        hint.className = 'service-group-hint';
        hint.textContent = row.hint;

        cell.append(title, hint);
        groupTr.append(cell);
        body.append(groupTr);
      } else {
        const tr = document.createElement('tr');
        tr.dataset.unit = row.service.unit;

        const name = document.createElement('td');
        const stateCell = document.createElement('td');
        const badge = document.createElement('span');
        badge.className = 'badge';
        stateCell.append(badge);

        const memoryCell = document.createElement('td');
        memoryCell.className = 'service-memory';
        const timerCell = document.createElement('td');
        const lastCell = document.createElement('td');
        const nextCell = document.createElement('td');
        const actionCell = document.createElement('td');

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'ghost';
        button.textContent = '日志';
        button.addEventListener('click', (event) => {
          event.stopPropagation();
          showLogs(row.service.unit);
        });
        actionCell.append(button);

        tr.append(name, stateCell, memoryCell, timerCell, lastCell, nextCell, actionCell);
        tr.addEventListener('click', () => showLogs(row.service.unit));
        body.append(tr);
      }
    }
    body.dataset.signature = signature;
  }

  // 更新内容（按单元名定位，跳过分组行）
  const serviceRows = [...body.querySelectorAll('tr[data-unit]')];
  for (const tr of serviceRows) {
    const unit = tr.dataset.unit;
    const service = services.find((s) => s.unit === unit);
    if (!service) continue;

    const nameCell = tr.children[0];
    nameCell.textContent = unitLabel(service.unit);
    nameCell.title = service.unit;

    const badge = tr.children[1].firstChild;
    badge.dataset.state = service.error ? 'unknown' : service.active || 'unknown';
    badge.textContent = service.error ? '查询失败' : stateLabel(service.active);
    // 整行也带上状态，styles.css 的 tbody tr[data-state="…"] 才能画出左侧色条
    tr.dataset.state = badge.dataset.state;

    const memoryCell = tr.children[2];
    memoryCell.textContent = service.memory ? formatMemory(service.memory) : '—';
    memoryCell.title = service.memory ? `${service.memory} 字节` : '无内存数据';

    const timerCell = tr.children[3];
    const lastCell = tr.children[4];
    const nextCell = tr.children[5];
    const timer = service.timer;
    if (timer) {
      // 定时器：显示触发计划、上次触发与下次触发
      timerCell.textContent = timer.calendar && timer.calendar.length > 0
        ? timer.calendar.join(' / ')
        : '周期';

      const lastAt = parseSystemdTime(timer.last);
      lastCell.textContent = lastAt ? fmtNextAt(lastAt) : '—';
      lastCell.title = timer.last || '';

      const nextAt = parseSystemdTime(timer.next || service.nextRun);
      if (nextAt) {
        const remain = nextAt - Date.now();
        nextCell.textContent = fmtNextAt(nextAt);
        const countdown = document.createElement('span');
        countdown.className = 'countdown';
        countdown.textContent = fmtCountdown(remain);
        nextCell.append(countdown);
      } else {
        nextCell.textContent = '—';
      }
    } else {
      // 普通服务：优先显示同名 timer 的上次触发时间（oneshot 的真实运行时刻）
      timerCell.textContent = '—';
      const runSource = service.lastRun || service.since;
      const sinceAt = parseSystemdTime(runSource);
      if (sinceAt) {
        lastCell.textContent = fmtNextAt(sinceAt);
        lastCell.title = runSource;
        const elapsed = Math.floor((Date.now() - sinceAt) / 1000);
        if (elapsed >= 0) {
          const label = document.createElement('span');
          label.className = 'countdown';
          label.textContent = `${fmtDuration(elapsed)}前`;
          lastCell.append(label);
        }
      } else {
        lastCell.textContent = '—';
      }

      // oneshot 服务：若有关联 timer，显示它的下次触发时间
      const nextAt = parseSystemdTime(service.nextRun);
      if (nextAt) {
        const remain = nextAt - Date.now();
        nextCell.textContent = fmtNextAt(nextAt);
        const countdown = document.createElement('span');
        countdown.className = 'countdown';
        countdown.textContent = fmtCountdown(remain);
        nextCell.append(countdown);
      } else {
        nextCell.textContent = '—';
      }
    }

    tr.children[6].firstChild.hidden = Boolean(service.error);
  }
}

/* -------------------------------------------------------------- 服务活动 */

function fillLogUnits(status) {
  const select = $('log-unit');
  if (select.dataset.filled === '1') return;
  const units = (status.services || []).map((service) => service.unit);
  if (units.length === 0) return;
  const none = document.createElement('option');
  none.value = '';
  none.textContent = '无';
  none.title = '不显示任何日志';

  select.replaceChildren(none, ...units.map((unit) => {
    const option = document.createElement('option');
    option.value = unit;
    option.textContent = unitLabel(unit);
    option.title = unit;
    return option;
  }));
  select.dataset.filled = '1';
  select.value = '';
}

function showLogs(unit) {
  const select = $('log-unit');
  if ([...select.options].some((option) => option.value === unit)) select.value = unit;
  // 用户主动点了某个服务 → 解除清屏并加载，但不滚动页面
  state.activityCleared = false;
  loadActivity();
}

function showClearedHint() {
  const list = $('activity-list');
  if (!list) return;
  list.replaceChildren();
  const empty = document.createElement('li');
  empty.className = 'activity-empty';
  empty.textContent = '未选择服务。在上方下拉框里选一个服务即可查看活动。';
  list.append(empty);
}

async function loadActivity() {
  const unit = $('log-unit').value;

  // 「无」选项 或 清屏态：不拉取，只显示提示
  if (!unit || state.activityCleared) {
    showClearedHint();
    return;
  }

  const list = $('activity-list');
  try {
    const data = await api(`/api/activity?unit=${encodeURIComponent(unit)}&lines=${$('log-lines').value}`);
    state.activity = data;
    renderActivity(data);
  } catch (error) {
    state.activity = null;
    list.replaceChildren();
    const item = document.createElement('li');
    item.className = 'activity-empty';
    item.textContent = `读取服务活动失败：${error.message}`;
    list.append(item);
  }
}

function formatEventTime(value) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  const time = date.toLocaleTimeString('zh-CN', { hour12: false });
  if (date.toDateString() === new Date().toDateString()) return time;
  return `${date.getMonth() + 1}/${date.getDate()} ${time.slice(0, 5)}`;
}

function renderActivity(data) {
  const status = data.status || {};
  const badge = $('activity-state');
  badge.dataset.state = status.activeState || 'unknown';
  badge.textContent = stateLabel(status.activeState);
  $('activity-enabled').textContent = status.unitFileState === 'enabled' ? '开机自启' : '';

  const stats = data.stats || { total: 0, errors: 0, warnings: 0 };
  $('activity-stats').textContent = `共 ${stats.total} 条 · 错误 ${stats.errors} · 警告 ${stats.warnings}`;

  const filter = $('log-filter').value.trim().toLowerCase();
  const list = $('activity-list');
  const fragment = document.createDocumentFragment();
  let shown = 0;

  for (const event of data.events || []) {
    const haystack = `${event.summary} ${event.message}`.toLowerCase();
    if (filter && !haystack.includes(filter)) continue;

    const item = document.createElement('li');
    item.className = 'activity-item';
    item.dataset.level = event.level;

    const time = document.createElement('time');
    time.className = 'activity-time';
    time.textContent = formatEventTime(event.at);

    const dot = document.createElement('span');
    dot.className = 'activity-dot';

    const body = document.createElement('div');
    body.className = 'activity-body';
    const summary = document.createElement('p');
    summary.className = 'activity-summary';
    summary.textContent = event.summary;
    body.append(summary);
    if (event.message && event.message !== event.summary) {
      const raw = document.createElement('p');
      raw.className = 'activity-raw';
      raw.textContent = event.message;
      raw.title = event.message;
      body.append(raw);
    }

    item.append(time, dot, body);
    fragment.append(item);
    shown += 1;
  }

  list.replaceChildren();
  if (shown === 0) {
    const empty = document.createElement('li');
    empty.className = 'activity-empty';
    empty.textContent = filter ? '没有匹配的活动。' : '暂无活动记录。';
    list.append(empty);
  } else {
    list.append(fragment);
  }
}

$('log-refresh').addEventListener('click', () => {
  // 清屏就是「什么都不显示」，此时刷新不做事
  if (state.activityCleared) return;
  loadActivity();
});

// 清屏：停掉自动刷新、下拉框回到「无」、清空列表
$('log-clear').addEventListener('click', () => {
  if (state.logTimer) {
    clearInterval(state.logTimer);
    state.logTimer = null;
    const auto = $('log-auto');
    if (auto) auto.checked = false;
  }

  state.activityCleared = true;
  state.activity = null;

  const unitSelect = $('log-unit');
  if (unitSelect) unitSelect.value = '';

  $('activity-state').textContent = '未知';
  $('activity-state').dataset.state = 'unknown';
  $('activity-enabled').textContent = '';
  $('activity-stats').textContent = '';

  showClearedHint();
});
$('log-unit').addEventListener('change', () => {
  const unit = $('log-unit').value;
  // 选「无」= 清屏态，选具体服务 = 正常加载
  state.activityCleared = !unit;
  loadActivity();
});
$('log-lines').addEventListener('change', () => {
  state.activityCleared = false;
  const button = $('log-clear');
  if (button) button.textContent = '清屏';
  loadActivity();
});
$('log-filter').addEventListener('input', () => {
  if (state.activity) renderActivity(state.activity);
});
$('log-auto').addEventListener('change', (event) => {
  if (state.logTimer) {
    clearInterval(state.logTimer);
    state.logTimer = null;
  }
  if (event.target.checked) {
    state.activityCleared = false;
    loadActivity();
    state.logTimer = setInterval(() => {
      if (!document.hidden) loadActivity();
    }, 5000);
  }
});

/* -------------------------------------------------------------- 终端 */

/* -------------------------------------------------------------- 延迟探测 */

let latencyTimer = null;

function stopLatencyProbe() {
  if (latencyTimer) {
    clearInterval(latencyTimer);
    latencyTimer = null;
  }
  const label = $('terminal-rtt');
  if (label) {
    label.hidden = true;
    label.textContent = 'RTT --';
  }
}

/**
 * 每 3 秒发一次协议级 ping，既测往返延迟，也避免 Cloudflare 因空闲断开 WebSocket。
 */
function startLatencyProbe(socket) {
  stopLatencyProbe();
  const label = $('terminal-rtt');
  if (label) label.hidden = false;
  let sentAt = 0;
  const ping = () => {
    if (socket.readyState !== WebSocket.OPEN) return;
    sentAt = performance.now();
    try {
      socket.send(JSON.stringify({ t: 'ping' }));
    } catch {
      // 连接可能刚好关闭
    }
  };
  socket.addEventListener('message', (event) => {
    if (!sentAt) return;
    let message;
    try {
      message = JSON.parse(event.data);
    } catch {
      return;
    }
    if (message.t !== 'pong') return;
    const rtt = Math.round(performance.now() - sentAt);
    sentAt = 0;
    if (label) label.textContent = rtt > 900 ? 'RTT >900 ms' : `RTT ${rtt} ms`;
  });
  ping();
  latencyTimer = setInterval(ping, 3000);
}

function ensureTerminal() {
  if (state.terminal) return state.terminal;
  const xterm = window.RockConsoleXterm;
  if (!xterm) throw new Error('终端组件未加载。');
  const terminal = new xterm.Terminal({
    cursorBlink: true,
    fontSize: state.fontSize,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "DejaVu Sans Mono", monospace',
    scrollback: 5000,
    theme: {
      background: '#f8fbf9',
      foreground: '#1c2b2a',
      cursor: '#4d7572',
      cursorAccent: '#f8fbf9',
      selectionBackground: 'rgba(77, 117, 114, .18)',
      black: '#1c2b2a',
      red: '#b5473f',
      green: '#4d7572',
      yellow: '#a56213',
      blue: '#3f6e8c',
      magenta: '#7a4a78',
      cyan: '#3f8a79',
      white: '#e8f1ec',
      brightBlack: '#5f7573',
      brightRed: '#c85a52',
      brightGreen: '#3f8a79',
      brightYellow: '#c07a1c',
      brightBlue: '#3a76a8',
      brightMagenta: '#95588f',
      brightCyan: '#3f9385',
      brightWhite: '#1c2b2a',
    },
  });
  const fitAddon = new xterm.FitAddon();
  terminal.loadAddon(fitAddon);
  terminal.open($('terminal-host'));
  terminal.writeln('\x1b[90m点击「新建会话」以在本机（radxa 账号）开启一个终端。\x1b[0m');
  terminal.onData((data) => {
    if (!state.socket || state.socket.readyState !== WebSocket.OPEN) return;
    const send = (value) => state.socket.send(JSON.stringify({ t: 'in', d: value }));
    const local = state.localInputEnabled && state.localActive;

    if (data === '\r') {
      if (local && state.localLine) {
        // 远端这一行本来就是空的，不发 Ctrl-U（它会触发 bash 重绘提示符）。
        // 直接送整行，并吞掉远端这次回显，视觉上就是原始终端。
        send(`${state.localLine}\r`);
        state.echoSuppress = state.localLine;
        state.localLine = '';
      } else {
        send('\r');
      }
      state.localActive = state.localInputEnabled;
      return;
    }

    if (data === '\u007f') {
      if (local && state.localLine) {
        state.localLine = state.localLine.slice(0, -1);
        terminal.write('\b \b');
      } else {
        send(data);
      }
      return;
    }

    // 纯文本：本地立即显示，不占用网络往返。
    if (local && data.length > 0 && !/[\x00-\x1f\x7f]/.test(data)) {
      state.localLine += data;
      terminal.write(data);
      return;
    }

    // 方向键、Tab、Ctrl-* 等：先把本地缓冲同步给远端，再实时发送并暂时退出本地模式。
    if (state.localLine) {
      send(state.localLine);
      state.echoSuppress = state.localLine;
      state.localLine = '';
    }
    state.localActive = false;
    send(data);
  });
  terminal.onResize(({ cols, rows }) => {
    if (state.socket && state.socket.readyState === WebSocket.OPEN) {
      state.socket.send(JSON.stringify({ t: 'resize', cols, rows }));
    }
  });
  state.terminal = terminal;
  state.fitAddon = fitAddon;
  return terminal;
}

function appendTerminalText(text) {
  const terminal = ensureTerminal();
  terminal.write(text);
}

function setTerminalMode(text, stateName) {
  const badge = $('terminal-mode');
  badge.textContent = text;
  badge.dataset.state = stateName || 'unknown';
}

function fitTerminal() {
  if (!state.fitAddon) return;
  try {
    state.fitAddon.fit();
  } catch {
    // 容器隐藏时 fit 会失败，忽略
  }
}

async function connectTerminal(readOnly) {
  closeTerminal();
  const terminal = ensureTerminal();
  fitTerminal();
  const cols = terminal.cols || 100;
  const rows = terminal.rows || 30;
  setTerminalMode('正在创建…', 'warn');
  try {
    const result = await api('/api/terminal', {
      method: 'POST',
      body: JSON.stringify({ cols, rows, readOnly: Boolean(readOnly) }),
    });
    state.sessionId = result.sessionId;
    state.readOnly = result.readOnly;

    const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
    const socket = new WebSocket(`${scheme}://${location.host}/ws?session=${encodeURIComponent(result.sessionId)}`);
    state.socket = socket;
    state.localLine = '';
    state.echoSuppress = '';
    state.localActive = state.localInputEnabled;
    startLatencyProbe(socket);

    socket.addEventListener('open', () => {
      fitTerminal();
      terminal.focus();
    });
    socket.addEventListener('message', (event) => {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }
      if (message.t === 'out') {
        let text = String(message.d || '');
        if (state.echoSuppress) {
          if (text.startsWith(state.echoSuppress)) {
            text = text.slice(state.echoSuppress.length);
            state.echoSuppress = '';
          } else if (state.echoSuppress.startsWith(text)) {
            state.echoSuppress = state.echoSuppress.slice(text.length);
            text = '';
          } else {
            state.echoSuppress = '';
          }
        }
        if (text) terminal.write(text);
      }
      else if (message.t === 'ready') {
        state.readOnly = message.readOnly;
        setTerminalMode(state.readOnly ? '只读会话' : '可写会话', 'live');
      } else if (message.t === 'notice') {
        setTerminalMode(message.message, 'warn');
      } else if (message.t === 'error') {
        setTerminalMode(message.message, 'down');
      }
    });
    socket.addEventListener('close', () => {
      stopLatencyProbe();
      if (state.socket === socket) {
        setTerminalMode('已断开', 'down');
        state.socket = null;
        state.sessionId = null;
      }
    });
    socket.addEventListener('error', () => setTerminalMode('连接错误', 'down'));
  } catch (error) {
    setTerminalMode(error.message, 'down');
  }
}

async function closeTerminal() {
  stopLatencyProbe();
  if (state.socket) {
    try {
      state.socket.close();
    } catch {
      // 忽略
    }
    state.socket = null;
  }
  if (state.sessionId) {
    const id = state.sessionId;
    state.sessionId = null;
    try {
      await api(`/api/terminal/${encodeURIComponent(id)}`, { method: 'DELETE' });
    } catch {
      // 会话可能已因空闲超时结束
    }
  }
  setTerminalMode('未连接', 'unknown');
}

$('terminal-connect').addEventListener('click', () => connectTerminal(false));
$('terminal-readonly').addEventListener('click', () => connectTerminal(true));
$('terminal-clear').addEventListener('click', () => state.terminal?.clear());
$('terminal-close').addEventListener('click', () => closeTerminal());

function applyFontSize(delta) {
  state.fontSize = Math.min(18, Math.max(11, state.fontSize + delta));
  try {
    localStorage.setItem('rock-console.fontSize', String(state.fontSize));
  } catch {
    // 忽略存储失败
  }
  if (state.terminal) {
    state.terminal.options.fontSize = state.fontSize;
    fitTerminal();
  }
}

function toggleTerminalFullscreen(force) {
  const card = document.querySelector('.terminal-card');
  if (!card) return;
  const next = typeof force === 'boolean' ? force : !card.classList.contains('fullscreen');
  card.classList.toggle('fullscreen', next);
  setTimeout(fitTerminal, 80);
}

$('terminal-local').addEventListener('click', () => {
  state.localInputEnabled = !state.localInputEnabled;
  state.localActive = state.localInputEnabled;
  state.localLine = '';
  $('terminal-local').classList.toggle('active', state.localInputEnabled);
  $('terminal-local').title = state.localInputEnabled
    ? '本地输入：按键先在本地显示，回车时整行发送'
    : '实时输入：每个按键立即发送到开发板';
  if (state.terminal) state.terminal.focus();
});

$('terminal-font-dec').addEventListener('click', () => applyFontSize(-1));
$('terminal-font-inc').addEventListener('click', () => applyFontSize(1));
$('terminal-fullscreen').addEventListener('click', () => toggleTerminalFullscreen());
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') toggleTerminalFullscreen(false);
});

let resizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(fitTerminal, 150);
});

/* -------------------------------------------------------------- 启动 */

(async function boot() {
  try {
    const config = await api('/api/config');
    state.allowWrite = config.allowWrite;
    $('terminal-readonly').hidden = !config.allowWrite;
    if (config.totpEnabled) {
      $('totp-label').hidden = false;
      $('totp').hidden = false;
    }
    if (config.authenticated) {
      state.csrfToken = config.csrfToken;
      showConsole();
    } else {
      showLogin();
    }
  } catch (error) {
    showLogin(`无法连接服务：${error.message}`);
  }
})();

/* -------------------------------------------------------------- 侧边栏导航 */

(function setupNav() {
  const items = [...document.querySelectorAll('.nav-item')];
  if (!items.length) return;

  const sections = items
    .map((item) => document.getElementById(item.dataset.target))
    .filter(Boolean);

  const activate = (targetId) => {
    for (const item of items) {
      item.classList.toggle('active', item.dataset.target === targetId);
    }
  };

  for (const item of items) {
    item.addEventListener('click', () => {
      const section = document.getElementById(item.dataset.target);
      if (!section) return;
      activate(item.dataset.target);
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  if ('IntersectionObserver' in window && sections.length > 0) {
    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) activate(visible.target.id);
    }, { rootMargin: '-68px 0px -55% 0px', threshold: [0.1, 0.35] });
    for (const section of sections) observer.observe(section);
  }
})();
