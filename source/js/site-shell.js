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
