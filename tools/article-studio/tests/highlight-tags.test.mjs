/**
 * 校验 typora-live-preview.js 里引用的每个 tags.xxx 都真实存在。
 *
 * 背景：@lezer/highlight 的 tags 是个固定表，但没有类型检查。写错一个名字
 * （比如 tags.math 在 1.2.x 里并不存在）会让 HighlightStyle.define 抛错，
 * 而这段代码包在 IIFE 里，一抛错就导致 window.TyporaPreview 根本不赋值，
 * 整个编辑器渲染不出来 —— 表面上像"编辑器坏了"，实际只是拼错一个词。
 * 所以把它变成一条自动化断言。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tags } from '@lezer/highlight';

const here = dirname(fileURLToPath(import.meta.url));
const previewPath = join(here, '..', 'public', 'js', 'typora-live-preview.js');
const source = readFileSync(previewPath, 'utf8');

test('typora-live-preview.js 引用的 tags 全部存在', () => {
  const names = new Set();
  // 同时覆盖 tags.xxx 与 tags.xxx( 两种写法
  const re = /\btags\.([A-Za-z_$][\w$]*)/g;
  let match;
  while ((match = re.exec(source)) !== null) names.add(match[1]);

  assert.ok(names.size > 0, '一个 tags.xxx 都没匹配到，正则可能失效了');

  const missing = [...names].filter((name) => tags[name] === undefined).sort();
  assert.deepEqual(
    missing,
    [],
    `以下 tag 不存在，会让 HighlightStyle.define 抛错并拖垮整个编辑器：${missing.join(', ')}`,
  );
});

test('tags 表里取到的值都是合法 Tag（非 null/undefined）', () => {
  const names = new Set();
  const re = /\btags\.([A-Za-z_$][\w$]*)/g;
  let match;
  while ((match = re.exec(source)) !== null) names.add(match[1]);

  const broken = [];
  for (const name of names) {
    const value = tags[name];
    if (value == null) broken.push(name);
  }
  assert.deepEqual(broken, [], `这些 tag 取值为 null/undefined：${broken.join(', ')}`);
});
