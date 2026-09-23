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
  siyuanDocuments: [], privateSelected: new Set(),
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
  const match = text.match(/^---\s*\r?\n[\s\S]*?\r?\n---\s*(?:\r?\n|$)/);
  return match ? { frontMatter: match[0], body: text.slice(match[0].length) } : { frontMatter: '', body: text };
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

const editor = {
  get value() { return currentEditorContent(); },
  set value(value) { setEditorContent(value); },
  get selectionStart() { return sourceEditor.selectionStart; },
  get selectionEnd() { return sourceEditor.selectionEnd; },
  setSelectionRange(...args) { sourceEditor.setSelectionRange(...args); },
  setRangeText(...args) { sourceEditor.setRangeText(...args); },
  focus(options) { if (editorMode === 'wysiwyg' && richEditor) richEditor.focus(); else sourceEditor.focus(options); },
  addEventListener(...args) { sourceEditor.addEventListener(...args); },
};
const articleMetadata = globalThis.ArticleMetadata;
const AUTO_SAVE_RETRY_MS = 60 * 1000;

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body) headers['Content-Type'] = 'application/json';
  if (state.accessKey) headers['X-Article-Studio-Key'] = state.accessKey;
  if (options.method && options.method !== 'GET') headers['X-Article-Studio-Token'] = state.token;
  const response = await fetch(path, { ...options, headers });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401 && state.authMode === 'password' && path !== '/api/login') showLoginDialog();
    const error = new Error(data.message || '操作失败');
    Object.assign(error, data);
    throw error;
  }
  return data;
}

function showLoginDialog() {
  const dialog = $('#loginDialog');
  if (!dialog || dialog.open) return;
  $('#loginPassword').value = '';
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
    const result = await api('/api/login', { method: 'POST', body: JSON.stringify({ password }) });
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

function renderPreview() {
  const content = editor.value;
  const raw = stripFrontMatter(content);
  $('#wordCount').textContent = `${raw.replace(/\s/g, '').length} 字`;
  $('#documentTitle').textContent = titleFromContent(content, state.currentPath);
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

function storeDraftSoon() {
  clearTimeout(state.draftTimer);
  if (!state.currentPath) return;
  state.draftTimer = setTimeout(() => {
    try {
      localStorage.setItem(draftKey(state.currentPath), JSON.stringify({
        content: editor.value, savedAt: new Date().toISOString(),
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

function renderList() {
  const list = $('#articleList');
  const oldScroll = list.scrollTop;
  const query = $('#searchInput').value.trim().toLowerCase();
  const articles = state.articles.filter((item) => `${item.title} ${item.path}`.toLowerCase().includes(query));
  list.innerHTML = articles.length ? articles.map((item) => `
    <div class="article-row" data-path="${escapeHtml(item.path)}">
    <button class="article-item ${item.path === state.currentPath ? 'active' : ''}" data-path="${escapeHtml(item.path)}" title="右键编辑文章信息">
      <strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.path)}</small>
    </button><button type="button" class="article-more" aria-label="编辑 ${escapeHtml(item.title)} 的文章信息" title="文章信息">⋯</button></div>`).join('') : '<div class="local-note">没有找到文章。</div>';
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
  scheduleArticleOutline();
  renderPreview();
  updateCursor();
  setDirty(editor.value !== state.content);
  if (editor.value !== state.content) storeDraftSoon();
}

let outlineTimer;
let outlineEntries = [];
let outlineActiveButton = null;
let outlineScrollFrame;
function syncArticleOutline() {
  const nav = $('#articleOutline');
  const container = editorMode === 'wysiwyg' ? $('#richEditor .toastui-editor-ww-container .ProseMirror') : sourceEditor;
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
  if (event.target !== sourceEditor && !event.target.matches?.('#richEditor .toastui-editor-ww-container .ProseMirror')) return;
  if (outlineScrollFrame) return;
  outlineScrollFrame = requestAnimationFrame(() => { outlineScrollFrame = null; syncArticleOutline(); });
}, true);
function scheduleArticleOutline() {
  clearTimeout(outlineTimer);
  outlineTimer = setTimeout(renderArticleOutline, 120);
}

function renderArticleOutline() {
  const nav = $('#articleOutline');
  if (!nav) return;
  let headings;
  if (editorMode === 'wysiwyg') {
    headings = [...document.querySelectorAll('#richEditor .toastui-editor-ww-container .ProseMirror h1, #richEditor .toastui-editor-ww-container .ProseMirror h2, #richEditor .toastui-editor-ww-container .ProseMirror h3, #richEditor .toastui-editor-ww-container .ProseMirror h4, #richEditor .toastui-editor-ww-container .ProseMirror h5, #richEditor .toastui-editor-ww-container .ProseMirror h6')].map((node) => ({ title: node.textContent, level: Number(node.tagName[1]), node }));
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
      if (heading.node) {
        const container = heading.node.closest('.ProseMirror');
        container.scrollTop += heading.node.getBoundingClientRect().top - container.getBoundingClientRect().top - 20;
        syncArticleOutline();
      } else {
        sourceEditor.focus(); sourceEditor.setSelectionRange(heading.offset, heading.offset);
        const line = sourceEditor.value.slice(0, heading.offset).split('\n').length - 1;
        sourceEditor.scrollTop = Math.max(0, line * parseFloat(getComputedStyle(sourceEditor).lineHeight) - 40);
        updateCursor();
      }
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
    sourceEditor.value = currentEditorContent();
    refreshEditorState();
  });
}

// Toast UI's WYSIWYG mode does not ship Markdown heading input rules.
// Use its ProseMirror transaction/history API so typing and undo stay coherent.
function markdownHeadingInputPlugin({ pmRules, pmKeymap, pmState }) {
  const { InputRule, inputRules, undoInputRule } = pmRules;
  const inlineRule = (pattern, markName) => new InputRule(pattern, (state, match, start, end) => {
    if (!state.selection.empty) return null;
    const prefix = match[1] || '';
    const text = match[2];
    const from = start + prefix.length;
    const mark = state.schema.marks[markName];
    if (!mark || !text || text.includes('\n')) return null;
    const tr = state.tr.insertText(text, from, end);
    tr.addMark(from, from + text.length, mark.create());
    tr.removeStoredMark(mark);
    return tr;
  });
  const linkRule = (pattern, automatic = false) => new InputRule(pattern, (state, match, start, end) => {
    if (!state.selection.empty) return null;
    const prefix = match[1] || '', label = match[2], url = automatic ? label : match[3];
    if (!/^(?:https?:\/\/|mailto:|\/(?!\/)|#)/i.test(url)) return null;
    const from = start + prefix.length, mark = state.schema.marks.link;
    if (!mark) return null;
    return state.tr.insertText(label, from, end).addMark(from, from + label.length, mark.create({ linkUrl: url })).removeStoredMark(mark);
  });
  const listRule = new InputRule(/^(?:([-+*]) |(\d{1,9})\. )$/, (state, match, start, end) => {
    const { $from, empty } = state.selection;
    if (!empty || $from.parent.type.name !== 'paragraph') return null;
    const n = state.schema.nodes;
    const type = match[2] ? n.orderedList : n.bulletList;
    const parent = $from.node($from.depth - 1), index = $from.index($from.depth - 1);
    if (!parent.canReplaceWith(index, index + 1, type)) return null;
    const paragraph = n.paragraph.create(null, $from.parent.content.cut(end - $from.start()));
    const list = type.create(match[2] ? { order: Number(match[2]) } : null, n.listItem.create(null, paragraph));
    const from = $from.before();
    const tr = state.tr.replaceWith(from, $from.after(), list);
    return tr.setSelection(pmState.TextSelection.create(tr.doc, from + 3));
  });
  const taskRule = new InputRule(/^\[([ xX])\] $/, (state, match, start, end) => {
    const { $from } = state.selection;
    if (!state.selection.empty || $from.parent.type.name !== 'paragraph') return null;
    if ($from.depth < 2 || $from.node($from.depth - 1).type.name !== 'listItem') return null;
    const item = $from.node($from.depth - 1);
    return state.tr.delete(start, end).setNodeMarkup($from.before($from.depth - 1), null, { ...item.attrs, task: true, checked: match[1].toLowerCase() === 'x' });
  });
  const codeRule = new InputRule(/^(```|~~~)([\w+-]*) $/, (state, match, start, end) => {
    const { $from } = state.selection;
    const type = state.schema.nodes.codeBlock;
    if (!state.selection.empty || $from.parent.type.name !== 'paragraph' || $from.parentOffset !== $from.parent.content.size) return null;
    if (!$from.node($from.depth - 1).canReplaceWith($from.index($from.depth - 1), $from.index($from.depth - 1) + 1, type)) return null;
    return state.tr.delete(start, end).setBlockType(start, start, type, { language: match[2] || null });
  });
  const blockRule = (pattern, quote) => new InputRule(pattern, (state, match, start, end) => {
    const { $from, empty } = state.selection;
    if (!empty || $from.parent.type.name !== 'paragraph') return null;
    const { paragraph, blockQuote, thematicBreak } = state.schema.nodes;
    const from = $from.before(), to = $from.after();
    const rest = $from.parent.content.cut(end - $from.start());
    const text = paragraph.create(null, rest);
    const nodes = quote ? [blockQuote.create(null, text)] : [thematicBreak.create(), text];
    const parent = $from.node($from.depth - 1), index = $from.index($from.depth - 1);
    if (!parent.canReplaceWith(index, index + 1, nodes[0].type)) return null;
    const tr = state.tr.replaceWith(from, to, nodes);
    return tr.setSelection(pmState.TextSelection.create(tr.doc, from + (quote ? 2 : nodes[0].nodeSize + 1)));
  });
  return {
    wysiwygPlugins: [
      () => inputRules({ rules: [new InputRule(/^(#{1,6}) $/, (state, match, start, end) => {
        const { $from, empty } = state.selection;
        const heading = state.schema.nodes.heading;
        if (!empty || $from.parent.type.name !== 'paragraph' || !heading) return null;
        const parent = $from.node($from.depth - 1);
        const index = $from.index($from.depth - 1);
        if (!parent.canReplaceWith(index, index + 1, heading)) return null;
        return state.tr.delete(start, end).setBlockType(start, start, heading, {
          level: match[1].length,
        });
      }), blockRule(/^> $/, true), blockRule(/^(?:\*\*\*|---|___) $/, false), listRule, taskRule, codeRule,
      inlineRule(/(^|[^\\*])\*\*([^*]+)\*\*$/, 'strong'),
      inlineRule(/(^|[^\\_\w])__([^_]+)__$/, 'strong'),
      inlineRule(/(^|[^\\*])\*([^*]+)\*$/, 'emph'),
      inlineRule(/(^|[^\\_\w])_([^_]+)_$/, 'emph'),
      inlineRule(/(^|[^\\~])~~([^~]+)~~$/, 'strike'),
      inlineRule(/(^|[^\\`])`([^`]+)`$/, 'code'),
      linkRule(/(^|[^\\!])\[([^\]\n]+)\]\(([^\s()]+)\)$/),
      linkRule(/(^|[^\\])<(https?:\/\/[^<>\s]+)>$/, true)
      ] }),
      () => new pmState.Plugin({ props: { handleKeyDown(view, event) {
        if (event.key !== 'Enter' || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey || view.composing) return false;
        const { $from, empty } = view.state.selection;
        if (!empty || $from.parent.type.name !== 'paragraph' || !/^(?:```|~~~)[\w+-]*$/.test($from.parent.textContent)) return false;
        return view.someProp('handleTextInput', handler => handler(view, $from.pos, $from.pos, ' ')) || false;
      } } }),
      () => pmKeymap.keymap({ Backspace: undoInputRule }),
    ],
  };
}

function bottomWritingSpacePlugin({ pmState }) {
  return { wysiwygPlugins: [() => new pmState.Plugin({
    props: { handleDOMEvents: { click(view, event) {
      if (event.button !== 0 || event.target !== view.dom || view.composing || !view.editable) return false;
      const lastElement = view.dom.lastElementChild;
      if (!lastElement || event.clientY <= lastElement.getBoundingClientRect().bottom) return false;
      const { doc, schema } = view.state;
      const last = doc.lastChild;
      if (!last) return false;
      const tr = view.state.tr;
      let position;
      if (last.type === schema.nodes.paragraph && last.content.size === 0) {
        position = doc.content.size - last.nodeSize + 1;
      } else {
        const paragraph = schema.nodes.paragraph.createAndFill();
        if (!paragraph || !doc.canReplaceWith(doc.childCount, doc.childCount, paragraph.type)) return false;
        position = doc.content.size + 1;
        tr.insert(doc.content.size, paragraph);
      }
      tr.setSelection(pmState.TextSelection.create(tr.doc, position));
      view.dispatch(tr.scrollIntoView());
      view.focus();
      event.preventDefault();
      return true;
    } } },
  })] };
}

function initializeRichEditor() {
  if (!globalThis.toastui?.Editor) throw new Error('所见即所得编辑器加载失败。');
  richEditor = new globalThis.toastui.Editor({
    el: $('#richEditor'),
    height: '100%',
    initialValue: '',
    initialEditType: 'wysiwyg',
    previewStyle: 'tab',
    hideModeSwitch: true,
    autofocus: false,
    usageStatistics: false,
    plugins: [markdownHeadingInputPlugin, bottomWritingSpacePlugin],
    language: 'zh-CN',
    toolbarItems: [
      ['heading', 'bold', 'italic', 'strike'],
      ['hr', 'quote'],
      ['ul', 'ol', 'task', 'indent', 'outdent'],
      ['table', 'image', 'link'],
      ['code', 'codeblock'],
    ],
    events: { change: handleRichEditorChange },
    hooks: {
      addImageBlobHook(blob, callback) {
        if (!state.currentPath) {
          toast('请先创建或选择文章。', true);
          return false;
        }
        toast(`正在保存图片：${blob.name || '粘贴的图片'}`);
        uploadImageFile(blob).then((data) => {
          callback(data.markdownPath, (blob.name || '图片').replace(/\.[^.]+$/, ''));
          toast('图片已插入。');
        }).catch((error) => toast(error.message, true));
        return false;
      },
    },
  });
}

// Observe rendered headings as well as editor change callbacks: toolbar changes,
// undo/redo and document replacement all update the same live outline.
let outlineObserver;
function watchArticleHeadings() {
  const root = $('#richEditor .toastui-editor-ww-container .ProseMirror');
  if (!root) return;
  outlineObserver?.disconnect();
  outlineObserver = new MutationObserver(scheduleArticleOutline);
  outlineObserver.observe(root, { childList: true, subtree: true, characterData: true });
}

function switchEditorMode(mode) {
  if (mode === editorMode) return;
  if (mode === 'source') {
    sourceEditor.value = currentEditorContent();
    editorMode = 'source';
    $('#editingSurface').className = 'editing-surface source-mode';
    sourceEditor.focus({ preventScroll: true });
  } else {
    const parts = splitEditorDocument(sourceEditor.value);
    richFrontMatter = parts.frontMatter;
    suppressRichChange = true;
    richEditor.setMarkdown(parts.body, false);
    suppressRichChange = false;
    editorMode = 'wysiwyg';
    $('#editingSurface').className = 'editing-surface wysiwyg-mode';
    richEditor.focus();
  }
  document.querySelectorAll('.view-tab').forEach((item) => item.classList.toggle('active', item.dataset.view === mode));
  refreshEditorState();
}

async function init() {
  try {
    const config = await api('/api/config');
    state.authMode = config.authMode || 'local';
    state.token = config.token || '';
    state.authenticated = config.authenticated !== false;
    state.identity = config.identity;
    state.autoSaveMinutes = config.settings?.autoSaveMinutes || 3;
    if (state.authMode === 'password' && !state.authenticated) {
      $('#identityState').textContent = '需要登录';
      showLoginDialog();
      return;
    }
    $('#identityState').textContent = config.identity?.email || (config.authMode === 'cloudflare' ? '已安全登录' : '本地模式');
    await loadArticles();
  } catch (error) {
    toast(`无法连接本地后台：${error.message}`, true);
  }
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
  const manual = linesFrom($('#manualPrivateDocuments').value);
  $('#privateDocumentCount').textContent = `${new Set([...state.privateSelected, ...manual]).size} 篇`;
}

function renderPrivateDocumentList() {
  const query = $('#privateDocumentSearch').value.trim().toLowerCase();
  const documents = state.siyuanDocuments.filter((item) => `${item.title} ${item.path}`.toLowerCase().includes(query));
  const list = $('#privateDocumentList');
  list.innerHTML = documents.length ? documents.map((item) => `
    <label class="private-document-item">
      <input type="checkbox" data-private-document="${escapeHtml(item.path)}" ${state.privateSelected.has(item.path) ? 'checked' : ''}>
      <span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.path)}</small></span>
    </label>`).join('') : '<div class="local-note">没有找到可选择的文档，可在下方手动填写路径。</div>';
  list.querySelectorAll('[data-private-document]').forEach((checkbox) => checkbox.addEventListener('change', () => {
    if (checkbox.checked) state.privateSelected.add(checkbox.dataset.privateDocument);
    else state.privateSelected.delete(checkbox.dataset.privateDocument);
    updatePrivateDocumentCount();
  }));
  updatePrivateDocumentCount();
}

async function openSiyuanPrivacyDialog() {
  try {
    const data = await api('/api/siyuan-privacy');
    state.siyuanDocuments = data.documents || [];
    const known = new Set(state.siyuanDocuments.map((item) => item.path));
    state.privateSelected = new Set((data.rules?.excludedDocuments || []).filter((item) => known.has(item)));
    $('#manualPrivateDocuments').value = (data.rules?.excludedDocuments || []).filter((item) => !known.has(item)).join('\n');
    $('#privateValues').value = (data.rules?.privateValues || []).join('\n');
    $('#privateDocumentSearch').value = '';
    renderPrivateDocumentList();
    $('#siyuanPrivacyDialog').showModal();
  } catch (error) { toast(`无法读取思源隐私规则：${error.message}`, true); }
}

async function saveSiyuanPrivacy(event) {
  event.preventDefault();
  try {
    const excludedDocuments = [...new Set([...state.privateSelected, ...linesFrom($('#manualPrivateDocuments').value)])];
    const privateValues = linesFrom($('#privateValues').value);
    const data = await api('/api/siyuan-privacy', {
      method: 'POST', body: JSON.stringify({ excludedDocuments, privateValues }),
    });
    $('#siyuanPrivacyDialog').close();
    toast(`隐私规则已保存：排除 ${data.rules.excludedDocuments.length} 篇文档，遮盖 ${data.rules.privateValues.length} 个值`);
  } catch (error) { toast(error.message, true); }
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
    else if (button.dataset.action === 'divider') insertDivider();
  });
});
document.querySelectorAll('.view-tab').forEach((button) => button.addEventListener('click', () => switchEditorMode(button.dataset.view)));
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
$('#metadataButton').addEventListener('click', openMetadataDialog);
$('#metadataForm').addEventListener('submit', updateArticleMetadata);
$('#cancelMetadata').addEventListener('click', () => $('#metadataDialog').close());
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
$('#renameButton').addEventListener('click', openRenameDialog);
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
  toast(error.message, true);
}
