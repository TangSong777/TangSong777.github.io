const mobileKeyFromUrl = new URLSearchParams(location.search).get('key');
if (mobileKeyFromUrl) {
  sessionStorage.setItem('articleStudioKey', mobileKeyFromUrl);
  history.replaceState(null, '', location.pathname);
}

const state = {
  token: '', articles: [], currentPath: '', content: '', dirty: false, publishing: false,
  undoStack: [], redoStack: [], pendingEdit: null, applyingEdit: false,
  accessKey: mobileKeyFromUrl || sessionStorage.getItem('articleStudioKey') || '',
};
const $ = (selector) => document.querySelector(selector);
const editor = $('#markdownEditor');
const preview = $('#markdownPreview');

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body) headers['Content-Type'] = 'application/json';
  if (state.accessKey) headers['X-Article-Studio-Key'] = state.accessKey;
  if (options.method && options.method !== 'GET') headers['X-Article-Studio-Token'] = state.token;
  const response = await fetch(path, { ...options, headers });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.message || '操作失败');
    Object.assign(error, data);
    throw error;
  }
  return data;
}

function toast(message, isError = false) {
  const element = $('#toast');
  element.textContent = message;
  element.className = `toast show${isError ? ' error' : ''}`;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { element.className = 'toast'; }, 3200);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
}

function stripFrontMatter(markdown) {
  return markdown.replace(/^---\s*\r?\n[\s\S]*?\r?\n---\s*(?:\r?\n|$)/, '');
}

function titleFromContent(content, fallback) {
  const match = content.match(/^---\s*\r?\n[\s\S]*?^title:\s*([^\r\n]+)$/m);
  return match ? match[1].trim().replace(/^['"]|['"]$/g, '') : fallback.replace(/\.md$/i, '');
}

let previewTimer;
let previewRevision = 0;

function previewDocument(html) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <base href="${location.origin}/">
  <link rel="stylesheet" href="/site-preview/css/main.css">
  <style>
    html, body { min-height: 100%; margin: 0; background: #fff; }
    .main-inner.post.posts-expand { width: auto; max-width: none; margin: 0; padding: 32px clamp(24px, 6vw, 72px); }
    .post-block { margin: 0; }
    @media (max-width: 600px) {
      .main-inner.post.posts-expand { padding: 24px 20px; }
    }
  </style>
</head>
<body>
  <main class="main">
    <div class="main-inner post posts-expand">
      <div class="post-block">
        <article class="post-content" lang="zh-CN">
          <div class="post-body">${html}</div>
        </article>
      </div>
    </div>
  </main>
</body>
</html>`;
}

function renderPreview() {
  const raw = stripFrontMatter(editor.value);
  $('#wordCount').textContent = `${raw.replace(/\s/g, '').length} 字`;
  $('#documentTitle').textContent = titleFromContent(editor.value, state.currentPath);

  clearTimeout(previewTimer);
  const revision = ++previewRevision;
  const status = $('#previewStatus');
  if (!preview.getAttribute('srcdoc')) {
    status.textContent = '正在使用 Hexo 渲染预览…';
    status.className = 'preview-status';
  }
  previewTimer = setTimeout(async () => {
    try {
      const data = await api('/api/preview', {
        method: 'POST',
        body: JSON.stringify({ path: state.currentPath, content: editor.value }),
      });
      if (revision !== previewRevision) return;
      preview.addEventListener('load', () => status.classList.add('hidden'), { once: true });
      preview.srcdoc = previewDocument(data.html);
    } catch (error) {
      if (revision !== previewRevision) return;
      status.textContent = `预览渲染失败：${error.message}`;
      status.className = 'preview-status error';
    }
  }, 220);
}

function updateCursor() {
  const before = editor.value.slice(0, editor.selectionStart);
  const rows = before.split('\n');
  $('#cursorPosition').textContent = `行 ${rows.length}，列 ${rows.at(-1).length + 1}`;
}

function setDirty(dirty) {
  state.dirty = dirty;
  $('#saveState').textContent = state.currentPath ? (dirty ? '有未保存修改' : '已保存到本地') : '尚未选择文章';
  $('#saveButton').disabled = !state.currentPath || !dirty || state.publishing;
  $('#publishButton').disabled = !state.currentPath || state.publishing;
}

function renderList() {
  const query = $('#searchInput').value.trim().toLowerCase();
  const articles = state.articles.filter((item) => `${item.title} ${item.path}`.toLowerCase().includes(query));
  $('#articleList').innerHTML = articles.length ? articles.map((item) => `
    <button class="article-item ${item.path === state.currentPath ? 'active' : ''}" data-path="${escapeHtml(item.path)}">
      <strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.path)}</small>
    </button>`).join('') : '<div class="local-note">没有找到文章。</div>';
  document.querySelectorAll('.article-item').forEach((button) => button.addEventListener('click', () => selectArticle(button.dataset.path)));
}

async function loadArticles() {
  const data = await api('/api/articles');
  state.articles = data.articles;
  renderList();
}

async function selectArticle(path) {
  if (state.dirty && !confirm('当前文章有未保存修改，确定切换吗？')) return;
  const data = await api(`/api/article?path=${encodeURIComponent(path)}`);
  state.currentPath = data.path;
  state.content = data.content;
  state.undoStack = [];
  state.redoStack = [];
  state.pendingEdit = null;
  editor.value = data.content;
  $('#documentPath').textContent = `source/_posts/${data.path}`;
  $('#emptyState').classList.add('hidden');
  $('#editorView').classList.remove('hidden');
  renderPreview();
  updateCursor();
  setDirty(false);
  renderList();
}

async function saveArticle(showToast = true) {
  if (!state.currentPath) return;
  const data = await api('/api/save', { method: 'POST', body: JSON.stringify({ path: state.currentPath, content: editor.value }) });
  state.content = editor.value;
  setDirty(false);
  await loadArticles();
  if (showToast) toast(data.warnings.length ? `已保存；发现 ${data.warnings.length} 项可能的敏感内容` : data.message);
  return data;
}

function openRenameDialog() {
  if (!state.currentPath) return;
  const fileName = state.currentPath.split('/').at(-1).replace(/\.md$/i, '');
  $('#renameFileName').value = fileName;
  $('#renameDialog').showModal();
  $('#renameFileName').focus();
  $('#renameFileName').select();
}

async function renameArticle(event) {
  event.preventDefault();
  if (!state.currentPath) return;
  try {
    if (state.dirty) await saveArticle(false);
    const data = await api('/api/rename', {
      method: 'POST',
      body: JSON.stringify({ path: state.currentPath, fileName: $('#renameFileName').value }),
    });
    state.currentPath = data.path;
    state.content = data.content;
    editor.value = data.content;
    state.undoStack = [];
    state.redoStack = [];
    $('#documentPath').textContent = `source/_posts/${data.path}`;
    $('#renameDialog').close();
    renderPreview();
    setDirty(false);
    await loadArticles();
    toast(data.message);
  } catch (error) { toast(error.message, true); }
}

function openNewDialog() {
  $('#newTitle').value = '';
  $('#newSlug').value = '';
  delete $('#newSlug').dataset.edited;
  $('#newDialog').showModal();
  $('#newTitle').focus();
}

function slugify(value) {
  return value.trim().normalize('NFKC').replace(/[<>:"/\\|?*]/g, '-').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^[.-]+|[. ]+$/g, '');
}

async function createArticle(event) {
  event.preventDefault();
  const title = $('#newTitle').value.trim();
  const slug = $('#newSlug').value.trim();
  if (!title || !slug) return;
  try {
    const data = await api('/api/create', { method: 'POST', body: JSON.stringify({ title, slug }) });
    $('#newDialog').close();
    await loadArticles();
    await selectArticle(data.path);
    toast('新文章已创建。');
  } catch (error) { toast(error.message, true); }
}

function editorSnapshot() {
  return { value: editor.value, start: editor.selectionStart, end: editor.selectionEnd };
}

function refreshEditorState() {
  renderPreview();
  updateCursor();
  setDirty(editor.value !== state.content);
}

function recordEdit(before, after, inputType = 'toolbar') {
  if (before.value === after.value) return;
  const now = Date.now();
  const previous = state.undoStack.at(-1);
  const canGroup = inputType === 'insertText'
    && previous?.inputType === inputType
    && now - previous.time < 750
    && previous.after.value === before.value;

  if (canGroup) {
    previous.after = after;
    previous.time = now;
  } else {
    state.undoStack.push({ before, after, inputType, time: now });
    if (state.undoStack.length > 300) state.undoStack.shift();
  }
  state.redoStack = [];
}

function restoreSnapshot(snapshot) {
  state.applyingEdit = true;
  editor.value = snapshot.value;
  editor.focus({ preventScroll: true });
  editor.setSelectionRange(snapshot.start, snapshot.end);
  state.applyingEdit = false;
  refreshEditorState();
}

function undoEditorEdit() {
  const edit = state.undoStack.at(-1);
  if (!edit) return false;
  state.undoStack.pop();
  state.redoStack.push(edit);
  restoreSnapshot(edit.before);
  return true;
}

function redoEditorEdit() {
  const edit = state.redoStack.at(-1);
  if (!edit) return false;
  state.redoStack.pop();
  state.undoStack.push(edit);
  restoreSnapshot(edit.after);
  return true;
}

function applyUndoableEdit(start, end, replacement, nextStart, nextEnd = nextStart) {
  const before = editorSnapshot();
  state.applyingEdit = true;
  editor.focus({ preventScroll: true });
  editor.setSelectionRange(start, end);
  editor.setRangeText(replacement, start, end, 'end');
  editor.setSelectionRange(nextStart, nextEnd);
  state.applyingEdit = false;
  const after = editorSnapshot();
  recordEdit(before, after);
  refreshEditorState();
}

function replaceSelection(prefix, suffix = prefix, placeholder = '文本') {
  const start = editor.selectionStart;
  const end = editor.selectionEnd;
  const selected = editor.value.slice(start, end) || placeholder;
  const replacement = `${prefix}${selected}${suffix}`;
  applyUndoableEdit(start, end, replacement, start + prefix.length, start + prefix.length + selected.length);
}

function prefixLines(prefix) {
  const start = editor.value.lastIndexOf('\n', editor.selectionStart - 1) + 1;
  const endPosition = editor.value.indexOf('\n', editor.selectionEnd);
  const end = endPosition === -1 ? editor.value.length : endPosition;
  const selected = editor.value.slice(start, end).split('\n').map((line) => prefix + line).join('\n');
  applyUndoableEdit(start, end, selected, start + selected.length);
}

async function fileToDataUrl(file) {
  return await new Promise((resolvePromise, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolvePromise(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function insertImages(files) {
  if (!state.currentPath) return toast('请先创建或选择文章。', true);
  for (const file of [...files].filter((item) => item.type.startsWith('image/'))) {
    try {
      toast(`正在保存图片：${file.name}`);
      const data = await api('/api/image', {
        method: 'POST',
        body: JSON.stringify({ articlePath: state.currentPath, name: file.name, mime: file.type, data: await fileToDataUrl(file) }),
      });
      const alt = file.name.replace(/\.[^.]+$/, '');
      const markdown = `![${alt}](${data.markdownPath})`;
      applyUndoableEdit(editor.selectionStart, editor.selectionEnd, markdown, editor.selectionStart + markdown.length);
      toast('图片已插入。');
    } catch (error) { toast(error.message, true); }
  }
}

function showWarnings(warnings) {
  const box = $('#warningBox');
  const confirmLabel = $('#warningConfirmLabel');
  if (!warnings?.length) {
    box.classList.add('hidden');
    confirmLabel.classList.add('hidden');
    $('#warningConfirm').checked = false;
    return;
  }
  box.innerHTML = `<strong>检测到可能的敏感内容：</strong><br>${warnings.map((item) => `${escapeHtml(item.label)}（正文第 ${item.line} 行，${escapeHtml(item.sample)}）`).join('<br>')}`;
  box.classList.remove('hidden');
  confirmLabel.classList.remove('hidden');
}

async function openPublishDialog() {
  try {
    const result = await saveArticle(false);
    showWarnings(result.warnings);
    $('#commitMessage').value = `Publish article: ${titleFromContent(editor.value, state.currentPath)}`;
    $('#publishLog').classList.add('hidden');
    $('#publishLog').textContent = '';
    $('#confirmPublish').disabled = false;
    $('#confirmPublish').textContent = '开始上传';
    $('#publishDialog').showModal();
  } catch (error) { toast(error.message, true); }
}

async function publishArticle(event) {
  event.preventDefault();
  const confirmWarnings = $('#warningConfirm').checked;
  if (!$('#warningConfirmLabel').classList.contains('hidden') && !confirmWarnings) {
    return toast('请先检查敏感内容并确认。', true);
  }
  state.publishing = true;
  setDirty(false);
  $('#confirmPublish').disabled = true;
  $('#cancelPublish').disabled = true;
  $('#confirmPublish').textContent = '正在构建并上传…';
  const log = $('#publishLog');
  log.classList.remove('hidden');
  log.textContent = '正在保存文章并执行 Hexo 构建检查，请稍候…';
  try {
    const data = await api('/api/publish', {
      method: 'POST',
      body: JSON.stringify({
        path: state.currentPath, content: editor.value,
        message: $('#commitMessage').value, confirmWarnings,
      }),
    });
    log.textContent = data.logs || data.message;
    $('#confirmPublish').textContent = '上传完成';
    toast(data.message);
    await loadArticles();
  } catch (error) {
    if (error.code === 'SENSITIVE_WARNING') showWarnings(error.warnings);
    log.textContent = `${error.message}\n\n${error.details || ''}`.trim();
    $('#confirmPublish').disabled = false;
    $('#confirmPublish').textContent = '重试上传';
    toast(error.message, true);
  } finally {
    state.publishing = false;
    $('#cancelPublish').disabled = false;
    setDirty(false);
  }
}

async function init() {
  try {
    const config = await api('/api/config');
    state.token = config.token;
    await loadArticles();
  } catch (error) {
    toast(`无法连接本地后台：${error.message}`, true);
  }
}

editor.addEventListener('beforeinput', (event) => {
  if (state.applyingEdit || event.inputType.startsWith('history')) return;
  state.pendingEdit = { before: editorSnapshot(), inputType: event.inputType };
});
editor.addEventListener('input', (event) => {
  if (!state.applyingEdit && state.pendingEdit) {
    recordEdit(state.pendingEdit.before, editorSnapshot(), state.pendingEdit.inputType || event.inputType);
  }
  state.pendingEdit = null;
  refreshEditorState();
});
editor.addEventListener('click', updateCursor);
editor.addEventListener('keyup', updateCursor);
editor.addEventListener('keydown', (event) => {
  const modifier = event.ctrlKey || event.metaKey;
  const key = event.key.toLowerCase();
  if (modifier && !event.altKey && key === 'z') {
    event.preventDefault();
    if (event.shiftKey) redoEditorEdit();
    else undoEditorEdit();
    return;
  }
  if (modifier && !event.altKey && key === 'y') {
    event.preventDefault();
    redoEditorEdit();
    return;
  }
  if (event.key === 'Tab') {
    event.preventDefault();
    applyUndoableEdit(editor.selectionStart, editor.selectionEnd, '  ', editor.selectionStart + 2);
  }
});
document.addEventListener('keydown', (event) => {
  const modifier = event.ctrlKey || event.metaKey;
  if (!modifier || event.altKey || event.key.toLowerCase() !== 's') return;

  event.preventDefault();
  if (!state.currentPath) {
    toast('请先创建或选择文章。', true);
    return;
  }
  if (state.publishing) return;
  saveArticle().catch((error) => toast(error.message, true));
});
editor.addEventListener('paste', (event) => {
  const images = [...event.clipboardData.files].filter((file) => file.type.startsWith('image/'));
  if (images.length) { event.preventDefault(); insertImages(images); }
});
editor.addEventListener('dragover', (event) => event.preventDefault());
editor.addEventListener('drop', (event) => {
  const images = [...event.dataTransfer.files].filter((file) => file.type.startsWith('image/'));
  if (images.length) { event.preventDefault(); insertImages(images); }
});
document.querySelectorAll('.format-bar button').forEach((button) => {
  button.addEventListener('mousedown', (event) => event.preventDefault());
  button.addEventListener('click', () => {
    if (button.dataset.wrap) replaceSelection(button.dataset.wrap);
    else if (button.dataset.prefix) prefixLines(button.dataset.prefix);
    else if (button.dataset.action === 'link') replaceSelection('[', '](https://)', '链接文字');
  });
});
document.querySelectorAll('.view-tab').forEach((button) => button.addEventListener('click', () => {
  document.querySelectorAll('.view-tab').forEach((item) => item.classList.toggle('active', item === button));
  $('#splitPane').className = `split-pane ${button.dataset.view === 'write' ? 'write-only' : button.dataset.view === 'preview' ? 'preview-only' : ''}`;
}));
$('#imageInput').addEventListener('change', (event) => { insertImages(event.target.files); event.target.value = ''; });
$('#searchInput').addEventListener('input', renderList);
$('#newButton').addEventListener('click', openNewDialog);
$('#emptyNewButton').addEventListener('click', openNewDialog);
$('#newTitle').addEventListener('input', () => { if (!$('#newSlug').dataset.edited) $('#newSlug').value = slugify($('#newTitle').value); });
$('#newSlug').addEventListener('input', () => { $('#newSlug').dataset.edited = 'true'; });
$('#newForm').addEventListener('submit', createArticle);
$('#cancelCreate').addEventListener('click', () => $('#newDialog').close());
$('#saveButton').addEventListener('click', () => saveArticle().catch((error) => toast(error.message, true)));
$('#publishButton').addEventListener('click', openPublishDialog);
$('#renameButton').addEventListener('click', openRenameDialog);
$('#renameForm').addEventListener('submit', renameArticle);
$('#cancelRename').addEventListener('click', () => $('#renameDialog').close());
$('#publishForm').addEventListener('submit', publishArticle);
$('#cancelPublish').addEventListener('click', () => $('#publishDialog').close());
window.addEventListener('beforeunload', (event) => { if (state.dirty) { event.preventDefault(); event.returnValue = ''; } });
init();
