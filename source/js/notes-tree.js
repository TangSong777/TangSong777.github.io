/* ==========================================================================
   学习笔记 · 左侧全文档目录（重写版）
   ─────────────────────────────────────────────────────────────────────────────
   对标参考站 yhblogs.cn 的侧栏交互：纯链接、普通整页跳转、没有任何前端路由。
   上一版用 fetch + 替换 .main-inner.innerHTML 做「无刷新换页」，换页后
   notes-v2.js 构建的顶栏/侧栏/目录卡不会重建，于是切换文档时侧栏丢失、
   目录高亮错位、滚动位置错乱 —— 这里整段删掉，恢复成浏览器原生跳转。
   ========================================================================== */
(function () {
  'use strict';

  var data = window.SiyuanKnowledgeData;
  if (!data || !Array.isArray(data.documents)) return;

  var ROOT = '/siyuan';
  var LS_EXPANDED = 'siyuan.tree.expanded.v3';
  var SS_SCROLL = 'siyuan.tree.scroll.v3';

  function norm(path) {
    try { path = decodeURIComponent(path); } catch (e) { /* 保留原样 */ }
    return (path.replace(/index\.html$/, '').replace(/\/+$/, '') || '/');
  }

  var current = norm(location.pathname);
  if (current !== ROOT && current.indexOf(ROOT + '/') !== 0) return;

  var rootUrl = ROOT + '/';

  /* ── 1. 建模：把扁平的 documents 列表还原成一棵树 ─────────────────────── */
  var rootNode = { key: '', title: data.notebook || '学习笔记', url: rootUrl, children: [], order: -1 };
  var byKey = { '': rootNode };

  data.documents.forEach(function (doc) {
    var parts = doc.parts || [];
    if (!parts.length) {
      rootNode.title = doc.title || rootNode.title;
      rootNode.url = doc.url || rootNode.url;
      return;
    }
    var parent = rootNode;
    var key = '';
    for (var i = 0; i < parts.length; i++) {
      key = key ? key + '/' + parts[i] : parts[i];
      var node = byKey[key];
      if (!node) {
        node = byKey[key] = { key: key, title: parts[i].replace(/-/g, ' '), url: '', children: [], order: 1e9 };
        parent.children.push(node);
      }
      parent = node;
    }
    parent.title = doc.title || parent.title;
    parent.url = doc.url || parent.url;
    parent.order = typeof doc.order === 'number' ? doc.order : parent.order;
    parent.daily = Boolean(doc.daily);
  });

  function sortTree(node) {
    node.children.sort(function (a, b) { return (a.order - b.order) || a.title.localeCompare(b.title, 'zh-CN'); });
    node.children.forEach(sortTree);
  }
  sortTree(rootNode);

  /* ── 2. 展开状态：当前文档的祖先链永远是展开的 ───────────────────────── */
  var expanded = {};
  try { expanded = JSON.parse(localStorage.getItem(LS_EXPANDED) || '{}') || {}; } catch (e) { expanded = {}; }
  if (typeof expanded !== 'object' || expanded === null) expanded = {};

  function saveExpanded() {
    try { localStorage.setItem(LS_EXPANDED, JSON.stringify(expanded)); } catch (e) { /* 隐私模式忽略 */ }
  }

  var ancestorsOfCurrent = {};
  (function () {
    if (current === ROOT) return;
    var rest = current.slice(ROOT.length + 1).split('/').filter(Boolean);
    var acc = '';
    rest.forEach(function (part) { acc = acc ? acc + '/' + part : part; ancestorsOfCurrent[acc] = true; });
  })();

  function isOpen(node, depth) {
    // 当前文档的祖先链永远展开，否则「我在哪」看不见
    if (ancestorsOfCurrent[node.key]) return true;
    // 手动折叠/展开过的以记忆为准（true / false 都要存，不能只存 true）
    if (Object.prototype.hasOwnProperty.call(expanded, node.key)) return expanded[node.key] !== false;
    return depth === 0; // 顶层默认展开，深层默认折叠
  }

  /* ── 3. 渲染 ──────────────────────────────────────────────────────────── */
  var CHEV = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M4.2 2.6 8 6l-3.8 3.4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function render(node, depth) {
    var li = document.createElement('li');
    li.className = 'nt-item';
    li.dataset.key = node.key;
    li.dataset.title = node.title.toLowerCase();

    var row = document.createElement('div');
    row.className = 'nt-row' + (node.url && norm(node.url) === current ? ' is-current' : '');

    if (node.children.length) {
      var chev = document.createElement('button');
      chev.type = 'button';
      chev.className = 'nt-chev';
      chev.innerHTML = CHEV;
      chev.setAttribute('aria-label', '展开或折叠「' + node.title + '」');
      row.appendChild(chev);
    } else {
      var dot = document.createElement('span');
      dot.className = 'nt-dot';
      dot.setAttribute('aria-hidden', 'true');
      row.appendChild(dot);
    }

    var link = document.createElement(node.url ? 'a' : 'span');
    link.className = 'nt-link';
    link.textContent = node.title;
    /* 树宽 300px，长标题会被省略号截断，补 title 让悬停能看到全文 */
    link.title = node.title;
    if (node.url) link.href = node.url;
    if (node.url && norm(node.url) === current) link.setAttribute('aria-current', 'page');
    row.appendChild(link);
    li.appendChild(row);

    if (node.children.length) {
      var kids = document.createElement('ul');
      kids.className = 'nt-kids';
      var open = isOpen(node, depth);
      li.classList.toggle('is-open', open);
      kids.hidden = !open;
      if (chev) chev.setAttribute('aria-expanded', String(open));
      node.children.forEach(function (child) { kids.appendChild(render(child, depth + 1)); });
      li.appendChild(kids);
    }
    return li;
  }

  /* ── 4. 面板骨架 ──────────────────────────────────────────────────────── */
  var panel = document.createElement('aside');
  panel.className = 'siyuan-tree-panel';
  panel.setAttribute('aria-label', '学习笔记全文档目录');
  panel.innerHTML =
    '<div class="siyuan-tree-header">' +
      '<a class="siyuan-tree-home" href="' + rootNode.url + '"></a>' +
      '<p class="siyuan-tree-subtitle">全文档目录 · 双向引用</p>' +
      '<input class="siyuan-tree-search" type="search" placeholder="搜索文档…" aria-label="搜索文档">' +
    '</div>' +
    '<div class="siyuan-tree-scroll"><ul class="nt-tree"></ul><p class="siyuan-tree-empty" hidden>没有找到匹配文档</p></div>';
  panel.querySelector('.siyuan-tree-home').textContent = rootNode.title;

  var scroller = panel.querySelector('.siyuan-tree-scroll');
  var tree = panel.querySelector('.nt-tree');
  var empty = panel.querySelector('.siyuan-tree-empty');
  rootNode.children.forEach(function (node) { tree.appendChild(render(node, 0)); });
  document.body.appendChild(panel);

  /* ── 5. 折叠/展开 ─────────────────────────────────────────────────────── */
  panel.addEventListener('click', function (event) {
    var chev = event.target.closest('.nt-chev');
    if (!chev) return;
    event.preventDefault();
    var li = chev.closest('.nt-item');
    var kids = li.querySelector(':scope > .nt-kids');
    var open = kids.hidden;
    kids.hidden = !open;
    li.classList.toggle('is-open', open);
    chev.setAttribute('aria-expanded', String(open));
    expanded[li.dataset.key] = Boolean(open);
    saveExpanded();
  });

  /* ── 6. 滚动位置：切换文档后回到「我刚才看到的位置」 ─────────────────── */
  var scrollSaveTimer = 0;
  scroller.addEventListener('scroll', function () {
    if (scrollSaveTimer) return;
    scrollSaveTimer = window.setTimeout(function () {
      scrollSaveTimer = 0;
      try { sessionStorage.setItem(SS_SCROLL, String(scroller.scrollTop)); } catch (e) { /* 忽略 */ }
    }, 160);
  }, { passive: true });

  function revealCurrent() {
    var active = tree.querySelector('.nt-row.is-current');
    if (!active) return;
    var box = scroller.getBoundingClientRect();
    var rect = active.getBoundingClientRect();
    if (!box.height) return;
    if (rect.top >= box.top + 4 && rect.bottom <= box.bottom - 4) return;
    scroller.scrollTop += (rect.top - box.top) - (box.height - rect.height) / 2;
  }

  if (tree.querySelector('.nt-row.is-current')) {
    // 有当前文档：定位到它（覆盖上一次的滚动记忆）
    window.requestAnimationFrame(revealCurrent);
  } else {
    var saved = NaN;
    try { saved = parseInt(sessionStorage.getItem(SS_SCROLL) || '', 10); } catch (e) { saved = NaN; }
    if (!isNaN(saved)) window.requestAnimationFrame(function () { scroller.scrollTop = saved; });
  }

  /* ── 7. 抽屉（窄屏 / 非首页） ─────────────────────────────────────────── */
  var toggle = document.createElement('button');
  toggle.className = 'siyuan-tree-toggle';
  toggle.type = 'button';
  toggle.textContent = '☰';
  toggle.setAttribute('aria-label', '打开学习笔记目录');
  toggle.setAttribute('aria-expanded', 'false');

  var overlay = document.createElement('button');
  overlay.className = 'siyuan-tree-overlay';
  overlay.type = 'button';
  overlay.setAttribute('aria-label', '关闭学习笔记目录');

  function setOpen(open) {
    panel.classList.toggle('is-open', open);
    overlay.classList.toggle('is-open', open);
    document.body.classList.toggle('siyuan-tree-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? '关闭学习笔记目录' : '打开学习笔记目录');
    if (open) window.requestAnimationFrame(revealCurrent);
  }

  toggle.addEventListener('click', function () { setOpen(!panel.classList.contains('is-open')); });
  overlay.addEventListener('click', function () { setOpen(false); });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') setOpen(false);
  });
  document.body.appendChild(overlay);
  document.body.appendChild(toggle);

  /* ── 8. 悬停预取：整页跳转也能很快 ───────────────────────────────────── */
  var prefetched = {};
  panel.addEventListener('pointerover', function (event) {
    var link = event.target.closest('a.nt-link');
    if (!link || !link.href) return;
    if (prefetched[link.href]) return;
    prefetched[link.href] = true;
    var hint = document.createElement('link');
    hint.rel = 'prefetch';
    hint.href = link.href;
    hint.as = 'document';
    document.head.appendChild(hint);
  }, { passive: true });

  /* ── 9. 搜索 ──────────────────────────────────────────────────────────── */
  var search = panel.querySelector('.siyuan-tree-search');

  function setOpenState(li, open) {
    var kids = li.querySelector(':scope > .nt-kids');
    var chev = li.querySelector(':scope > .nt-row > .nt-chev');
    if (!kids) return;
    kids.hidden = !open;
    li.classList.toggle('is-open', open);
    if (chev) chev.setAttribute('aria-expanded', String(open));
  }

  search.addEventListener('input', function () {
    var term = search.value.trim().toLowerCase();
    var items = Array.prototype.slice.call(tree.querySelectorAll('.nt-item'));

    if (!term) {
      items.forEach(function (li) { li.hidden = false; });
      items.forEach(function (li) {
        var key = li.dataset.key;
        var depth = li.parentElement === tree ? 0 : 1;
        var open = ancestorsOfCurrent[key] ||
          (Object.prototype.hasOwnProperty.call(expanded, key) ? expanded[key] !== false : depth === 0);
        setOpenState(li, open);
      });
      empty.hidden = true;
      revealCurrent();
      return;
    }

    var hits = 0;
    // 自底向上：先判断子项，再把命中的祖先展开
    items.slice().reverse().forEach(function (li) {
      var link = li.querySelector(':scope > .nt-row > .nt-link');
      var own = link && link.textContent.toLowerCase().indexOf(term) >= 0;
      var childHit = Array.prototype.some.call(li.querySelectorAll(':scope > .nt-kids > .nt-item'), function (child) {
        return !child.hidden;
      });
      li.hidden = !(own || childHit);
      if (!li.hidden && depthOf(li) === 0) hits++;
      if (childHit) setOpenState(li, true);
    });
    empty.hidden = hits > 0;
    scroller.scrollTop = 0;
  });

  function depthOf(li) {
    var depth = 0;
    var node = li.parentElement;
    while (node && node !== tree) {
      if (node.classList && node.classList.contains('nt-item')) depth++;
      node = node.parentElement;
    }
    return depth;
  }
})();
