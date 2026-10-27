/**
 * 排版一致性守卫。
 *
 * 目标：editor.yanghanlin.cn 里看到的文章，和 blogs 发布后的文章长得一样。
 * 两边分属 Stylus（站点）和 JS（编辑器），没法共用变量，所以这里把关键数值
 * 从源码里解析出来逐项比对——任何一边单独改动都会让本测试失败。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../..');

export const paths = {
  site: resolve(repo, 'source/_data/styles.styl'),
  preview: resolve(repo, 'tools/article-studio/public/js/typora-live-preview.js'),
  app: resolve(repo, 'tools/article-studio/public/app.js'),
};

function read(path) {
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

/** 从 Stylus 的 .post-body 块里取一张「属性 → 值」表。 */
export function parseSiteBody(styl) {
  const body = styl.slice(styl.indexOf('.post-body {'));
  const out = {};
  // 只取 .post-body 直接一级的声明（h1..h6 / p / li 前的那些）
  const head = body.slice(0, body.indexOf('h1, h2, h3'));
  const font = /font-size:\s*([\d.]+px)/.exec(head);
  const lead = /line-height:\s*([\d.]+)/.exec(head);
  if (font) out.fontSize = font[1];
  if (lead) out.lineHeight = lead[1];
  for (const level of [1, 2, 3, 4, 5, 6]) {
    const m = new RegExp(`h${level}\\s*\\{\\s*font-size:\\s*([\\d.]+em)`).exec(body);
    if (m) out[`h${level}`] = m[1];
  }
  const blockquote = /blockquote\s*\{([^}]*)\}/.exec(body);
  if (blockquote) {
    const bg = /background:\s*(#[0-9a-fA-F]{6})/.exec(blockquote[1]);
    const border = /border-left-color:\s*(#[0-9a-fA-F]{6})/.exec(blockquote[1]);
    if (bg) out.quoteBg = bg[1].toLowerCase();
    if (border) out.quoteBorder = border[1].toLowerCase();
  }
  const heading = /color:\s*(#[0-9a-fA-F]{6})/.exec(body.slice(body.indexOf('h1, h2, h3')));
  if (heading) out.headingColor = heading[1].toLowerCase();
  return out;
}

/** 从 CodeMirror baseTheme 里取编辑器侧的同名指标。 */
export function parseEditor(preview, app) {
  const out = {};
  for (const level of [1, 2, 3, 4, 5, 6]) {
    const m = new RegExp(`'\\.cm-md-h${level}':\\s*\\{[^}]*fontSize:\\s*'([\\d.]+em)'`).exec(preview);
    if (m) out[`h${level}`] = m[1];
  }
  const quote = /'\.cm-md-quote-line':\s*\{([^}]*)\}/.exec(preview);
  if (quote) {
    const bg = /backgroundColor:\s*'(#[0-9a-fA-F]{6})'/.exec(quote[1]);
    const border = /borderLeft:\s*'\d+px solid (#[0-9a-fA-F]{6})'/.exec(quote[1]);
    if (bg) out.quoteBg = bg[1].toLowerCase();
    if (border) out.quoteBorder = border[1].toLowerCase();
  }
  const link = /'\.cm-md-link':\s*\{[^}]*color:\s*'(#[0-9a-fA-F]{6})'/.exec(preview);
  if (link) out.linkColor = link[1].toLowerCase();
  const h1 = /'\.cm-md-h1':\s*\{[^}]*color:\s*'(#[0-9a-fA-F]{6})'/.exec(preview);
  if (h1) out.headingColor = h1[1].toLowerCase();

  const font = /'&':\s*\{[^}]*fontSize:\s*'([\d.]+px)'/.exec(app);
  if (font) out.fontSize = font[1];
  const lead = /\.cm-scroller':\s*\{[^}]*lineHeight:\s*'([\d.]+)'/.exec(app);
  if (lead) out.lineHeight = lead[1];
  const stack = /\.cm-scroller':\s*\{[^}]*fontFamily:\s*'([^']+)'/.exec(app);
  if (stack) out.fontFamily = stack[1];
  return out;
}

const site = parseSiteBody(read(paths.site));
const editor = parseEditor(read(paths.preview), read(paths.app));

test('站点样式文件可解析', () => {
  assert.ok(site.fontSize, 'styles.styl 里找不到 .post-body 的 font-size');
  assert.ok(site.lineHeight, 'styles.styl 里找不到 .post-body 的 line-height');
});

test('编辑器样式文件可解析', () => {
  assert.ok(editor.fontSize, 'app.js 里找不到编辑器基准字号');
  assert.ok(editor.lineHeight, 'app.js 里找不到编辑器行高');
});

test('基准字号与行高一致', () => {
  assert.equal(editor.fontSize, site.fontSize, `编辑器 ${editor.fontSize} ≠ 站点 ${site.fontSize}`);
  assert.equal(editor.lineHeight, site.lineHeight, `编辑器行高 ${editor.lineHeight} ≠ 站点行高 ${site.lineHeight}`);
});

test('标题六级比例一致', () => {
  for (const level of [1, 2, 3, 4, 5, 6]) {
    assert.ok(site[`h${level}`], `站点缺少 h${level} 字号`);
    assert.ok(editor[`h${level}`], `编辑器缺少 h${level} 字号`);
    assert.equal(editor[`h${level}`], site[`h${level}`], `h${level}: 编辑器 ${editor[`h${level}`]} ≠ 站点 ${site[`h${level}`]}`);
  }
});

test('引用块底色与左边框一致', () => {
  assert.equal(editor.quoteBg, site.quoteBg, `引用底色 编辑器 ${editor.quoteBg} ≠ 站点 ${site.quoteBg}`);
  assert.equal(editor.quoteBorder, site.quoteBorder, `引用边框 编辑器 ${editor.quoteBorder} ≠ 站点 ${site.quoteBorder}`);
});

test('标题颜色一致', () => {
  assert.equal(editor.headingColor, site.headingColor, `标题色 编辑器 ${editor.headingColor} ≠ 站点 ${site.headingColor}`);
});

test('链接色不回到主题蓝', () => {
  assert.ok(editor.linkColor, '编辑器里找不到链接色');
  assert.notEqual(editor.linkColor, '#1f6feb', '编辑器链接又变回蓝色系了，与站点绿色主题不一致');
});

test('编辑器字体栈与站点相同', () => {
  assert.ok(site.headingColor);
  for (const family of ['Segoe UI', 'Microsoft YaHei', 'PingFang SC', 'system-ui']) {
    assert.ok(editor.fontFamily.includes(family), `编辑器字体栈缺少 ${family}`);
  }
});
