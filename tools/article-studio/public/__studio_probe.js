(function () {
  var f = document.getElementById('f');
  f.src = '/__studio_fake.html?path=rock5b-services.md';
  var R = [];
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function txt(w) { try { return w.__CM__().text; } catch (e) { return ''; } }
  function key(el, k, mods) { el.dispatchEvent(new KeyboardEvent('keydown', Object.assign({ key: k, bubbles: true, cancelable: true }, mods || {}))); }
  function cardCount(d) { return d.querySelectorAll('.cm-md-table-widget').length; }
  function rawTableVisible(d) {
    return [].slice.call(d.querySelectorAll('.cm-line')).some(function (l) { return l.textContent.indexOf('| 项目 | 规格') > -1; });
  }

  f.addEventListener('load', function () {
    setTimeout(async function () {
      var d = f.contentDocument, w = f.contentWindow;
      var T0 = txt(w);
      R.push('len0=' + T0.length);

      var before = cardCount(d);
      var card = d.querySelector('.cm-md-table-widget');
      R.push('初始卡=' + before);
      if (card) card.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: w }));
      await wait(500);
      var after = cardCount(d);
      R.push('点后卡=' + after);
      R.push('点表格进源码' + (after < before && rawTableVisible(d) ? '✓' : '✗'));

      var cm = d.querySelector('.cm-content');
      cm.focus();
      key(cm, 'a', { ctrlKey: true });
      await wait(250);
      var bold = d.querySelector('[data-wrap="**"]');
      if (bold) bold.click();
      await wait(400);
      R.push('加粗包裹全文' + (txt(w) === '**' + T0 + '**' ? '✓' : '✗'));
      key(cm, 'z', { ctrlKey: true });
      await wait(450);
      R.push('撤销恢复' + (txt(w) === T0 ? '✓' : '✗'));

      var toSource = d.querySelector('.view-tab[data-view="source"]');
      var back = d.querySelector('.view-tab[data-view="wysiwyg"]');
      if (toSource) toSource.click();
      await wait(400);
      if (back) back.click();
      await wait(500);
      R.push('往返正文一致' + (txt(w) === T0 ? '✓' : '✗'));
      var sb = d.querySelector('#saveButton');
      R.push('往返后不脏' + (sb && sb.disabled ? '✓' : '✗'));
      R.push('无装饰错误' + (!w.__CM_DECO_ERROR__ ? '✓' : '✗'));
      R.push('deco=' + w.__CM__().decorations);

      document.title = R.join(' ');
    }, 2400);
  });
})();