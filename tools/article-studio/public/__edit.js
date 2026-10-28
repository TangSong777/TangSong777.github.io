window.__ERR__ = null;
window.onerror = function (m, s, l, c) { window.__ERR__ = m + " @" + l + ":" + c; };
var SRC = "---\ntitle: 编辑器自检\ndate: 2026-10-28 10:00:00\ncategories:\n  - 小项目\ntags:\n  - 工具\n---\n\n# 一级标题\n\n正文里有 **粗体**、*斜体*、~~删除线~~、`行内代码` 和 [链接](https://example.com)。\n\n> 引用块的第一行\n> 引用块的第二行\n\n- 无序项一\n- 无序项二\n  - 嵌套项\n\n1. 有序项一\n2. 有序项二\n\n- [ ] 未完成的任务\n- [x] 已完成的任务\n\n```js\nconst answer = 42;\nfunction greet(name) { return \"Hello, \" + name; }\n```\n\n| 项目 | 规格 | 备注 |\n| :--- | :---: | ---: |\n| 处理器 | RK3588 | 8 核 |\n| 内存 | 8GB | LPDDR5 |\n\n---\n\n## 二级标题\n\n结尾段落，用来观察行距与光标。\n";
(function () {
  var q = new URLSearchParams(location.search);
  if (q.get("embed") === "1") document.body.classList.add("embed-mode");
  function report(rows) { document.title = rows.join(" | "); }
  function boot() {
    try {
      var CM = window.CM, TP = window.TyporaPreview;
      if (!CM || !TP) { report(["CM=" + !!CM, "TP=" + !!TP, "ERR=" + window.__ERR__]); return; }
      var state = CM.EditorState.create({
        doc: SRC,
        extensions: [
          CM.markdown({ base: CM.markdownLanguage }),
          CM.history(),
          CM.highlightSpecialChars(),
          CM.drawSelection(),
          CM.dropCursor(),
          CM.EditorView.lineWrapping,
          TP.highlight, TP.livePreview, TP.tablePreview, TP.liveStyles
        ]
      });
      var view = new CM.EditorView({ state: state, parent: document.getElementById("box") });
      window.__view = view;
      setTimeout(function () {
        var lines = view.contentDOM.querySelectorAll(".cm-line");
        var tables = view.contentDOM.querySelectorAll(".cm-md-table-widget");
        var tasks = view.contentDOM.querySelectorAll(".cm-md-task");
        var bullets = view.contentDOM.querySelectorAll(".cm-md-bullet");
        var overlay = document.querySelector("#box").getBoundingClientRect();
        var firstLine = lines.length ? getComputedStyle(lines[0]) : null;
        report([
          "CM键=" + Object.keys(CM).length,
          "错误=" + (window.__ERR__ || window.__CM_DECO_ERROR__ || "无"),
          "行数=" + lines.length,
          "表格=" + tables.length,
          "任务=" + tasks.length,
          "圆点=" + bullets.length,
          "编辑区=" + Math.round(overlay.width) + "x" + Math.round(overlay.height),
          "bodyclass=" + document.body.className
        ]);
      }, 900);
    } catch (e) { report(["异常=" + e.message]); }
  }
  boot();
})();
