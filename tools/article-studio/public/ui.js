/* 文章工作台 · 界面辅助（Round 53–54）
   只做纯前端视觉交互，不碰编辑器状态。 */
(function () {
  /* ── 大纲折叠 ─────────────────────────────────────────────── */
  const KEY = 'studio.outlineHidden';
  const toggle = document.getElementById('outlineToggle');

  function applyOutline(hidden) {
    document.body.classList.toggle('outline-hidden', hidden);
    if (!toggle) return;
    toggle.classList.toggle('is-on', !hidden);
    toggle.setAttribute('aria-pressed', String(!hidden));
  }

  if (toggle) {
    let stored = null;
    try {
      stored = localStorage.getItem(KEY);
    } catch (error) {
      stored = null;
    }
    applyOutline(stored === '1');

    toggle.addEventListener('click', function () {
      const hidden = !document.body.classList.contains('outline-hidden');
      applyOutline(hidden);
      try {
        localStorage.setItem(KEY, hidden ? '1' : '0');
      } catch (error) {
        /* 隐私模式下写不进去也不影响本次会话 */
      }
    });
  }

  /* ── 源码视图行号 ─────────────────────────────────────────── */
  const area = document.getElementById('markdownEditor');
  const gutter = document.querySelector('.source-gutter');
  const surface = document.getElementById('editingSurface');

  if (!area || !gutter) return;

  function renderGutter() {
    const total = area.value.split('\n').length;
    if (gutter.dataset.lines === String(total)) return;
    gutter.dataset.lines = String(total);
    const parts = new Array(total);
    for (let i = 0; i < total; i += 1) parts[i] = i + 1;
    gutter.textContent = parts.join('\n');
    gutter.scrollTop = area.scrollTop;
  }

  area.addEventListener('input', renderGutter);
  area.addEventListener('scroll', function () {
    gutter.scrollTop = area.scrollTop;
  }, { passive: true });

  if (surface) {
    new MutationObserver(function () {
      if (area.offsetParent !== null) renderGutter();
    }).observe(surface, { attributes: true, attributeFilter: ['class'] });
  }

  renderGutter();
})();
