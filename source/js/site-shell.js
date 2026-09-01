(function () {
  'use strict';

  var path = location.pathname.replace(/index\.html$/, '').replace(/\/+$/, '') || '/';
  if (/\/archives(?:\/|$)/.test(path)) document.body.classList.add('archive-mode');
  if (document.querySelector('.main-inner.post') && path.indexOf('/siyuan') < 0) {
    document.body.classList.add('blog-post-mode');
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
