/**
 * 工具栏操作的纯逻辑测试。
 *
 * 复刻 app.js 里 replaceSelection / prefixLines / insertCodeBlock / insertDivider
 * 的字符串变换逻辑，验证插入结果与预期光标位置。
 */

import test from 'node:test';
import assert from 'node:assert/strict';

function makeDoc(text, start = 0, end = start) {
  return { text, start, end };
}

function replaceSelection(doc, prefix, suffix = prefix, placeholder = '文本') {
  const selected = doc.text.slice(doc.start, doc.end) || placeholder;
  const replacement = `${prefix}${selected}${suffix}`;
  return {
    text: doc.text.slice(0, doc.start) + replacement + doc.text.slice(doc.end),
    start: doc.start + prefix.length,
    end: doc.start + prefix.length + selected.length,
  };
}

function prefixLines(doc, prefix) {
  const lineStart = doc.text.lastIndexOf('\n', doc.start - 1) + 1;
  const lineEndIdx = doc.text.indexOf('\n', doc.end);
  const lineEnd = lineEndIdx === -1 ? doc.text.length : lineEndIdx;
  const prefixed = doc.text.slice(lineStart, lineEnd)
    .split('\n').map((line) => prefix + line).join('\n');
  return {
    text: doc.text.slice(0, lineStart) + prefixed + doc.text.slice(lineEnd),
    start: lineStart,
    end: lineStart + prefixed.length,
  };
}

function insertCodeBlock(doc) {
  const selected = doc.text.slice(doc.start, doc.end);
  const replacement = selected ? '```\n' + selected + '\n```' : '```\n\n```';
  return {
    text: doc.text.slice(0, doc.start) + replacement + doc.text.slice(doc.end),
    start: doc.start + 4,
    end: doc.start + 4 + (selected ? selected.length : 0),
  };
}

function insertDivider(doc) {
  const before = doc.text.slice(0, doc.start);
  const after = doc.text.slice(doc.end);
  const prefix = before.length && !before.endsWith('\n\n')
    ? (before.endsWith('\n') ? '\n' : '\n\n') : '';
  const suffix = after.length && !after.startsWith('\n\n')
    ? (after.startsWith('\n') ? '\n' : '\n\n') : '';
  const cursor = doc.start + prefix.length + 3;
  return { text: before + `${prefix}---${suffix}` + after, start: cursor, end: cursor };
}

test('加粗：选中文字后包裹，选区落在文字内部', () => {
  // '前面 后面' → 前(0) 面(1) 空格(2) 后(3) 面(4)
  const out = replaceSelection(makeDoc('前面 后面', 3, 5), '**');

  assert.equal(out.text, '前面 **后面**');
  assert.equal(out.text.slice(out.start, out.end), '后面', '选区应只覆盖原文字，不含星号');
});

test('加粗：未选中时插入占位文本并选中它', () => {
  const out = replaceSelection(makeDoc('abc', 3, 3), '**', '**', '文本');

  assert.equal(out.text, 'abc**文本**');
  assert.equal(out.text.slice(out.start, out.end), '文本', '应选中占位文本方便直接覆盖');
});

test('斜体与删除线用同样的包裹逻辑', () => {
  const base = makeDoc('x', 0, 1);

  assert.equal(replaceSelection(base, '*').text, '*x*');
  assert.equal(replaceSelection(base, '~~').text, '~~x~~');
});

test('行内代码：反引号包裹', () => {
  // '用 foo 举例' → 用(0) 空格(1) f(2) o(3) o(4) 空格(5)
  const out = replaceSelection(makeDoc('用 foo 举例', 2, 5), '`');
  assert.equal(out.text, '用 `foo` 举例');
});

test('标题前缀：给当前行加 # ', () => {
  const out = prefixLines(makeDoc('标题内容', 0, 2), '# ');
  assert.equal(out.text, '# 标题内容');
});

test('列表前缀：选区跨行时每行都加', () => {
  // 选区 0..8 覆盖第 1 行全部与第 2 行开头，行尾取整后三行都被包含
  const out = prefixLines(makeDoc('第一行\n第二行\n第三行', 0, 8), '- ');
  assert.equal(out.text, '- 第一行\n- 第二行\n- 第三行');
});

test('列表前缀：单行内不带出多余行', () => {
  const out = prefixLines(makeDoc('第一行\n第二行', 0, 2), '- ');
  assert.equal(out.text, '- 第一行\n第二行', '只应命中第 1 行');
});

test('代码块：未选中时插入空围栏，光标在中间', () => {
  const out = insertCodeBlock(makeDoc('', 0, 0));

  assert.equal(out.text, '```\n\n```');
  assert.equal(out.start, 4, '光标应落在第一行围栏之后');
  assert.equal(out.start, out.end);
});

test('代码块：选中内容时包进围栏并保持选中', () => {
  const out = insertCodeBlock(makeDoc('a\nb', 0, 3));

  assert.equal(out.text, '```\na\nb\n```');
  assert.equal(out.text.slice(out.start, out.end), 'a\nb', '原内容应仍被选中');
});

test('分隔线：前后都补足空行', () => {
  const out = insertDivider(makeDoc('段落一\n段落二', 4, 4));
  assert.equal(out.text, '段落一\n\n---\n\n段落二');
});

test('分隔线：在文档开头时不产生前导空行', () => {
  const out = insertDivider(makeDoc('内容', 0, 0));
  assert.equal(out.text, '---\n\n内容');
});

test('链接：选中文字时变成 [文字](url) 且保留原文字选中', () => {
  const out = replaceSelection(makeDoc('看这里', 1, 3), '[', '](https://)', '链接文字');

  assert.equal(out.text, '看[这里](https://)');
  assert.equal(out.text.slice(out.start, out.end), '这里');
});

test('连续套用两种格式不破坏嵌套', () => {
  const bold = replaceSelection(makeDoc('文字', 0, 2), '**');
  const both = replaceSelection(makeDoc(bold.text, bold.start, bold.end), '*');

  assert.equal(both.text, '***文字***');
});
