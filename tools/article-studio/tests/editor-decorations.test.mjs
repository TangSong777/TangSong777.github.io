/**
 * 在 Node 里复现 buildDecorations 的核心逻辑，验证行内渲染是否真的产出了预期的装饰。
 *
 * 这是不依赖浏览器的最后一道验证：如果装饰数量、类型、范围都符合预期，
 * 那么页面上的渲染行为基本可以确定是对的。
 */
import { EditorState } from '../../../node_modules/@codemirror/state/dist/index.js';
import { markdown, markdownLanguage } from '../../../node_modules/@codemirror/lang-markdown/dist/index.js';
import { syntaxTree } from '../../../node_modules/@codemirror/language/dist/index.js';
import { Decoration } from '../../../node_modules/@codemirror/view/dist/index.js';

const doc = [
  '# 一级标题',
  '',
  '普通段落 **粗体** 和 *斜体* 还有 ~~删除线~~ 与 `代码`。',
  '',
  '> 这是一段引用',
  '',
  '- 列表项',
  '',
  '- [ ] 待办',
  '- [x] 完成',
  '',
  '```js',
  'console.log(1)',
  '```',
  '',
  '---',
  '',
  '[链接](https://example.com)',
  '',
  '![独占图片](https://example.com/a.png)',
  '',
  '段落里夹一个 ![行内图](b.png) 图片。',
].join('\n');

const state = EditorState.create({
  doc,
  extensions: [markdown({ base: markdownLanguage, codeLanguages: [] })],
});

const HIDE_WHEN_INACTIVE = new Set([
  'EmphasisMark', 'CodeMark', 'StrikethroughMark', 'LinkMark', 'URL',
  'QuoteMark', 'ListMark', 'HeaderMark',
]);

// cursorLines 为空 = 光标不在任何行（模拟"所有行都非活动"）
function build(activeLines) {
  const decorations = [];
  const tree = syntaxTree(state);

  function hide(from, to) {
    if (to > from) decorations.push({ kind: 'replace', cls: '', from, to });
  }
  function style(from, to, cls) {
    if (to > from) decorations.push({ kind: 'mark', cls, from, to });
  }
  function lineDeco(at, cls) {
    decorations.push({ kind: 'line', cls, from: at, to: at });
  }

  tree.iterate({
    from: 0,
    to: state.doc.length,
    enter(node) {
      const name = node.name;
      const line = state.doc.lineAt(node.from);
      const isActive = activeLines.has(line.number);

      if (/^ATXHeading[1-6]$/.test(name)) { style(node.from, node.to, 'cm-md-h' + name.slice(-1)); return true; }
      if (name === 'StrongEmphasis') { style(node.from, node.to, 'cm-md-strong'); return true; }
      if (name === 'Emphasis') { style(node.from, node.to, 'cm-md-em'); return true; }
      if (name === 'Strikethrough') { style(node.from, node.to, 'cm-md-strike'); return true; }
      if (name === 'InlineCode') { style(node.from, node.to, 'cm-md-code'); return true; }
      if (name === 'Link') { style(node.from, node.to, 'cm-md-link'); return true; }

      if (name === 'Blockquote') {
        const s = state.doc.lineAt(node.from).number;
        const e = state.doc.lineAt(node.to).number;
        for (let ln = s; ln <= e; ln += 1) lineDeco(state.doc.line(ln).from, 'cm-md-quote-line');
        return true;
      }

      if (name === 'Image') {
        if (!isActive) {
          const raw = state.doc.sliceString(node.from, node.to);
          const m = /^!\[([^\]]*)\]\(\s*([^)\s]+)/.exec(raw);
          if (m) {
            const beforeText = state.doc.sliceString(line.from, node.from).trim();
            const afterText = state.doc.sliceString(node.to, line.to).trim();
            if (beforeText === '' && afterText === '') {
              decorations.push({ kind: 'widget-image', cls: '', from: node.from, to: node.to, url: m[2] });
              return false;
            }
          }
        }
        return true;
      }

      if (name === 'HorizontalRule') {
        if (!isActive) {
          decorations.push({ kind: 'widget-rule', cls: '', from: node.from, to: node.to });
          return false;
        }
        return true;
      }

      if (name === 'FencedCode' || name === 'CodeBlock') {
        const s = state.doc.lineAt(node.from).number;
        const e = state.doc.lineAt(node.to).number;
        for (let ln = s; ln <= e; ln += 1) lineDeco(state.doc.line(ln).from, 'cm-md-codeblock');
        return true;
      }

      if (name === 'ListMark') {
        const t = state.doc.sliceString(node.from, node.to);
        if (!isActive && /^[-*+]$/.test(t)) {
          decorations.push({ kind: 'widget-bullet', cls: '', from: node.from, to: node.to });
          return false;
        }
        return true;
      }

      if (name === 'TaskMarker') {
        const t = state.doc.sliceString(node.from, node.to);
        if (!isActive && /^\[[ xX]\]/.test(t)) {
          decorations.push({ kind: 'widget-task', cls: '', from: node.from, to: node.to });
          return false;
        }
        return true;
      }

      if (name === 'TableDelimiter' || name === 'TableHeader' || name === 'TableRow') {
        style(node.from, node.to, 'cm-md-table-line');
        return true;
      }

      if (HIDE_WHEN_INACTIVE.has(name)) {
        if (!isActive) { hide(node.from, node.to); return false; }
        style(node.from, node.to, 'cm-md-mark');
        return false;
      }

      return true;
    },
  });

  return decorations;
}

function summarize(label, decos) {
  const byKind = {};
  for (const d of decos) {
    const key = d.kind + (d.cls ? ':' + d.cls : '');
    byKind[key] = (byKind[key] || 0) + 1;
  }
  console.log(`\n=== ${label} ===`);
  console.log('装饰总数:', decos.length);
  for (const [k, v] of Object.entries(byKind).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${v.toString().padStart(3)}  ${k}`);
  }
  return byKind;
}

// 场景一：光标不在任何行（所有标记应隐藏）
const idle = build(new Set());
const idleKinds = summarize('光标不在任何行（全部渲染）', idle);

// 场景二：光标在第 3 行（粗体那行），该行标记应显示出来
const active = build(new Set([3]));
const activeKinds = summarize('光标在第 3 行（该行标记恢复）', active);

console.log('\n=== 行为断言 ===');
function assert(name, cond) {
  console.log('  ' + (cond ? 'PASS' : 'FAIL') + '  ' + name);
  return cond;
}

let ok = true;
ok = assert('非活动态有图片替换', (idleKinds['widget-image'] || 0) === 1) && ok;
ok = assert('非活动态有分隔线替换', (idleKinds['widget-rule'] || 0) === 1) && ok;
ok = assert('非活动态有列表圆点替换', (idleKinds['widget-bullet'] || 0) === 3) && ok;
ok = assert('非活动态有任务框替换', (idleKinds['widget-task'] || 0) === 2) && ok;
ok = assert('非活动态隐藏了大量标记', (idleKinds['replace'] || 0) > 10) && ok;
ok = assert('行内图片没有被替换（段落内）', (idleKinds['widget-image'] || 0) === 1) && ok;
ok = assert('标题有放大样式', (idleKinds['mark:cm-md-h1'] || 0) >= 1) && ok;
ok = assert('粗体有加粗样式', (idleKinds['mark:cm-md-strong'] || 0) >= 1) && ok;
ok = assert('斜体有样式', (idleKinds['mark:cm-md-em'] || 0) >= 1) && ok;
ok = assert('删除线有样式', (idleKinds['mark:cm-md-strike'] || 0) >= 1) && ok;
ok = assert('行内代码有样式', (idleKinds['mark:cm-md-code'] || 0) >= 1) && ok;
ok = assert('链接有样式', (idleKinds['mark:cm-md-link'] || 0) >= 1) && ok;
ok = assert('引用有逐行装饰', (idleKinds['line:cm-md-quote-line'] || 0) >= 1) && ok;
ok = assert('代码块有逐行底板', (idleKinds['line:cm-md-codeblock'] || 0) >= 3) && ok;
ok = assert('活动行的隐藏装饰变少', (activeKinds['replace'] || 0) < (idleKinds['replace'] || 0)) && ok;

console.log('\n结果:', ok ? '全部通过' : '有失败项');
process.exit(ok ? 0 : 1);
