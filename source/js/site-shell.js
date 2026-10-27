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
})();
