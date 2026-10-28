/* 文章工作台 · 界面辅助（Round 53）
   只做纯前端视觉交互，不碰编辑器状态。 */
(function () {
  const KEY = 'studio.outlineHidden';
  const toggle = document.getElementById('outlineToggle');

  function apply(hidden) {
    document.body.classList.toggle('outline-hidden', hidden);
    if (!toggle) return;
    toggle.classList.toggle('is-on', !hidden);
    toggle.setAttribute('aria-pressed', String(!hidden));
  }

  if (!toggle) return;

  let stored = null;
  try {
    stored = localStorage.getItem(KEY);
  } catch (error) {
    stored = null;
  }
  apply(stored === '1');

  toggle.addEventListener('click', function () {
    const hidden = !document.body.classList.contains('outline-hidden');
    apply(hidden);
    try {
      localStorage.setItem(KEY, hidden ? '1' : '0');
    } catch (error) {
      /* 隐私模式下写不进去也不影响本次会话 */
    }
  });
})();
