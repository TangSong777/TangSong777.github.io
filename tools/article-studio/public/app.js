const mobileKeyFromUrl = new URLSearchParams(location.search).get('key');
if (mobileKeyFromUrl) {
  sessionStorage.setItem('articleStudioKey', mobileKeyFromUrl);
  history.replaceState(null, '', location.pathname);
}

const state = {
  token: '', articles: [], currentPath: '', content: '', dirty: false, publishing: false,
  undoStack: [], redoStack: [], pendingEdit: null, applyingEdit: false,
  identity: null, draftTimer: null, autoSaveTimer: null, autoSaving: false,
  autoSaveMinutes: 3, dirtySince: null,
  authMode: 'local', authenticated: false,
  siyuanDocuments: [], privateIncluded: new Set(), collapsed: new Set(), documentTree: null,
  accessKey: mobileKeyFromUrl || sessionStorage.getItem('articleStudioKey') || '',
};
const $ = (selector) => document.querySelector(selector);
const sourceEditor = $('#markdownEditor');
let richEditor;
let editorMode = 'wysiwyg';
let richFrontMatter = '';
let suppressRichChange = false;
let richChangeFrame;

function splitEditorDocument(value) {
  const text = String(value || '');
  const match = text.match(/^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/);
  if (!match) return { frontMatter: '', body: text };

  /* Round 43f: 只有「长得像 YAML」才当前置属性区。
     原来的正则只要有两条 --- 就切走中间内容，于是「正文以水平分割线开头」的文章
     会被吃掉一整段（编辑器里看起来内容凭空消失，保存后又原样写回，极难排查）。
     YAML 的判据：每一行要么空、要么注释、要么 key: value、要么是列表项 - xxx。 */
  const looksYaml = match[1].split(/\r?\n/).every((row) => {
    const t = row.trim();
    if (t === '') return true;
    if (t.charAt(0) === '#') return true;
    if (/^[-\w]+\s*:/.test(t)) return true;
    return /^-\s/.test(t);
  });
  if (!looksYaml) return { frontMatter: '', body: text };

  return { frontMatter: match[0], body: text.slice(match[0].length) };
}

function setEditorContent(value) {
  const text = String(value || '');
  const parts = splitEditorDocument(text);
  richFrontMatter = parts.frontMatter;
  sourceEditor.value = text;
  if (richEditor) {
    suppressRichChange = true;
    richEditor.setMarkdown(parts.body, false);
    suppressRichChange = false;
  }
}

function currentEditorContent() {
  if (editorMode === 'wysiwyg' && richEditor) return `${richFrontMatter}${richEditor.getMarkdown()}`;
  return sourceEditor.value;
}

/**
 * 编辑器统一门面。
 * - 所见即所得模式（CodeMirror）下所有读写都落到 CodeMirror 上
 * - 源码模式下落到 textarea
 *
 * 坐标注意：editor.value 包含 front matter，而 CodeMirror 只装正文，
 * 因此读写选中范围都要做一次 offset 换算。
 */
const editor = {
  get value() { return currentEditorContent(); },
  set value(value) { setEditorContent(value); },

  get _cm() { return (editorMode === 'wysiwyg' && richEditor) ? richEditor : null; },
  get _offset() { return this._cm ? richFrontMatter.length : 0; },

  get selectionStart() {
    const cm = this._cm;
    if (cm) return cm.state.selection.main.from + this._offset;
    return sourceEditor.selectionStart;
  },
  get selectionEnd() {
    const cm = this._cm;
    if (cm) return cm.state.selection.main.to + this._offset;
    return sourceEditor.selectionEnd;
  },

  setSelectionRange(start, end) {
    const cm = this._cm;
    if (cm) {
      const offset = this._offset;
      const total = cm.state.doc.length;
      const anchor = Math.max(0, Math.min(total, start - offset));
      const head = Math.max(0, Math.min(total, (end ?? start) - offset));
      cm.dispatch({ selection: { anchor, head } });
      return;
    }
    sourceEditor.setSelectionRange(start, end);
  },

  setRangeText(replacement, start, end) {
    const cm = this._cm;
    if (cm) {
      const offset = this._offset;
      const total = cm.state.doc.length;
      const from = Math.max(0, Math.min(total, start - offset));
      const to = Math.max(0, Math.min(total, (end ?? start) - offset));
      cm.dispatch({
        changes: { from, to, insert: replacement },
        selection: { anchor: from + replacement.length },
      });
      return;
    }
    sourceEditor.setRangeText(replacement, start, end, 'end');
  },

  focus(options) {
    const cm = this._cm;
    if (cm) { cm.focus(); return; }
    sourceEditor.focus(options);
  },

  addEventListener(...args) { sourceEditor.addEventListener(...args); },
};
const articleMetadata = globalThis.ArticleMetadata;
const AUTO_SAVE_RETRY_MS = 60 * 1000;

let pendingRequests = 0;

function updateLoadingBar() {
  const bar = document.querySelector('#loadingBar');
  if (!bar) return;
  bar.classList.toggle('active', pendingRequests > 0);
}

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body) headers['Content-Type'] = 'application/json';
  if (state.accessKey) headers['X-Article-Studio-Key'] = state.accessKey;
  if (options.method && options.method !== 'GET') headers['X-Article-Studio-Token'] = state.token;
  pendingRequests += 1;
  updateLoadingBar();
  try {
    const response = await fetch(path, { ...options, headers });
    const data = await response.json();
    if (!response.ok) {
      if (response.status === 401 && state.authMode === 'password' && path !== '/api/login') showLoginDialog();
      const error = new Error(data.message || '操作失败');
      Object.assign(error, data);
      throw error;
    }
    return data;
  } finally {
    pendingRequests = Math.max(0, pendingRequests - 1);
    updateLoadingBar();
  }
}

function showLoginDialog() {
  const dialog = $('#loginDialog');
  if (!dialog || dialog.open) return;
  $('#loginPassword').value = '';
  $('#loginTotp').value = '';
  $('#loginError').textContent = '';
  dialog.showModal();
  $('#loginPassword').focus();
}

async function login(event) {
  event.preventDefault();
  const button = $('#loginSubmit');
  const password = $('#loginPassword').value;
  if (!password) return;
  button.disabled = true;
  $('#loginError').textContent = '';
  try {
    const payload = { password };
    if (!$('#loginTotp').hidden) payload.totp = $('#loginTotp').value.trim();
    const result = await api('/api/login', { method: 'POST', body: JSON.stringify(payload) });
    state.token = result.token || '';
    state.authenticated = true;
    $('#loginDialog').close();
    $('#identityState').textContent = '已登录';
    await loadArticles();
  } catch (error) {
    $('#loginError').textContent = error.message || '登录失败';
  } finally {
    button.disabled = false;
  }
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

/* 底部状态栏：显示当前光标所在行列 */
function updateCursorPosition() {
  const label = $('#cursorPosition');
  if (!label) return;
  const cm = editor._cm;
  if (cm && cm.hasFocus) {
    const pos = cm.state.selection.main.head;
    const line = cm.state.doc.lineAt(pos);
    label.textContent = `行 ${line.number} · 列 ${pos - line.from + 1}`;
    return;
  }
  if (document.activeElement === sourceEditor) {
    const before = sourceEditor.value.slice(0, sourceEditor.selectionStart || 0);
    const line = before.split('\n').length;
    const col = before.length - before.lastIndexOf('\n');
    label.textContent = `行 ${line} · 列 ${col}`;
    return;
  }
  label.textContent = editorMode === 'wysiwyg' ? '所见即所得' : 'Markdown 源码';
}

let previewCache = { value: null, text: '' };

function renderPreview(options = {}) {
  const content = options.value ?? editor.value;

  // 值没变就跳过统计，避免每次按键都全文扫描
  if (content !== previewCache.value) {
    const raw = stripFrontMatter(content);
    const chars = raw.replace(/\s/g, '').length;
    $('#wordCount').textContent = `${chars.toLocaleString('zh-CN')} 字`;
    $('#documentTitle').textContent = titleFromContent(content, state.currentPath);
    previewCache = { value: content, text: null };
  }

  if (options.resetScroll) {
    const cm = editor._cm;
    if (cm) {
      cm.dispatch({ selection: { anchor: 0 }, scrollIntoView: true });
      cm.scrollDOM.scrollTop = 0;
    } else {
      sourceEditor.setSelectionRange(0, 0);
      sourceEditor.scrollTop = 0;
    }
    previewCache.value = null; // 强制下一次重算标题
  }
}

function updateCursor() {
  if (editorMode === 'wysiwyg') {
    $('#cursorPosition').textContent = '所见即所得';
    return;
  }
  const before = editor.value.slice(0, editor.selectionStart);
  const rows = before.split('\n');
  $('#cursorPosition').textContent = `行 ${rows.length}，列 ${rows.at(-1).length + 1}`;
}

function clearAutoSaveTimer() {
  clearTimeout(state.autoSaveTimer);
  state.autoSaveTimer = null;
}

function autoSaveDelayMs() {
  return state.autoSaveMinutes * 60 * 1000;
}

function scheduleAutoSave(delay) {
  if (!state.currentPath || !state.dirty || state.autoSaveTimer) return;
  const elapsed = state.dirtySince ? Date.now() - state.dirtySince : 0;
  const wait = delay ?? Math.max(0, autoSaveDelayMs() - elapsed);
  state.autoSaveTimer = setTimeout(async () => {
    state.autoSaveTimer = null;
    if (!state.dirty || !state.currentPath) return;
    if (state.publishing || state.autoSaving) {
      scheduleAutoSave(AUTO_SAVE_RETRY_MS);
      return;
    }
    state.autoSaving = true;
    try {
      const data = await saveArticle(false);
      const suffix = data?.warnings?.length ? `，发现 ${data.warnings.length} 项可能的敏感内容` : '';
      toast(`已自动保存${suffix}`);
    } catch (error) {
      toast(`自动保存失败：${error.message}；将在 1 分钟后重试`, true);
      scheduleAutoSave(AUTO_SAVE_RETRY_MS);
    } finally {
      state.autoSaving = false;
    }
  }, wait);
}

function setDirty(dirty) {
  const wasDirty = state.dirty;
  state.dirty = dirty;
  if (dirty) {
    if (!wasDirty || !state.dirtySince) state.dirtySince = Date.now();
    scheduleAutoSave();
  } else {
    state.dirtySince = null;
    clearAutoSaveTimer();
  }
  $('#saveState').textContent = state.currentPath ? (dirty ? `有未保存修改 · ${state.autoSaveMinutes} 分钟后自动保存` : '已保存到本地') : '尚未选择文章';
  $('#saveButton').disabled = !state.currentPath || !dirty || state.publishing;
  $('#publishButton').disabled = !state.currentPath || state.publishing;
}

function draftKey(path) {
  return `article-studio:draft:${path}`;
}

function storeDraftSoon(pendingValue) {
  clearTimeout(state.draftTimer);
  if (!state.currentPath) return;
  state.draftTimer = setTimeout(() => {
    try {
      localStorage.setItem(draftKey(state.currentPath), JSON.stringify({
        content: pendingValue ?? editor.value,
        savedAt: new Date().toISOString(),
      }));
    } catch { /* 浏览器禁用或空间不足时仍可手动保存到服务端 */ }
  }, 600);
}

function removeDraft(path = state.currentPath) {
  if (!path) return;
  try { localStorage.removeItem(draftKey(path)); } catch { /* 无可清理内容 */ }
}

function closeArticlePanel() {
  document.body.classList.remove('article-panel-open');
  $('#mobileMenuButton').setAttribute('aria-expanded', 'false');
}

function openArticlePanel() {
  document.body.classList.add('article-panel-open');
  $('#mobileMenuButton').setAttribute('aria-expanded', 'true');
}

function articleStamp(item) {
  const raw = item.updatedAt || item.date || '';
  const d = new Date(raw);
  if (!d || Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function articleMeta(item) {
  const stamp = articleStamp(item);
  return stamp ? `${stamp} · ${item.path}` : item.path;
}

function renderList() {
  const list = $('#articleList');
  const oldScroll = list.scrollTop;
  const query = $('#searchInput').value.trim().toLowerCase();
  const articles = state.articles.filter((item) => `${item.title} ${item.path}`.toLowerCase().includes(query));
  list.innerHTML = articles.length ? articles.map((item) => `
    <div class="article-row" data-path="${escapeHtml(item.path)}">
    <button class="article-item ${item.path === state.currentPath ? 'active' : ''}" data-path="${escapeHtml(item.path)}" title="右键编辑文章信息">
      <strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(articleMeta(item))}</small>
    </button><button type="button" class="article-more" aria-label="编辑 ${escapeHtml(item.title)} 的文章信息" title="文章信息">⋯</button></div>`).join('') : `<div class="list-empty"><p class="list-empty-title">${query ? '没有匹配的文章' : '还没有文章'}</p><p class="list-empty-hint">${query ? '换个关键词试试' : '点右上角的 ＋ 新建一篇'}</p></div>`;
  list.scrollTop = oldScroll;
  document.querySelectorAll('.article-item').forEach((button) => button.addEventListener('click', () => selectArticle(button.dataset.path)));
  list.querySelectorAll('.article-row').forEach((row) => {
    const open = (event) => {
      event.preventDefault();
      openArticleQuickInfo(row.dataset.path).catch((error) => toast(error.message, true));
    };
    row.addEventListener('contextmenu', open);
    row.querySelector('.article-more').addEventListener('click', open);
    row.addEventListener('keydown', (event) => {
      if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) open(event);
    });
  });
}

let openingQuickInfo = false;
async function openArticleQuickInfo(path) {
  if (openingQuickInfo || state.publishing) return;
  openingQuickInfo = true;
  try {
    // Selecting another article uses the existing unsaved-change/draft protection.
    if (state.currentPath !== path && !await selectArticle(path)) return;
    openMetadataDialog();
  } finally { openingQuickInfo = false; }
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
  let initialContent = data.content;
  try {
    const draft = JSON.parse(localStorage.getItem(draftKey(data.path)) || 'null');
    if (draft?.content && draft.content !== data.content) {
      const stamp = draft.savedAt ? new Date(draft.savedAt).toLocaleString() : '未知时间';
      if (confirm(`发现 ${stamp} 的浏览器草稿，是否恢复？\n\n选择“取消”将使用 Rock 上已保存的版本。`)) initialContent = draft.content;
      else removeDraft(data.path);
    }
  } catch { removeDraft(data.path); }
  editor.value = initialContent;
  $('#documentPath').textContent = `source/_posts/${data.path}`;
  $('#emptyState').classList.add('hidden');
  $('#editorView').classList.remove('hidden');
  // CodeMirror 在隐藏状态下创建时量不到尺寸，显示后必须重新测量
  if (richEditor && typeof richEditor.requestMeasure === 'function') {
    requestAnimationFrame(() => richEditor.requestMeasure());
  }
  renderPreview({ immediate: true, resetScroll: true });
  updateCursor();
  setDirty(initialContent !== data.content);
  renderList();
  closeArticlePanel();
  scheduleArticleOutline();
  return true;
}

async function saveArticle(showToast = true) {
  if (!state.currentPath) return;
  const savedPath = state.currentPath;
  const savedContent = editor.value;
  const data = await api('/api/save', { method: 'POST', body: JSON.stringify({ path: savedPath, content: savedContent }) });
  if (state.currentPath !== savedPath) return data;
  state.content = savedContent;
  const stillDirty = editor.value !== savedContent;
  if (!stillDirty) removeDraft();
  state.dirty = false;
  state.dirtySince = null;
  clearAutoSaveTimer();
  setDirty(stillDirty);
  await loadArticles();
  if (showToast) toast(data.warnings.length ? `已保存；发现 ${data.warnings.length} 项可能的敏感内容` : data.message);
  if (window.parent !== window) window.parent.postMessage({ type: 'studio-saved', path: savedPath }, location.origin);
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

function openMetadataDialog() {
  if (!state.currentPath) return;
  const metadata = articleMetadata.read(editor.value);
  $('#metadataFileInfo').textContent = `source/_posts/${state.currentPath} · 正文约 ${Array.from(articleMetadata.splitDocument(editor.value).body || splitEditorDocument(editor.value).body).length} 字符${state.dirty ? ' · 有未保存修改' : ' · 已保存'}`;
  $('#metadataTitle').value = metadata.title || titleFromContent(editor.value, state.currentPath);
  $('#metadataDate').value = metadata.date || articleMetadata.currentLocalDateTime();
  $('#metadataUpdated').value = metadata.updated;
  $('#metadataCategories').value = metadata.categories.join(', ');
  $('#metadataTags').value = metadata.tags.join(', ');
  $('#metadataDescription').value = metadata.description;
  $('#metadataDialog').showModal();
  $('#metadataTitle').focus();
  $('#metadataTitle').select();
}

function updateArticleMetadata(event) {
  event.preventDefault();
  if (!state.currentPath) return;
  try {
    const before = editorSnapshot();
    const oldBodyStart = articleMetadata.splitDocument(before.value).bodyStart;
    const value = articleMetadata.update(before.value, {
      title: $('#metadataTitle').value,
      date: $('#metadataDate').value,
      updated: $('#metadataUpdated').value,
      categories: $('#metadataCategories').value,
      tags: $('#metadataTags').value,
      description: $('#metadataDescription').value,
    });
    const newBodyStart = articleMetadata.splitDocument(value).bodyStart;
    const movePosition = (position) => position >= oldBodyStart ? newBodyStart + position - oldBodyStart : Math.min(position, newBodyStart);

    state.applyingEdit = true;
    editor.value = value;
    editor.setSelectionRange(movePosition(before.start), movePosition(before.end));
    state.applyingEdit = false;
    const after = editorSnapshot();
    recordEdit(before, after, 'metadata');
    refreshEditorState();
    $('#metadataDialog').close();
    editor.focus({ preventScroll: true });
    toast(before.value === value ? '文章信息没有变化。' : '文章信息已更新；按 Ctrl+S 保存。');
  } catch (error) {
    toast(error.message, true);
  }
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
    renderPreview({ immediate: true, resetScroll: true });
    setDirty(false);
    await loadArticles();
    toast(data.message);
  } catch (error) { toast(error.message, true); }
}

async function deleteArticle() {
  if (!state.currentPath || state.publishing) return;
  const path = state.currentPath;
  const title = titleFromContent(editor.value, path);
  if (state.dirty && !confirm('当前文章有未保存修改，删除后这些修改也会丢失。确定继续吗？')) return;
  if (!confirm(`确定删除《${title}》吗？这会删除本地文章和关联图片，并提交推送以同步删除网站版本。`)) return;
  state.publishing = true;
  setDirty(state.dirty);
  try {
    const data = await api('/api/delete', {
      method: 'POST',
      body: JSON.stringify({ path }),
    });
    removeDraft(path);
    clearAutoSaveTimer();
    // 通知管理中心母页面：文章没了，回到列表并刷新。Round 45
    if (window.parent && window.parent !== window) {
      try { window.parent.postMessage({ type: 'rock-studio:article-deleted', path: path }, '*'); } catch (error) { /* 跨域时忽略 */ }
    }
    state.currentPath = '';
    state.content = '';
    state.dirty = false;
    state.dirtySince = null;
    state.undoStack = [];
    state.redoStack = [];
    state.pendingEdit = null;
    editor.value = '';
    $('#metadataDialog').close();
    $('#editorView').classList.add('hidden');
    $('#emptyState').classList.remove('hidden');
    $('#documentPath').textContent = '';
    $('#documentTitle').textContent = '未命名文章';
    setDirty(false);
    await loadArticles();
    toast(data.message);
  } catch (error) { toast(error.message, true); }
  finally {
    state.publishing = false;
    setDirty(state.dirty);
  }
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
  // 只取一次全文：CodeMirror 下每次 editor.value 都是 doc.toString()，
  // 大文档里调三次会明显掉帧。
  const value = editor.value;
  const dirty = value !== state.content;
  scheduleArticleOutline();
  renderPreview({ value });
  updateCursor();
  setDirty(dirty);
  if (dirty) storeDraftSoon(value);
}

let outlineTimer;
let outlineEntries = [];
let outlineActiveButton = null;
let outlineScrollFrame;
function syncArticleOutline() {
  const nav = $('#articleOutline');
  const container = editorMode === 'wysiwyg' ? ($('#richEditor .cm-scroller') || $('#richEditor')) : sourceEditor;
  if (!nav || !container || !outlineEntries.length) return;
  const bounds = container.getBoundingClientRect();
  const threshold = Math.min(180, container.clientHeight * .24);
  let current = outlineEntries[0];
  outlineEntries.forEach((entry) => {
    const top = entry.node ? entry.node.getBoundingClientRect().top - bounds.top
      : sourceEditor.value.slice(0, entry.offset).split('\n').length * parseFloat(getComputedStyle(sourceEditor).lineHeight) - container.scrollTop;
    if (top <= threshold) current = entry;
  });
  if (container.scrollHeight > container.clientHeight + 8 && container.scrollTop + container.clientHeight >= container.scrollHeight - 8) current = outlineEntries.at(-1);
  if (outlineActiveButton === current.button) return;
  outlineEntries.forEach(({ button }) => {
    button.classList.toggle('outline-current', button === current.button);
    if (button === current.button) button.setAttribute('aria-current', 'location');
    else button.removeAttribute('aria-current');
  });
  outlineActiveButton = current.button;
  const itemBounds = current.button.getBoundingClientRect(), panelBounds = nav.getBoundingClientRect();
  if (itemBounds.top < panelBounds.top + 16 || itemBounds.bottom > panelBounds.bottom - 16) {
    nav.scrollTop += itemBounds.top - panelBounds.top - nav.clientHeight / 2;
  }
}
$('#editingSurface').addEventListener('scroll', (event) => {
  if (event.target !== sourceEditor && !event.target.matches?.('#richEditor .cm-scroller')) return;
  if (outlineScrollFrame) return;
  outlineScrollFrame = requestAnimationFrame(() => { outlineScrollFrame = null; syncArticleOutline(); });
}, true);
function scheduleArticleOutline() {
  clearTimeout(outlineTimer);
  outlineTimer = setTimeout(renderArticleOutline, 120);
}

/**
 * 从 Markdown 正文里解析标题，返回 { level, title, offset }。
 * CodeMirror 与源码模式共用这一套逻辑。
 */
function parseMarkdownHeadings(body, baseOffset, out) {
  let offset = baseOffset;
  let fence = null;
  const lines = String(body || '').split('\n');

  /* Round 43f: 大纲跳过 YAML 属性区。
     属性区里的 `sticky: 2` 下一行正好是 `---`，会被 setext 规则误判成二级标题，
     于是大纲第一条变成 "sticky: 2"。这里先把开头那一段整块排除掉。 */
  let fmSkip = -1;
  for (let i = 0; i < Math.min(lines.length, 5); i += 1) {
    const probe = lines[i].trim();
    if (!probe) continue;
    if (probe === '---' || probe === '---yaml') {
      for (let j = i + 1; j < Math.min(lines.length, i + 301); j += 1) {
        const close = lines[j].trim();
        if (close === '---' || close === '...') {
          const looksYaml = lines.slice(i + 1, j).every((row) => {
            const t = row.trim();
            return t === '' || /^[-\w]+\s*:/.test(t) || t.charAt(0) === '#';
          });
          if (looksYaml) fmSkip = j;
          break;
        }
      }
    }
    break;
  }

  lines.forEach((line, index) => {
    if (index <= fmSkip) { offset += line.length + 1; return; }
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (marker) {
      if (!fence) fence = marker[1];
      else if (marker[1][0] === fence[0] && marker[1].length >= fence.length && /^\s*$/.test(line.slice(marker[0].length))) fence = null;
    } else if (!fence) {
      const atx = line.match(/^ {0,3}(#{1,6})(?:[ \t]+|$)(.*)/);
      const setext = line.trim() && lines[index + 1]?.match(/^ {0,3}(=+|-+)\s*$/);
      if (atx) out.push({ level: atx[1].length, title: atx[2].replace(/[ \t]+#+\s*$/, ''), offset });
      else if (setext) out.push({ level: setext[1][0] === '=' ? 1 : 2, title: line.trim(), offset });
    }
    offset += line.length + 1;
  });
  return out;
}

function renderArticleOutline() {
  const nav = $('#articleOutline');
  if (!nav) return;
  let headings;
  if (editorMode === 'wysiwyg') {
    // CodeMirror 里标题不是 DOM 元素，直接从文本解析，点击时按行定位
    headings = [];
    const parts = splitEditorDocument(richEditor ? richEditor.getMarkdown() : sourceEditor.value);
    parseMarkdownHeadings(parts.body, parts.frontMatter.length, headings);
  } else {
    headings = [];
    const parts = splitEditorDocument(sourceEditor.value);
    let offset = parts.frontMatter.length, fence = null;
    const lines = parts.body.split('\n');
    lines.forEach((line, index) => {
      const marker = line.match(/^ {0,3}(`{3,}|~{3,})/);
      if (marker) {
        if (!fence) fence = marker[1];
        else if (marker[1][0] === fence[0] && marker[1].length >= fence.length && /^\s*$/.test(line.slice(marker[0].length))) fence = null;
      } else if (!fence) {
        const atx = line.match(/^ {0,3}(#{1,6})(?:[ \t]+|$)(.*)/);
        const setext = line.trim() && lines[index + 1]?.match(/^ {0,3}(=+|-+)\s*$/);
        if (atx) headings.push({ level: atx[1].length, title: atx[2].replace(/[ \t]+#+\s*$/, ''), offset });
        else if (setext) headings.push({ level: setext[1][0] === '=' ? 1 : 2, title: line.trim(), offset });
      }
      offset += line.length + 1;
    });
  }
  const scroll = nav.scrollTop;
  outlineEntries = [];
  outlineActiveButton = null;
  nav.replaceChildren();
  if (!headings.length) {
    const empty = document.createElement('p'); empty.className = 'outline-empty'; empty.textContent = '添加标题后显示大纲'; nav.append(empty);
  }
  headings.forEach((heading) => {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'outline-item';
    button.style.setProperty('--outline-depth', heading.level - 1);
    button.textContent = heading.title.trim() || '未命名标题';
    button.title = `H${heading.level} · ${button.textContent}`;
    button.addEventListener('click', () => {
      if (editorMode === 'wysiwyg' && richEditor) {
        // CodeMirror：按偏移量定位并滚动到可视区
        const position = Math.min(heading.offset + 0, richEditor.state.doc.length);
        richEditor.dispatch({
          selection: { anchor: position },
          scrollIntoView: true,
        });
        richEditor.focus();
        return;
      }
      sourceEditor.focus();
      sourceEditor.setSelectionRange(heading.offset, heading.offset);
      const line = sourceEditor.value.slice(0, heading.offset).split('\n').length - 1;
      sourceEditor.scrollTop = Math.max(0, line * parseFloat(getComputedStyle(sourceEditor).lineHeight) - 40);
      updateCursor();
    });
    nav.append(button);
    outlineEntries.push({ ...heading, button });
  });
  nav.scrollTop = scroll;
  syncArticleOutline();
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

function insertDivider() {
  const start = editor.selectionStart;
  const end = editor.selectionEnd;
  const before = editor.value.slice(0, start);
  const after = editor.value.slice(end);
  const prefix = before.length && !before.endsWith('\n\n') ? (before.endsWith('\n') ? '\n' : '\n\n') : '';
  const suffix = after.length && !after.startsWith('\n\n') ? (after.startsWith('\n') ? '\n' : '\n\n') : '';
  const replacement = `${prefix}---${suffix}`;
  applyUndoableEdit(start, end, replacement, start + prefix.length + 3);
}

function blockInsertRange() {
  let start = editor.selectionStart;
  let end = editor.selectionEnd;
  // 光标落在行中间时，把插入点移到本行末尾，避免把一句话切断
  if (start === end) {
    const lineStart = editor.value.lastIndexOf('\n', start - 1) + 1;
    if (start > lineStart) {
      const lineEnd = editor.value.indexOf('\n', start);
      if (lineEnd !== -1) {
        start = lineEnd;
        end = lineEnd;
      }
    }
  }
  const before = editor.value.slice(0, start);
  const after = editor.value.slice(end);
  const prefix = before.length && !before.endsWith('\n\n') ? (before.endsWith('\n') ? '\n' : '\n\n') : '';
  const suffix = after.length && !after.startsWith('\n\n') ? (after.startsWith('\n') ? '\n' : '\n\n') : '';
  return { start, end, prefix, suffix };
}

function insertTable() {
  const { start, end, prefix, suffix } = blockInsertRange();
  const table = '| 列 1 | 列 2 |\n| --- | --- |\n| 内容 | 内容 |';
  const replacement = `${prefix}${table}${suffix}`;
  const selectStart = start + prefix.length + 2;
  applyUndoableEdit(start, end, replacement, selectStart, selectStart + 3);
}

function insertTaskList() {
  const { start, end, prefix, suffix } = blockInsertRange();
  const body = '- [ ] 待办事项\n- [ ] 待办事项';
  const replacement = `${prefix}${body}${suffix}`;
  const selectStart = start + prefix.length + 6;
  applyUndoableEdit(start, end, replacement, selectStart, selectStart + 4);
}

async function fileToDataUrl(file) {
  return await new Promise((resolvePromise, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolvePromise(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function uploadImageFile(file) {
  if (!state.currentPath) throw new Error('请先创建或选择文章。');
  return api('/api/image', {
    method: 'POST',
    body: JSON.stringify({ articlePath: state.currentPath, name: file.name, mime: file.type, data: await fileToDataUrl(file) }),
  });
}

async function insertImages(files) {
  if (!state.currentPath) return toast('请先创建或选择文章。', true);
  for (const file of [...files].filter((item) => item.type.startsWith('image/'))) {
    try {
      toast(`正在保存图片：${file.name}`);
      const data = await uploadImageFile(file);
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
  const blocked = (warnings || []).filter((item) => item.severity === 'block');
  if (!warnings?.length) {
    box.classList.remove('blocked');
    box.classList.add('hidden');
    confirmLabel.classList.add('hidden');
    $('#warningConfirm').checked = false;
    return false;
  }
  $('#warningConfirm').checked = false;
  box.classList.toggle('blocked', blocked.length > 0);
  box.innerHTML = `<strong>${blocked.length ? '检测到禁止公开的敏感内容，请先删除：' : '检测到可能的敏感内容：'}</strong><br>${warnings.map((item) => `${item.severity === 'block' ? '⛔' : '⚠️'} ${escapeHtml(item.label)}（正文第 ${item.line} 行，${escapeHtml(item.sample)}）`).join('<br>')}`;
  box.classList.remove('hidden');
  confirmLabel.classList.toggle('hidden', blocked.length > 0);
  return blocked.length > 0;
}

async function openPublishDialog() {
  try {
    const result = await saveArticle(false);
    $('#confirmPublish').disabled = false;
    const blocked = showWarnings(result.warnings);
    $('#commitMessage').value = `docs(article): 更新《${titleFromContent(editor.value, state.currentPath)}》`;
    $('#publishLog').classList.add('hidden');
    $('#publishLog').textContent = '';
    $('#confirmPublish').disabled = blocked;
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
    if (window.parent !== window) window.parent.postMessage({ type: 'studio-published', path: state.currentPath }, location.origin);
  } catch (error) {
    let sensitiveBlocked = false;
    if (error.code === 'SENSITIVE_WARNING' || error.code === 'SENSITIVE_BLOCK') {
      sensitiveBlocked = showWarnings(error.warnings);
    }
    log.textContent = `${error.message}\n\n${error.details || ''}`.trim();
    $('#confirmPublish').disabled = sensitiveBlocked;
    $('#confirmPublish').textContent = sensitiveBlocked ? '请先修改文章' : '重试上传';
    toast(error.message, true);
  } finally {
    state.publishing = false;
    $('#cancelPublish').disabled = false;
    setDirty(false);
  }
}

function handleRichEditorChange() {
  if (suppressRichChange) return;
  cancelAnimationFrame(richChangeFrame);
  richChangeFrame = requestAnimationFrame(() => {
    // CodeMirror 直接持有 Markdown 源码，不需要回写到隐藏的 textarea
    // 只有切到源码模式时才需要同步
    if (editorMode !== 'wysiwyg') sourceEditor.value = currentEditorContent();
    refreshEditorState();
  });
}

// Toast UI's WYSIWYG mode does not ship Markdown heading input rules.
// Use its ProseMirror transaction/history API so typing and undo stay coherent.


function initializeRichEditor() {
  const CM = globalThis.CM;
  const TP = globalThis.TyporaPreview;
  if (!CM) throw new Error('CodeMirror 加载失败。');
  if (!TP) throw new Error('行内预览扩展加载失败。');

  const {
    EditorState, EditorView, keymap, history, historyKeymap, defaultKeymap,
    markdown, markdownLanguage, drawSelection, dropCursor, highlightActiveLine,
    highlightSpecialChars, highlightSelectionMatches, searchKeymap, indentWithTab,
    bracketMatching, indentOnInput, codeLanguages,
  } = CM;

  const theme = EditorView.theme({
    '&': {
      height: '100%',
      fontSize: '16px',
      backgroundColor: 'transparent',
    },
    '.cm-scroller': {
      /* 与 blogs 的 .post-body 使用同一套字体栈和行高 */
      fontFamily: '"Segoe UI", "Microsoft YaHei", "PingFang SC", system-ui, -apple-system, sans-serif',
      lineHeight: '1.85',
      padding: '24px 26px 40vh 26px',
    },
    '.cm-content': { caretColor: 'var(--accent, #33544f)' },
    '.cm-line': { padding: '0' },
    '&.cm-focused': { outline: 'none' },
    '.cm-activeLine': { backgroundColor: 'transparent' },
    '.cm-selectionBackground, ::selection': { backgroundColor: 'rgba(31, 81, 71, .14)' },
    '&.cm-focused .cm-selectionBackground': { backgroundColor: 'rgba(31, 81, 71, .18)' },
    '.cm-cursor': { borderLeftWidth: '2px' },
  });

  const state = EditorState.create({
    doc: '',
    extensions: [
      highlightSpecialChars(),
      history(),
      drawSelection(),
      dropCursor(),
      EditorState.allowMultipleSelections.of(true),
      indentOnInput(),
      bracketMatching(),
      highlightSelectionMatches(),
      highlightActiveLine(),
      markdown({ base: markdownLanguage, codeLanguages: codeLanguages || [] }),
      TP.highlight,
      TP.livePreview,
      TP.tablePreview,
      TP.parseWatch,
      TP.liveStyles,
      theme,
      keymap.of([
        // Markdown 快捷标记：与 Typora 保持一致
        {
          key: 'Mod-b',
          run: (view) => TP.toggleInlineMark(view, '**', '**', '粗体'),
        },
        {
          key: 'Mod-i',
          run: (view) => TP.toggleInlineMark(view, '*', '*', '斜体'),
        },
        {
          key: 'Mod-Shift-x',
          run: (view) => TP.toggleInlineMark(view, '~~', '~~', '删除线'),
        },
        {
          key: 'Mod-e',
          run: (view) => TP.toggleInlineMark(view, '`', '`', '代码'),
        },
        {
          key: 'Mod-k',
          run: (view) => {
            const range = view.state.selection.main;
            const text = view.state.sliceDoc(range.from, range.to) || '链接文字';
            const snippet = `[${text}](https://)`;
            view.dispatch({
              changes: { from: range.from, to: range.to, insert: snippet },
              selection: { anchor: range.from + snippet.length - 1 },
            });
            return true;
          },
        },
        // 官方 Markdown 键位：回车延续列表、列表标记上退格删除整块、
        // Ctrl+Click 打开链接等。必须排在 defaultKeymap 之前，
        // 否则 Enter 会先被 defaultKeymap 的 insertNewlineAndIndent 抢走。
        ...(Array.isArray(CM.markdownKeymap) ? CM.markdownKeymap : []),
        ...defaultKeymap,
        ...historyKeymap,
        ...searchKeymap,
        ...(Array.isArray(CM.foldKeymap) ? CM.foldKeymap : []),
        indentWithTab,
      ]),
      EditorView.lineWrapping,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) handleRichEditorChange();
      }),
      EditorView.domEventHandlers({
        paste(event, view) {
          const files = [...(event.clipboardData?.files || [])].filter((f) => f.type.startsWith('image/'));
          if (files.length) {
            event.preventDefault();
            insertImagesIntoCodeMirror(view, files);
            return true;
          }
          // 选中文字后粘贴 URL → 自动变成 Markdown 链接
          const text = event.clipboardData?.getData('text') || '';
          const range = view.state.selection.main;
          if (range.empty || !/^https?:\/\/\S+$/.test(text.trim())) return false;
          event.preventDefault();
          const label = view.state.sliceDoc(range.from, range.to);
          const snippet = `[${label}](${text.trim()})`;
          view.dispatch({
            changes: { from: range.from, to: range.to, insert: snippet },
            selection: { anchor: range.from + snippet.length },
          });
          return true;
        },
        drop(event, view) {
          const files = [...(event.dataTransfer?.files || [])].filter((f) => f.type.startsWith('image/'));
          if (!files.length) return false;
          event.preventDefault();
          insertImagesIntoCodeMirror(view, files);
          return true;
        },
      }),
    ],
  });

  const host = document.getElementById('richEditor');
  if (!host) throw new Error('找不到编辑器容器 #richEditor。');
  host.innerHTML = '';
  richEditor = new EditorView({ state, parent: host });

  // 诊断出口：浏览器控制台里执行 __CM__() 就能看到编辑器的真实状态
  window.__CM__ = () => ({
    ready: true,
    mode: editorMode,
    text: richEditor.state.doc.toString(),
    docLength: richEditor.state.doc.length,
    lines: richEditor.state.doc.lines,
    selection: richEditor.state.selection.main,
    frontMatterLength: richFrontMatter.length,
    contentPreview: richEditor.state.doc.toString().slice(0, 200),
    viewportHeight: richEditor.scrollDOM?.clientHeight ?? null,
    decorations: (() => {
      try {
        const plugin = richEditor.plugin(window.TyporaPreview.livePreview);
        return plugin ? plugin.decorations.size : 'no-plugin';
      } catch (error) { return 'error: ' + error.message; }
    })(),
    // 语法树自检：解析到底了没有、认出了多少张表
    treeLength: (() => {
      try {
        const tree = CM.ensureSyntaxTree(richEditor.state, richEditor.state.doc.length, 3000);
        return tree ? tree.length : 'null';
      } catch (error) { return 'error: ' + error.message; }
    })(),
    tablesInTree: (() => {
      try {
        const tree = CM.ensureSyntaxTree(richEditor.state, richEditor.state.doc.length, 3000) || CM.syntaxTree(richEditor.state);
        let count = 0;
        tree.iterate({ enter: (node) => { if (node.name === 'Table') count += 1; } });
        return count;
      } catch (error) { return 'error: ' + error.message; }
    })(),
  });

  // 对外的契约方法，沿用 Toast UI 的命名，调用方无需改动
  richEditor.getMarkdown = () => richEditor.state.doc.toString();
  richEditor.setMarkdown = (text) => {
    const next = String(text || '');
    if (next === richEditor.state.doc.toString()) return;
    suppressRichChange = true;
    // 整篇替换不能进撤销历史：否则打开下一篇后按 Ctrl+Z 会「撤销」回上一篇文章
    const addToHistory = CM.Transaction?.addToHistory;
    richEditor.dispatch({
      changes: { from: 0, to: richEditor.state.doc.length, insert: next },
      annotations: addToHistory ? addToHistory.of(false) : undefined,
    });
    suppressRichChange = false;
  };
  // 保存原生 focus，避免覆盖后自我递归
  const nativeFocus = EditorView.prototype.focus;
  richEditor.focus = (options) => nativeFocus.call(richEditor, options);

  // 图片插入：把上传结果写进光标位置
  function insertImagesIntoCodeMirror(view, files) {
    if (!state_currentPath()) {
      toast('请先创建或选择文章。', true);
      return;
    }
    [...files].forEach(async (file) => {
      try {
        toast(`正在保存图片：${file.name}`);
        const data = await uploadImageFile(file);
        const alt = file.name.replace(/\.[^.]+$/, '');
        const snippet = `![${alt}](${data.markdownPath})`;
        const { from, to } = view.state.selection.main;
        view.dispatch({
          changes: { from, to, insert: snippet },
          selection: { anchor: from + snippet.length },
        });
        toast('图片已插入。');
      } catch (error) {
        toast(error.message, true);
      }
    });
  }

  function state_currentPath() {
    return state.currentPath;
  }
}

// Observe rendered headings as well as editor change callbacks: toolbar changes,
// undo/redo and document replacement all update the same live outline.
let outlineObserver;
function watchArticleHeadings() {
  // CodeMirror 的内容区是 .cm-content，标题变化由编辑器更新监听统一驱动
  const root = $('#richEditor .cm-content');
  if (!root) return;
  outlineObserver?.disconnect();
  outlineObserver = new MutationObserver(scheduleArticleOutline);
  outlineObserver.observe(root, { childList: true, subtree: true, characterData: true });
}

function switchEditorMode(mode) {
  if (mode === editorMode) return;
  if (mode === 'source') {
    // 先取当前 CodeMirror 内容（含 front matter），再切到纯文本编辑
    sourceEditor.value = currentEditorContent();
    editorMode = 'source';
    $('#editingSurface').className = 'editing-surface source-mode';
    sourceEditor.focus({ preventScroll: true });
  } else {
    const parts = splitEditorDocument(sourceEditor.value);
    richFrontMatter = parts.frontMatter;
    richEditor.setMarkdown(parts.body);
    editorMode = 'wysiwyg';
    $('#editingSurface').className = 'editing-surface wysiwyg-mode';
    richEditor.focus();
  }
  document.querySelectorAll('.view-tab').forEach((item) => item.classList.toggle('active', item.dataset.view === mode));
  refreshEditorState();
}

async function init() {
  // 被管理中心以 iframe 内嵌时（?embed=1），压扁顶栏、去掉文章列表。
  // 必须放在最前面：未登录时 init 会提前 return，放后面就永远加不上这个类。
  if (new URLSearchParams(location.search).get('embed') === '1') {
    document.body.classList.add('embed-mode');
    // 与管理中心集成：卡片头统一触发保存/上传（iframe 内不再重复旧顶栏）
    window.addEventListener('message', (event) => {
      if (event.origin !== location.origin) return;
      const data = event.data || {};
      if (data.type === 'studio-save') saveArticle().catch((error) => toast(error.message, true));
      if (data.type === 'studio-publish') openPublishDialog();
    });
    window.parent.postMessage({ type: 'studio-ready' }, location.origin);
  }
  try {
    const config = await api('/api/config');
    state.authMode = config.authMode || 'local';
    state.token = config.token || '';
    state.authenticated = config.authenticated !== false;
    state.identity = config.identity;
    state.autoSaveMinutes = config.settings?.autoSaveMinutes || 3;
    if (config.totpEnabled) {
      $('#loginTotpLabel').hidden = false;
      $('#loginTotp').hidden = false;
    }
    if (state.authMode === 'password' && !state.authenticated) {
      $('#identityState').textContent = '需要登录';
      showLoginDialog();
      return;
    }
    $('#identityState').textContent = config.identity?.email || (config.authMode === 'cloudflare' ? '已安全登录' : '本地模式');
    await loadArticles();
    // 从管理中心跳过来时带着 ?path=，直接打开对应文章
    const deepLink = new URLSearchParams(location.search).get('path');
    if (deepLink && state.authenticated) {
      try {
        await selectArticle(deepLink);
        return;
      } catch (error) {
        // 文章可能刚被删掉，先把列表刷成真实状态，再说人话。Round 45
        const gone = /不存在/.test(error.message || '');
        toast(gone ? '这篇文章已经不在了（可能刚被删除），列表已刷新。' : `打开文章失败：${error.message}`, true);
        await loadArticles().catch(() => {});
      }
    }
  } catch (error) {
    toast(`无法连接本地后台：${error.message}`, true);
  }
  // Round 65：空状态初始隐藏，等初始化结束再决定是否显示，
  // 避免「点编辑 → 先闪一下空状态 → 正文才出来」的观感。
  $('#emptyState').classList.remove('hidden');
}

function openSettingsDialog() {
  $('#autoSaveMinutes').value = state.autoSaveMinutes;
  $('#settingsDialog').showModal();
  $('#autoSaveMinutes').focus();
  $('#autoSaveMinutes').select();
}

function linesFrom(value) {
  return [...new Set(String(value || '').split(/\r?\n/).map((item) => item.trim()).filter(Boolean))];
}

function updatePrivateDocumentCount() {
  $('#privateDocumentCount').textContent = `${state.privateIncluded.size} / ${state.siyuanDocuments.length} 篇展示`;
}

function buildDocumentTree(documents) {
  const root = { name: '', path: '', children: new Map(), doc: null };
  for (const doc of documents) {
    const parts = doc.path.replace(/\.md$/i, '').split('/').filter(Boolean);
    let node = root;
    let acc = '';
    for (const part of parts) {
      acc = acc ? `${acc}/${part}` : part;
      if (!node.children.has(part)) {
        node.children.set(part, { name: part, path: acc, children: new Map(), doc: null });
      }
      node = node.children.get(part);
    }
    node.doc = doc;
  }
  return root;
}

function collectDocPaths(node) {
  const paths = node.doc ? [node.doc.path] : [];
  for (const child of node.children.values()) paths.push(...collectDocPaths(child));
  return paths;
}

function findTreeNode(node, path) {
  if (!node) return null;
  if (node.path === path) return node;
  for (const child of node.children.values()) {
    const found = findTreeNode(child, path);
    if (found) return found;
  }
  return null;
}

function renderTreeNode(node, depth, container) {
  const children = [...node.children.values()].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
  for (const child of children) {
    const docPaths = collectDocPaths(child);
    const included = docPaths.filter((item) => state.privateIncluded.has(item)).length;
    const hasChildren = child.children.size > 0;

    const row = document.createElement('div');
    row.className = 'tree-row';
    row.style.paddingLeft = `${10 + depth * 18}px`;

    if (hasChildren) {
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'tree-toggle';
      toggle.dataset.treeToggle = child.path;
      toggle.setAttribute('aria-expanded', String(!state.collapsed.has(child.path)));
      toggle.textContent = state.collapsed.has(child.path) ? '▸' : '▾';
      row.append(toggle);
    } else {
      const spacer = document.createElement('span');
      spacer.className = 'tree-spacer';
      row.append(spacer);
    }

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.dataset.treeCheck = child.path;
    checkbox.checked = docPaths.length > 0 && included === docPaths.length;
    checkbox.indeterminate = included > 0 && included < docPaths.length;
    row.append(checkbox);

    const label = document.createElement('span');
    label.className = hasChildren ? 'tree-label tree-folder' : 'tree-label';
    label.textContent = child.doc ? child.doc.title : child.name;
    label.title = child.doc ? child.doc.path : child.path;
    row.append(label);

    const count = document.createElement('small');
    count.className = 'tree-count';
    count.textContent = `${included}/${docPaths.length}`;
    row.append(count);

    container.append(row);

    if (hasChildren && !state.collapsed.has(child.path)) {
      renderTreeNode(child, depth + 1, container);
    }
  }
}

function renderPrivateDocumentList() {
  const query = $('#privateDocumentSearch').value.trim().toLowerCase();
  const documents = state.siyuanDocuments.filter((item) => `${item.title} ${item.path}`.toLowerCase().includes(query));
  const list = $('#privateDocumentList');
  list.replaceChildren();
  if (documents.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'local-note';
    empty.textContent = query ? '没有匹配的文档。' : '没有找到可选择的文档，可在下方手动填写路径。';
    list.append(empty);
    updatePrivateDocumentCount();
    return;
  }
  state.documentTree = buildDocumentTree(documents);
  renderTreeNode(state.documentTree, 0, list);
  updatePrivateDocumentCount();
}

$('#privateDocumentList').addEventListener('change', (event) => {
  const checkbox = event.target.closest('[data-tree-check]');
  if (!checkbox) return;
  const node = findTreeNode(state.documentTree, checkbox.dataset.treeCheck);
  if (!node) return;
  const docPaths = collectDocPaths(node);
  if (checkbox.checked) docPaths.forEach((item) => state.privateIncluded.add(item));
  else docPaths.forEach((item) => state.privateIncluded.delete(item));
  renderPrivateDocumentList();
});

$('#privateDocumentList').addEventListener('click', (event) => {
  const toggle = event.target.closest('[data-tree-toggle]');
  if (!toggle) return;
  const path = toggle.dataset.treeToggle;
  if (state.collapsed.has(path)) state.collapsed.delete(path);
  else state.collapsed.add(path);
  renderPrivateDocumentList();
});

async function openSiyuanPrivacyDialog() {
  try {
    const data = await api('/api/siyuan-privacy');
    state.siyuanDocuments = data.documents || [];
    const known = new Set(state.siyuanDocuments.map((item) => item.path));
    const excluded = new Set(data.rules?.excludedDocuments || []);
    state.privateIncluded = new Set(
      state.siyuanDocuments.filter((item) => !excluded.has(item.path)).map((item) => item.path),
    );
    $('#manualPrivateDocuments').value = (data.rules?.excludedDocuments || []).filter((item) => !known.has(item)).join('\n');
    $('#privateValues').value = (data.rules?.privateValues || []).join('\n');
    $('#privateDocumentSearch').value = '';
    state.collapsed = new Set();
    renderPrivateDocumentList();
    $('#siyuanPrivacyDialog').showModal();
  } catch (error) { toast(`无法读取思源隐私规则：${error.message}`, true); }
}

async function saveSiyuanPrivacy(event) {
  event.preventDefault();
  try {
    const manualExcluded = linesFrom($('#manualPrivateDocuments').value);
    const excludedDocuments = [...new Set([
      ...state.siyuanDocuments
        .filter((item) => !state.privateIncluded.has(item.path))
        .map((item) => item.path),
      ...manualExcluded,
    ])];
    const privateValues = linesFrom($('#privateValues').value);
    const data = await api('/api/siyuan-privacy', {
      method: 'POST', body: JSON.stringify({ excludedDocuments, privateValues }),
    });
    $('#siyuanPrivacyDialog').close();
    if (data.republish?.started) {
      toast('隐私规则已保存，正在重新导入、构建并发布…');
      setTimeout(pollRepublishStatus, 3000);
    } else {
      toast(`隐私规则已保存：排除 ${data.rules.excludedDocuments.length} 篇文档（已有发布任务在运行，稍后自动重试）`);
    }
  } catch (error) { toast(error.message, true); }
}

async function pollRepublishStatus() {
  try {
    const data = await api('/api/siyuan-privacy/status');
    const task = data.republish || {};
    if (task.running) {
      setTimeout(pollRepublishStatus, 3000);
      return;
    }
    if (task.ok === true) toast(`笔记已重新发布：${task.message}`);
    else if (task.ok === false) toast(`发布失败：${task.message}`, true);
  } catch {
    setTimeout(pollRepublishStatus, 5000);
  }
}

async function saveSettings(event) {
  event.preventDefault();
  try {
    const data = await api('/api/settings', {
      method: 'POST',
      body: JSON.stringify({ autoSaveMinutes: Number($('#autoSaveMinutes').value) }),
    });
    state.autoSaveMinutes = data.settings.autoSaveMinutes;
    clearAutoSaveTimer();
    if (state.dirty) scheduleAutoSave();
    setDirty(state.dirty);
    $('#settingsDialog').close();
    toast(`自动保存间隔已设置为 ${state.autoSaveMinutes} 分钟`);
  } catch (error) { toast(error.message, true); }
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
    // 自维护的撤销栈只记录工具栏/元数据这类操作，普通打字并不入栈。
    // 栈里没东西时必须放行，否则会吞掉按键又拦掉浏览器原生撤销，等于完全失效。
    const available = event.shiftKey ? state.redoStack.length : state.undoStack.length;
    if (!available) return;
    event.preventDefault();
    if (event.shiftKey) redoEditorEdit();
    else undoEditorEdit();
    return;
  }
  if (modifier && !event.altKey && key === 'y') {
    if (!state.redoStack.length) return;
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
document.querySelectorAll('.editor-toolbar button').forEach((button) => {
  // 按下时不让编辑器失焦，否则插入位置会跳走
  button.addEventListener('mousedown', (event) => event.preventDefault());
  button.addEventListener('click', () => {
    if (button.dataset.wrap) replaceSelection(button.dataset.wrap);
    else if (button.dataset.prefix) prefixLines(button.dataset.prefix);
    else if (button.dataset.action === 'link') replaceSelection('[', '](https://)', '链接文字');
    else if (button.dataset.action === 'divider') insertDivider();
    else if (button.dataset.action === 'table') insertTable();
    else if (button.dataset.action === 'tasklist') insertTaskList();
    else if (button.dataset.action === 'codeblock') insertCodeBlock();
  });
});

/** 插入围栏代码块；有选中内容时把选中的内容包进去，并把光标放到代码区里。 */
function insertCodeBlock() {
  const start = editor.selectionStart;
  const end = editor.selectionEnd;
  const selected = editor.value.slice(start, end);

  if (selected) {
    const replacement = `\`\`\`\n${selected}\n\`\`\``;
    applyUndoableEdit(start, end, replacement, start + 4, start + 4 + selected.length);
  } else {
    applyUndoableEdit(start, end, '\`\`\`\n\n\`\`\`', start + 4);
  }
}
document.querySelectorAll('.view-tab').forEach((button) => button.addEventListener('click', () => switchEditorMode(button.dataset.view)));

// 窗口尺寸变化、侧栏折叠等都会改变编辑器可用宽度，需要重新测量换行
window.addEventListener('resize', () => {
  if (richEditor && typeof richEditor.requestMeasure === 'function') {
    richEditor.requestMeasure();
  }
});
$('#imageInput').addEventListener('change', (event) => { insertImages(event.target.files); event.target.value = ''; });
$('#searchInput').addEventListener('input', () => { syncSearchClear(); renderList(); });

function syncSearchClear() {
  const button = $('#searchClear');
  if (button) button.hidden = !$('#searchInput').value;
}

$('#searchClear').addEventListener('click', (event) => {
  event.preventDefault();
  event.stopPropagation();
  const input = $('#searchInput');
  input.value = '';
  syncSearchClear();
  renderList();
  input.focus();
});
$('#newButton').addEventListener('click', openNewDialog);
$('#emptyNewButton').addEventListener('click', openNewDialog);
$('#newTitle').addEventListener('input', () => { if (!$('#newSlug').dataset.edited) $('#newSlug').value = slugify($('#newTitle').value); });
$('#newSlug').addEventListener('input', () => { $('#newSlug').dataset.edited = 'true'; });
$('#newForm').addEventListener('submit', createArticle);
$('#cancelCreate').addEventListener('click', () => $('#newDialog').close());
$('#saveButton').addEventListener('click', () => saveArticle().catch((error) => toast(error.message, true)));
$('#publishButton').addEventListener('click', openPublishDialog);
$('#metadataButton').addEventListener('click', openMetadataDialog);
$('#metadataForm').addEventListener('submit', updateArticleMetadata);
$('#cancelMetadata').addEventListener('click', () => $('#metadataDialog').close());
document.addEventListener('selectionchange', updateCursorPosition);
$('#deleteArticleButton').addEventListener('click', deleteArticle);
// Close only when a primary-button gesture starts and ends on the backdrop.
// Dragging a selection out of an input must not dismiss the form.
{
  const dialog = $('#metadataDialog');
  let backdropPointer = null;
  const outside = (event) => {
    const rect = dialog.getBoundingClientRect();
    return event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom);
  };
  dialog.addEventListener('pointerdown', (event) => {
    backdropPointer = event.button === 0 && outside(event) ? event.pointerId : null;
  });
  dialog.addEventListener('pointerup', (event) => {
    if (event.button === 0 && event.pointerId === backdropPointer && outside(event)) dialog.close();
    backdropPointer = null;
  });
  dialog.addEventListener('pointercancel', () => { backdropPointer = null; });
  dialog.addEventListener('close', () => { backdropPointer = null; });
}
document.querySelectorAll('[data-now-target]').forEach((button) => button.addEventListener('click', () => {
  $(`#${button.dataset.nowTarget}`).value = articleMetadata.currentLocalDateTime();
}));
const renameButton = $('#renameButton');
if (renameButton) renameButton.addEventListener('click', openRenameDialog);
$('#openRenameFromMetadata').addEventListener('click', () => {
  $('#metadataDialog').close();
  openRenameDialog();
});
$('#renameForm').addEventListener('submit', renameArticle);
$('#cancelRename').addEventListener('click', () => $('#renameDialog').close());
$('#publishForm').addEventListener('submit', publishArticle);
$('#cancelPublish').addEventListener('click', () => $('#publishDialog').close());
$('#settingsButton').addEventListener('click', openSettingsDialog);
$('#settingsForm').addEventListener('submit', saveSettings);
$('#cancelSettings').addEventListener('click', () => $('#settingsDialog').close());
$('#loginForm').addEventListener('submit', login);
document.querySelectorAll('[data-autosave-minutes]').forEach((button) => button.addEventListener('click', () => {
  $('#autoSaveMinutes').value = button.dataset.autosaveMinutes;
}));
$('#siyuanPrivacyButton').addEventListener('click', openSiyuanPrivacyDialog);
$('#siyuanPrivacyForm').addEventListener('submit', saveSiyuanPrivacy);
$('#closeSiyuanPrivacy').addEventListener('click', () => $('#siyuanPrivacyDialog').close());
$('#cancelSiyuanPrivacy').addEventListener('click', () => $('#siyuanPrivacyDialog').close());
$('#privateDocumentSearch').addEventListener('input', renderPrivateDocumentList);
$('#privateSelectAll').addEventListener('click', () => {
  state.privateIncluded = new Set(state.siyuanDocuments.map((item) => item.path));
  renderPrivateDocumentList();
});
$('#privateSelectNone').addEventListener('click', () => {
  state.privateIncluded = new Set();
  renderPrivateDocumentList();
});
$('#manualPrivateDocuments').addEventListener('input', updatePrivateDocumentCount);
$('#markdownHelpButton').addEventListener('click', () => $('#markdownHelpDialog').showModal());
$('#closeMarkdownHelp').addEventListener('click', () => $('#markdownHelpDialog').close());
$('#mobileMenuButton').addEventListener('click', () => document.body.classList.contains('article-panel-open') ? closeArticlePanel() : openArticlePanel());
$('#panelBackdrop').addEventListener('click', closeArticlePanel);
$('#closePanelButton').addEventListener('click', closeArticlePanel);
window.addEventListener('beforeunload', (event) => { if (state.dirty) { event.preventDefault(); event.returnValue = ''; } });
try {
  initializeRichEditor();
  watchArticleHeadings();
  init();
} catch (error) {
  // 编辑器起不来时给出显眼提示，避免只剩一个空白区域
  const host = document.getElementById('richEditor');
  if (host) {
    host.innerHTML = '<div style="padding:32px;color:#b91c1c;font-family:monospace;white-space:pre-wrap;">'
      + '编辑器初始化失败：\n' + String(error && error.stack || error)
      + '</div>';
  }
  toast(error.message, true);
  console.error('[article-studio] 编辑器初始化失败', error);
}
