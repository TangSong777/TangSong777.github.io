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
    app.innerHTML = '<div class="login"><form class="login-card" id="login-form">' +
      '<h1>管理中心</h1><p>学习笔记 · 博客 · 岁月史书</p>' +
      '<label class="field"><span>密码</span><input id="login-password" type="password" autocomplete="current-password" required></label>' +
      '<label class="field"><span>动态验证码（如已启用）</span><input id="login-totp" type="text" inputmode="numeric" maxlength="6" autocomplete="one-time-code"></label>' +
      '<button class="btn primary block" type="submit">登录</button>' +
      '<div class="login-msg" id="login-msg"></div></form></div>';
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
      var config = await api('/api/config');
      state.token = config.token || '';
      var results = await Promise.all([
        api('/api/articles'),
        api('/api/siyuan-privacy'),
        api('/api/admin/comments'),
        api('/api/admin/submissions'),
      ]);
      state.articles = results[0].articles || [];
      state.rules = results[1].rules || state.rules;
      state.documents = results[1].documents || [];
      state.notebook = results[1].notebook || '';
      state.comments = results[2].comments || [];
      state.submissions = results[3].submissions || [];
      render();
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
      return '<div class="row"><div class="row-head"><span class="row-title">' + esc(item.title) + '</span>' +
        '<span class="row-meta">' + fmt(item.updatedAt) + '</span></div>' +
        '<p class="row-meta">' + esc(item.path) + '</p>' +
        '<div class="row-actions"><button class="btn" data-action="edit" data-path="' + esc(item.path) + '">编辑</button></div></div>';
    }).join('') + '</section>';
  }

  function viewEditor() {
    // 直接把文章工作台（CodeMirror 所见即所得）嵌进管理中心，
    // 不再整页跳转，编辑完点「返回列表」就回到这里。
    return '<section class="card card-editor">' +
      '<div class="card-head"><h2>编辑：' + esc(state.editing.path) + '</h2>' +
      '<div class="row-actions"><button class="btn" data-action="back-to-articles">返回列表</button></div></div>' +
      '<iframe class="studio-frame" title="文章工作台" src="/studio.html?embed=1&path=' +
      encodeURIComponent(state.editing.path) + '"></iframe>' +
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

  function renderDocTree(node, excluded) {
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
        '</span></label>';
      var kids = hasChildren ? renderDocTree(child, excluded) : '';
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
    var views = {
      overview: viewOverview, articles: viewArticles, privacy: viewPrivacy,
      submissions: viewSubmissions, approved: viewApproved, trash: viewTrash,
      comments: viewComments,
    };
    app.innerHTML = '<header class="topbar"><div class="brand">管理中心<span>学习笔记 · 博客 · 岁月史书</span></div>' +
      '<div class="top-actions"><button class="top-btn" data-action="refresh">刷新</button>' +
      '<button class="top-btn" data-action="logout">退出</button></div></header>' +
      '<div class="layout">' + sidebar() + '<main class="content">' + (views[state.view] || views.overview)() + '</main></div>' +
      '<div id="toast" class="toast"></div>';
    if (state.message) {
      var el = document.getElementById('toast');
      if (el) { el.textContent = state.message; el.classList.add('is-on'); }
    }
  }

  /* ---------------- 交互 ---------------- */
  function openEditor(path) {
    // 编辑器内嵌在管理中心里（iframe 载入文章工作台），不做整页跳转
    state.editing = { path: path };
    render();
  }

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
      if (action === 'back-to-articles') { state.editing = null; render(); return; }

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

  loadAll();
})();
