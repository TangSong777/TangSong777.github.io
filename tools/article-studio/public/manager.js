(function () {
  'use strict';

  var app = document.getElementById('app');
  var state = {
    view: 'overview',
    token: '',
    articles: [],
    rules: { excludedDocuments: [], privateValues: [] },
    documents: [],
    notebook: '',
    historyRules: { excludedDocuments: [], privateValues: [] },
    historyDocs: [],
    comments: [],
    submissions: [],
    editing: null,
    message: '',
    trashOpen: false,
    groupOpen: { notes: true, history: true },
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
  function toast(text) {
    state.message = text;
    var el = document.getElementById('toast');
    if (el) { el.textContent = text; el.classList.add('is-on'); }
    setTimeout(function () { if (el) el.classList.remove('is-on'); }, 2600);
  }


  /* ---------------- 常驻工作台 iframe（Round 69） ----------------
   * 工作台（studio.html）在管理中心里只加载一次；之后点「编辑」只把 iframe
   * 挪进卡片并 postMessage 切文章，不再重建 iframe、不再重跑 CodeMirror 初始化。 */
  var studioFrame = null;
  var studioReady = false;
  var studioPendingPath = null;

  function ensureStudioFrame() {
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
    frame.src = '/studio.html?embed=1&t=' + Date.now();
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
    ensureStudioFrame();
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

  async function api(url, options) {
    var opts = Object.assign({ credentials: 'same-origin' }, options || {});
    var method = (opts.method || 'GET').toUpperCase();
    if (method !== 'GET') {
      opts.headers = Object.assign({}, opts.headers || {}, { 'x-article-studio-token': state.token });
    }
    var response = await fetch(url, opts);
    if (response.status === 401) { renderLogin(); throw new Error('unauthorized'); }
    var data = await response.json().catch(function () { return {}; });
    if (!response.ok) throw new Error(data.error || data.message || ('HTTP ' + response.status));
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
      var results = await Promise.all([
        window.__configPromise || api('/api/config'),
        api('/api/articles'),
        api('/api/siyuan-privacy'),
        api('/api/history-privacy'),
        api('/api/admin/comments'),
        api('/api/admin/submissions'),
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
      render();
      // Round 69：页面数据就绪后空闲预热工作台 iframe，点「编辑」时零等待
      if ('requestIdleCallback' in window) {
        requestIdleCallback(function () { try { ensureStudioFrame(); } catch (e) {} }, { timeout: 2500 });
      } else {
        setTimeout(function () { try { ensureStudioFrame(); } catch (e) {} }, 1500);
      }
    } catch (error) {
      if (error.message === 'unauthorized') return;
      try { render(); } catch (e) { renderLogin(); }
    }
  }

  /* ---------------- 侧边栏 ---------------- */
  function sidebar() {
    var pending = state.submissions.filter(function (s) { return (s.status || 'pending') === 'pending'; }).length;
    var approved = state.submissions.filter(function (s) { return s.status === 'approved'; }).length;
    var rejected = state.submissions.filter(function (s) { return s.status === 'rejected'; }).length;
    var excluded = (state.rules.excludedDocuments || []).length;

    function item(view, label, count) {
      return '<button data-view="' + view + '" class="' + (state.view === view ? 'is-active' : '') + '">' +
        esc(label) + (count ? '<span class="badge">' + count + '</span>' : '') + '</button>';
    }
    function group(key, label, items) {
      var open = state.groupOpen[key] !== false;
      return '<div class="side-group">' +
        '<button class="side-group-title" data-group-toggle="' + key + '" type="button">' +
        '<span>' + esc(label) + '</span><span class="caret">' + (open ? '▾' : '▸') + '</span></button>' +
        '<div class="side-group-items"' + (open ? '' : ' hidden') + '>' + items + '</div></div>';
    }

    return '<aside class="side">' +
      item('overview', '概览', 0) +
      group('notes', '学习笔记',
        item('articles', '文章', state.articles.length) +
        item('privacy', '隐私规则', excluded)) +
      group('history', '岁月史书',
        item('submissions', '内容补充审核', pending) +
        item('historyPrivacy', '隐私规则', (state.historyRules.excludedDocuments || []).length) +
        item('approved', '已采纳', approved) +
        item('trash', '垃圾桶', rejected) +
        item('comments', '评论', state.comments.length)) +
      '</aside>';
  }

  function stat(value, label) {
    return '<div class="stat"><strong>' + value + '</strong><span>' + esc(label) + '</span></div>';
  }

  /* ---------------- 视图 ---------------- */
  function viewOverview() {
    var pending = state.submissions.filter(function (s) { return (s.status || 'pending') === 'pending'; }).length;
    var approved = state.submissions.filter(function (s) { return s.status === 'approved'; }).length;
    return '<section class="card"><h2>概览</h2><div class="stats">' +
      stat(state.articles.length, '博客文章') +
      stat((state.rules.excludedDocuments || []).length, '隐私排除文档') +
      stat(pending, '待处理申请') +
      stat(approved, '已采纳申请') +
      stat(state.comments.length, '评论') +
      '</div></section>' +
      '<section class="card"><h2>快捷操作</h2><div class="row-actions">' +
      '<button class="btn primary" data-action="publish-all">发布博客</button>' +
      '<button class="btn" data-action="refresh">刷新数据</button>' +
      '<a class="btn" href="https://blogs.yanghanlin.cn" target="_blank" rel="noopener">查看博客</a>' +
      '<a class="btn" href="https://history.yanghanlin.cn" target="_blank" rel="noopener">查看岁月史书</a>' +
      '</div></section>';
  }

  function viewArticles() {
    if (state.editing) return viewEditor();
    var head = '<div class="card-head"><h2>文章（' + state.articles.length + '）</h2>' +
      '<button class="btn primary" data-action="new-article">新建文章</button></div>';
    if (!state.articles.length) return '<section class="card">' + head + '<p class="empty">还没有文章</p></section>';
    return '<section class="card">' + head + state.articles.map(function (item) {
      return '<div class="article-row"><div class="article-main">' +
        '<span class="row-title">' + esc(item.title) + '</span>' +
        '<span class="row-meta">' + fmt(item.updatedAt) + ' · ' + esc(item.path) + '</span>' +
        '</div><button class="btn pill" data-action="edit" data-path="' + esc(item.path) + '">编辑</button></div>';
    }).join('') + '</section>';
  }

  function viewEditor() {
    // 工作台由常驻 iframe 承载（见 ensureStudioFrame），这里只放宿主容器；
    // 点「编辑」时把预热好的 iframe 挪进来并切文章，不再重载整个工作台。
    return '<section class="card card-editor">' +
      '<div class="card-head"><h2>编辑：' + esc(state.editing.path) + '</h2>' +
      '<div class="row-actions">' +
        '<button class="btn" data-action="save-editor">保存</button>' +
        '<button class="btn primary" data-action="publish-editor">上传</button>' +
        '<button class="btn" data-action="back-to-articles">返回概览</button></div></div>' +
      '<div id="studioHost" class="studio-host"></div>' +
      '</section>';
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
      '<button class="btn primary" data-action="save-privacy">保存并重新发布</button></div></div>';
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
      '<button class="btn primary" data-action="save-history-privacy">保存并重新生成</button></div></div>';
    if (!docs.length) return '<section class="card">' + head + '<p class="empty">没有找到岁月史书文档（确认 /srv/blog/history-source 存在）</p></section>';
    var tree = buildDocTree(docs, '岁月史书');
    return '<section class="card">' + head +
      '<p class="hint">勾选表示「不公开到岁月史书站」——勾选目录会连带其下所有文档。保存后自动重新导出、生成并部署岁月史书；被排除的文档只在管理中心可见（点「查看」读原文）。</p>' +
      '<div class="privacy-tree-wrap">' + renderDocTree(tree, excluded, 'history-doc') + '</div></section>';
  }

  /* ---------------- 内容补充审核 ---------------- */
  function submissionRow(item, actions) {
    var status = item.status || 'pending';
    return '<div class="row"><div class="row-head"><span class="row-title">' + esc(item.title || '（未指定文档）') + '</span>' +
      '<span class="tag ' + status + '">' + ({ pending: '待处理', approved: '已采纳', rejected: '已忽略' }[status] || status) + '</span></div>' +
      '<p class="row-body">' + esc(item.content) + '</p>' +
      '<p class="row-meta">' + fmt(item.createdAt) + (item.contact ? ' · ' + esc(item.contact) : '') + '</p>' +
      (actions ? '<div class="row-actions">' + actions + '</div>' : '') + '</div>';
  }

  function viewSubmissions() {
    var pending = state.submissions.filter(function (s) { return (s.status || 'pending') === 'pending'; });
    var head = '<div class="card-head"><h2>岁月史书内容补充审核（待处理 ' + pending.length + '）</h2></div>';
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

  function viewComments() {
    if (!state.comments.length) return '<section class="card"><h2>评论</h2><p class="empty">还没有评论</p></section>';
    return '<section class="card"><h2>评论（' + state.comments.length + '）</h2>' + state.comments.map(function (item) {
      return '<div class="row"><div class="row-head"><span class="row-title">' + esc(item.name) + '</span>' +
        '<span class="row-meta">' + fmt(item.createdAt) + ' · ▲ ' + (item.likes ? item.likes.length : 0) + '</span></div>' +
        '<p class="row-body">' + esc(item.content) + '</p>' +
        '<p class="row-meta">' + esc(item.page) + '</p>' +
        '<div class="row-actions"><button class="btn danger" data-action="delete-comment" data-id="' + esc(item.id) + '">删除</button></div></div>';
    }).join('') + '</section>';
  }

  /* ---------------- 编辑器 ---------------- */
  function render() {
    detachStudio(); // Round 69：先把常驻 iframe 停回 park，避免 innerHTML 替换连它一起销毁
    var views = {
      overview: viewOverview, articles: viewArticles, privacy: viewPrivacy, historyPrivacy: viewHistoryPrivacy,
      submissions: viewSubmissions, approved: viewApproved, trash: viewTrash,
      comments: viewComments,
    };
    app.innerHTML = '<header class="topbar"><div class="brand">管理中心<span>学习笔记 · 博客 · 岁月史书</span></div>' +
      '<div class="top-actions"><button class="top-btn" data-action="refresh">刷新</button>' +
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

    var viewButton = event.target.closest('[data-view]');
    if (viewButton) {
      state.view = viewButton.getAttribute('data-view');
      state.editing = null;
      if (state.view === 'articles') {
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
      if (action === 'back-to-articles') { state.editing = null; state.view = 'overview'; render(); return; }
      if (action === 'save-editor' || action === 'publish-editor') {
        var frame = document.querySelector('.studio-frame');
        if (!frame || !frame.contentWindow) return toast('工作台还没加载完');
        frame.contentWindow.postMessage({ type: action === 'save-editor' ? 'studio-save' : 'studio-publish' }, location.origin);
        return;
      }

      if (action === 'publish-all') {
        target.disabled = true;
        await api('/api/publish', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
        toast('已触发发布');
        target.disabled = false;
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

      if (action === 'edit') { await openEditor(target.getAttribute('data-path')); return; }

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
        toast(result.republish && result.republish.started ? '已保存，正在重新发布' : '已保存');
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
        render();
        toast(hresult.sync && hresult.sync.started ? '已保存，正在重新生成岁月史书' : '已保存');
        return;
      }

      if (action === 'history-doc') {
        var hdocPath = target.getAttribute('data-path');
        var hdoc = await api('/api/history-doc?path=' + encodeURIComponent(hdocPath));
        showHistoryDoc(hdoc);
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
    if (data.type === 'studio-saved') { toast('文章已保存'); loadAll(); }
    if (data.type === 'studio-published') { toast('已上传'); loadAll(); }
  });

  window.addEventListener('resize', updateStudioPosition);
  window.addEventListener('scroll', updateStudioPosition, { passive: true });
  loadAll();
})();
