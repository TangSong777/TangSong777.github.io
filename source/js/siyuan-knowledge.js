(function () {
  'use strict';
  var data = window.SiyuanKnowledgeData;
  if (!data || !Array.isArray(data.documents)) return;

  function normalize(path) {
    try { path = decodeURI(path); } catch (_) {}
    return (path.replace(/index\.html$/, '').replace(/\/+$/, '') || '/');
  }

  var currentPath = normalize(location.pathname);

  function setupResponsiveTables() {
    function enhance() {
      Array.prototype.forEach.call(document.querySelectorAll('.post-body .table-container'), function (container) {
        if (container.closest('figure.highlight')) {
          container.removeAttribute('tabindex');
          container.removeAttribute('role');
          container.removeAttribute('aria-label');
          return;
        }
        container.tabIndex = 0;
        container.setAttribute('role', 'region');
        container.setAttribute('aria-label', '可横向滑动的表格');
      });
    }
    enhance();
    if (document.readyState === 'complete') window.setTimeout(enhance, 0);
    else window.addEventListener('load', enhance, { once: true });
  }

  function setupSiteRuntime() {
    var footer = document.querySelector('.footer-inner');
    if (!footer || footer.querySelector('.site-runtime')) return;
    var runtime = document.createElement('div');
    runtime.className = 'site-runtime';
    runtime.setAttribute('aria-label', '网站运行时间');
    var value = document.createElement('span');
    runtime.appendChild(value);
    footer.appendChild(runtime);

    var startedAt = new Date('2026-09-01T00:00:00+08:00').getTime();
    function pad(number) { return String(number).padStart(2, '0'); }
    function updateRuntime() {
      var elapsed = Math.max(0, Date.now() - startedAt);
      var totalSeconds = Math.floor(elapsed / 1000);
      var days = Math.floor(totalSeconds / 86400);
      var hours = Math.floor(totalSeconds % 86400 / 3600);
      var minutes = Math.floor(totalSeconds % 3600 / 60);
      var seconds = totalSeconds % 60;
      value.textContent = '建站已有 ' + days + ' day ' + pad(hours) + ' h ' + pad(minutes) + ' min ' + pad(seconds) + ' s';
    }
    updateRuntime();
    window.setInterval(updateRuntime, 1000);
  }

  setupResponsiveTables();
  setupSiteRuntime();

  function setupBlogHome() {
    var homeMain = document.querySelector('.main-inner.index');
    if (!homeMain) return;
    document.body.classList.add('blog-home-mode');

    var documents = data.documents.filter(function (doc) {
      return !doc.daily && doc.url !== '/siyuan/' && doc.parts && doc.parts.length <= 2;
    });
    var featuredTitles = ['Python笔记', '计算机网络', '命令行', '嵌入式'];
    var featured = featuredTitles.map(function (title) {
      return documents.find(function (doc) { return doc.title === title; });
    }).filter(Boolean);
    var dailyCount = data.documents.filter(function (doc) { return doc.daily; }).length;
    var articleCount = Number(data.articleCount);
    var postBlocks = Array.prototype.slice.call(homeMain.querySelectorAll(':scope > .post-block'));

    var hero = document.createElement('section');
    hero.className = 'blog-home-hero';
    hero.innerHTML = '<div class="blog-home-hero-inner"><span class="blog-home-eyebrow">YANGHANLIN · PERSONAL SPACE</span><h1>学习、记录与持续构建</h1><p>将实践写成文章，把零散知识整理成可以反复抵达的路径。</p><div class="blog-home-actions"><a href="/siyuan/">进入学习笔记</a><a href="/archives/" class="is-secondary">浏览文章归档</a></div></div><div class="blog-home-orbit" aria-hidden="true"><span>CODE</span><span>NOTE</span><span>BUILD</span></div>';

    var layout = document.createElement('div');
    layout.className = 'blog-home-layout';
    var feed = document.createElement('section');
    feed.className = 'blog-home-feed';
    feed.innerHTML = '<header class="blog-home-section-title"><div><span>RECENT POSTS</span><h2>最近文章</h2></div><a href="/archives/">查看全部 →</a></header>';
    postBlocks.forEach(function (block) {
      feed.appendChild(block);
      var postLink = block.querySelector('.post-title-link');
      if (postLink && !block.querySelector('.blog-home-readmore')) {
        var readmore = document.createElement('a');
        readmore.className = 'blog-home-readmore';
        readmore.href = postLink.href;
        readmore.textContent = '阅读全文  →';
        block.appendChild(readmore);
      }
    });

    var knowledge = document.createElement('section');
    knowledge.className = 'blog-home-knowledge';
    knowledge.innerHTML = '<header class="blog-home-section-title"><div><span>KNOWLEDGE BASE</span><h2>学习笔记精选</h2></div><a href="/siyuan/">完整目录 →</a></header><div class="blog-home-note-grid"></div>';
    var noteGrid = knowledge.querySelector('.blog-home-note-grid');
    featured.forEach(function (doc, index) {
      var card = document.createElement('a');
      card.className = 'blog-home-note-card';
      card.href = doc.url;
      card.innerHTML = '<span class="blog-home-note-index">0' + (index + 1) + '</span><strong>' + doc.title + '</strong><small>' + (doc.parts[0] || '学习笔记').replace(/-/g, ' ') + '</small>';
      noteGrid.appendChild(card);
    });
    feed.appendChild(knowledge);

    var rail = document.createElement('aside');
    rail.className = 'blog-home-rail';
    rail.innerHTML = '<section class="blog-home-profile"><img src="/images/avatar.jpg" width="82" height="82" alt="YangHanLin"><h2>YangHanLin</h2><p>相遇是知识连接的开始。</p><div class="blog-home-stats"><a href="/archives/"><strong>' + (Number.isFinite(articleCount) ? articleCount : postBlocks.length) + '</strong><span>文章</span></a><a href="/siyuan/"><strong>' + (data.documents.length - dailyCount) + '</strong><span>笔记</span></a></div></section><section class="blog-home-side-card"><span class="blog-home-side-label">公告</span><p>保持好奇，尊重事实，让每次记录都能成为下一次思考的起点。</p></section><section class="blog-home-side-card"><span class="blog-home-side-label">快速抵达</span><nav><a href="/siyuan/Python笔记/">Python 笔记</a><a href="/siyuan/待学习/">待学习</a><a href="/siyuan/其他笔记/命令行/">命令行</a><a href="/archives/">文章归档</a></nav></section><section class="blog-home-side-card blog-home-site-info"><span class="blog-home-side-label">网站信息</span><dl><div><dt>知识文档</dt><dd>' + data.documents.length + '</dd></div><div><dt>非日记笔记</dt><dd>' + (data.documents.length - dailyCount) + '</dd></div><div><dt>内容组织</dt><dd>双向引用</dd></div></dl></section>';

    layout.appendChild(feed);
    layout.appendChild(rail);
    homeMain.replaceChildren(hero, layout);
  }

  if (currentPath === '/') setupBlogHome();

  var knowledgeRoot = normalize((document.querySelector('script[src*="siyuan-knowledge.js"]') || {}).src ? new URL(document.querySelector('script[src*="siyuan-knowledge.js"]').src).pathname.replace(/js\/siyuan-knowledge\.js$/, 'siyuan/') : '/siyuan/');
  if (!(currentPath === knowledgeRoot || currentPath.indexOf(knowledgeRoot + '/') === 0)) return;
  document.body.classList.add('siyuan-mode');

  var root = { title: data.notebook, url: knowledgeRoot + '/', children: [], key: '' };
  var nodes = { '': root };
  var docs = data.documents.slice().sort(function (a, b) { return a.url.localeCompare(b.url, 'zh-CN'); });
  var expandedStorageKey = 'siyuan-knowledge-tree-expanded';
  var expandedKeys = [];
  try { expandedKeys = JSON.parse(sessionStorage.getItem(expandedStorageKey) || '[]'); } catch (_) {}
  if (!Array.isArray(expandedKeys)) expandedKeys = [];

  function saveExpandedState() {
    try { sessionStorage.setItem(expandedStorageKey, JSON.stringify(expandedKeys)); } catch (_) {}
  }

  docs.forEach(function (doc) {
    var parts = doc.parts || [];
    var parent = root;
    parts.forEach(function (part, index) {
      var key = parts.slice(0, index + 1).join('/');
      if (!nodes[key]) {
        nodes[key] = { title: part.replace(/-/g, ' '), url: '', children: [], key: key, daily: doc.daily };
        parent.children.push(nodes[key]);
      }
      parent = nodes[key];
    });
    if (!parts.length) {
      root.url = doc.url;
      root.title = doc.title;
    } else {
      parent.title = doc.title;
      parent.url = doc.url;
      parent.daily = doc.daily;
    }
  });

  function renderNode(node, depth) {
    var li = document.createElement('li');
    li.dataset.key = node.key;
    li.dataset.title = node.title.toLowerCase();
    var row = document.createElement('div');
    row.className = 'siyuan-tree-row';
    var expander = document.createElement('button');
    expander.className = 'siyuan-tree-expander' + (node.children.length ? '' : ' is-leaf');
    expander.type = 'button';
    expander.textContent = node.children.length ? '▶' : '•';
    expander.setAttribute('aria-label', '展开或折叠 ' + node.title);
    var shouldOpen = node.children.some(function contains(child) {
      return normalize(child.url || '') === currentPath || child.children.some(contains);
    }) || expandedKeys.indexOf(node.key) >= 0 || depth < 1;
    expander.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
    row.appendChild(expander);
    var link = document.createElement(node.url ? 'a' : 'span');
    link.className = 'siyuan-tree-link';
    link.textContent = node.title;
    if (node.url) {
      link.href = node.url;
      if (normalize(node.url) === currentPath) link.classList.add('is-current');
    }
    row.appendChild(link);
    li.appendChild(row);
    if (node.children.length) {
      var ul = document.createElement('ul');
      ul.className = 'siyuan-tree-children';
      ul.hidden = !shouldOpen;
      node.children.sort(function (a, b) { return Number(a.daily) - Number(b.daily) || a.title.localeCompare(b.title, 'zh-CN'); });
      node.children.forEach(function (child) { ul.appendChild(renderNode(child, depth + 1)); });
      li.appendChild(ul);
      expander.addEventListener('click', function () {
        ul.hidden = !ul.hidden;
        expander.setAttribute('aria-expanded', String(!ul.hidden));
        var index = expandedKeys.indexOf(node.key);
        if (!ul.hidden && index < 0) expandedKeys.push(node.key);
        if (ul.hidden && index >= 0) expandedKeys.splice(index, 1);
        saveExpandedState();
      });
    }
    return li;
  }

  var panel = document.createElement('aside');
  panel.className = 'siyuan-tree-panel';
  panel.setAttribute('aria-label', '学习笔记全文档目录');
  panel.innerHTML = '<div class="siyuan-tree-header"><a class="siyuan-tree-home" href="' + root.url + '"></a><p class="siyuan-tree-subtitle">全文档目录 · 双向引用</p><input class="siyuan-tree-search" type="search" placeholder="搜索文档…" aria-label="搜索文档"></div><div class="siyuan-tree-scroll"><ul class="siyuan-tree"></ul><p class="siyuan-tree-empty" hidden>没有找到匹配文档</p></div>';
  panel.querySelector('.siyuan-tree-home').appendChild(document.createTextNode(root.title));
  var list = panel.querySelector('.siyuan-tree');
  root.children.sort(function (a, b) { return Number(a.daily) - Number(b.daily) || a.title.localeCompare(b.title, 'zh-CN'); });
  root.children.forEach(function (node) { list.appendChild(renderNode(node, 0)); });
  document.body.appendChild(panel);

  var treeScroll = panel.querySelector('.siyuan-tree-scroll');
  var treeScrollStorageKey = 'siyuan-knowledge-tree-scroll';
  var treeScrollSavePending = false;
  function saveTreeScrollPosition() {
    try { sessionStorage.setItem(treeScrollStorageKey, String(treeScroll.scrollTop)); } catch (_) {}
  }
  function scheduleTreeScrollSave() {
    if (treeScrollSavePending) return;
    treeScrollSavePending = true;
    window.requestAnimationFrame(function () {
      saveTreeScrollPosition();
      treeScrollSavePending = false;
    });
  }
  function restoreTreeScrollPosition() {
    var saved = null;
    try { saved = sessionStorage.getItem(treeScrollStorageKey); } catch (_) {}
    if (saved === null) return;
    var position = Number(saved);
    if (!Number.isFinite(position)) return;
    // Wait until the expanded current branch has completed layout.
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () { treeScroll.scrollTop = position; });
    });
  }
  treeScroll.addEventListener('scroll', scheduleTreeScrollSave, { passive: true });
  panel.addEventListener('click', function (event) {
    if (event.target.closest('a.siyuan-tree-link')) {
      saveTreeScrollPosition();
      setPanelOpen(false);
    }
  });
  window.addEventListener('pagehide', saveTreeScrollPosition);
  restoreTreeScrollPosition();

  var toggle = document.createElement('button');
  toggle.className = 'siyuan-tree-toggle';
  toggle.type = 'button';
  toggle.textContent = '☰';
  toggle.setAttribute('aria-label', '打开学习笔记目录');
  var overlay = document.createElement('button');
  overlay.className = 'siyuan-tree-overlay';
  overlay.type = 'button';
  overlay.setAttribute('aria-label', '关闭学习笔记目录');
  function setPanelOpen(open) {
    panel.classList.toggle('is-open', open);
    overlay.classList.toggle('is-open', open);
    document.body.classList.toggle('siyuan-tree-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? '关闭学习笔记目录' : '打开学习笔记目录');
  }
  toggle.setAttribute('aria-expanded', 'false');
  toggle.addEventListener('click', function () { setPanelOpen(!panel.classList.contains('is-open')); });
  overlay.addEventListener('click', function () { setPanelOpen(false); });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') setPanelOpen(false);
  });
  document.body.appendChild(overlay);
  document.body.appendChild(toggle);

  var search = panel.querySelector('.siyuan-tree-search');
  search.addEventListener('input', function () {
    var term = search.value.trim().toLowerCase();
    var items = Array.prototype.slice.call(list.querySelectorAll('li'));
    if (!term) {
      items.forEach(function (li) {
        li.hidden = false;
        var children = li.querySelector(':scope > .siyuan-tree-children');
        var button = li.querySelector(':scope > .siyuan-tree-row .siyuan-tree-expander');
        if (!children || !button) return;
        var isTopLevel = li.parentElement === list;
        var containsCurrent = Boolean(li.querySelector('.siyuan-tree-link.is-current'));
        var shouldOpen = isTopLevel || containsCurrent || expandedKeys.indexOf(li.dataset.key) >= 0;
        children.hidden = !shouldOpen;
        button.setAttribute('aria-expanded', String(shouldOpen));
      });
      panel.querySelector('.siyuan-tree-empty').hidden = true;
      return;
    }
    var visible = 0;
    items.reverse().forEach(function (li) {
      var ownTitle = li.querySelector(':scope > .siyuan-tree-row .siyuan-tree-link');
      var ownMatch = !term || (ownTitle && ownTitle.textContent.toLowerCase().indexOf(term) >= 0);
      var childMatch = Array.prototype.some.call(li.querySelectorAll(':scope > ul > li'), function (child) { return !child.hidden; });
      li.hidden = !(ownMatch || childMatch);
      if (!li.hidden) visible++;
      if (term && childMatch) {
        var children = li.querySelector(':scope > .siyuan-tree-children');
        var button = li.querySelector(':scope > .siyuan-tree-row .siyuan-tree-expander');
        if (children) children.hidden = false;
        if (button) button.setAttribute('aria-expanded', 'true');
      }
    });
    panel.querySelector('.siyuan-tree-empty').hidden = visible > 0;
  });

  function focusReferencedBlock() {
    if (!location.hash) return;
    var id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch (_) { id = location.hash.slice(1); }
    if (!/^\d{14}-[a-z0-9]{7}$/i.test(id)) return;
    var anchor = document.getElementById(id);
    if (!anchor) return;
    var target = anchor.closest('h1, h2, h3, h4, h5, h6, li, blockquote, p') || anchor.parentElement || anchor;
    window.setTimeout(function () {
      target.scrollIntoView({ block: 'center', behavior: 'auto' });
      target.classList.remove('siyuan-reference-focus');
      void target.offsetWidth;
      target.classList.add('siyuan-reference-focus');
    }, 80);
  }

  focusReferencedBlock();
  window.addEventListener('hashchange', focusReferencedBlock);

  // NexT's default TOC may lag behind on long pages and clips collapsed branches.
  // Track the visible heading ourselves and keep it inside the TOC's own scroll area.
  var tocContainer = document.querySelector('.sidebar-panel-container');
  var tocLinks = Array.prototype.slice.call(document.querySelectorAll('.post-toc .nav-link[href^="#"]'));
  var tocEntries = tocLinks.map(function (link) {
    var hash = link.getAttribute('href').slice(1);
    var id;
    try { id = decodeURIComponent(hash); } catch (_) { id = hash; }
    return { link: link, heading: document.getElementById(id) };
  }).filter(function (entry) { return entry.heading; });
  var lastTocLink = null;
  var tocSyncPending = false;

  function syncKnowledgeToc() {
    if (!tocEntries.length) return;
    var current = tocEntries[0];
    var threshold = Math.min(180, window.innerHeight * .24);
    tocEntries.forEach(function (entry) {
      if (entry.heading.getBoundingClientRect().top <= threshold) current = entry;
    });
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 8) {
      current = tocEntries[tocEntries.length - 1];
    }
    if (lastTocLink === current.link) return;
    tocLinks.forEach(function (link) { link.classList.remove('siyuan-toc-current'); });
    current.link.classList.add('siyuan-toc-current');
    lastTocLink = current.link;
    if (tocContainer) {
      var linkRect = current.link.getBoundingClientRect();
      var panelRect = tocContainer.getBoundingClientRect();
      if (linkRect.top < panelRect.top + 16 || linkRect.bottom > panelRect.bottom - 16) {
        tocContainer.scrollTop += linkRect.top - panelRect.top - tocContainer.clientHeight / 2;
      }
    }
  }

  function scheduleKnowledgeTocSync() {
    if (tocSyncPending) return;
    tocSyncPending = true;
    window.requestAnimationFrame(function () {
      syncKnowledgeToc();
      tocSyncPending = false;
    });
  }

  window.addEventListener('scroll', scheduleKnowledgeTocSync, { passive: true });
  syncKnowledgeToc();

  // Build a useful knowledge-home first viewport from the actual imported tree.
  if (currentPath === normalize(root.url)) {
    var postBody = document.querySelector('.post-body');
    if (postBody) {
      var nonDaily = docs.filter(function (doc) { return !doc.daily; });
      var knowledgeHomeTitles = ['Python笔记', '计算机网络', '命令行', '嵌入式'];
      var allTreeNodes = Object.keys(nodes).map(function (key) { return nodes[key]; });
      var topNodes = knowledgeHomeTitles.map(function (title) {
        return allTreeNodes.find(function (node) { return node.title === title; });
      }).filter(Boolean);
      var hero = document.createElement('section');
      hero.className = 'siyuan-hero';
      hero.innerHTML = '<div class="siyuan-hero-kicker">PERSONAL KNOWLEDGE BASE</div><h1>' + root.title + '</h1><p>沿着主题探索笔记，也可以顺着引用回到知识形成的上下文。这里与普通博客时间线相互独立。</p><div class="siyuan-stats"><div class="siyuan-stat"><strong>' + nonDaily.length + '</strong><span>主题文档</span></div><div class="siyuan-stat"><strong>' + docs.filter(function (d) { return d.daily; }).length + '</strong><span>日记文档</span></div><div class="siyuan-stat"><strong>' + root.children.length + '</strong><span>知识分区</span></div></div>';
      var grid = document.createElement('div');
      grid.className = 'siyuan-home-grid';
      topNodes.forEach(function (node) {
        var card = document.createElement('a');
        card.className = 'siyuan-home-card';
        card.href = node.url || '#';
        card.innerHTML = '<strong>' + node.title + '</strong><span>' + node.children.length + ' 个子文档 · 打开主题</span>';
        grid.appendChild(card);
      });
      postBody.insertBefore(grid, postBody.firstChild);
      postBody.insertBefore(hero, grid);
    }
  }
})();
