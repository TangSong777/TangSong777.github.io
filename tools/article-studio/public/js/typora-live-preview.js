/**
 * Typora 风格行内实时渲染（CodeMirror 6 扩展）
 *
 * 行为约定：
 *   · 光标不在某行 → 该行的 Markdown 标记符号隐藏，文本按格式渲染
 *   · 光标进入该行 → 标记符号恢复显示，可以直接改语法
 *
 * 底层始终是真正的 Markdown 源码，所以保存往返零损失。
 */
(function () {
  'use strict';

  var CM = window.CM;
  if (!CM) return;

  var Decoration = CM.Decoration;
  var ViewPlugin = CM.ViewPlugin;
  var WidgetType = CM.WidgetType;
  var syntaxTree = CM.syntaxTree;
  var EditorView = CM.EditorView;
  var tags = CM.tags;
  var HighlightStyle = CM.HighlightStyle;
  var syntaxHighlighting = CM.syntaxHighlighting;

  /* ---------------------------------------------------------------- widget */

  class ImageWidget extends WidgetType {
    constructor(url, alt) {
      super();
      this.url = url;
      this.alt = alt || '';
    }
    eq(other) {
      return other instanceof ImageWidget && other.url === this.url && other.alt === this.alt;
    }
    toDOM() {
      var wrap = document.createElement('span');
      var img = document.createElement('img');
      img.className = 'cm-md-image';
      img.loading = 'lazy';
      img.alt = this.alt;
      img.src = this.url;
      var self = this;
      img.addEventListener('error', function () {
        var fallback = document.createElement('span');
        fallback.className = 'cm-md-image-broken';
        fallback.textContent = '图片加载失败：' + (self.alt || self.url);
        wrap.replaceChildren(fallback);
      });
      wrap.append(img);
      return wrap;
    }
    ignoreEvent() { return false; }
  }

  class RuleWidget extends WidgetType {
    eq() { return true; }
    toDOM() {
      var span = document.createElement('span');
      span.className = 'cm-md-hr';
      return span;
    }
    ignoreEvent() { return true; }
  }

  class TaskWidget extends WidgetType {
    constructor(checked, from, to) {
      super();
      this.checked = checked;
      this.from = from;
      this.to = to;
    }
    eq(other) {
      return other instanceof TaskWidget
        && other.checked === this.checked
        && other.from === this.from
        && other.to === this.to;
    }
    toDOM(view) {
      var self = this;
      var span = document.createElement('span');
      span.className = 'cm-md-task' + (this.checked ? ' cm-md-task-done' : '');
      span.textContent = this.checked ? '✓' : '';
      span.title = this.checked ? '点击标记为未完成' : '点击标记为已完成';
      // 勾选框要能点。mousedown 上拦掉，避免光标先跳到别处再重建装饰导致点击丢失。
      span.addEventListener('mousedown', function (event) {
        event.preventDefault();
        event.stopPropagation();
        var marker = self.checked ? '[ ]' : '[x]';
        view.dispatch({
          changes: { from: self.from, to: self.to, insert: marker },
        });
      });
      return span;
    }
    ignoreEvent() { return true; }
  }

  /* -------------------------------------------------------------- 表格块级渲染
     块级 replace 装饰不能由 ViewPlugin 提供（CodeMirror 会抛
     "Block decorations may not be specified via plugins"），必须来自 state 派生的
     facet。所以表格渲染单独用 EditorView.decorations.compute 提供，与行内装饰的
     livePreview 插件并行存在：光标在表格外时看到真表格，点进表格就变回源码。 */
  class TableWidget extends WidgetType {
    constructor(source) {
      super();
      this.source = source;
    }

    eq(other) {
      return other.source === this.source;
    }

    toDOM() {
      var wrap = document.createElement('div');
      wrap.className = 'cm-md-table-widget';

      var rows = this.source.split('\n').filter(function (line) {
        return line.trim() !== '';
      });
      var cells = rows.map(function (line) {
        return line.trim().replace(/^\|/, '').replace(/\|$/, '')
          .split('|').map(function (cell) { return cell.trim(); });
      });

      var align = [];
      if (cells.length > 1 && /^[\s:|-]+$/.test(cells[1].join(''))) {
        align = cells[1].map(function (cell) {
          if (/^:.*:$/.test(cell)) return 'center';
          if (/^:/.test(cell)) return 'left';
          if (/:$/.test(cell)) return 'right';
          return '';
        });
        cells.splice(1, 1);
      }

      var table = document.createElement('table');
      cells.forEach(function (row, index) {
        var tr = document.createElement('tr');
        row.forEach(function (text, columnIndex) {
          var cell = document.createElement(index === 0 ? 'th' : 'td');
          if (align[columnIndex]) cell.style.textAlign = align[columnIndex];
          cell.textContent = text;
          tr.appendChild(cell);
        });
        table.appendChild(tr);
      });

      wrap.appendChild(table);
      return wrap;
    }

    ignoreEvent() {
      return false;
    }
  }

  class BulletWidget extends WidgetType {
    eq() { return true; }
    toDOM() {
      var span = document.createElement('span');
      span.className = 'cm-md-bullet';
      span.textContent = '•';
      return span;
    }
    ignoreEvent() { return true; }
  }

  /* ---------------------------------------------------------------- 样式 */

  var liveStyles = EditorView.baseTheme({
    /* 标题比例与 blogs 的 .post-body 完全一致：2 / 1.6 / 1.3 / 1.15 / 1.05 / 1 */
    '.cm-md-h1': { fontSize: '2em', fontWeight: '700', lineHeight: '1.35', color: '#33544f' },
    '.cm-md-h2': { fontSize: '1.6em', fontWeight: '700', lineHeight: '1.4', color: '#33544f' },
    '.cm-md-h3': { fontSize: '1.3em', fontWeight: '700', lineHeight: '1.45', color: '#33544f' },
    '.cm-md-h4': { fontSize: '1.15em', fontWeight: '700', lineHeight: '1.5', color: '#33544f' },
    '.cm-md-h5': { fontSize: '1.05em', fontWeight: '700', color: '#33544f' },
    '.cm-md-h6': { fontSize: '1em', fontWeight: '700', color: '#5d6d6b' },

    '.cm-md-strong': { fontWeight: '700' },
    '.cm-md-em': { fontStyle: 'italic' },
    '.cm-md-strike': { textDecoration: 'line-through', opacity: '.62' },
    '.cm-md-code': {
      fontFamily: 'ui-monospace, SFMono-Regular, "Cascadia Mono", Consolas, monospace',
      background: '#eaf1f0',
      color: '#33544f',
      borderRadius: '4px',
      padding: '.08em .32em',
      fontSize: '.88em',
    },
    '.cm-md-link': {
      color: '#4d7572',
      textDecoration: 'underline',
      textUnderlineOffset: '2px',
      cursor: 'pointer',
    },
    '.cm-md-quote-line': {
      // 与站点 styles.styl 的 .post-body blockquote 逐项对齐：
      // 左边框是琥珀（不是烟雨青）、正文色是深青、底色是 --green-wash
      borderLeft: '3px solid #d98324',
      paddingLeft: '.75em',
      color: '#33544f',
      backgroundColor: '#eef4f3',
    },
    '.cm-md-bullet': {
      color: '#33544f',
      fontWeight: '700',
      display: 'inline-block',
      width: '.95em',
    },
    '.cm-md-hr': {
      display: 'inline-block',
      width: '100%',
      borderTop: '2px solid rgba(31, 81, 71, .18)',
      verticalAlign: 'middle',
      margin: '.4em 0',
    },
    '.cm-md-image': {
      display: 'block',
      maxWidth: '100%',
      borderRadius: '6px',
      margin: '.25em 0',
      border: '1px solid rgba(31, 81, 71, .12)',
    },
    '.cm-md-image-broken': {
      display: 'inline-block',
      padding: '.1em .45em',
      border: '1px dashed rgba(31, 81, 71, .3)',
      borderRadius: '4px',
      color: '#8a9a98',
      fontSize: '.9em',
    },
    '.cm-md-mark': { color: '#a9b6b4' },

    /* 代码块：逐行加底色，视觉上连成一块 */
    '.cm-md-codeblock': {
      backgroundColor: '#f3f6f4',
      fontFamily: 'ui-monospace, SFMono-Regular, "Cascadia Mono", Consolas, monospace',
      fontSize: '.88em',
    },
    '.cm-md-codeblock-first': {
      borderTopLeftRadius: '6px',
      borderTopRightRadius: '6px',
      paddingTop: '.35em',
    },
    '.cm-md-codeblock-last': {
      borderBottomLeftRadius: '6px',
      borderBottomRightRadius: '6px',
      paddingBottom: '.35em',
    },

    /* 任务列表勾选框 */
    '.cm-md-task': {
      display: 'inline-block',
      width: '1em',
      height: '1em',
      lineHeight: '1em',
      textAlign: 'center',
      borderRadius: '3px',
      border: '1.5px solid rgba(31, 81, 71, .4)',
      marginRight: '.35em',
      cursor: 'pointer',
      userSelect: 'none',
      transition: 'background-color .12s ease, border-color .12s ease',
      fontSize: '.85em',
      verticalAlign: 'baseline',
      color: '#33544f',
    },
    '.cm-md-task-done': {
      backgroundColor: '#33544f',
      borderColor: '#33544f',
      color: '#fff',
    },

    /* 表格：只做轻量的等宽与分隔感 */
    '.cm-md-table-line': {
      fontFamily: 'ui-monospace, SFMono-Regular, "Cascadia Mono", Consolas, monospace',
      fontSize: '.9em',
      color: '#4c5f5d',
    },
    '.cm-md-tok-keyword': { color: '#444', fontWeight: '700' },
    '.cm-md-tok-string': { color: '#880000' },
    '.cm-md-tok-number': { color: '#880000' },
    '.cm-md-tok-comment': { color: '#697070' },
    '.cm-md-tok-function': { color: '#880000', fontWeight: '700' },
    '.cm-md-tok-property': { color: '#444' },
    '.cm-md-tok-type': { color: '#880000' },
    '.cm-md-codeinfo': { color: '#9aa8a6', fontStyle: 'italic' },
    '.cm-md-table-pipe': { color: '#c6d0ce', fontWeight: '300' },
    '.cm-md-table-widget': {
      margin: '10px 0 14px 0',
    },
    '.cm-md-table-widget table': {
      borderCollapse: 'collapse',
      width: '100%',
      fontSize: '.94em',
      lineHeight: '1.6',
      color: '#1c2b2a',
      border: '1px solid #d8e5e3',
      borderRadius: '10px',
      overflow: 'hidden',
      display: 'table',
    },
    '.cm-md-table-widget th': {
      background: '#eef4f3',
      color: '#33544f',
      fontWeight: '700',
      padding: '9px 12px',
      borderBottom: '1px solid #d8e5e3',
      textAlign: 'left',
    },
    '.cm-md-table-widget td': {
      padding: '9px 12px',
      borderTop: '1px solid #edf2f1',
    },
    '.cm-md-table-widget tbody tr:nth-child(even)': {
      background: '#fafcfb',
    },
    '.cm-md-table-align': { color: '#d2dcda', fontStyle: 'italic', fontSize: '.82em' },
    '.cm-md-table-head': { fontWeight: '700', color: '#1c2b2a' },
  });

  /* ---------------------------------------------------------------- 工具 */

  function collectActiveLines(state) {
    var lines = new Set();
    for (var i = 0; i < state.selection.ranges.length; i += 1) {
      var range = state.selection.ranges[i];
      var startLine = state.doc.lineAt(range.from).number;
      var endLine = state.doc.lineAt(range.to).number;
      for (var n = startLine; n <= endLine; n += 1) lines.add(n);
    }
    return lines;
  }

  var HIDE_WHEN_INACTIVE = new Set([
    'EmphasisMark',
    'CodeMark',
    'StrikethroughMark',
    'LinkMark',
    'URL',
    'QuoteMark',
    'ListMark',
    'HeaderMark',
  ]);

  /* ---------------------------------------------------------------- 主逻辑 */

  function buildDecorations(view) {
    try {
      return buildDecorationsUnsafe(view);
    } catch (err) {
      // 装饰构建抛异常时，CodeMirror 会静默丢掉整个插件，页面看起来"所有标记都露出来了"。
      // 把异常留在 window 上，方便在控制台 __CM_DECO_ERROR__ 里直接看到。
      window.__CM_DECO_ERROR__ = String((err && err.stack) || err);
      return { all: Decoration.none, atomic: Decoration.none };
    }
  }

  /* ---------------- 代码块轻量着色 ----------------
   * CodeMirror 的 parseMixed 在这套依赖组合下不产生子语言节点（nest 回调零调用），
   * 所以代码块内部的高亮自己分词，不依赖子语言 parser。够用且完全可控。 */
  var CODE_KEYWORDS = {
    js: ('var let const function return if else for while do switch case break continue new delete typeof instanceof in of '
      + 'class extends super this try catch finally throw async await yield import export from as default null undefined true false void').split(' '),
    python: ('def class return if elif else for while break continue import from as pass raise try except finally with '
      + 'lambda yield global nonlocal assert del in is not and or None True False self async await').split(' '),
    bash: ('if then else elif fi for while do done case esac function return exit local export source echo cd sudo '
      + 'set unset trap read eval exec test').split(' '),
    css: ('important media supports keyframes import charset font-face').split(' '),
    default: ('var let const function return if else for while class new this true false null undefined import export '
      + 'public private static void def self None True False').split(' '),
  };

  function codeKeywordSet(lang) {
    var key = lang === 'sh' ? 'bash' : lang;
    var list = CODE_KEYWORDS[key] || CODE_KEYWORDS.default;
    var set = Object.create(null);
    for (var i = 0; i < list.length; i += 1) set[list[i]] = true;
    return set;
  }

  // 返回相对偏移的 token：[{ from, to, cls }]
  function tokenizeCode(text, lang) {
    var tokens = [];
    var keywords = codeKeywordSet(lang);
    var hashComment = lang === 'python' || lang === 'bash' || lang === 'sh'
      || lang === 'yaml' || lang === 'yml' || lang === 'toml' || lang === 'ruby';
    var i = 0;
    var n = text.length;

    function push(from, to, cls) {
      if (to > from) tokens.push({ from: from, to: to, cls: cls });
    }

    while (i < n) {
      var ch = text.charAt(i);
      var next = text.charAt(i + 1);

      // 行注释
      if (hashComment && ch === '#' && text.charAt(i - 1) !== '\\') {
        var eol = text.indexOf('\n', i);
        if (eol < 0) eol = n;
        push(i, eol, 'cm-md-tok-comment');
        i = eol;
        continue;
      }
      if (!hashComment && ch === '/' && next === '/') {
        var eol2 = text.indexOf('\n', i);
        if (eol2 < 0) eol2 = n;
        push(i, eol2, 'cm-md-tok-comment');
        i = eol2;
        continue;
      }
      // 块注释
      if (ch === '/' && next === '*') {
        var close = text.indexOf('*/', i + 2);
        close = close < 0 ? n : close + 2;
        push(i, close, 'cm-md-tok-comment');
        i = close;
        continue;
      }
      // 字符串
      if (ch === '"' || ch === "'" || ch === '`') {
        var j = i + 1;
        while (j < n) {
          if (text.charAt(j) === '\\') { j += 2; continue; }
          if (text.charAt(j) === ch) { j += 1; break; }
          if (text.charAt(j) === '\n' && ch !== '`') break;
          j += 1;
        }
        push(i, Math.min(j, n), 'cm-md-tok-string');
        i = Math.min(j, n);
        continue;
      }
      // 数字（前面不能紧贴标识符字符，避免吃掉 foo2 里的 2）
      if (ch >= '0' && ch <= '9' && !/[A-Za-z_$]/.test(text.charAt(i - 1))) {
        var num = /^[0-9]+(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/.exec(text.slice(i));
        if (num) {
          push(i, i + num[0].length, 'cm-md-tok-number');
          i += num[0].length;
          continue;
        }
      }
      // 标识符 / 关键字 / 函数名 / 属性 / 类型
      if (/[A-Za-z_$]/.test(ch)) {
        var word = /^[A-Za-z_$][\w$]*/.exec(text.slice(i));
        var end = i + word[0].length;
        var body = word[0];
        if (keywords[body]) {
          push(i, end, 'cm-md-tok-keyword');
        } else if (text.charAt(i - 1) === '.') {
          push(i, end, 'cm-md-tok-property');
        } else if (body.charAt(0) >= 'A' && body.charAt(0) <= 'Z') {
          // 大驼峰优先判成类型：new Foo() / Foo.bar 这类更常见
          push(i, end, 'cm-md-tok-type');
        } else if (/^[ \t]*\(/.test(text.slice(end, end + 4))) {
          push(i, end, 'cm-md-tok-function');
        }
        i = end;
        continue;
      }
      i += 1;
    }
    return tokens;
  }

  // 把分词结果落到以 base 为原点的文档区间上
  function highlightCode(text, base, lang, out) {
    var tokens = tokenizeCode(text, lang);
    for (var i = 0; i < tokens.length; i += 1) {
      var t = tokens[i];
      out.push(Decoration.mark({ class: t.cls }).range(base + t.from, base + t.to));
    }
  }

  function buildDecorationsUnsafe(view) {
    var state = view.state;
    /* 用户要求：编辑时不显示 #、>、** 这类最终会被隐藏的语法符号。
       因此活动行也按普通行处理，activeLines 恒为空。
       若要恢复「光标所在行显示源码标记」的 Typora 行为，
       把下一行换回 collectActiveLines(state) 即可。 */
    var activeLines = new Set();
    var decorations = [];
    // 只收集 replace 装饰，供 atomicRanges 使用
    var atomicDecorations = [];

    function hide(from, to) {
      if (to <= from) return;
      var deco = Decoration.replace({}).range(from, to);
      decorations.push(deco);
      atomicDecorations.push(deco);
    }

    function style(from, to, className) {
      if (to > from) decorations.push(Decoration.mark({ class: className }).range(from, to));
    }

    var tree = syntaxTree(state);

    for (var r = 0; r < view.visibleRanges.length; r += 1) {
      var range = view.visibleRanges[r];

      tree.iterate({
        from: range.from,
        to: range.to,
        enter: function (node) {
          var name = node.name;
          var line = state.doc.lineAt(node.from);
          var isActive = activeLines.has(line.number);

          /* ---- 标题：整行放大 ---- */
          if (/^ATXHeading[1-6]$/.test(name)) {
            style(node.from, node.to, 'cm-md-h' + name.slice(-1));
            return true;
          }
          if (name === 'SetextHeading1') { style(node.from, node.to, 'cm-md-h1'); return true; }
          if (name === 'SetextHeading2') { style(node.from, node.to, 'cm-md-h2'); return true; }

          /* ---- 行内格式 ---- */
          if (name === 'StrongEmphasis') { style(node.from, node.to, 'cm-md-strong'); return true; }
          if (name === 'Emphasis') { style(node.from, node.to, 'cm-md-em'); return true; }
          if (name === 'Strikethrough') { style(node.from, node.to, 'cm-md-strike'); return true; }
          if (name === 'InlineCode') { style(node.from, node.to, 'cm-md-code'); return true; }
          if (name === 'Link') { style(node.from, node.to, 'cm-md-link'); return true; }
          /* ---- 引用：逐行加左边框，避免跨行时每行重复描边 ---- */
          if (name === 'Blockquote') {
            var bqStart = state.doc.lineAt(node.from).number;
            var bqEnd = state.doc.lineAt(node.to).number;
            for (var bqLine = bqStart; bqLine <= bqEnd; bqLine += 1) {
              var bqObj = state.doc.line(bqLine);
              decorations.push(Decoration.line({ class: 'cm-md-quote-line' }).range(bqObj.from));
            }
            return true;
          }

          /* ---- 图片：仅当独占一行时才替换成真实图片 ----
             行内图片保留源码，避免把段落切断 */
          if (name === 'Image') {
            if (!isActive) {
              var raw = state.doc.sliceString(node.from, node.to);
              var m = /^!\[([^\]]*)\]\(\s*([^)\s]+)/.exec(raw);
              if (m) {
                var lineFrom = line.from;
                var lineTo = line.to;
                var beforeText = state.doc.sliceString(lineFrom, node.from).trim();
                var afterText = state.doc.sliceString(node.to, lineTo).trim();
                var aloneOnLine = beforeText === '' && afterText === '';
                if (aloneOnLine) {
                  var imageDeco = Decoration.replace({
                    widget: new ImageWidget(m[2], m[1]),
                  }).range(node.from, node.to);
                  decorations.push(imageDeco);
                  atomicDecorations.push(imageDeco);
                  return false;
                }
              }
            }
            return true;
          }

          /* ---- 分隔线：替换成横线 ---- */
          if (name === 'HorizontalRule') {
            if (!isActive) {
              var ruleDeco = Decoration.replace({
                widget: new RuleWidget(),
              }).range(node.from, node.to);
              decorations.push(ruleDeco);
              atomicDecorations.push(ruleDeco);
              return false;
            }
            return true;
          }

          /* ---- 无序列表符号：普通项换成圆点，任务项只把 "-" 藏掉 ---- */
          if (name === 'ListMark') {
            var markText = state.doc.sliceString(node.from, node.to);
            // 后面紧跟 "[ ]" 或 "[x]" 说明这是任务列表项，勾选框由 TaskWidget 负责
            var afterMark = state.doc.sliceString(node.to, Math.min(node.to + 6, state.doc.length));
            var isTaskItem = /^\s+\[[ xX]\]/.test(afterMark);
            if (!isActive && /^[-*+]$/.test(markText)) {
              if (isTaskItem) {
                // 任务项：藏掉 "-" 与紧随其后的空格，让勾选框顶到行首
                var afterOne = node.to < state.doc.length ? state.doc.sliceString(node.to, node.to + 1) : '';
                hide(node.from, afterOne === ' ' ? node.to + 1 : node.to);
                return false;
              }
              var bulletDeco = Decoration.replace({
                widget: new BulletWidget(),
              }).range(node.from, node.to);
              decorations.push(bulletDeco);
              atomicDecorations.push(bulletDeco);
              return false;
            }
            return true;
          }

          /* ---- 代码块：逐行加底色，让整块看起来是一个盒子 ---- */
          if (name === 'FencedCode' || name === 'CodeBlock') {
            var startLine = state.doc.lineAt(node.from).number;
            var endLine = state.doc.lineAt(node.to).number;
            for (var ln = startLine; ln <= endLine; ln += 1) {
              var deco = Decoration.line({ class: 'cm-md-codeblock' });
              var lineObj = state.doc.line(ln);
              if (ln === startLine) deco = Decoration.line({ class: 'cm-md-codeblock cm-md-codeblock-first' });
              else if (ln === endLine) deco = Decoration.line({ class: 'cm-md-codeblock cm-md-codeblock-last' });
              decorations.push(deco.range(lineObj.from));
            }
            return true;
          }

          /* ---- 任务列表：[ ] / [x] ---- */
          // Task 是整个任务项的容器，范围覆盖正文（"- [x] 已完成的任务" 里的
          // "[x] 已完成的任务"），整体替换会把正文一起吞掉。只替换 TaskMarker。
          if (name === 'Task') return true;
          if (name === 'TaskMarker') {
            var marker = state.doc.sliceString(node.from, node.to);
            var taskMatch = /^\[([ xX])\]/.exec(marker);
            if (taskMatch && !isActive) {
              var taskDeco = Decoration.replace({
                widget: new TaskWidget(
                  taskMatch[1].toLowerCase() === 'x',
                  node.from,
                  node.to,
                ),
              }).range(node.from, node.to);
              decorations.push(taskDeco);
              atomicDecorations.push(taskDeco);
              return false;
            }
            return true;
          }

          /* ---- 代码块的语言标签 ---- */
          if (name === 'CodeInfo') {
            if (!isActive) style(node.from, node.to, 'cm-md-codeinfo');
            return false;
          }

          /* ---- 代码块正文：自己分词上色 ---- */
          if (name === 'CodeText') {
            var parent = node.node.parent;
            while (parent && parent.name !== 'FencedCode' && parent.name !== 'CodeBlock') parent = parent.parent;
            if (parent) {
              var infoNode = parent.getChild('CodeInfo');
              if (infoNode) {
                var lang = state.doc.sliceString(infoNode.from, infoNode.to).trim().split(/\s+/)[0].toLowerCase();
                if (lang) {
                  highlightCode(state.doc.sliceString(node.from, node.to), node.from, lang, decorations);
                }
              }
            }
            return false;
          }


          /* ---- 表格整块 ----
             光标不在表内时，整块由 tablePreview（EditorView.decorations.compute）
             替换成真表格。这里必须让路：同一段文字上既有 line 装饰又有 block replace
             时，CodeMirror 会丢掉块级替换，表现就是表格退回源码。
             光标进了表格才走下面那套「竖线弱化 + 表头加粗」的源码美化。 */
          if (name === 'Table') {
            var tableSelection = state.selection.main;
            if (!(tableSelection.from <= node.to && tableSelection.to >= node.from)) return false;
            return true;
          }

          /* ---- 表格：竖线弱化成网格线，表头加粗，对齐行再淡一档 ---- */
          if (name === 'TableDelimiter') {
            var delimText = state.doc.sliceString(node.from, node.to);
            if (delimText.length > 1) {
              /* 整段对齐行（| :--- | ---: |），压淡当分隔线看 */
              style(node.from, node.to, 'cm-md-table-align');
            } else {
              /* 单元格之间的单根竖线，弱化成网格线 */
              style(node.from, node.to, 'cm-md-table-pipe');
            }
            return false;
          }
          if (name === 'TableHeader' || name === 'TableRow') {
            style(node.from, node.to, 'cm-md-table-line');
            return true;
          }
          if (name === 'TableCell') {
            var cellParent = node.node.parent;
            if (cellParent && cellParent.name === 'TableHeader') {
              style(node.from, node.to, 'cm-md-table-head');
            }
            return false;
          }

          /* ---- 其余标记符号：非当前行时隐藏 ---- */
          if (HIDE_WHEN_INACTIVE.has(name)) {
            if (!isActive) {
              hide(node.from, node.to);
              return false;
            }
            style(node.from, node.to, 'cm-md-mark');
            return false;
          }

          return true;
        },
      });
    }

    decorations.sort(function (a, b) { return a.from - b.from || a.to - b.to; });
    atomicDecorations.sort(function (a, b) { return a.from - b.from || a.to - b.to; });
    return {
      all: Decoration.set(decorations),
      atomic: Decoration.set(atomicDecorations),
    };
  }

  /* 表格块级装饰：光标不在表格内时把整块替换成真表格，选区一进去就退回源码。 */
  function tableBlockStart(doc, tableFrom) {
    var line = doc.lineAt(tableFrom);
    while (line.number > 1) {
      var previous = doc.line(line.number - 1);
      if (previous.text.trim() !== '') break;
      line = previous;
    }
    return line.from;
  }

  var tablePreview = EditorView.decorations.compute(['doc', 'selection'], function (state) {
    var tree = syntaxTree(state);
    var ranges = state.selection.ranges;
    var items = [];

    tree.iterate({
      enter: function (node) {
        if (node.name !== 'Table') return;
        for (var index = 0; index < ranges.length; index += 1) {
          if (ranges[index].from <= node.to && ranges[index].to >= node.from) return false;
        }
        items.push(
          Decoration.replace({
            widget: new TableWidget(state.doc.sliceString(node.from, node.to)),
            block: true,
          }).range(tableBlockStart(state.doc, node.from), node.to),
        );
        return false;
      },
    });

    return Decoration.set(items);
  });

  var livePreview = ViewPlugin.fromClass(
    class {
      constructor(view) {
        var result = buildDecorations(view);
        this.decorations = result.all;
        this.atomic = result.atomic;
      }
      update(update) {
        /* 只在这两种情况下重建：
             docChanged      —— 内容变了，装饰当然要重算
             viewportChanged —— 装饰是按 view.visibleRanges 逐段生成的，
                                滚动到新位置必须补上那一段
           特意不含 selectionSet：activeLines 恒为空（编辑时不显示源码标记），
           光标移动不会改变任何装饰的结果。以前每次点选、每次打字都白算一遍
           整棵语法树，长文档（近 400 行）在快速输入时会攒出可感的卡顿。 */
        if (update.docChanged || update.viewportChanged) {
          var result = buildDecorations(update.view);
          this.decorations = result.all;
          this.atomic = result.atomic;
        }
      }
    },
    {
      decorations: function (value) { return value.decorations; },
      provide: function (plugin) {
        return EditorView.atomicRanges.of(function (view) {
          var instance = view.plugin(plugin);
          return instance ? instance.atomic : Decoration.none;
        });
      },
    },
  );

  /* ---------------------------------------------------------------- 语法高亮 */

  var markdownHighlight = HighlightStyle.define([
    /* --- Markdown 自身 --- */
    { tag: tags.heading, fontWeight: '700' },
    { tag: tags.strong, fontWeight: '700' },
    { tag: tags.emphasis, fontStyle: 'italic' },
    { tag: tags.strikethrough, textDecoration: 'line-through' },
    { tag: tags.link, color: '#4d7572' },
    { tag: tags.url, color: '#8a9a98' },
    { tag: tags.monospace, fontFamily: 'ui-monospace, monospace' },
    { tag: tags.quote, color: '#5d6d6b' },
    { tag: tags.list, color: '#33544f' },
    { tag: tags.contentSeparator, color: '#9aa8a6' },

    /* --- 代码块里的编程语言 ---
       不补这一组的话，代码块能正确解析、也能折叠，但所有 token 都继承
       正文字色，看起来和纯文本没有区别，像是"高亮坏了"。配色取 One Light
       的色板，整体饱和度压低一点，跟站点的墨绿主色不打架。 */
    { tag: [tags.keyword, tags.controlKeyword, tags.moduleKeyword, tags.definitionKeyword], color: '#a626a4' },
    { tag: [tags.string, tags.special(tags.string)], color: '#4e8a3f' },
    { tag: [tags.number, tags.bool, tags.null, tags.atom], color: '#b76b01' },
    { tag: [tags.comment, tags.lineComment, tags.blockComment, tags.docComment], color: '#9aa1a8', fontStyle: 'italic' },
    { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: '#4078f2' },
    { tag: tags.variableName, color: '#3b4045' },
    { tag: [tags.propertyName, tags.attributeName], color: '#986801' },
    { tag: [tags.typeName, tags.className, tags.namespace], color: '#c18401' },
    { tag: [tags.tagName, tags.labelName], color: '#e45649' },
    { tag: [tags.operator, tags.punctuation, tags.bracket, tags.separator], color: '#5b6067' },
    { tag: [tags.regexp, tags.escape], color: '#c18401' },
    { tag: [tags.meta, tags.processingInstruction], color: '#9aa1a8' },
    { tag: tags.invalid, color: '#e45649', textDecoration: 'underline wavy #e45649' },
  ]);

  /* ---------------------------------------------------------------- 快捷键工具 */

  /**
   * 对选中文本套用/取消一层行内标记。
   * 已经包裹时再按一次会拆掉，符合 Typora 的直觉。
   */
  function toggleInlineMark(view, before, after, placeholder) {
    var state = view.state;
    var range = state.selection.main;
    var from = range.from;
    var to = range.to;
    var selected = state.sliceDoc(from, to);

    var outerFrom = from - before.length;
    var outerTo = to + after.length;
    var hasWrapper = outerFrom >= 0
      && outerTo <= state.doc.length
      && state.sliceDoc(outerFrom, from) === before
      && state.sliceDoc(to, outerTo) === after;

    if (hasWrapper) {
      view.dispatch({
        changes: [
          { from: outerFrom, to: from, insert: '' },
          { from: to, to: outerTo, insert: '' },
        ],
        selection: { anchor: outerFrom, head: outerFrom + selected.length },
      });
      return true;
    }

    var text = selected || (placeholder || '文本');
    view.dispatch({
      changes: { from: from, to: to, insert: before + text + after },
      selection: { anchor: from + before.length, head: from + before.length + text.length },
    });
    return true;
  }

  window.TyporaPreview = {
    livePreview: livePreview,
    liveStyles: liveStyles,
    highlight: syntaxHighlighting(markdownHighlight),
    toggleInlineMark: toggleInlineMark,
    tablePreview: tablePreview,
  };
})();
