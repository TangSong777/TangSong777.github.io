/**
 * CodeMirror 6 打包入口（含代码块语言高亮）
 */
import { EditorState, Compartment, StateEffect, StateField, RangeSetBuilder, Annotation, Transaction } from '@codemirror/state';
import {
  EditorView, Decoration, ViewPlugin, WidgetType, keymap,
  drawSelection, dropCursor, highlightActiveLine, highlightActiveLineGutter,
  lineNumbers, highlightSpecialChars, rectangularSelection,
  crosshairCursor, placeholder as cmPlaceholder,
} from '@codemirror/view';
import {
  defaultKeymap, history, historyKeymap, indentWithTab,
  undo, redo, selectAll,
} from '@codemirror/commands';
import {
  markdown, markdownLanguage, markdownKeymap,
  insertNewlineContinueMarkup, deleteMarkupBackward, pasteURLAsLink,
} from '@codemirror/lang-markdown';
import {
  syntaxHighlighting, HighlightStyle, syntaxTree, bracketMatching,
  indentOnInput, foldGutter, foldKeymap, codeFolding,
  LanguageDescription, LanguageSupport,
} from '@codemirror/language';
import { searchKeymap, highlightSelectionMatches, search } from '@codemirror/search';
import { tags } from '@lezer/highlight';

import { javascriptLanguage, typescriptLanguage, jsxLanguage, tsxLanguage } from '@codemirror/lang-javascript';
import { htmlLanguage } from '@codemirror/lang-html';
import { cssLanguage } from '@codemirror/lang-css';

/* 代码块里能识别的语言：只挑最常用的，控制包体积。
   注意 LanguageDescription.load() 必须返回 LanguageSupport 而不是 Language，
   否则 CodeMirror 内部取 support.language 得到 undefined，会抛
   "Cannot read properties of undefined (reading 'parser')"，
   表现为代码块完全不高亮。lang-javascript / lang-html / lang-css 只导出了
   Language（javascriptLanguage 等），没有可用的语言工厂函数，所以统一包一层。 */
function ofLanguage(name, alias, language) {
  var support = new LanguageSupport(language);
  return LanguageDescription.of({
    name: name,
    alias: alias,
    // support 与 load 都要给：
    //   support —— 让 CodeMirror 在首次同步解析代码块时就能拿到语言；
    //   load    —— 给需要异步加载的路径（比如按需切换语言）兜底。
    // 只给 load 的话，首屏渲染时代码块会被当成纯文本，完全不显色，
    // 要等下一次重新解析才可能补上，用户看到的就是"代码块没有高亮"。
    support: support,
    load: async () => support,
  });
}

const codeLanguages = [
  ofLanguage('JavaScript', ['js', 'mjs', 'cjs'], javascriptLanguage),
  ofLanguage('TypeScript', ['ts', 'mts', 'cts'], typescriptLanguage),
  ofLanguage('JSX', ['jsx'], jsxLanguage),
  ofLanguage('TSX', ['tsx'], tsxLanguage),
  ofLanguage('HTML', ['html', 'htm', 'vue'], htmlLanguage),
  ofLanguage('CSS', ['css', 'scss', 'less'], cssLanguage),
];

window.CM = {
  EditorState, Compartment, StateEffect, StateField, RangeSetBuilder, Annotation, Transaction,
  EditorView, Decoration, ViewPlugin, WidgetType, keymap,
  drawSelection, dropCursor, highlightActiveLine, highlightActiveLineGutter,
  lineNumbers, highlightSpecialChars, rectangularSelection, crosshairCursor,
  placeholder: cmPlaceholder,
  defaultKeymap, history, historyKeymap, indentWithTab, undo, redo, selectAll,
  markdown, markdownLanguage,
  markdownKeymap, insertNewlineContinueMarkup, deleteMarkupBackward, pasteURLAsLink,
  syntaxHighlighting, HighlightStyle, syntaxTree, bracketMatching,
  indentOnInput, foldGutter, foldKeymap, codeFolding,
  LanguageDescription, codeLanguages,
  searchKeymap, highlightSelectionMatches, search,
  tags,
};
