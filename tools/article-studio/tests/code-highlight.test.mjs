// 代码块轻量着色的分词器测试
// 直接从 typora-live-preview.js 里抠出分词器实现，避免复制一份逻辑导致两边漂移。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const sourcePath = join(here, '..', 'public', 'js', 'typora-live-preview.js');
const source = readFileSync(sourcePath, 'utf8');

const start = source.indexOf('  var CODE_KEYWORDS = {');
const end = source.indexOf('  // 把分词结果落到以 base');
assert.ok(start > 0 && end > start, '没找到分词器代码块，检查 typora-live-preview.js 结构');

const chunk = source.slice(start, end);
const { tokenizeCode } = new Function(`${chunk}\nreturn { tokenizeCode, codeKeywordSet };`)();

// 把 token 还原成 [文字, 类别]，方便断言
function tokenize(text, lang) {
  return tokenizeCode(text, lang).map((t) => [text.slice(t.from, t.to), t.cls]);
}

function clsOf(tokens, word) {
  const hit = tokens.find(([text]) => text === word);
  return hit ? hit[1] : null;
}

test('JS 关键字与数字', () => {
  const tokens = tokenize('const answer = 42;', 'js');
  assert.equal(clsOf(tokens, 'const'), 'cm-md-tok-keyword');
  assert.equal(clsOf(tokens, '42'), 'cm-md-tok-number');
  // 普通变量不应被上色
  assert.equal(clsOf(tokens, 'answer'), null);
});

test('JS 字符串与注释', () => {
  const strTokens = tokenize("const s = 'hello';", 'js');
  assert.equal(clsOf(strTokens, "'hello'"), 'cm-md-tok-string');

  const commentTokens = tokenize('// 这是注释\nconst a = 1;', 'js');
  assert.equal(clsOf(commentTokens, '// 这是注释'), 'cm-md-tok-comment');

  const blockTokens = tokenize('/* 块注释 */\nx', 'js');
  assert.equal(clsOf(blockTokens, '/* 块注释 */'), 'cm-md-tok-comment');
});

test('JS 函数名、属性、类型', () => {
  const fnTokens = tokenize('foo(1)', 'js');
  assert.equal(clsOf(fnTokens, 'foo'), 'cm-md-tok-function');

  const propTokens = tokenize('obj.prop', 'js');
  assert.equal(clsOf(propTokens, 'prop'), 'cm-md-tok-property');

  const typeTokens = tokenize('new Foo()', 'js');
  assert.equal(clsOf(typeTokens, 'Foo'), 'cm-md-tok-type');
});

test('数字不吞掉标识符里的数字', () => {
  const tokens = tokenize('foo2 = 7', 'js');
  assert.equal(clsOf(tokens, 'foo2'), null, 'foo2 不应被当成 token');
  assert.equal(clsOf(tokens, '7'), 'cm-md-tok-number');
});

test('Python 用 # 作行注释，而不是 //', () => {
  const py = tokenize('# 注释\ndef f():\n    pass', 'python');
  assert.equal(clsOf(py, '# 注释'), 'cm-md-tok-comment');
  assert.equal(clsOf(py, 'def'), 'cm-md-tok-keyword');
  assert.equal(clsOf(py, 'pass'), 'cm-md-tok-keyword');

  // JS 里 # 不是注释，不应被整行吞掉
  const js = tokenize('# 这在 js 里不是注释', 'js');
  assert.equal(clsOf(js, '# 这在 js 里不是注释'), null);
});

test('未知语言退回默认关键字表，不抛错', () => {
  assert.doesNotThrow(() => tokenize('function x() {}', 'brainfuck'));
  const tokens = tokenize('function x() {}', 'brainfuck');
  assert.equal(clsOf(tokens, 'function'), 'cm-md-tok-keyword');
});

test('空文本与纯空白不抛错且无 token', () => {
  assert.deepEqual(tokenize('', 'js'), []);
  assert.deepEqual(tokenize('   \n\t\n', 'js'), []);
});

test('中文与 emoji 混排不会切坏偏移', () => {
  const text = '// 中文注释 🎉\nconst 名称 = "值";';
  const tokens = tokenize(text, 'js');
  // 所有 token 的区间必须严格递增且不重叠
  const offsets = tokenizeCode(text, 'js');
  for (let i = 1; i < offsets.length; i += 1) {
    assert.ok(offsets[i].from >= offsets[i - 1].to, 'token 区间重叠');
  }
  assert.equal(clsOf(tokens, '// 中文注释 🎉'), 'cm-md-tok-comment');
  assert.equal(clsOf(tokens, 'const'), 'cm-md-tok-keyword');
});
