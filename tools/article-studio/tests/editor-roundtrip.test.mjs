/**
 * 零损失往返验证：真实 Markdown 文件经过 CodeMirror 后必须字节级一致。
 *
 * 这直接对应「打开文章不改、保存后 git diff 应该为空」这一核心要求。
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { EditorState } from '../../../node_modules/@codemirror/state/dist/index.js';
import { markdown, markdownLanguage } from '../../../node_modules/@codemirror/lang-markdown/dist/index.js';

const POSTS = new URL('../../../source/_posts', import.meta.url).pathname;

function splitEditorDocument(value) {
  const text = String(value || '');
  const match = text.match(/^---\s*\r?\n[\s\S]*?\r?\n---\s*(?:\r?\n|$)/);
  return match
    ? { frontMatter: match[0], body: text.slice(match[0].length) }
    : { frontMatter: '', body: text };
}

function collect(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) collect(full, out);
    else if (entry.endsWith('.md')) out.push(full);
  }
  return out;
}

const files = collect(POSTS);
console.log('待测文章数:', files.length);
console.log();

let pass = 0;
let fail = 0;
const failures = [];

for (const file of files) {
  const original = readFileSync(file, 'utf8');
  const parts = splitEditorDocument(original);

  // 模拟：载入编辑器 → getMarkdown() 取回
  const state = EditorState.create({
    doc: parts.body,
    extensions: [markdown({ base: markdownLanguage })],
  });
  const roundTripped = parts.frontMatter + state.doc.toString();

  if (roundTripped === original) {
    pass += 1;
  } else {
    fail += 1;
    const a = original;
    const b = roundTripped;
    let firstDiff = 0;
    while (firstDiff < Math.min(a.length, b.length) && a[firstDiff] === b[firstDiff]) firstDiff += 1;
    failures.push({
      file: path.relative(POSTS, file),
      origLen: a.length,
      newLen: b.length,
      at: firstDiff,
      orig: JSON.stringify(a.slice(Math.max(0, firstDiff - 20), firstDiff + 20)),
      next: JSON.stringify(b.slice(Math.max(0, firstDiff - 20), firstDiff + 20)),
    });
  }
}

console.log('=== 结果 ===');
console.log('字节级一致:', pass);
console.log('存在差异  :', fail);

if (failures.length) {
  console.log();
  console.log('=== 差异详情（前 5 个）===');
  for (const f of failures.slice(0, 5)) {
    console.log('文件:', f.file);
    console.log('  长度:', f.origLen, '→', f.newLen, ' 首差位置:', f.at);
    console.log('  原文:', f.orig);
    console.log('  往返:', f.next);
    console.log();
  }
}

process.exit(fail === 0 ? 0 : 1);
