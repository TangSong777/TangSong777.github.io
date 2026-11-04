(function () {
  'use strict';
  var data = window.SiyuanKnowledgeData;
  if (!data || !Array.isArray(data.documents)) return;

  function normalize(path) {
    // Round 35b：这里原来用 decodeURI，它对「保留字符」的百分号编码不做解码 ——
    // `/siyuan/其他笔记/Rock5B%2B/串流方案/` 里的 %2B（加号）会原样留着，
    // 而树数据里的 url 写的是真的 `+`，两者永远不相等：
    //   当前页 → /siyuan/其他笔记/Rock5B%2B/串流方案
    //   树节点 → /siyuan/其他笔记/Rock5B+/串流方案
    // 结果是所有路径含 `+` 的笔记都没有 is-current 高亮，revealCurrentInTree()
    // 也永远找不到「当前项」。必须用 decodeURIComponent。
    try { path = decodeURIComponent(path); } catch (_) {}
    return (path.replace(/index\.html$/, '').replace(/\/+$/, '') || '/');
  }

  var currentPath = normalize(location.pathname);

  function enhanceResponsiveTables() {
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

  function setupResponsiveTables() {
    enhanceResponsiveTables();
    if (document.readyState === 'complete') window.setTimeout(enhanceResponsiveTables, 0);
    else window.addEventListener('load', enhanceResponsiveTables, { once: true });
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
    var dailyCount = data.documents.filter(function (doc) { return doc.daily; }).length;
    var stats = window.__SITE_STATS__ || null;
    // 构建期注入的真实数量优先；拿不到（例如脚本被单独打开）才退回数据快照。
    var articleCount = stats ? Number(stats.articles) : Number(data.articleCount);
    var noteCount = stats ? Number(stats.notes) : (data.documents.length - dailyCount);
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
      // NexT 首页卡片里可能同时有 .post-button / .post-more-link 与普通 a.btn，
      // 只删前两个会留下第二个「阅读全文」，和下面新建的 .blog-home-readmore 叠在一起。
      var staticMores = block.querySelectorAll('.post-button, .post-more-link, a.btn');
      for (var sm = 0; sm < staticMores.length; sm++) staticMores[sm].remove();
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

    var tagsNode = document.querySelector('.sidebar-tags');
    var archivesNode = document.querySelector('.sidebar-archives');
    var tagsHtml = tagsNode ? tagsNode.innerHTML : '';
    var archivesHtml = archivesNode ? archivesNode.innerHTML : '';

    var rail = document.createElement('aside');
    rail.className = 'blog-home-rail';
    rail.innerHTML = '<section class="blog-home-profile"><img src="/images/avatar-180.jpg" width="82" height="82" alt="YangHanLin"><h2>YangHanLin</h2><p>相遇是知识连接的开始。</p><div class="blog-home-stats"><a href="/archives/"><strong>' + (Number.isFinite(articleCount) ? articleCount : postBlocks.length) + '</strong><span>文章</span></a><a href="/siyuan/"><strong>' + noteCount + '</strong><span>笔记</span></a></div></section><section class="blog-home-side-card"><span class="blog-home-side-label">公告</span><p>保持好奇，尊重事实，让每次记录都能成为下一次思考的起点。</p></section><section class="blog-home-side-card"><span class="blog-home-side-label">标签</span><div class="sidebar-tags">' + tagsHtml + '</div></section><section class="blog-home-side-card"><span class="blog-home-side-label">归档</span><div class="sidebar-archives">' + archivesHtml + '</div></section>';

    layout.appendChild(feed);
    layout.appendChild(rail);
    homeMain.replaceChildren(hero, layout);
  }

  if (currentPath === '/') setupBlogHome();

  var knowledgeRoot = normalize((document.querySelector('script[src*="siyuan-knowledge.js"]') || {}).src ? new URL(document.querySelector('script[src*="siyuan-knowledge.js"]').src).pathname.replace(/js\/siyuan-knowledge\.js$/, 'siyuan/') : '/siyuan/');
  if (!(currentPath === knowledgeRoot || currentPath.indexOf(knowledgeRoot + '/') === 0)) return;
  document.body.classList.add('siyuan-mode');

  /* 左侧全文档目录已经拆到 source/js/notes-tree.js（重写版）。
     这里只保留首页 hero 需要的两个量：笔记本名与「知识分区」数。 */
  var root = { title: data.notebook, url: knowledgeRoot + '/', children: [], key: '' };
  var docs = data.documents;
  var topLevelCount = (function () {
    var seen = {};
    docs.forEach(function (doc) { if (doc.parts && doc.parts.length) seen[doc.parts[0]] = true; });
    return Object.keys(seen).length;
  })();

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
    tocContainer = document.querySelector('.sidebar-panel-container');
    tocLinks = Array.prototype.slice.call(document.querySelectorAll('.post-toc .nav-link[href^="#"]'));
    tocEntries = tocLinks.map(function (link) {
      var hash = link.getAttribute('href').slice(1);
      var id;
      try { id = decodeURIComponent(hash); } catch (_) { id = hash; }
      return { link: link, heading: document.getElementById(id) };
    }).filter(function (entry) { return entry.heading; });
    if (lastTocLink && tocLinks.indexOf(lastTocLink) < 0) lastTocLink = null;
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
    /* hero 现在由构建脚本（scripts/siyuan-knowledge.js 的 injectKnowledgeHero）
       直接写进 HTML，这里只在缺失时兜底补一个，避免出现两个。 */
    if (postBody && !postBody.querySelector('.siyuan-hero')) {
      var nonDaily = docs.filter(function (doc) { return !doc.daily; });
      var hero = document.createElement('section');
      hero.className = 'siyuan-hero';
      var heroStats = window.__SITE_STATS__ || null;
      var heroNotes = heroStats ? Number(heroStats.notes) : nonDaily.length;
      var heroDaily = heroStats ? Number(heroStats.daily) : docs.filter(function (d) { return d.daily; }).length;
      hero.innerHTML = '<div class="siyuan-hero-kicker">PERSONAL KNOWLEDGE BASE</div><h1>' + root.title + '</h1><p>沿着主题探索笔记，也可以顺着引用回到知识形成的上下文。这里与普通博客时间线相互独立。</p><div class="siyuan-stats"><div class="siyuan-stat"><strong>' + heroNotes + '</strong><span>主题文档</span></div><div class="siyuan-stat"><strong>' + heroDaily + '</strong><span>日记文档</span></div><div class="siyuan-stat"><strong>' + topLevelCount + '</strong><span>知识分区</span></div></div>';

      // hero 里已经有 <h1>页面名</h1>，页面上方那个居中的同名大标题纯属重复。
      // 只在文字完全一致时才收起来，避免误伤有独立标题的页面。
      var ownTitle = document.querySelector('.post-block > .post-header .post-title');
      if (ownTitle && ownTitle.textContent.trim() === String(root.title || '').trim()) {
        var ownHeader = ownTitle.closest('.post-header');
        if (ownHeader) ownHeader.style.display = 'none';
      }
      postBody.insertBefore(hero, postBody.firstChild);
    }
  }
})();

/* 笔记正文里每条链接前有一个 📄。没装 emoji 字体的系统（板子实测 emoji 字体数 = 0）
   会把它渲染成豆腐块 □，看着像排版坏了。这里把字符剥掉、给 li 打标记，
   由 CSS 画一个小文档图标，Windows / Linux 一致。 */
(function () {
  'use strict';
  function decorateDocLinks() {
    var items = document.querySelectorAll('.post-body li');
    for (var i = 0; i < items.length; i++) {
      var li = items[i];
      // siyuan 导出的列表有两种形态：
      //   <li>📄 <a>…</a></li>            ← 文字节点直接在 li 下
      //   <li><p>📄 <a>…</a></p></li>     ← 多包一层 p（大部分页面是这种）
      // 早先只认第一种，于是同一份目录里一部分行换成了小文档图标、另一部分还留着彩色 emoji，
      // 在没装 emoji 字体的机器上（开发板就是这样）后者直接渲染成方框。
      // 只认 📄。用 surrogate 高字节判断会把 📘 🔗 📋 🔐 一起剥掉（实测会误伤 10 处）。
      var first = li.firstChild;
      if (first && first.nodeType === 1 && first.tagName === 'P') first = first.firstChild;
      if (first && first.nodeType === 3) {
        // 只剥「这是一篇文档」这一类的标记，换成统一的灰色文档图标：
        //   📄 单篇文档、📑 目录/索引、📁 分组、📘 手册
        // 主题图标（📜 🔗 🔐 🐧 🖥 🧩 ⚙ …）保留，它们各自代表内容主题，不是「文档」的同义符号。
        //
        // 注意：emoji 是代理对。早先用 charAt(0) 取「第一个字符」，拿到的是高代理 U+D83D；
        // 再拿它去 DOC_MARKS（同样以 U+D83D 开头）里 indexOf，任何 U+D83D 开头的 emoji
        // （📜 📅 🗂 📋 …）都会命中下标 0，于是被当作文档标记剥掉 —— 一页目录里所有图标
        // 就都变成了同一个灰色文档图标。必须按码点比较。
        var DOC_MARKS = [0x1F4C4, 0x1F4D1, 0x1F4C1, 0x1F4D8];
        var trimmed = first.nodeValue.replace(/^\s+/, '');
        var cp = trimmed.codePointAt(0);
        if (DOC_MARKS.indexOf(cp) >= 0) {
          // 统一换成灰色文档图标
          li.className = (li.className ? li.className + ' ' : '') + 'doc-link';
          var lead = first.nodeValue.length - trimmed.length;
          first.nodeValue = first.nodeValue.slice(lead + String.fromCodePoint(cp).length);
        } else if (cp >= 0x1F000 && cp <= 0x1FAFF) {
          // 其它 emoji（📜 📅 🗂 📋 …）保留，但去掉项目符号：
          // 一个列表项前面同时有「圆点 + emoji」两个标记显得很挤。
          li.className = (li.className ? li.className + ' ' : '') + 'emoji-link';
        }
      }
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', decorateDocLinks);
  } else {
    decorateDocLinks();
  }
})();
