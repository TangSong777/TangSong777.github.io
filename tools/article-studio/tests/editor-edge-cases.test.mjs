/**
 * 边界场景验证：空文档、嵌套结构、超长行、连续标记。
 */
import { EditorState } from '../../../node_modules/@codemirror/state/dist/index.js';
import { markdown, markdownLanguage } from '../../../node_modules/@codemirror/lang-markdown/dist/index.js';
import { syntaxTree } from '../../../node_modules/@codemirror/language/dist/index.js';

const HIDE = new Set(['EmphasisMark', 'CodeMark', 'StrikethroughMark', 'LinkMark', 'URL', 'QuoteMark', 'ListMark', 'HeaderMark']);

function buildFor(doc, activeLines = new Set()) {
  const state = EditorState.create({ doc, extensions: [markdown({ base: markdownLanguage })] });
  const decos = [];
  syntaxTree(state).iterate({
    from: 0,
    to: state.doc.length,
    enter(node) {
      const line = state.doc.lineAt(node.from);
      const isActive = activeLines.has(line.number);
      if (HIDE.has(node.name)) {
        if (!isActive && node.to > node.from) decos.push({ kind: 'hide', from: node.from, to: node.to, txt: doc.slice(node.from, node.to) });
        return false;
      }
      if (node.name === 'FencedCode') {
        const s = state.doc.lineAt(node.from).number;
        const e = state.doc.lineAt(node.to).number;
        for (let i = s; i <= e; i += 1) decos.push({ kind: 'line', at: state.doc.line(i).from });
        return true;
      }
      return true;
    },
  });
  return decos;
}

function check(name, fn) {
  try {
    const ok = fn();
    console.log((ok ? 'PASS  ' : 'FAIL  ') + name);
    return ok;
  } catch (error) {
    console.log('ERROR ' + name + ' → ' + error.message);
    return false;
  }
}

let all = true;

all = check('空文档不报错', () => buildFor('').length === 0) && all;

all = check('只有空行不报错', () => {
  const d = buildFor('\n\n\n');
  return Array.isArray(d);
}) && all;

all = check('嵌套强调 ***粗斜***', () => {
  const d = buildFor('***粗斜***');
  return d.length > 0;
}) && all;

all = check('未闭合标记不崩溃', () => {
  const d = buildFor('这是 **未闭合的粗体');
  return Array.isArray(d);
}) && all;

all = check('代码块内的 # 不被当标题', () => {
  const doc = '```\n# 这不是标题\n```';
  const state = EditorState.create({ doc, extensions: [markdown({ base: markdownLanguage })] });
  let hasHeading = false;
  syntaxTree(state).iterate({
    enter(n) { if (/^ATXHeading/.test(n.name)) hasHeading = true; },
  });
  return !hasHeading;
}) && all;

all = check('超长单行不崩溃', () => {
  const long = '**bold** '.repeat(2000);
  const d = buildFor(long);
  return d.length > 1000;
}) && all;

all = check('中文混排标记位置正确', () => {
  const doc = '中文**粗体**中文';
  const d = buildFor(doc);
  const marks = d.filter((x) => x.kind === 'hide').map((x) => x.txt);
  return marks.length === 2 && marks.every((t) => t === '**');
}) && all;

all = check('表内强调不被误识别为块级', () => {
  const doc = '| a | b |\n| --- | --- |\n| **x** | y |';
  const d = buildFor(doc);
  return Array.isArray(d);
}) && all;

all = check('引用内嵌列表正常', () => {
  const doc = '> - 项目一\n> - 项目二';
  const d = buildFor(doc);
  return d.length > 0;
}) && all;

all = check('链接里的图片语法', () => {
  const doc = '[![alt](img.png)](https://example.com)';
  const d = buildFor(doc);
  return Array.isArray(d);
}) && all;

console.log();
console.log(all ? '全部通过' : '有失败项');
process.exitCode = all ? 0 : 1;
