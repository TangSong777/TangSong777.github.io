/**
 * 元数据写回的幂等性测试。
 *
 * 场景：用户打开一篇文章 → 点「信息」→ 什么都不改直接确定 → 保存。
 * 期望：文件字节完全不变，git diff 为空。
 * 任何额外字段、顺序变化、格式改写都会让用户觉得「我明明没动它」。
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
require('/srv/blog/repo/tools/article-studio/public/metadata.js');
const M = globalThis.ArticleMetadata;

/** 模拟「打开 → 读元数据 → 原样写回」 */
function roundTrip(src) {
  const meta = M.read(src);
  return M.update(src, meta);
}

test('典型 Hexo 元数据往返后字节不变', () => {
  const src = [
    '---',
    'title: "一篇测试文章"',
    'date: 2026-10-27 10:00:00',
    'categories: ["技术"]',
    'tags: ["Rock5b+", "调教"]',
    'description: "这里是摘要"',
    '---',
    '',
    '正文第一段。',
    '',
    '正文第二段。',
    '',
  ].join('\n');

  assert.equal(roundTrip(src), src);
});

test('没有 description 字段时不应凭空添加', () => {
  const src = [
    '---',
    'title: "无摘要文章"',
    'date: 2026-10-27 10:00:00',
    'tags: ["a"]',
    '---',
    '',
    '正文',
    '',
  ].join('\n');

  assert.equal(roundTrip(src), src, '不该多出 description: "" 这一行');
});

test('块状列表格式往返后不变', () => {
  const src = [
    '---',
    'title: "块状列表"',
    'date: 2026-10-27 10:00:00',
    'tags:',
    '  - 一',
    '  - 二',
    '---',
    '',
    '正文',
    '',
  ].join('\n');

  // 块状会被改写成 flow 形式，这是已知设计（可读性取舍），
  // 但至少再往返一次必须稳定，不能每次都变。
  const once = roundTrip(src);
  const twice = roundTrip(once);
  assert.equal(twice, once, '第二次往返必须稳定');
});

test('带时区偏移的 date 不应丢时区', () => {
  const src = [
    '---',
    'title: "时区"',
    'date: 2026-10-27T10:00:00+08:00',
    '---',
    '',
    '正文',
    '',
  ].join('\n');

  const out = roundTrip(src);
  assert.equal(out, src, '没改时间就不该重写这一行');
});

test('未知字段不应被挪到最前面', () => {
  const src = [
    '---',
    'title: "未知字段"',
    'date: 2026-10-27 10:00:00',
    'permalink: custom-slug',
    'comments: false',
    '---',
    '',
    '正文',
    '',
  ].join('\n');

  const out = roundTrip(src);
  assert.equal(out, src, '未知字段应原样保留在原有相对位置');
});

test('没有 front matter 的文章补全后结构正确', () => {
  const src = '# 只有正文\n\n内容\n';
  const out = M.update(src, {
    title: '补全',
    date: '2026-10-27T10:00:00',
    updated: '',
    categories: [],
    tags: [],
    description: '',
  });

  assert.ok(out.startsWith('---\n'), '应补出 front matter');
  assert.ok(out.includes('title: "补全"'));
  assert.ok(out.endsWith('# 只有正文\n\n内容\n'), '正文不能被改动');
});

test('空标题抛错', () => {
  assert.throws(() => M.update('---\ntitle: a\ndate: 2026-10-27 10:00:00\n---\n正文', {
    title: '   ', date: '2026-10-27T10:00:00',
  }), /标题不能为空/);
});

test('空日期抛错', () => {
  assert.throws(() => M.update('---\ntitle: a\ndate: 2026-10-27 10:00:00\n---\n正文', {
    title: '标题', date: '',
  }), /有效的发布时间/);
});
