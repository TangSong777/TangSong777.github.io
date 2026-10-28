(function () {
  'use strict';

  var path = location.pathname.replace(/index\.html$/, '').replace(/\/+$/, '') || '/';
  if (/\/(?:archives|tags|categories)(?:\/|$)/.test(path)) {
    document.body.classList.add('archive-mode');
  }
  if (document.querySelector('.main-inner.post') && path.indexOf('/siyuan') < 0) {
    document.body.classList.add('blog-post-mode');
  }
  // 学习笔记站：造型与博客文章页不同（三栏、树形目录、独立侧栏），
  // 对应的 55 条规则一直写在 siyuan-knowledge.css 里，但从没被激活过。
  if (/^\/siyuan(?:\/|$)/.test(path)) {
    document.body.classList.add('siyuan-mode');
  }

  var main = document.querySelector('main, .main');
  if (main && !main.id) main.id = 'main-content';
  if (main && !document.querySelector('.site-skip-link')) {
    var skip = document.createElement('a');
    skip.className = 'site-skip-link';
    skip.href = '#main-content';
    skip.textContent = '跳到正文';
    document.body.insertBefore(skip, document.body.firstChild);
  }

/* siyuan 的「文档关系」区块里，「本文引用」在没有引用时仍然输出标题 + 空列表，
   正文白白多一行小标题、右侧目录也多一个点不动的锚点。
   这里把空分组连同目录里对应的那一条一起去掉。 */
(function () {
  var wrap = document.querySelector('.siyuan-references');
  if (!wrap) return;

  Array.prototype.forEach.call(wrap.querySelectorAll('h3'), function (head) {
    var list = head.nextElementSibling;
    if (!list || list.tagName !== 'UL') return;
    if (list.children.length > 0) return;

    var id = head.id;
    head.parentNode.removeChild(head);
    list.parentNode.removeChild(list);

    if (!id) return;
    Array.prototype.forEach.call(document.querySelectorAll('.post-toc a[href]'), function (link) {
      if (link.getAttribute('href') !== '#' + encodeURIComponent(id)) return;
      var item = link.closest('li');
      if (item) item.parentNode.removeChild(item);
    });
  });
})();

})();

/* 图片点开放大（Round 29）
   笔记页一屏能排十几张截图，正文里的图都按容器宽度缩过，想看清还得缩浏览器。
   点一下铺满屏，再点任意处或按 Esc 关闭。只处理 .post-body 里的图，
   头像、logo 之类不动；被 <a> 包住的图（可能是外链）让链接自己响应。 */
(function () {
  'use strict';
  var body = document.querySelector('.post-body');
  if (!body) return;

  var overlay = null;

  function close() {
    if (!overlay) return;
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    overlay = null;
    document.removeEventListener('keydown', onKey);
    document.body.style.removeProperty('overflow');
  }

  function onKey(event) {
    if (event.key === 'Escape') close();
  }

  function open(img) {
    overlay = document.createElement('div');
    overlay.className = 'img-zoom-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', (img.alt || '图片') + ' 预览');
    overlay.addEventListener('click', close);

    var big = document.createElement('img');
    big.src = img.currentSrc || img.src;
    big.alt = img.alt || '';
    /* 远端图挂了别留一块黑底空屏 */
    big.addEventListener('error', close);
    overlay.appendChild(big);

    /* alt 是 image / 图片 这种占位词时，写出来只会添乱 */
    var GENERIC_ALT = /^(image|img|图片|picture|photo)$/i;
    if (img.alt && !GENERIC_ALT.test(img.alt.trim())) {
      var caption = document.createElement('p');
      caption.className = 'img-zoom-caption';
      caption.textContent = img.alt;
      overlay.appendChild(caption);
    }

    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
  }

  body.addEventListener('click', function (event) {
    var target = event.target;
    if (!target || target.tagName !== 'IMG') return;
    if (target.classList.contains('site-author-image')) return;
    if (target.closest('a')) return;
    if (target.closest('.img-zoom-overlay')) return;
    event.preventDefault();
    open(target);
  });
})();

/* 笔记详情页标题重复（Round 43）
   siyuan 导出时正文第一个 h1 就是文档标题，而页面本身已经有 .post-title，
   于是卡片里出现两次同样的名字（「（已归档）」这类后缀会让两者只差几个字）。
   规则：h1 文本与页面标题相同、或页面标题以它开头，就去掉这个 h1，
   同时删掉右侧目录里对应的条目，免得点进去是空的。 */
(function () {
  'use strict';
  if (!document.body || document.body.className.indexOf('siyuan-mode') < 0) return;

  var box = document.querySelector('.post-body');
  var titleEl = document.querySelector('.post-title');
  if (!box || !titleEl) return;

  var title = (titleEl.textContent || '').trim();
  var h1 = box.querySelector('h1');
  if (!title || !h1) return;

  var text = (h1.textContent || '').trim();
  if (!text || (text !== title && title.indexOf(text) !== 0)) return;

  var id = h1.id;
  h1.parentNode.removeChild(h1);
  if (!id) return;

  Array.prototype.forEach.call(document.querySelectorAll('.post-toc a[href]'), function (link) {
    var href = link.getAttribute('href');
    if (href !== '#' + id && href !== '#' + encodeURIComponent(id)) return;
    var item = link.closest('li');
    if (item) item.parentNode.removeChild(item);
  });
})();
