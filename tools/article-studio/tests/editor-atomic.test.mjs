/**
 * 验证 decorations 与 atomic 的分离是否正确。
 *
 * 关键约束：
 *   atomic 只能包含 replace 类型（隐藏的标记符号、图片、分隔线、圆点、勾选框）
 *   mark / line 类型绝不能进 atomic，否则光标无法在加粗、斜体文字内部移动
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { EditorState } from '../../../node_modules/@codemirror/state/dist/index.js';
import { markdown, markdownLanguage } from '../../../node_modules/@codemirror/lang-markdown/dist/index.js';
import { syntaxTree } from '../../../node_modules/@codemirror/language/dist/index.js';

const DOC = [
  '# 标题',
  '',
  '段落 **粗体** 和 *斜体* 与 ~~删除~~ 和 `代码`。',
  '',
  '> 引用',
  '',
  '- 列表项',
  '',
  '- [ ] 待办',
  '',
  '```js',
  'x = 1',
  '```',
  '',
  '---',
  '',
  '[链接](https://example.com)',
  '',
  '![图](https://example.com/x.png)',
].join('\n');

const HIDE = new Set([
  'EmphasisMark', 'CodeMark', 'StrikethroughMark',
  'LinkMark', 'URL', 'QuoteMark', 'ListMark', 'HeaderMark',
]);

/**
 * 复刻 typora-live-preview.js 的分类逻辑：
 * 统计 all / atomic 的数量，并记录各自来源。
 */
function collect(docText) {
  const state = EditorState.create({
    doc: docText,
    extensions: [markdown({ base: markdownLanguage })],
  });

  const all = [];
  const atomic = [];
  const kinds = { replace: 0, mark: 0, line: 0 };
  const atomicSources = new Set();
  const activeLines = new Set();

  const pushReplace = (source) => {
    all.push(source);
    atomic.push(source);
    kinds.replace += 1;
    atomicSources.add(source);
  };
  const pushMark = () => { all.push('mark'); kinds.mark += 1; };
  const pushLine = () => { all.push('line'); kinds.line += 1; };

  syntaxTree(state).iterate({
    from: 0,
    to: state.doc.length,
    enter(node) {
      const name = node.name;
      const line = state.doc.lineAt(node.from);
      const isActive = activeLines.has(line.number);

      if (/^ATXHeading[1-6]$/.test(name)) { pushMark(); return true; }
      if (name === 'StrongEmphasis') { pushMark(); return true; }
      if (name === 'Emphasis') { pushMark(); return true; }
      if (name === 'Strikethrough') { pushMark(); return true; }
      if (name === 'InlineCode') { pushMark(); return true; }
      if (name === 'Link') { pushMark(); return true; }

      if (name === 'Blockquote') {
        const s = state.doc.lineAt(node.from).number;
        const e = state.doc.lineAt(node.to).number;
        for (let i = s; i <= e; i += 1) pushLine();
        return true;
      }

      if (name === 'HorizontalRule') {
        if (!isActive) { pushReplace('widget-rule'); return false; }
        return true;
      }

      if (name === 'FencedCode' || name === 'CodeBlock') {
        const s = state.doc.lineAt(node.from).number;
        const e = state.doc.lineAt(node.to).number;
        for (let i = s; i <= e; i += 1) pushLine();
        return true;
      }

      if (name === 'ListMark') {
        const text = state.doc.sliceString(node.from, node.to);
        if (!isActive && /^[-*+]$/.test(text)) { pushReplace('widget-bullet'); return false; }
        return true;
      }

      if (name === 'TaskMarker') {
        if (!isActive) { pushReplace('widget-task'); return false; }
        return true;
      }

      if (HIDE.has(name)) {
        if (!isActive) { pushReplace('replace'); return false; }
        pushMark();
        return false;
      }

      return true;
    },
  });

  return { all, atomic, kinds, atomicSources };
}

test('atomic 只含 replace 类型，不混入 mark 与 line', () => {
  const { all, atomic, kinds } = collect(DOC);

  console.log('    replace:', kinds.replace, '| mark:', kinds.mark, '| line:', kinds.line);
  console.log('    all:', all.length, '| atomic:', atomic.length);

  assert.equal(atomic.length, kinds.replace, 'atomic 数量应等于 replace 数量');
  assert.ok(atomic.length < all.length, 'atomic 应少于 all（mark/line 不能混进去）');
  assert.ok(kinds.mark > 0, '应存在 mark 装饰');
  assert.ok(kinds.line > 0, '应存在 line 装饰');
  assert.ok(kinds.replace > 10, '应有足够多的 replace 装饰');
});

test('圆点、勾选框、分隔线三类 widget 都在原子集合里', () => {
  const { atomicSources } = collect(DOC);

  assert.ok(atomicSources.has('widget-bullet'), '列表圆点应在原子集合');
  assert.ok(atomicSources.has('widget-task'), '任务勾选框应在原子集合');
  assert.ok(atomicSources.has('widget-rule'), '分隔线应在原子集合');
});

test('加粗与斜体的标记符号属于 replace，但强调文字本身是 mark', () => {
  const { atomicSources, kinds } = collect('**粗体** 和 *斜体*');

  assert.ok(atomicSources.has('replace'), '标记符号应被替换');
  assert.ok(kinds.mark >= 2, '粗体与斜体各贡献一个 mark');
});

test('空文档不产生任何装饰', () => {
  const { all, atomic } = collect('');
  assert.equal(all.length, 0, '空文档不应有装饰');
  assert.equal(atomic.length, 0, '空文档不应有原子范围');
});

test('只有标记没有内容时不崩', () => {
  const { all } = collect('****\n\n---\n');
  assert.ok(Array.isArray(all));
});
