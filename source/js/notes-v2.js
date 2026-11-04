/* ===========================================================================
   学习笔记页面组件（对标 yhblogs.cn 文章页的 Butterfly 版式）
   仅在 body.siyuan-mode 下运行；负责搭建顶栏、侧栏三卡、文章尾、右下角按钮，
   并把 NexT 留下的目录搬进侧栏目录卡。
   =========================================================================== */
(function () {
  'use strict';

  if (!document.body || document.body.className.indexOf('siyuan-mode') < 0) return;

  var ICON = {
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    stream: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h11M4 18h6"/></svg>',
    bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>',
    up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></svg>'
  };

  function el(tag, cls, html) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (html != null) node.innerHTML = html;
    return node;
  }

  function text(node) {
    return node ? (node.textContent || '').replace(/\s+/g, ' ').trim() : '';
  }

  function currentPath() {
    return location.pathname.replace(/\/index\.html$/, '/').replace(/\.html$/, '/');
  }

  /* 菜单一律从页面现有的导航里取，避免和站点配置（_config.next.yml 的 menu）分叉 */
  function readMenu() {
    var out = [];
    var seen = {};
    var anchors = document.querySelectorAll('nav.site-nav a[href], .site-nav a[href], .main-menu a[href]');
    for (var i = 0; i < anchors.length; i++) {
      var a = anchors[i];
      var href = a.getAttribute('href') || '';
      var label = text(a);
      if (!href || !label || href.charAt(0) === '#') continue;
      if (href.indexOf('http') === 0 && href.indexOf(location.host) < 0) continue;
      if (seen[href]) continue;
      seen[href] = 1;
      out.push({ href: href, label: label });
    }
    if (!out.length) {
      out = [
        { href: '/', label: '首页' },
        { href: '/siyuan/', label: '学习笔记' },
        { href: '/archives/', label: '时间轴' },
        { href: '/tags/', label: '标签' }
      ];
    }
    return out;
  }

  /* ── 顶栏 ─────────────────────────────────────────────────────────────── */
  function buildNav() {
    if (document.getElementById('nv2-nav')) return;
    var nav = el('div');
    nav.id = 'nv2-nav';

    var toggle = el('button', 'nv2-toggle', ICON.menu);
    toggle.type = 'button';
    toggle.setAttribute('aria-label', '打开学习笔记目录');
    toggle.addEventListener('click', function () {
      var drill = document.querySelector('.siyuan-tree-toggle');
      if (drill) drill.click();
    });

    var brand = el('a', 'nv2-brand', '<span class="nv2-logo" aria-hidden="true">学</span><span>学习笔记</span>');
    brand.href = '/siyuan/';

    var menu = el('div', 'nv2-menu');
    var path = currentPath();
    readMenu().forEach(function (item) {
      var a = el('a', null, item.label);
      a.href = item.href;
      var target = item.href.replace(/\/index\.html$/, '/').replace(/\.html$/, '/');
      if (target === '/' ? path === '/' : path.indexOf(target) === 0) a.className = 'is-active';
      menu.appendChild(a);
    });

    nav.appendChild(toggle);
    nav.appendChild(brand);
    nav.appendChild(menu);
    /* 顶栏虽然 position: fixed，但顺序上要排在正文之前 ——
       否则键盘用户得 Tab 过整篇文章才轮得到导航。 */
    var skip = document.querySelector('.site-skip-link');
    if (skip && skip.parentNode === document.body) {
      document.body.insertBefore(nav, skip.nextSibling);
    } else {
      document.body.insertBefore(nav, document.body.firstChild);
    }
  }

  /* ── 侧栏：信息卡 / 公告卡 / 目录卡 ──────────────────────────────────── */
  function buildAside() {
    if (document.getElementById('aside-content')) return null;
    var stats = window.__SITE_STATS__ || {};
    var tagCount = document.querySelectorAll('.sidebar-tags a').length;

    var aside = el('aside');
    aside.id = 'aside-content';

    var info = el('div', 'nv2-card');
    info.id = 'nv2-info';
    info.innerHTML =
      '<img class="nv2-avatar" src="/images/avatar-180.jpg" alt="YangHanLin" width="106" height="106" loading="lazy">' +
      '<div class="nv2-name">YangHanLin</div>' +
      '<p class="nv2-desc">个人博客与学习笔记知识库</p>' +
      '<div class="nv2-data">' +
        '<a href="/archives/"><div class="v">' + (stats.articles != null ? stats.articles : '—') + '</div><div class="k">文章</div></a>' +
        '<a href="/siyuan/"><div class="v">' + (stats.notes != null ? stats.notes : '—') + '</div><div class="k">笔记</div></a>' +
        '<a href="/tags/"><div class="v">' + (tagCount || '—') + '</div><div class="k">标签</div></a>' +
      '</div>';

    var announce = el('div', 'nv2-card');
    announce.id = 'nv2-announce';
    announce.innerHTML =
      '<div class="nv2-card-head">' + ICON.bell + '<span>公告</span></div>' +
      '<p>这里按主题整理长期笔记：计算机网络、命令行、Python、深度学习等。' +
      (document.body.classList.contains('is-knowledge-home')
        ? '左侧就是全文档目录，可以逐级展开。'
        : '点左上角 ☰ 可以打开全文档目录。') + '</p>';

    var toc = el('div', 'nv2-card');
    toc.id = 'nv2-toc';
    toc.innerHTML =
      '<div class="nv2-card-head">' + ICON.stream + '<span>目录</span><span class="nv2-percent">0%</span></div>' +
      '<div class="nv2-toc-content"></div>';

    aside.appendChild(info);
    aside.appendChild(announce);
    aside.appendChild(toc);

    var host = document.querySelector('.main-inner');
    var block = document.querySelector('.post-block');
    if (!host || !block) return null;
    host.insertBefore(aside, block.nextSibling);

    /* 目录：优先搬 NexT 的 .post-toc（里面已经按标题生成好 <ol class="nav">） */
    var box = toc.querySelector('.nv2-toc-content');
    var source = document.querySelector('.post-toc');
    if (source) {
      source.parentNode && source.parentNode.removeChild(source);
      box.appendChild(source);
    } else {
      box.appendChild(buildTocFromHeadings());
    }
    /* polish.js 的 ready() 要等 DOMContentLoaded 才跑 pruneReferenceToc()，
       而本脚本在 defer 阶段就执行完了 —— 目录里「文档关系/本文引用/反向引用」
       是稍后才被摘掉的，所以空目录状态要再盯一会儿。 */
    syncTocEmpty(toc);
    window.requestAnimationFrame(function () { syncTocEmpty(toc); });
    window.setTimeout(function () { syncTocEmpty(toc); }, 600);
    window.setTimeout(function () { syncTocEmpty(toc); }, 1500);
    if (window.MutationObserver && box) {
      new MutationObserver(function () { syncTocEmpty(toc); }).observe(box, { childList: true, subtree: true });
    }
    return toc;
  }

  function syncTocEmpty(toc) {
    if (!toc) return;
    var hasLink = !!toc.querySelector('.post-toc li');
    toc.classList.toggle('is-empty', !hasLink);
  }

  function buildTocFromHeadings() {
    var ol = el('ol', 'nav');
    var body = document.querySelector('.post-body');
    if (!body) return ol;
    var heads = body.querySelectorAll('h1, h2, h3');
    for (var i = 0; i < heads.length; i++) {
      var h = heads[i];
      if (!h.id) continue;
      var li = el('li', 'nav-item nav-level-' + h.tagName.charAt(1));
      var a = el('a', 'nav-link');
      a.href = '#' + h.id;
      a.textContent = text(h);
      li.appendChild(a);
      ol.appendChild(li);
    }
    return ol;
  }

  /* ── 目录联动：当前项高亮 + 阅读百分比 ───────────────────────────────── */
  function bindToc(percentEl) {
    var body = document.querySelector('.post-body');
    if (!body) return;
    var heads = [].slice.call(body.querySelectorAll('h1, h2, h3, h4'));
    var links = [].slice.call(document.querySelectorAll('#nv2-toc .nav-link'));
    if (!heads.length || !links.length) return;

    /* 目录链接每次现查：TOC 会被其它脚本搬动、裁剪，
       缓存下来的节点一旦脱离文档，加在上面的高亮就看不见了。 */
    function linkForHeading(head) {
      if (!head || !head.id) return null;
      var all = document.querySelectorAll('#nv2-toc .nav-link');
      for (var i = 0; i < all.length; i++) {
        var id = decodeURIComponent((all[i].getAttribute('href') || '').replace(/^#/, ''));
        if (id === head.id) return all[i];
      }
      return null;
    }

    var current = null;
    var ticking = false;
    function update() {
      ticking = false;
      var line = 120;
      var active = null;
      for (var i = 0; i < heads.length; i++) {
        // 只认目录里存在的标题：文末「文档关系 / 本文引用 / 反向引用」会被
        // pruneReferenceToc() 摘掉，若把它们当候选，滚到页底时高亮会整个消失。
        if (heads[i].getBoundingClientRect().top <= line && linkForHeading(heads[i])) active = heads[i];
      }
      var link = active ? linkForHeading(active) : null;
      if (link !== current) {
        if (current) {
          var old = current.parentNode;
          if (old) old.classList.remove('nv2-current');
        }
        current = link || null;
        if (link && link.parentNode) link.parentNode.classList.add('nv2-current');
      }

      if (percentEl) {
        var docH = document.documentElement.scrollHeight - window.innerHeight;
        var pct = docH > 0 ? (window.scrollY / docH) * 100 : 0;
        pct = Math.max(0, Math.min(100, Math.round(pct)));
        percentEl.textContent = pct + '%';
      }
    }
    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    // 正文高度会自己变：图片懒加载、MathJax 排版完成、引用区块被裁剪……
    // 这些都没有 scroll 事件，靠 ResizeObserver 补一次重算，
    // 否则「一进页面就跳到页底」时算出来没有任何高亮项，之后也不会自愈。
    if (window.ResizeObserver) {
      var ro = new ResizeObserver(onScroll);
      ro.observe(body);
    }
    window.addEventListener('load', onScroll);
    update();
  }

  /* ── 文章头：面包屑提到标题上方，meta 换成「发表于 / 字数 / 阅读约」 ─── */
  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  /* 主题的面包屑用 `{{ name | upper }}` 输出，于是「Python笔记」变成「PYTHON笔记」、
     「PathLib专项」变成「PATHLIB专项」，和目录树、正文标题对不上。
     这里按 SiyuanKnowledgeData 里的真实文档标题还原每一段。 */
  function fixCrumbNames(crumb, header) {
    var docs = (window.SiyuanKnowledgeData && window.SiyuanKnowledgeData.documents) || [];
    var byUrl = {};
    docs.forEach(function (doc) {
      if (!doc || !doc.url) return;
      var u;
      try { u = decodeURIComponent(doc.url); } catch (_) { u = doc.url; }
      byUrl[u.replace(/\/+$/, '')] = doc.title;
    });

    function nameFor(href) {
      var u;
      try { u = decodeURIComponent(href); } catch (_) { u = href; }
      u = u.replace(/index\.html$/, '').replace(/\/+$/, '');
      return byUrl[u] || '';
    }

    var links = crumb.querySelectorAll('a[href]');
    for (var i = 0; i < links.length; i++) {
      var name = nameFor(links[i].getAttribute('href'));
      if (name) links[i].textContent = name;
    }

    var title = header.querySelector('.post-title');
    var last = crumb.querySelector('li:last-child');
    if (last && title && !last.querySelector('a')) {
      last.textContent = title.textContent.trim();
    }
  }

  function buildHeader() {
    var header = document.querySelector('.post-header');
    if (!header || header.querySelector('.nv2-meta')) return;

    var crumb = header.querySelector('.breadcrumb');
    if (crumb) {
      crumb.className = 'nv2-crumb';
      header.insertBefore(crumb, header.firstChild);
      fixCrumbNames(crumb, header);
    }

    var box = header.querySelector('.post-meta-container');
    if (!box) return;
    var body = document.querySelector('.post-body');
    var chars = body ? (body.innerText || '').replace(/\s+/g, '').length : 0;
    var minutes = Math.max(1, Math.round(chars / 400));

    var date = '';
    var meta = document.querySelector('meta[property="article:published_time"]');
    if (meta && meta.content) {
      var d = new Date(meta.content);
      if (!isNaN(d.getTime())) date = d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
    }

    var parts = [];
    if (date) parts.push('<span class="nv2-meta-item">发表于 ' + date + '</span>');
    parts.push('<span class="nv2-meta-item">字数 ' + chars.toLocaleString() + '</span>');
    parts.push('<span class="nv2-meta-item">阅读约 ' + minutes + ' 分钟</span>');
    box.innerHTML = '<div class="nv2-meta">' + parts.join('<span class="nv2-meta-sep">|</span>') + '</div>';
  }

  /* ── 文章尾：版权卡 + 标签 ───────────────────────────────────────────── */
  function buildTail() {
    var body = document.querySelector('.post-body');
    if (!body) return;
    var anchor = document.querySelector('.siyuan-references') || body;

    var title = text(document.querySelector('.post-title')) || document.title;
    var card = el('div', 'nv2-copyright');
    card.innerHTML =
      '<div class="row"><span class="k">文章作者：</span><span>YangHanLin</span></div>' +
      '<div class="row"><span class="k">文章链接：</span><a href="' + location.origin + location.pathname + '">' +
        location.origin + decodeURI(location.pathname) + '</a></div>' +
      '<div class="row"><span class="k">版权声明：</span><span>本笔记采用 CC BY-NC-SA 4.0 许可协议，' +
        '转载请注明「' + title.replace(/["<>]/g, '') + '」及出处。</span></div>';
    anchor.parentNode.insertBefore(card, anchor.nextSibling);

    var tags = [];
    var raw = document.querySelectorAll('.post-meta a[rel="tag"], .post-meta a[href*="/tags/"], .post-tags a');
    for (var i = 0; i < raw.length; i++) {
      var label = text(raw[i]);
      var href = raw[i].getAttribute('href');
      if (label && href && !tags.some(function (t) { return t.href === href; })) tags.push({ label: label, href: href });
    }
    if (!tags.length) {
      tags = [
        { label: '学习笔记', href: '/tags/学习笔记/' },
        { label: '知识库', href: '/tags/知识库/' }
      ];
    }
    var wrap = el('div', 'nv2-tags');
    tags.forEach(function (t) {
      var a = el('a', null, t.label);
      a.href = t.href;
      wrap.appendChild(a);
    });
    card.parentNode.insertBefore(wrap, card.nextSibling);
  }

  /* ── 右下角：回到顶部 ────────────────────────────────────────────────── */
  function buildRightside() {
    if (document.getElementById('nv2-rightside')) return;
    var box = el('div');
    box.id = 'nv2-rightside';
    var up = el('button', null, ICON.up);
    up.type = 'button';
    up.setAttribute('aria-label', '回到顶部');
    up.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    box.appendChild(up);
    document.body.appendChild(box);
  }

  /* ── 启动 ────────────────────────────────────────────────────────────── */
  /* 学习笔记首页（/siyuan/）默认把左侧全文档目录当成常驻栏列出来，
     其它页面还是抽屉（点 ☰ 才出来）。 */
  function markKnowledgeHome() {
    var p = location.pathname.replace(/\/index\.html$/, '/');
    if (p === '/siyuan/' || p === '/siyuan') document.body.classList.add('is-knowledge-home');
  }

  function run() {
    markKnowledgeHome();
    buildNav();
    buildHeader();
    var toc = buildAside();
    if (toc) {
      var percent = toc.querySelector('.nv2-percent');
      bindToc(percent);
    }
    buildTail();
    buildRightside();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
