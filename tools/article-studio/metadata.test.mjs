import test from 'node:test';
import assert from 'node:assert/strict';

await import('./public/metadata.js');
const metadata = globalThis.ArticleMetadata;

test('文章信息读取支持列表与中文内容', () => {
  const content = `---\ntitle: "测试文章"\ndate: 2026-09-10 09:30:12\nupdated: 2026-09-10 10:00:00\ncategories:\n  - 技术\n  - Hexo\ntags: ["Markdown", "写作"]\ndescription: "文章摘要"\n---\n\n正文\n`;
  assert.deepEqual(metadata.read(content), {
    title: '测试文章',
    date: '2026-09-10T09:30:12',
    updated: '2026-09-10T10:00:00',
    categories: ['技术', 'Hexo'],
    tags: ['Markdown', '写作'],
    description: '文章摘要',
  });
});

test('文章信息更新保留未知 YAML 字段与正文', () => {
  const content = `---\ntitle: Old\ndate: 2026-01-01 00:00:00\npermalink: custom/path/\ncategories:\n  - 旧分类\n---\n\n正文不会被修改。\n`;
  const updated = metadata.update(content, {
    title: '新标题',
    date: '2026-09-10T12:34:56',
    updated: '',
    categories: '技术，Hexo',
    tags: 'Markdown, 写作, Markdown',
    description: '新的摘要',
  });
  assert.match(updated, /title: "新标题"/);
  assert.match(updated, /date: 2026-09-10 12:34:56/);
  assert.match(updated, /categories: \["技术", "Hexo"\]/);
  assert.match(updated, /tags: \["Markdown", "写作"\]/);
  assert.match(updated, /permalink: custom\/path\//);
  assert.match(updated, /\n\n正文不会被修改。\n$/);
});

test('没有 YAML 时可以创建文章信息且保留正文', () => {
  const updated = metadata.update('只有正文。\n', {
    title: '新文章', date: '2026-09-10T08:00:00', updated: '', categories: '', tags: '', description: '',
  });
  assert.match(updated, /^---\ntitle: "新文章"\ndate: 2026-09-10 08:00:00/);
  // 可选字段为空时不写进 front-matter：update() 的约定是「用户清空的可选字段整块删掉」，
  // 新建文章也一样，写 `categories: []` 只会给每篇文章多留一行噪声。
  assert.doesNotMatch(updated, /categories:/);
  assert.doesNotMatch(updated, /tags:/);
  assert.doesNotMatch(updated, /description:/);
  assert.match(updated, /---\n\n只有正文。\n$/);
});

test('清空已存在的分类写成空列表，未知字段原样保留', () => {
  const content = `---\ntitle: Old\ndate: 2026-01-01 00:00:00\npermalink: custom/path/\ncategories:\n  - 旧分类\n---\n\n正文。\n`;
  const updated = metadata.update(content, {
    title: 'Old', date: '2026-01-01T00:00:00', updated: '', categories: '', tags: '', description: '',
  });
  // 列表字段被清空时写 `categories: []`（显式的「没有分类」），而不是删掉整行——
  // 只有 updated / description 这类标量字段清空才整块删。
  assert.match(updated, /categories: \[\]/);
  assert.doesNotMatch(updated, /旧分类/);
  assert.match(updated, /permalink: custom\/path\//);
  assert.match(updated, /\n\n正文。\n$/);
});
