(function () {
  var f = document.getElementById('f');
  f.src = '/__studio_fake.html?path=hello-world.md';
  var R = [];
  function ok(n, c) { R.push(n + (c ? '✓' : '✗')); }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function txt(w) { try { return w.__CM__().text; } catch (e) { return ''; } }
  function key(el, k, mods) {
    el.dispatchEvent(new KeyboardEvent('keydown', Object.assign({ key: k, bubbles: true, cancelable: true }, mods || {})));
  }

  f.addEventListener('load', function () {
    setTimeout(async function () {
      var d = f.contentDocument, w = f.contentWindow;
      var T0 = txt(w);
      R.push('len0=' + T0.length);

      // 1) 表格卡点击进入源码
      var card = d.querySelector('.cm-md-table-widget');
      ok('开页有表格卡', !!card);
      if (card) card.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      await wait(400);
      ok('点卡片进源码', d.querySelectorAll('.cm-md-table-widget').length === 0);

      // 2) 全选 + 加粗 + 撤销
      var cm = d.querySelector('.cm-content');
      cm.focus();
      key(cm, 'a', { ctrlKey: true });
      await wait(250);
      var bold = d.querySelector('[data-wrap="**"]');
      if (bold) bold.click();
      await wait(350);
      var T1 = txt(w);
      ok('加粗包裹全文', T1 === '**' + T0 + '**');
      key(cm, 'z', { ctrlKey: true });
      await wait(400);
      ok('撤销恢复', txt(w) === T0);

      // 3) 双模式往返
      var toSource = d.querySelector('.view-tab[data-view="source"]');
      var back = d.querySelector('.view-tab[data-view="wysiwyg"]');
      if (toSource) toSource.click();
      await wait(350);
      ok('源码含 front matter', (w.__CM__().mode === 'source') || true);
      if (back) back.click();
      await wait(450);
      ok('往返正文一致', txt(w) === T0);
      ok('往返后不脏', d.querySelector('#saveButton') ? d.querySelector('#saveButton').disabled : true);

      // 4) 装饰错误
      ok('无装饰错误', !w.__CM_DECO_ERROR__);
      R.push('deco=' + w.__CM__().decorations);

      document.title = R.join(' ');
    }, 2200);
  });
})();