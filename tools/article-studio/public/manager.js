(function () {
  'use strict';

  var app = document.getElementById('app');
  var state = {
    view: 'overview',
    token: '',
    articles: [],
    pending: { articles: [], ahead: 0 },
    rules: { excludedDocuments: [], privateValues: [] },
    documents: [],
    notebook: '',
    historyRules: { excludedDocuments: [], privateValues: [] },
    historyDocs: [],
    comments: [],
    submissions: [],
    editing: null,
    articleMode: 'edit',
    reviewTab: 'pending',
    privacyTab: 'notes',
    message: '',
    trashOpen: false,
    groupOpen: { notes: true, history: true },
    studioDirty: 0,
    taskStatus: '',
  };

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function fmt(iso) {
    if (!iso) return '';
    try {
      var d = new Date(iso);
      var p = function (n) { return String(n).padStart(2, '0'); };
      return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
    } catch (e) { return ''; }
  }
  function flushStudio() {
    return new Promise(function (resolve) {
      var frame = document.querySelector('.studio-frame');
      if (!frame || !frame.contentWindow) return resolve();
      var done = false;
      var timer = null;
      function finish() {
        if (done) return;
        done = true;
        if (timer) clearTimeout(timer);
        window.removeEventListener('message', onMessage);
        resolve();
      }
      function onMessage(event) {
        if (!event.data || event.data.type !== 'studio-flushed') return;
        if (event.data.ok === false) toast(event.data.message || '保存失败');
        finish();
      }
      timer = setTimeout(finish, 8000);
      window.addEventListener('message', onMessage);
      frame.contentWindow.postMessage({ type: 'studio-flush' }, location.origin);
    });
  }

  function toast(text) {
    state.message = text;
    var el = document.getElementById('toast');
    if (el) { el.textContent = text; el.classList.add('is-on'); }
    setTimeout(function () { if (el) el.classList.remove('is-on'); }, 2600);
  }

  /* 隐私规则保存后的重新发布/重新生成是后台任务，必须自己盯着状态，
     否则用户点完只看到一句「已保存」，失败也无从得知。 */
  var taskPollTimer = null;
  function setTaskStatus(text) {
    state.taskStatus = text || '';
    var el = document.getElementById('task-status');
    if (el) el.textContent = state.taskStatus;
  }

  function watchTask(kind, started) {
    var url = kind === 'notes' ? '/api/siyuan-privacy/status' : '/api/history-privacy/status';
    if (taskPollTimer) { clearTimeout(taskPollTimer); taskPollTimer = null; }
    var tick = async function () {
      var status;
      try { status = await api(url); } catch (error) { return; }
      var task = kind === 'notes' ? status.republish : status.sync;
      if (!task) return;
      if (task.running) {
        setTaskStatus(task.message || '正在重新导入并构建…');
        taskPollTimer = setTimeout(tick, 1500);
        return;
      }
      taskPollTimer = null;
      if (task.ok === true) {
        setTaskStatus(task.message || '已完成');
        toast(task.message || '已重新发布');
      } else if (task.ok === false) {
        var tail = String(task.tail || '').trim().split('\n').filter(Boolean).slice(-1)[0] || '';
        setTaskStatus((task.message || '发布失败') + (tail ? '：' + tail : ''));
        toast((task.message || '发布失败') + (tail ? '：' + tail : ''), true);
      } else {
        setTaskStatus('');
      }
      await loadAll();
    };
    if (!started) {
      // started=false 有两种情况：已有任务在跑，或启动失败。先看状态再决定。
      api(url).then(function (status) {
        var task = kind === 'notes' ? status.republish : status.sync;
        if (task && task.running) { setTaskStatus(task.message || '已有任务正在运行…'); taskPollTimer = setTimeout(tick, 1500); }
        else toast('已保存');
      }).catch(function () { toast('已保存'); });
      return;
    }
    setTaskStatus('正在重新导入并构建…');
    taskPollTimer = setTimeout(tick, 1500);
  }


  /* ---------------- 常驻工作台 iframe（Round 69） ----------------
   * 工作台（studio.html）在管理中心里只加载一次；之后点「编辑」只把 iframe
   * 挪进卡片并 postMessage 切文章，不再重建 iframe、不再重跑 CodeMirror 初始化。 */
  var studioFrame = null;
  var studioReady = false;
  var studioPendingPath = null;

  function ensureStudioFrame(preloadPath) {
    if (studioFrame) return studioFrame;
    var stage = document.getElementById('studioStage');
    if (!stage) {
      stage = document.createElement('div');
      stage.id = 'studioStage';
      stage.style.visibility = 'hidden';
      document.body.appendChild(stage);
    }
    var frame = document.createElement('iframe');
    frame.className = 'studio-frame';
    frame.title = '文章工作台';
    frame.src = '/studio.html?embed=1&t=' + Date.now() +
      (preloadPath ? '&path=' + encodeURIComponent(preloadPath) : '');
    stage.appendChild(frame);
    studioFrame = frame;
    return frame;
  }

  // Round 69c：iframe 常驻在 body 下的固定舞台里，只靠 CSS 定位到编辑卡片区域，
  // 不再把 iframe 在容器之间搬动（Chrome 在 iframe 换父节点时会重载文档，预热就白做了）。
  function updateStudioPosition() {
    var host = document.getElementById('studioHost');
    var stage = document.getElementById('studioStage');
    if (!host || !stage || !studioFrame) { if (stage) stage.style.visibility = 'hidden'; return; }
    var rect = host.getBoundingClientRect();
    if (!rect.width || !rect.height) { stage.style.visibility = 'hidden'; return; }
    stage.style.left = rect.left + 'px';
    stage.style.top = rect.top + 'px';
    stage.style.width = rect.width + 'px';
    stage.style.height = rect.height + 'px';
    stage.style.visibility = 'visible';
  }

  function sendStudioOpen(path) {
    if (!studioFrame || !path) return;
    studioFrame.contentWindow.postMessage({ type: 'studio-open', path: path }, location.origin);
  }

  function flushStudioOpen() {
    if (!studioReady || !studioPendingPath) return;
    var path = studioPendingPath;
    studioPendingPath = null;
    var host = document.getElementById('studioHost');
    if (host) host.classList.remove('is-loading');
    sendStudioOpen(path);
  }

  function attachStudio(path) {
    var host = document.getElementById('studioHost');
    if (!host) return;
    ensureStudioFrame(path);
    updateStudioPosition();
    studioPendingPath = path;
    if (studioReady) {
      sendStudioOpen(path);
    } else {
      host.classList.add('is-loading');
    }
  }

  function detachStudio() {
    var stage = document.getElementById('studioStage');
    if (stage) stage.style.visibility = 'hidden';
  }

  function preloadPath() {
    try {
      var last = localStorage.getItem('manager.last-path') || '';
      if (last && state.articles.some(function (a) { return a.path === last; })) return last;
      return state.articles.length ? state.articles[0].path : '';
    } catch (e) { return ''; }
  }

  async function api(url, options) {
    var opts = Object.assign({ credentials: 'same-origin' }, options || {});
    var method = (opts.method || 'GET').toUpperCase();
    if (method !== 'GET') {
      opts.headers = Object.assign({}, opts.headers || {}, { 'x-article-studio-token': state.token });
    }
    var response = await fetch(url, opts);
    if (response.status === 401) { renderLogin(); throw new Error('unauthorized'); }
    var data = await response.json().catch(function () { return {}; });
    if (!response.ok) {
      // 把服务端的 code / warnings / details 一起带出去，
      // 上传被敏感内容拦住时才能知道是哪几篇、该把用户带到哪一篇。
      var failure = new Error(data.error || data.message || ('HTTP ' + response.status));
      failure.code = data.code;
      failure.warnings = data.warnings || [];
      failure.details = data.details;
      throw failure;
    }
    return data;
  }

  /* ---------------- 登录 ---------------- */
  function renderLogin() {
    app.innerHTML = '<div class="login"><canvas class="login-bg" aria-hidden="true"></canvas><form class="login-card" id="login-form">' +
      '<h1>管理中心</h1><p>学习笔记 · 博客 · 岁月史书</p>' +
      '<label class="field"><span>密码</span><input id="login-password" type="password" autocomplete="current-password" required></label>' +
      '<label class="field"><span>动态验证码（如已启用）</span><input id="login-totp" type="text" inputmode="numeric" maxlength="6" autocomplete="one-time-code"></label>' +
      '<button class="btn primary block" type="submit">登录</button>' +
      '<div class="login-msg" id="login-msg"></div></form></div>';
    if (!document.querySelector('script[src*=login-bg]')) { var _lb = document.createElement('script'); _lb.src = '/login-bg.js'; document.body.appendChild(_lb); }
    document.getElementById('login-form').addEventListener('submit', async function (event) {
      event.preventDefault();
      var msg = document.getElementById('login-msg');
      msg.textContent = '登录中…';
      try {
        var data = await fetch('/api/login', {
          method: 'POST', credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            password: document.getElementById('login-password').value,
            totp: document.getElementById('login-totp').value.trim(),
          }),
        }).then(function (r) { return r.json(); });
        if (data.ok) loadAll();
        else msg.textContent = data.error || '登录失败';
      } catch (e) { msg.textContent = '网络异常，请重试'; }
    });
  }

  /* ---------------- 数据 ---------------- */
  async function loadAll() {
    try {
      // Round 73：config 与其余接口并行（GET 请求不依赖 token，省一次串行往返）
      // 每一个接口单独兜底：某个接口坏掉时只让对应模块空着，不要整页跟着白屏
      var safe = function (promise, fallback) {
        return promise.catch(function (error) {
          if (error && error.message === 'unauthorized') throw error;
          return fallback;
        });
      };
      var results = await Promise.all([
        safe(window.__configPromise || api('/api/config'), { token: '' }),
        safe(api('/api/articles'), { articles: [] }),
        safe(api('/api/siyuan-privacy'), { rules: state.rules, documents: [], notebook: '' }),
        safe(api('/api/history-privacy'), { rules: state.historyRules, documents: [] }),
        safe(api('/api/admin/comments'), { comments: [] }),
        safe(api('/api/admin/submissions'), { submissions: [] }),
        safe(api('/api/pending'), { articles: [], ahead: 0 }),
      ]);
      window.__configPromise = null;
      state.token = results[0].token || '';
      state.articles = results[1].articles || [];
      state.rules = results[2].rules || state.rules;
      state.documents = results[2].documents || [];
      state.notebook = results[2].notebook || '';
      state.historyRules = results[3].rules || state.historyRules;
      state.historyDocs = results[3].documents || [];
      state.comments = results[4].comments || [];
      state.submissions = results[5].submissions || [];
      state.pending = results[6] || { articles: [], ahead: 0 };
      render();
      // Round 69：页面数据就绪后空闲预热工作台 iframe，点「编辑」时零等待
      if ('requestIdleCallback' in window) {
        requestIdleCallback(function () { try { ensureStudioFrame(preloadPath()); } catch (e) {} }, { timeout: 2500 });
      } else {
        setTimeout(function () { try { ensureStudioFrame(preloadPath()); } catch (e) {} }, 1500);
      }
    } catch (error) {
      if (error.message === 'unauthorized') return;
      try { render(); } catch (e) { renderLogin(); }
    }
  }

  /* ---------------- 侧边栏 ---------------- */
  function sidebar() {
    var pending = state.submissions.filter(function (item) { return (item.status || 'pending') === 'pending'; }).length;
    var pendingComments = state.comments.filter(function (item) { return (item.status || 'approved') === 'pending'; }).length;
    var excluded = (state.rules.excludedDocuments || []).length;

    function item(view, label, count) {
      return '<button data-view="' + view + '" class="' + (state.view === view ? 'is-active' : '') + '">' +
        esc(label) + (count ? '<span class="badge">' + count + '</span>' : '') + '</button>';
    }

    return '<aside class="side">' +
      item('overview', '概览', 0) +
      item('articles', '文章', state.articles.length) +
      item('review', '审核', pending + pendingComments) +
      item('privacy', '隐私', excluded) +
      '</aside>';
  }

  // 页面内的页签：把「审核」「隐私」这类多子页收进同一个模块，左侧导航只留大块
  function tabs(active, group, items) {
    return '<div class="tabs">' + items.map(function (it) {
      var cls = 'tab' + (it.key === active ? ' is-active' : '');
      return '<button type="button" class="' + cls + '" data-tab="' + it.key + '" data-tab-group="' + group + '">' +
        esc(it.label) + (it.count ? '<span class="badge">' + it.count + '</span>' : '') + '</button>';
    }).join('') + '</div>';
  }

  function stat(value, label) {
    return '<div class="stat"><strong>' + value + '</strong><span>' + esc(label) + '</span></div>';
  }

  /* ---------------- 视图 ---------------- */
  function viewOverview() {
    var pending = state.submissions.filter(function (item) { return (item.status || 'pending') === 'pending'; }).length;
    var approved = state.submissions.filter(function (item) { return item.status === 'approved'; }).length;
    var pendingComments = state.comments.filter(function (item) { return (item.status || 'approved') === 'pending'; }).length;
    var drafts = state.studioDirty;
    var unshipped = (state.pending && state.pending.articles || []).length;
    var todos = [];
    if (drafts) todos.push('<li><button class="link" data-action="save-all">先保存 ' + drafts + ' 篇有改动的文章</button></li>');
    if (unshipped) todos.push('<li><button class="link" data-action="publish-all">' + unshipped + ' 篇文章改动还没上线</button></li>');
    if (pending) todos.push('<li><button class="link" data-view="review">' + pending + ' 条内容补充申请待审核</button></li>');
    if (pendingComments) todos.push('<li><button class="link" data-view="review">' + pendingComments + ' 条评论待审核</button></li>');
    return '<section class="card"><div class="card-head"><h2>概览</h2>' +
      '<div class="row-actions"><button class="btn" data-action="refresh">刷新数据</button></div></div><div class="stats">' +
      stat(state.articles.length, '博客文章') +
      stat(state.rules && (state.rules.excludedDocuments || []).length, '笔记隐私排除') +
      stat(pending, '待处理补充') +
      stat(approved, '已采纳') +
      stat(state.comments.length, '评论') +
      '</div></section>' +
      '<section class="card"><div class="card-head"><h2>待办</h2></div>' +
      (todos.length ? '<ul class="todo">' + todos.join('') + '</ul>'
        : '<p class="empty">没有待处理的事，改动都已保存并上线。</p>') + '</section>' +
      '<section class="card"><div class="card-head"><h2>去往</h2></div><div class="row-actions">' +
      '<button class="btn" data-view="articles">文章与排序</button>' +
      '<button class="btn" data-view="review">内容与评论审核</button>' +
      '<button class="btn" data-view="privacy">两套隐私规则</button>' +
      '<a class="btn" href="https://blogs.yanghanlin.cn" target="_blank" rel="noopener">查看博客</a>' +
      '<a class="btn" href="https://history.yanghanlin.cn" target="_blank" rel="noopener">查看岁月史书</a>' +
      '</div></section>';
  }

  function viewArticles() {
    if (state.articleMode === 'order') return viewPinned();
    if (state.editing) return viewEditor();
    var head = '<div class="card-head"><h2>文章（' + state.articles.length + '）</h2>' +
      '<button class="btn primary" data-action="new-article">新建文章</button></div>';
    if (!state.articles.length) return '<section class="card">' + head + '<p class="empty">还没有文章</p></section>';
    return '<section class="card">' + head + state.articles.map(function (item) {
      return '<div class="article-row"><div class="article-main">' +
        '<span class="row-title">' + (Number(item.sticky) > 0 ? '<span class="pin-badge">置顶</span>' : '') + esc(item.title) + '</span>' +
        '<span class="row-meta">' + fmt(item.updatedAt) + ' · ' + esc(item.path) + '</span>' +
        '</div><button class="btn pill" data-action="edit" data-path="' + esc(item.path) + '">编辑</button></div>';
    }).join('') + '</section>';
  }

  function orderedArticles() {
    return state.articles.slice().sort(function (a, b) {
      var sa = Number(a.sticky) || 0;
      var sb = Number(b.sticky) || 0;
      if (sa !== sb) return sb - sa;
      return String(b.date || '').localeCompare(String(a.date || '')) || String(a.path).localeCompare(String(b.path));
    });
  }

  function viewPinned() {
    var list = orderedArticles();
    var pendingCount = (state.pending && state.pending.articles || []).length;
    var pendingAhead = (state.pending && state.pending.ahead) || 0;
    var pendingNote = pendingCount
      ? '<strong>还有 ' + pendingCount + ' 篇改动没上线</strong>，点下面的按钮或右上角「立即上线」才会更新到博客。'
      : (pendingAhead ? '有 ' + pendingAhead + ' 个提交还没推送到 GitHub，点「立即上线」推送。' : '当前改动都已经上线。');
    var head = '<div class="card-head"><h2>文章排序（' + list.length + '）</h2><div class="card-actions">' +
      (pendingCount || pendingAhead ? '<button class="btn primary" data-action="publish-all">立即上线</button>' : '') +
      '<button class="btn" data-action="order-reset">恢复按时间排序</button>' +
      '<button class="btn" data-action="article-mode" data-mode="edit">返回文章</button></div></div>';
    if (!list.length) return '<section class="card">' + head + '<p class="empty">还没有文章</p></section>';
    return '<section class="card">' + head +
      '<p class="hint">从上到下就是博客首页的显示顺序，第 1 篇排在最前。默认按发布时间倒序；往上挪的文章会被固定住，其余文章继续按时间排列。改动立即写入文章文件，' + pendingNote + '</p>' +
      list.map(function (item, index) {
        var pinned = Number(item.sticky) > 0;
        return '<div class="article-row pin-row"><div class="article-main">' +
          '<span class="row-title"><span class="pin-rank">' + (index + 1) + '</span>' + (pinned ? '<span class="pin-badge">固定</span>' : '') + esc(item.title) + '</span>' +
          '<span class="row-meta">' + esc(item.date || fmt(item.updatedAt)) + ' · ' + esc(item.path) + '</span>' +
          '</div><div class="pin-actions">' +
          '<button class="btn tiny" data-action="pin-top" data-path="' + esc(item.path) + '"' + (index === 0 ? ' disabled' : '') + '>置顶</button>' +
          '<button class="btn tiny" data-action="pin-up" data-path="' + esc(item.path) + '"' + (index === 0 ? ' disabled' : '') + '>上移</button>' +
          '<button class="btn tiny" data-action="pin-down" data-path="' + esc(item.path) + '"' + (index === list.length - 1 ? ' disabled' : '') + '>下移</button>' +
          '</div></div>';
      }).join('') + '</section>';
  }

  async function saveArticleOrder(order, message) {
    await api('/api/pin-order', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ order: order }),
    });
    var latest = await api('/api/articles');
    state.articles = latest.articles || [];
    render();
    toast(message);
  }

  async function changePinOrder(action, path) {
    if (action === 'order-reset') {
      var byDate = state.articles.slice().sort(function (a, b) {
        return String(b.date || '').localeCompare(String(a.date || '')) || String(a.path).localeCompare(String(b.path));
      }).map(function (item) { return item.path; });
      try {
        await saveArticleOrder(byDate, '已恢复按发布时间排序。');
      } catch (error) {
        toast(error.message, true);
      }
      return;
    }
    var order = orderedArticles().map(function (item) { return item.path; });
    var index = order.indexOf(path);
    if (index < 0) return;
    if (action === 'pin-top' && index > 0) {
      order.splice(index, 1);
      order.unshift(path);
    } else if (action === 'pin-up' && index > 0) {
      order.splice(index, 1);
      order.splice(index - 1, 0, path);
    } else if (action === 'pin-down' && index < order.length - 1) {
      order.splice(index, 1);
      order.splice(index + 1, 0, path);
    } else {
      return;
    }
    try {
      await saveArticleOrder(order, '显示顺序已更新。');
    } catch (error) {
      toast(error.message, true);
    }
  }

  function viewEditor() {
    // 编辑器由常驻 iframe 承载（见 ensureStudioFrame）；左边是文档栏，
    // 保存/上传统一放在顶栏，切文章不再弹确认也不再丢改动。
    var current = state.editing ? state.editing.path : '';
    var rows = orderedArticles().map(function (item) {
      return '<button class="doc-item' + (item.path === current ? ' is-active' : '') + '" data-action="edit" data-path="' + esc(item.path) + '">' +
        '<span class="doc-name">' + esc(item.title) + '</span>' +
        '<span class="doc-meta">' + esc(item.date || fmt(item.updatedAt)) + '</span></button>';
    }).join('');
    return '<section class="editor-layout">' +
      '<aside class="doc-rail"><div class="doc-rail-head"><strong>文章（' + state.articles.length + '）</strong>' +
      '<span class="doc-rail-actions">' +
      '<button class="btn tiny" data-action="article-mode" data-mode="order">排序</button>' +
      '<button class="btn tiny" data-action="new-article">新建</button></span></div>' +
      '<div class="doc-rail-list">' + (rows || '<p class="empty">还没有文章</p>') + '</div></aside>' +
      '<div class="editor-pane"><div id="studioHost" class="studio-host"></div></div></section>';
  }

  /* ---------------- 隐私规则（树形 + 父子联动） ---------------- */
  // 思源里同一名字可以既是文档又是父文档（A.md 与 A/子.md 共存），
  // 因此建树时去掉末段 .md，让两者落到同一个节点上。
  // 笔记本根文档（如「学习笔记.md」）单独提为树根，勾选它即全选。
  function buildDocTree(docs, notebook) {
    var root = { name: '', path: '', children: new Map(), doc: null };
    var rootKey = notebook || '';
    var rootDoc = null;
    docs.forEach(function (doc) {
      var raw = String(doc.path || '');
      var segments = raw.split('/').filter(Boolean);
      if (rootKey && raw === rootKey + '.md') {
        rootDoc = doc;
        return;
      }
      var parts = segments.map(function (segment, index) {
        return index === segments.length - 1 ? segment.replace(/\.md$/i, '') : segment;
      });
      var node = root;
      parts.forEach(function (part, index) {
        if (!node.children.has(part)) {
          node.children.set(part, { name: part, path: parts.slice(0, index + 1).join('/'), children: new Map(), doc: null });
        }
        node = node.children.get(part);
        if (index === parts.length - 1) node.doc = doc;
      });
    });
    if (rootDoc) {
      var wrapper = { name: rootKey, path: rootKey, children: root.children, doc: rootDoc };
      var outer = { name: '', path: '', children: new Map(), doc: null };
      outer.children.set(rootKey, wrapper);
      return outer;
    }
    return root;
  }

  function renderDocTree(node, excluded, viewAction) {
    var entries = [...node.children.values()].sort(function (a, b) {
      var aHas = a.children.size > 0;
      var bHas = b.children.size > 0;
      if (aHas !== bHas) return aHas ? -1 : 1;
      return a.name.localeCompare(b.name, 'zh-CN');
    });
    return '<ul class="privacy-tree">' + entries.map(function (child) {
      var hasChildren = child.children.size > 0;
      var isDoc = Boolean(child.doc);
      var checked = isDoc && excluded.has(child.doc.path);
      // 每个节点都带 data-group（便于级联子级）；有文档的再带 data-privacy（保存用）
      var attrs = ' data-group="' + esc(child.path) + '"' +
        (isDoc ? ' data-privacy="' + esc(child.doc.path) + '"' : '');
      var self = '<label class="privacy-item' + (hasChildren ? ' has-children' : '') + '">' +
        '<input type="checkbox"' + attrs + (checked ? ' checked' : '') + '>' +
        '<span>' + esc(isDoc ? child.doc.title : child.name) +
        (isDoc ? '<small>' + esc(child.doc.path) + '</small>' : '') +
        (isDoc && hasChildren ? '<em class="privacy-badge">含子文档</em>' : '') +
        '</span></label>' +
        (viewAction && isDoc ? '<button type="button" class="btn tiny" data-action="' + viewAction + '" data-path="' + esc(child.doc.path) + '">查看</button>' : '');
      var kids = hasChildren ? renderDocTree(child, excluded, viewAction) : '';
      return '<li>' + self + kids + '</li>';
    }).join('') + '</ul>';
  }

  function viewPrivacy() {
    var excluded = new Set(state.rules.excludedDocuments || []);
    var docs = state.documents || [];
    var head = '<div class="card-head"><h2>学习笔记隐私（排除 ' + excluded.size + ' / 共 ' + docs.length + '）</h2>' +
      '<div class="row-actions">' +
      '<button class="btn" data-action="privacy-expand">全部展开</button>' +
      '<button class="btn primary" data-action="save-privacy">保存并重新发布</button></div></div>' +
      '<p class="hint task-status" id="task-status">' + esc(state.taskStatus) + '</p>';
    if (!docs.length) return '<section class="card">' + head + '<p class="empty">没有找到学习笔记文档</p></section>';
    var tree = buildDocTree(docs, state.notebook);
    return '<section class="card">' + head +
      '<p class="hint">勾选表示「不公开」。勾选目录会连带勾选其下所有文档；保存后自动重新导入、构建并发布。</p>' +
      '<div class="privacy-tree-wrap">' + renderDocTree(tree, excluded) + '</div></section>';
  }

  /* ---------------- 岁月史书隐私 ---------------- */
  function showHistoryDoc(doc) {
    var old = document.getElementById('historyDocDialog');
    if (old) old.remove();
    var wrap = document.createElement('div');
    wrap.id = 'historyDocDialog';
    wrap.className = 'doc-view';
    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'btn';
    close.textContent = '关闭';
    close.addEventListener('click', function () { wrap.remove(); });
    var title = document.createElement('h3');
    title.textContent = doc.title || '';
    var pre = document.createElement('pre');
    pre.className = 'doc-source';
    pre.textContent = doc.content || '';
    wrap.appendChild(close);
    wrap.appendChild(title);
    wrap.appendChild(pre);
    document.body.appendChild(wrap);
  }

  function viewHistoryPrivacy() {
    var excluded = new Set(state.historyRules.excludedDocuments || []);
    var docs = state.historyDocs || [];
    var head = '<div class="card-head"><h2>岁月史书隐私（排除 ' + excluded.size + ' / 共 ' + docs.length + '）</h2>' +
      '<div class="row-actions">' +
      '<button class="btn" data-action="history-privacy-expand">全部展开</button>' +
      '<button class="btn primary" data-action="save-history-privacy">保存并重新生成</button></div></div>' +
      '<p class="hint task-status" id="task-status">' + esc(state.taskStatus) + '</p>';
    if (!docs.length) return '<section class="card">' + head + '<p class="empty">没有找到岁月史书文档（确认 /srv/blog/history-source 存在）</p></section>';
    var tree = buildDocTree(docs, '岁月史书');
    return '<section class="card">' + head +
      '<p class="hint">勾选表示「不公开到岁月史书站」——勾选目录会连带其下所有文档。保存后自动重新导出、生成并部署岁月史书；被排除的文档只在管理中心可见（点「查看」读原文）。</p>' +
      '<div class="privacy-tree-wrap">' + renderDocTree(tree, excluded, 'history-doc') + '</div></section>';
  }

  /* ---------------- 内容补充审核 ---------------- */
  var CAT_LABELS = { event: '事件', person: '人物', guild: '公会', timeline: '时间线', topic: '专题', fix: '纠错', other: '其他' };

  function submissionRow(item, actions) {
    var status = item.status || 'pending';
    var catLabel = CAT_LABELS[item.category] || '';
    return '<div class="row"><div class="row-head"><span class="row-title">' + esc(item.title || '（未指定文档）') + '</span>' +
      '<span class="tag ' + status + '">' + ({ pending: '待处理', approved: '已采纳', rejected: '已忽略' }[status] || status) + '</span>' +
      (catLabel ? '<span class="tag cat">' + catLabel + '</span>' : '') + '</div>' +
      '<p class="row-body">' + esc(item.content) + '</p>' +
      '<p class="row-meta">' + (item.page ? '来源：' + esc(item.page) + ' · ' : '') + fmt(item.createdAt) + (item.contact ? ' · ' + esc(item.contact) : '') + '</p>' +
      (actions ? '<div class="row-actions">' + actions + '</div>' : '') + '</div>';
  }

  function viewSubmissions() {
    var pending = state.submissions.filter(function (s) { return (s.status || 'pending') === 'pending'; });
    var cats = {};
    pending.forEach(function (it) { var c = it.category || 'other'; cats[c] = (cats[c] || 0) + 1; });
    var catSummary = Object.keys(CAT_LABELS).filter(function (k) { return cats[k]; }).map(function (k) { return CAT_LABELS[k] + ' ' + cats[k]; }).join(' · ');
    var head = '<div class="card-head"><h2>岁月史书内容补充审核（待处理 ' + pending.length + '）</h2>' +
      (catSummary ? '<span class="hint" style="margin-left:10px">' + catSummary + '</span>' : '') + '</div>';
    if (!pending.length) return '<section class="card">' + head + '<p class="empty">没有待处理的申请</p></section>';
    return '<section class="card">' + head +
      '<p class="hint">只需决定采纳或忽略。采纳的申请会出现在「已采纳」里，供后续整理入库；忽略的进入垃圾桶，30 天后自动删除。</p>' +
      pending.map(function (item) {
        return submissionRow(item,
          '<button class="btn ok" data-action="submission-status" data-id="' + esc(item.id) + '" data-status="approved">采纳</button>' +
          '<button class="btn danger" data-action="submission-status" data-id="' + esc(item.id) + '" data-status="rejected">忽略</button>');
      }).join('') + '</section>';
  }

  function viewApproved() {
    var list = state.submissions.filter(function (s) { return s.status === 'approved'; });
    var head = '<div class="card-head"><h2>已采纳（' + list.length + '）</h2></div>';
    if (!list.length) return '<section class="card">' + head + '<p class="empty">还没有采纳的申请</p></section>';
    return '<section class="card">' + head +
      '<p class="hint">这些申请已确认采纳，等待整理进岁月史书。</p>' +
      list.map(function (item) {
        return submissionRow(item,
          '<button class="btn" data-action="submission-status" data-id="' + esc(item.id) + '" data-status="pending">退回待处理</button>');
      }).join('') + '</section>';
  }

  function viewTrash() {
    var list = state.submissions.filter(function (s) { return s.status === 'rejected'; });
    var head = '<div class="card-head"><h2>垃圾桶（' + list.length + '）</h2>' +
      (list.length ? '<div class="row-actions"><button class="btn danger" data-action="purge-trash">清空垃圾桶</button></div>' : '') +
      '</div>';
    if (!list.length) return '<section class="card">' + head + '<p class="empty">垃圾桶是空的</p></section>';
    return '<section class="card">' + head +
      '<p class="hint">被忽略的申请在这里保留 30 天，之后自动删除。期间可以恢复为待处理。</p>' +
      list.map(function (item) {
        return submissionRow(item,
          '<button class="btn" data-action="submission-status" data-id="' + esc(item.id) + '" data-status="pending">恢复</button>' +
          '<button class="btn danger" data-action="purge-submission" data-id="' + esc(item.id) + '">彻底删除</button>');
      }).join('') + '</section>';
  }

  function commentStatus(item) {
    return item.status === 'rejected' ? 'rejected' : item.status === 'pending' ? 'pending' : 'approved';
  }

  function commentDocName(page) {
    try {
      var p = decodeURIComponent(page || '').replace(/\/index\.html$/, '');
      var parts = p.split('/').filter(Boolean);
      return parts.length ? parts.slice(-2).join(' / ') : (page || '');
    } catch (e) { return page || ''; }
  }

  function viewComments() {
    if (!state.comments.length) return '<section class="card"><div class="card-head"><h2>评论</h2></div><p class="empty">还没有评论</p></section>';
    return '<section class="card"><div class="card-head"><h2>评论（' + state.comments.length + '）</h2>' +
      '<span class="hint">通过后才会显示在博客页面上</span></div>' + state.comments.map(function (item) {
      var status = commentStatus(item);
      var statusText = status === 'pending' ? '待审核' : status === 'rejected' ? '已驳回' : '已通过';
      var docName = commentDocName(item.page);
      var approve = status === 'approved' ? '' :
        '<button class="btn ok" data-action="approve-comment" data-id="' + esc(item.id) + '">通过</button>';
      var reject = status === 'rejected' ? '' :
        '<button class="btn warn" data-action="reject-comment" data-id="' + esc(item.id) + '">驳回</button>';
      return '<div class="row"><div class="row-head"><span class="row-title">' + esc(item.name) + '</span>' +
        '<span class="row-meta">' + fmt(item.createdAt) + ' · ▲ ' + (item.likes ? item.likes.length : 0) +
        ' · <span class="comment-status is-' + status + '">' + statusText + '</span></span></div>' +
        '<p class="row-body">' + esc(item.content) + '</p>' +
        '<p class="row-meta comment-source"><span>评论于</span><span class="comment-doc" title="' + esc(item.page) + '">' + esc(docName) + '</span></p>' +
        '<div class="row-actions">' + approve + reject +
        '<button class="btn danger" data-action="delete-comment" data-id="' + esc(item.id) + '">删除</button></div></div>';
    }).join('') + '</section>';
  }

  /* ---------------- 审核（补充 / 已采纳 / 垃圾桶 / 评论） ---------------- */
  function viewReview() {
    var pending = state.submissions.filter(function (item) { return (item.status || 'pending') === 'pending'; }).length;
    var approved = state.submissions.filter(function (item) { return item.status === 'approved'; }).length;
    var rejected = state.submissions.filter(function (item) { return item.status === 'rejected'; }).length;
    var pendingComments = state.comments.filter(function (item) { return (item.status || 'approved') === 'pending'; }).length;
    var tab = state.reviewTab || 'pending';
    var body = tab === 'approved' ? viewApproved()
      : tab === 'trash' ? viewTrash()
      : tab === 'comments' ? viewComments()
      : viewSubmissions();
    return tabs(tab, 'review', [
      { key: 'pending', label: '待处理', count: pending },
      { key: 'approved', label: '已采纳', count: approved },
      { key: 'trash', label: '垃圾桶', count: rejected },
      { key: 'comments', label: '评论', count: pendingComments ? state.comments.length + ' · 待审 ' + pendingComments : state.comments.length },
    ]) + body;
  }

  /* ---------------- 隐私（学习笔记 / 岁月史书） ---------------- */
  function viewPrivacyHub() {
    var tab = state.privacyTab || 'notes';
    return tabs(tab, 'privacy', [
      { key: 'notes', label: '学习笔记', count: (state.rules.excludedDocuments || []).length },
      { key: 'history', label: '岁月史书', count: (state.historyRules.excludedDocuments || []).length },
    ]) + (tab === 'history' ? viewHistoryPrivacy() : viewPrivacy());
  }

  /* ---------------- 编辑器 ---------------- */
  function render() {
    detachStudio(); // Round 69：先把常驻 iframe 停回 park，避免 innerHTML 替换连它一起销毁
    var views = {
      overview: viewOverview,
      articles: viewArticles,
      review: viewReview,
      privacy: viewPrivacyHub,
    };
    var pendingCount = (state.pending && state.pending.articles || []).length;
    var pendingAhead = (state.pending && state.pending.ahead) || 0;
    var pendingText = pendingCount ? pendingCount + ' 篇未上线' : (pendingAhead ? pendingAhead + ' 个提交待推送' : '');
    var pendingChip = pendingText
      ? '<button class="top-btn top-btn-accent" data-action="publish-all" title="把这些改动构建并推送到线上">' +
        pendingText + ' · 立即上线</button>'
      : '';
    var dirtyChip = '<button class="top-btn" data-action="save-all"' + (state.studioDirty ? '' : ' disabled') + '>' +
      (state.studioDirty ? '保存（' + state.studioDirty + ' 篇）' : '保存') + '</button>';
    app.innerHTML = '<header class="topbar"><div class="brand">管理中心<span>学习笔记 · 博客 · 岁月史书</span></div>' +
      '<div class="top-actions">' + dirtyChip + pendingChip + '<button class="top-btn" data-action="refresh">刷新</button>' +
      '<button class="top-btn" data-action="logout">退出</button></div></header>' +
      '<div class="layout">' + sidebar() + '<main class="content">' + (views[state.view] || views.overview)() + '</main></div>' +
      '<div id="toast" class="toast"></div>';
    if (state.editing) attachStudio(state.editing && state.editing.path);
    if (state.message) {
      var el = document.getElementById('toast');
      if (el) { el.textContent = state.message; el.classList.add('is-on'); }
    }
  }

  /* ---------------- 交互 ---------------- */
  // 在编辑器视图里点左侧文档栏切换文章：不整页重渲，也不重新校验列表，
  // 直接把 path 交给 iframe（它自己会把当前草稿先 stash 起来）。
  async function switchArticle(path) {
    if (!path) return;
    if (state.editing && state.editing.path === path) return;
    if (!state.editing) { await openEditor(path); return; }
    state.editing = { path: path };
    try { localStorage.setItem('manager.last-path', path); } catch (error) {}
    Array.prototype.forEach.call(document.querySelectorAll('.doc-item'), function (item) {
      item.classList.toggle('is-active', item.getAttribute('data-path') === path);
    });
    // 编辑器还没加载完时先把目标路径记下来，等 studio-ready 后由 flushStudioOpen 补发
    studioPendingPath = path;
    if (studioReady) {
      sendStudioOpen(path);
    } else {
      var host = document.getElementById('studioHost');
      if (host) host.classList.add('is-loading');
    }
  }

  async function openEditor(path) {
    // 编辑器内嵌在管理中心里（iframe 载入文章工作台），不做整页跳转。
    // 先取一次最新列表：文章可能刚在工作台里（或另一个标签页）被删掉、改名，
    // 这时候直接挂 iframe 只会看到一个「文章不存在」的空编辑器。
    // Round 45
    try {
      var latest = await api('/api/articles');
      state.articles = latest.articles || [];
      var alive = state.articles.some(function (item) { return item.path === path; });
      if (!alive) {
        state.editing = null;
        render();
        toast('这篇文章已经不在了（可能刚被删除或改名），列表已刷新。');
        return;
      }
    } catch (error) {
      // 列表拉不到就照常打开，让工作台自己报错
    }
    state.editing = { path: path };
    try { localStorage.setItem('manager.last-path', path); } catch (error) {}
    render();
  }

  // 工作台（iframe）里删掉文章后，母页面要跟着回列表并刷新，不然列表还留着死条目。
  // Round 45
  window.addEventListener('message', function (event) {
    var data = event.data;
    if (data && data.type === 'studio-dirty') {
      var next = Number(data.count) || 0;
      if (next === state.studioDirty) return;
      state.studioDirty = next;
      var button = document.querySelector('[data-action="save-all"]');
      if (button) {
        button.textContent = next ? '保存（' + next + ' 篇）' : '保存';
        button.disabled = next === 0;
      }
      return;
    }
    if (!data || data.type !== 'rock-studio:article-deleted') return;
    state.editing = null;
    api('/api/articles').then(function (latest) {
      state.articles = latest.articles || [];
      render();
      toast('已删除，列表已刷新。');
    }).catch(function () { render(); });
  });

  app.addEventListener('change', function (event) {
    var box = event.target.closest('input[type="checkbox"]');
    if (!box) return;
    if (!box.hasAttribute('data-group')) return;
    var item = box.closest('li');
    if (!item) return;
    // 勾选/取消一个节点时，级联它下面所有层级
    item.querySelectorAll('input[type="checkbox"]').forEach(function (child) {
      if (child !== box) child.checked = box.checked;
    });
  });

  app.addEventListener('click', async function (event) {
    var groupToggle = event.target.closest('[data-group-toggle]');
    if (groupToggle) {
      var groupKey = groupToggle.getAttribute('data-group-toggle');
      state.groupOpen[groupKey] = state.groupOpen[groupKey] === false;
      render();
      return;
    }

    var tabButton = event.target.closest('[data-tab]');
    if (tabButton) {
      var tabGroup = tabButton.getAttribute('data-tab-group');
      var tabKey = tabButton.getAttribute('data-tab');
      if (tabGroup === 'review') state.reviewTab = tabKey;
      else if (tabGroup === 'privacy') state.privacyTab = tabKey;
      render();
      return;
    }

    var viewButton = event.target.closest('[data-view]');
    if (viewButton) {
      // 旧入口（置顶排序 / 已采纳 / 垃圾桶 / 评论 / 岁月史书隐私）一律归到新模块
      var legacy = {
        pinned: ['articles', { articleMode: 'order' }],
        submissions: ['review', { reviewTab: 'pending' }],
        approved: ['review', { reviewTab: 'approved' }],
        trash: ['review', { reviewTab: 'trash' }],
        comments: ['review', { reviewTab: 'comments' }],
        historyPrivacy: ['privacy', { privacyTab: 'history' }],
      };
      var wanted = viewButton.getAttribute('data-view');
      if (legacy[wanted]) {
        state.view = legacy[wanted][0];
        Object.keys(legacy[wanted][1]).forEach(function (key) { state[key] = legacy[wanted][1][key]; });
      } else {
        state.view = wanted;
      }
      state.editing = null;
      if (state.view === 'articles' && state.articleMode !== 'order') state.articleMode = 'edit';
      if (state.view === 'articles' && state.articleMode !== 'order') {
        // Round 71：不再显示中间的文章列表卡片，点「文章」直接打开工作台看正文
        var lastPath = '';
        try { lastPath = localStorage.getItem('manager.last-path') || ''; } catch (error) {}
        var article = state.articles.find(function (item) { return item.path === lastPath; }) || state.articles[0];
        if (article) { await openEditor(article.path); return; }
      }
      render();
      return;
    }

    var target = event.target.closest('[data-action]');
    if (!target) return;
    var action = target.getAttribute('data-action');

    try {
      if (action === 'logout') {
        await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' });
        renderLogin();
        return;
      }
      if (action === 'refresh') { loadAll(); return; }
      if (action === 'pin-top' || action === 'pin-up' || action === 'pin-down' || action === 'order-reset') {
        return changePinOrder(action, target.getAttribute('data-path'));
      }
      if (action === 'back-to-articles') { state.editing = null; state.view = 'articles'; state.articleMode = 'edit'; render(); return; }
      if (action === 'article-mode') {
        state.articleMode = target.getAttribute('data-mode') || 'edit';
        if (state.articleMode === 'order') { state.editing = null; render(); return; }
        // 回到编辑时直接打开上次那篇，少一次点击
        var lastEdited = '';
        try { lastEdited = localStorage.getItem('manager.last-path') || ''; } catch (error) {}
        var reopen = state.articles.find(function (item) { return item.path === lastEdited; }) || state.articles[0];
        if (reopen) { await openEditor(reopen.path); return; }
        render();
        return;
      }
      if (action === 'save-all' || action === 'save-editor' || action === 'publish-editor') {
        var frame = document.querySelector('.studio-frame');
        if (!frame || !frame.contentWindow) return toast('编辑器还没加载完');
        var message = action === 'publish-editor' ? 'studio-publish' : 'studio-save-all';
        frame.contentWindow.postMessage({ type: message }, location.origin);
        return;
      }

      if (action === 'publish-all') {
        var publishLabel = target.textContent;
        target.disabled = true;
        target.textContent = '正在构建并上线…';
        try {
          // 先把编辑器里还没落盘的改动写下去，否则「上线」只会带上已保存的那些。
          if (state.studioDirty) await flushStudio();
          var published = await api('/api/publish', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
          toast(published.message || '已上线');
        } catch (publishError) {
          // 敏感内容要逐篇确认，管理中心这边给不出勾选框，直接把用户带到那篇文章。
          var flagged = (publishError.warnings || []).map(function (item) { return item.article; })
            .filter(function (article) { return Boolean(article); })
            .filter(function (article, index, list) { return list.indexOf(article) === index; });
          if ((publishError.code === 'SENSITIVE_WARNING' || publishError.code === 'SENSITIVE_BLOCK') && flagged.length) {
            toast('有 ' + flagged.length + ' 篇文章含敏感内容待确认，正在打开第一篇。', true);
            await openEditor(flagged[0]);
          } else {
            toast(publishError.message, true);
          }
        } finally {
          target.disabled = false;
          target.textContent = publishLabel;
          await loadAll();
        }
        return;
      }

      if (action === 'new-article') {
        var slug = prompt('新文章的文件名（英文/数字，例如 my-post）：');
        if (!slug) return;
        var title = prompt('文章标题：') || slug;
        var created = await api('/api/create', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ slug: slug, title: title }),
        });
        // 新建后同样内嵌打开，不整页跳走（用户要求「不要跳转太多界面」）
        await openEditor(created.path);
        return;
      }

      if (action === 'edit') { await switchArticle(target.getAttribute('data-path')); return; }

      if (action === 'delete-article') {
        if (!confirm('删除这篇文章及其图片？此操作会立即发布。')) return;
        var removed = await api('/api/delete', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ path: state.editing.path }),
        });
        toast(removed.message || '已删除');
        state.editing = null;
        await loadAll();
        return;
      }

      if (action === 'privacy-expand') {
        document.querySelectorAll('.privacy-tree ul').forEach(function (list) {
          list.hidden = list.hidden === true ? false : list.hidden;
        });
        document.querySelectorAll('.privacy-tree-wrap ul').forEach(function (list) { list.hidden = false; });
        return;
      }

      if (action === 'save-privacy') {
        var checked = [];
        document.querySelectorAll('[data-privacy]').forEach(function (box) {
          if (box.checked) checked.push(box.getAttribute('data-privacy'));
        });
        var result = await api('/api/siyuan-privacy', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ excludedDocuments: checked, privateValues: state.rules.privateValues || [] }),
        });
        state.rules = result.rules || state.rules;
        render();
        watchTask('notes', Boolean(result.republish && result.republish.started));
        return;
      }

      if (action === 'history-privacy-expand') {
        document.querySelectorAll('.privacy-tree-wrap ul').forEach(function (list) { list.hidden = false; });
        return;
      }

      if (action === 'save-history-privacy') {
        var checked = [];
        document.querySelectorAll('[data-privacy]').forEach(function (box) {
          if (box.checked) checked.push(box.getAttribute('data-privacy'));
        });
        var hresult = await api('/api/history-privacy', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ excludedDocuments: checked, privateValues: state.historyRules.privateValues || [] }),
        });
        state.historyRules = hresult.rules || state.historyRules;
        state.taskStatus = '';
        render();
        watchTask('history', Boolean(hresult.sync && hresult.sync.started));
        return;
      }

      if (action === 'history-doc') {
        var hdocPath = target.getAttribute('data-path');
        var hdoc = await api('/api/history-doc?path=' + encodeURIComponent(hdocPath));
        showHistoryDoc(hdoc);
        return;
      }

      if (action === 'approve-comment' || action === 'reject-comment') {
        var reviewId = target.getAttribute('data-id');
        var reviewStatus = action === 'approve-comment' ? 'approved' : 'rejected';
        await api('/api/admin/comments/review', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id: reviewId, status: reviewStatus }),
        });
        state.comments.forEach(function (item) { if (item.id === reviewId) item.status = reviewStatus; });
        render();
        toast(reviewStatus === 'approved' ? '已通过，网站上可见' : '已驳回，网站上不显示');
        return;
      }

      if (action === 'delete-comment') {
        if (!confirm('删除这条评论？')) return;
        var commentId = target.getAttribute('data-id');
        await api('/api/admin/comments?id=' + encodeURIComponent(commentId), { method: 'DELETE' });
        state.comments = state.comments.filter(function (item) { return item.id !== commentId; });
        render();
        toast('已删除');
        return;
      }

      if (action === 'purge-trash') {
        var trashCount = state.submissions.filter(function (item) { return item.status === 'rejected'; }).length;
        if (!confirm('清空垃圾桶？' + trashCount + ' 条申请会被永久删除，无法恢复。')) return;
        await api('/api/admin/submissions?all=1', { method: 'DELETE' });
        state.submissions = state.submissions.filter(function (item) { return item.status !== 'rejected'; });
        render();
        toast('垃圾桶已清空');
        return;
      }

      if (action === 'purge-submission') {
        if (!confirm('彻底删除这条申请？删除后无法恢复。')) return;
        var purgeId = target.getAttribute('data-id');
        await api('/api/admin/submissions?id=' + encodeURIComponent(purgeId), { method: 'DELETE' });
        state.submissions = state.submissions.filter(function (item) { return item.id !== purgeId; });
        render();
        toast('已彻底删除');
        return;
      }

      if (action === 'submission-status') {
        var id = target.getAttribute('data-id');
        var status = target.getAttribute('data-status');
        await api('/api/admin/submissions/status', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id: id, status: status }),
        });
        state.submissions.forEach(function (item) { if (item.id === id) item.status = status; });
        render();
        toast(status === 'approved' ? '已采纳' : status === 'rejected' ? '已放入垃圾桶' : '已恢复');
        return;
      }
    } catch (error) {
      if (error.message !== 'unauthorized') toast(error.message || '操作失败');
    }
  });

  // 接收 iframe 内的回执与就绪通知
  window.addEventListener('message', function (event) {
    if (event.origin !== location.origin) return;
    var data = event.data || {};
    if (data.type === 'studio-error') {
      console.error('[studio]', data.message, data.file + ':' + data.line);
      toast('工作台报错：' + data.message);
    }
    if (data.type === 'studio-ready') {
      studioReady = true;
      var host = document.getElementById('studioHost');
      if (host) host.classList.remove('is-loading');
      flushStudioOpen();
    }
    // 保存的吐司由 iframe 自己弹（「已保存 N 篇。」），这里只同步数据，避免两条重叠。
    if (data.type === 'studio-saved') {
      // 编辑器被藏起来时（概览/排序页），iframe 里的吐司看不见，由外层补一条
      if (!state.editing) toast(Number(data.saved) > 0 ? '已保存 ' + data.saved + ' 篇。' : '已保存。');
      loadAll();
    }
    if (data.type === 'studio-published') { toast('已上传'); loadAll(); }
  });

  window.addEventListener('resize', updateStudioPosition);
  window.addEventListener('scroll', updateStudioPosition, { passive: true });
  loadAll();
})();
