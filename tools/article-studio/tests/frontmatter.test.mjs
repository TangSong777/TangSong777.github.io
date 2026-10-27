/**
 * front matter 拆分/还原测试。
 *
 * splitEditorDocument 决定「哪些字节属于元数据、哪些交给正文编辑器」，
 * 拆错一次就是文章元数据被当正文渲染、保存后结构被破坏。
 * 这里用真实正则跑一遍，把边界行为固化下来。
 */

import test from 'node:test';
import assert from 'node:assert/strict';

// 与 public/app.js 里完全一致的实现
function splitEditorDocument(value) {
  const text = String(value || '');
  const match = text.match(/^---[ \t]*\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/);
  return match
    ? { frontMatter: match[0], body: text.slice(match[0].length) }
    : { frontMatter: '', body: text };
}

function join(parts) {
  return parts.frontMatter + parts.body;
}

test('标准 front matter 正确拆出', () => {
  const src = '---\ntitle: 测试\ndate: 2026-10-27\n---\n\n正文第一段\n';
  const parts = splitEditorDocument(src);

  assert.equal(parts.frontMatter, '---\ntitle: 测试\ndate: 2026-10-27\n---\n');
  assert.equal(parts.body, '\n正文第一段\n', '正文前的空行要留在正文里');
  assert.equal(join(parts), src, '拼回必须与原文完全一致');
});

test('没有 front matter 时整篇都是正文', () => {
  const src = '# 只有正文\n\n内容\n';
  const parts = splitEditorDocument(src);

  assert.equal(parts.frontMatter, '');
  assert.equal(parts.body, src);
});

test('正文里的水平线不会被误当成 front matter', () => {
  const src = '---\ntitle: A\n---\n\n开头\n\n---\n\n后半段\n';
  const parts = splitEditorDocument(src);

  assert.equal(parts.frontMatter, '---\ntitle: A\n---\n', '元数据应在第一个闭合处结束');
  assert.ok(parts.body.includes('---\n\n后半段'), '正文里的水平线要留在正文');
  assert.equal(join(parts), src);
});

test('空文档不崩', () => {
  const parts = splitEditorDocument('');
  assert.equal(parts.frontMatter, '');
  assert.equal(parts.body, '');
});

test('null / undefined 不崩', () => {
  assert.equal(splitEditorDocument(null).body, '');
  assert.equal(splitEditorDocument(undefined).body, '');
});

test('CRLF 换行也能识别', () => {
  const src = '---\r\ntitle: 测试\r\n---\r\n\r\n正文\r\n';
  const parts = splitEditorDocument(src);

  assert.equal(parts.frontMatter, '---\r\ntitle: 测试\r\n---\r\n');
  assert.equal(parts.body, '\r\n正文\r\n', 'CRLF 下的空行同样留在正文');
  assert.equal(join(parts), src);
});

test('front matter 里有多行数组与嵌套', () => {
  const src = '---\ntitle: A\ntags:\n  - 一\n  - 二\ncategories:\n  - 分类\ndate: 2026-10-27 10:00:00\n---\n正文';
  const parts = splitEditorDocument(src);

  assert.ok(parts.frontMatter.includes('- 二'));
  assert.equal(parts.body, '正文');
  assert.equal(join(parts), src);
});

test('front matter 后直接跟正文（没有空行）', () => {
  const src = '---\ntitle: A\n---\n正文';
  const parts = splitEditorDocument(src);

  assert.equal(parts.frontMatter, '---\ntitle: A\n---\n');
  assert.equal(parts.body, '正文');
});

test('front matter 是文件唯一内容时正文为空', () => {
  const src = '---\ntitle: A\n---\n';
  const parts = splitEditorDocument(src);

  assert.equal(parts.frontMatter, src);
  assert.equal(parts.body, '');
});

test('已知边界：未闭合的 front matter 会被当成正文', () => {
  // 作者手写漏掉闭合 --- 的真实情况。
  // 当前行为是整篇进正文编辑器，Markdown 会把第一行 --- 渲染成分隔线、
  // title: 那行变成普通段落。这里把行为固化下来，改动时能立刻看到影响。
  const src = '---\ntitle: A\n\n正文\n';
  const parts = splitEditorDocument(src);

  assert.equal(parts.frontMatter, '', '没有闭合标记就不认为有元数据');
  assert.equal(parts.body, src);
});

test('已知边界：正文以水平线开头且后面还有水平线时会被误判', () => {
  // 文章第一行就是 ---，正文中间又有 ---，会被当成 front matter。
  // 这是 Markdown 无法区分的固有歧义，Hexo 自身也是同样规则。
  const src = '---\n\n第一段\n\n---\n\n第二段\n';
  const parts = splitEditorDocument(src);

  assert.equal(parts.frontMatter, '---\n\n第一段\n\n---\n', '被误判为元数据');
  assert.equal(parts.body, '\n第二段\n', '空行不随元数据一起被吃掉');
  // 关键：即使误判，join 后仍然与原文一致，保存不会丢内容
  assert.equal(join(parts), src, '误判也不能丢字节');
});
