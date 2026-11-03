/* ─────────────────────────────────────────────────────────────
   视觉润色层（polish）的脚本部分
   1) 滚动揭示：内容进入视口时淡入上移（JS 挂不上的话元素保持可见）
   2) 顶栏吸顶：滚过一屏后给 body 加 .is-scrolled，导航变成毛玻璃
   3) 代码块复制按钮
   4) 文章「阅读时长」提示

   刻意保持零依赖、幂等、可重复执行：脚本里所有入口都先判断元素是否存在。
   ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── 1. 滚动揭示 ─────────────────────────────────────────── */
  function setupReveal() {
    if (reduceMotion || !('IntersectionObserver' in window)) return;

    var selectors = [
      'body.blog-home-mode .blog-home-hero',
      'body.blog-home-mode .blog-home-feed > .post-block',
      'body.blog-home-mode .blog-home-knowledge',
      'body.blog-home-mode .blog-home-rail > section',
      'body.blog-post-mode .post-block',
      'body.archive-mode .post-block'
    ];

    var nodes = [];
    selectors.forEach(function (sel) {
      Array.prototype.forEach.call(document.querySelectorAll(sel), function (node) {
        if (node.hasAttribute('data-reveal')) return;
        node.setAttribute('data-reveal', '');
        nodes.push(node);
      });
    });
    if (!nodes.length) return;

    // 同一批元素里按出现顺序做一点错位，避免整块一起跳
    nodes.forEach(function (node, i) {
      node.style.setProperty('--reveal-delay', (Math.min(i, 8) * 55) + 'ms');
    });

    document.documentElement.classList.add('js-reveal');

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });

    nodes.forEach(function (node) { io.observe(node); });

    // 首屏已经在视口里的元素，下一帧直接淡入，避免「先闪一下再动画」
    window.requestAnimationFrame(function () {
      nodes.forEach(function (node) {
        if (node.getBoundingClientRect().top < window.innerHeight * 0.95) {
          node.classList.add('is-in');
        }
      });
    });

    // 首屏元素通常已经在视口里，IntersectionObserver 会立刻回调；
    // 但某些浏览器在 UA 隐藏图片加载完成前不触发，给个兜底。
    window.setTimeout(function () {
      nodes.forEach(function (node) {
        var rect = node.getBoundingClientRect();
        if (rect.top < window.innerHeight) node.classList.add('is-in');
      });
    }, 900);
  }

  /* ── 2. 顶栏吸顶状态 ─────────────────────────────────────── */
  function setupStickyHeader() {
    var header = document.querySelector('header.header');
    if (!header) return;

    var ticking = false;

    function update() {
      ticking = false;
      document.body.classList.toggle('is-scrolled', window.scrollY > 8);
    }

    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }, { passive: true });

    update();
  }

  /* ── 3. 代码块复制 ───────────────────────────────────────── */
  function setupCodeCopy() {
    var blocks = document.querySelectorAll('figure.highlight');
    if (!blocks.length) return;

    Array.prototype.forEach.call(blocks, function (block) {
      if (block.querySelector('.code-copy-btn')) return;
      var codeHost = block.querySelector('td.code pre') || block.querySelector('pre');
      if (!codeHost) return;

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'code-copy-btn';
      btn.textContent = '复制';
      btn.setAttribute('aria-label', '复制这段代码');

      btn.addEventListener('click', function () {
        var text = codeHost.innerText.replace(/\n$/, '');
        var done = function () {
          btn.textContent = '已复制';
          btn.classList.add('is-done');
          window.setTimeout(function () {
            btn.textContent = '复制';
            btn.classList.remove('is-done');
          }, 1600);
        };
        var fail = function () {
          btn.textContent = '复制失败';
          window.setTimeout(function () { btn.textContent = '复制'; }, 1600);
        };

        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(done, fail);
        } else {
          // 老浏览器 / 非安全上下文
          var area = document.createElement('textarea');
          area.value = text;
          area.setAttribute('readonly', '');
          area.style.cssText = 'position:fixed;left:-9999px;top:0;';
          document.body.appendChild(area);
          area.select();
          try { document.execCommand('copy'); done(); } catch (_) { fail(); }
          document.body.removeChild(area);
        }
      });

      block.appendChild(btn);
    });
  }

  /* ── 4. 阅读时长 ─────────────────────────────────────────── */
  function setupReadingTime() {
    var body = document.querySelector('body.blog-post-mode .post-body');
    if (!body) return;
    var meta = document.querySelector('.post-meta-container');
    if (!meta || meta.querySelector('.post-reading-time')) return;

    var text = body.innerText || '';
    var cjk = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    var words = (text.replace(/[\u4e00-\u9fa5]/g, ' ').match(/[A-Za-z0-9]+/g) || []).length;
    // 中文按 400 字/分钟，英文按 220 词/分钟
    var minutes = Math.max(1, Math.round(cjk / 400 + words / 220));
    if (!cjk && !words) return;

    var span = document.createElement('span');
    span.className = 'post-reading-time';
    span.textContent = '· 约 ' + minutes + ' 分钟';
    meta.appendChild(span);
  }

  /* polish.js 是 defer 脚本，执行时机在「解析结束、DOMContentLoaded 之前」，
     而首页的 hero / 卡片是 siyuan-knowledge.js（下一个 defer 脚本）才拼出来的；
     直接跑会一条都匹配不到，所以统一等 DOMContentLoaded（此前的 defer 都已执行）。
     另挂 window.load 与超时兜底，防止脚本被异步加载时 DCL 已经错过。 */
  function ready(fn) {
    if (document.readyState === 'complete') { fn(); return; }
    var done = false;
    function run() { if (done) return; done = true; fn(); }
    document.addEventListener('DOMContentLoaded', run);
    window.addEventListener('load', run);
    window.setTimeout(run, 1200);
  }

  ready(function () {
    setupReveal();
    setupStickyHeader();
    setupCodeCopy();
    setupReadingTime();
  });
})();
