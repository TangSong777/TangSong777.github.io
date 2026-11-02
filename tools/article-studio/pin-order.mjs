/**
 * 博客首页置顶（Hexo front-matter `sticky`）的换算规则。
 *
 * Hexo 的 `hexo-generator-index` 是按 `(b.sticky || 0) - (a.sticky || 0)` 排序的，
 * 所以 sticky 是「数值越大越靠前」，没有该字段（或为 0）就落回按日期排序。
 * 这里统一把「第 1 位 … 第 N 位」换算成 N … 1，读的时候按降序还原成顺序表。
 */

const FRONT_MATTER = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

/** 读取文章里的 sticky；没有 / 0 / 非法值都当作「没置顶」。 */
export function readSticky(markdown) {
  const match = String(markdown || '').match(FRONT_MATTER);
  if (!match) return null;
  const line = match[1].split(/\r?\n/).find((item) => /^sticky[ \t]*:/.test(item));
  if (!line) return null;
  const raw = line.replace(/^sticky[ \t]*:[ \t]*/, '').trim().replace(/^['"]|['"]$/g, '');
  if (!raw || raw === 'null' || raw === '~' || raw === 'false') return null;
  if (raw === 'true') return 1;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** 写入 / 清除 sticky，保持 front matter 其它字段的位置和原样。 */
export function writeSticky(markdown, value) {
  const text = String(markdown || '');
  const newline = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.split(/\r?\n/);
  if ((lines[0] || '').trim() !== '---') throw new Error('文章缺少 front matter，无法设置置顶。');
  let end = -1;
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index].trim() === '---') {
      end = index;
      break;
    }
  }
  if (end < 0) throw new Error('文章的 front matter 没有闭合，无法设置置顶。');
  const block = lines.slice(1, end);
  const position = block.findIndex((line) => /^sticky[ \t]*:/.test(line));
  const wanted = Number(value);
  const next = Number.isFinite(wanted) && wanted > 0 ? `sticky: ${Math.trunc(wanted)}` : null;
  if (position >= 0) {
    if (next) block[position] = next;
    else block.splice(position, 1);
  } else if (next) {
    block.push(next);
  } else {
    return text;
  }
  return ['---', ...block, '---', ...lines.slice(end + 1)].join(newline);
}

/** 把「第 1 位最前」的顺序表换算成每篇文章该写的 sticky 值。 */
export function rankSticky(order) {
  const list = Array.isArray(order) ? order.filter(Boolean) : [];
  return new Map(list.map((path, index) => [path, list.length - index]));
}

/**
 * 算出要把所有文章改成什么样。
 * order 里出现的按顺序写 sticky；没出现的（含原本置顶但已移出列表的）一律清掉 sticky。
 * 返回 [{path, content}]，只包含内容真的变了的文章。
 */
export function planPinOrder(entries, order) {
  const ranks = rankSticky(order);
  const updates = [];
  for (const entry of entries || []) {
    const path = entry && entry.path;
    if (!path) continue;
    const source = String(entry.content || '');
    const wanted = ranks.has(path) ? ranks.get(path) : null;
    const current = readSticky(source);
    if (wanted === current) continue;
    const content = writeSticky(source, wanted);
    if (content !== source) updates.push({ path, content });
  }
  return updates;
}

/* ---------- 全站排序（所有文章可自由调整） ---------- */

function timeOf(entry) {
  const value = String((entry && (entry.date || entry.updatedAt)) || '');
  const parsed = Date.parse(value.includes('T') ? value : value.replace(' ', 'T'));
  return Number.isFinite(parsed) ? parsed : 0;
}

function keyOfPath(entries, path) {
  const entry = entries.find((item) => item.path === path);
  return timeOf(entry || {});
}

/**
 * 按「希望的前后顺序」推算每篇文章该写的 sticky。
 *
 * Hexo 的 index 生成器只按 sticky 降序稳定排序（其余保持发布时间倒序），
 * 所以「手排的头部」用 sticky 固定住，最长的、本身已按时间倒序的尾巴留空即可，
 * 这样以后新写的文章会自动落在尾巴最前面，不需要每次重排。
 *
 * order: 全部文章路径，按希望的显示顺序排列。
 */
export function planArticleOrder(entries, order) {
  const pool = (entries || []).filter((item) => item && item.path);
  const byPath = new Map(pool.map((item) => [item.path, item]));
  const wanted = [];
  for (const path of order || []) {
    const normalized = String(path);
    if (byPath.has(normalized) && !wanted.includes(normalized)) wanted.push(normalized);
  }
  if (!wanted.length) return [];

  let tailStart = wanted.length;
  for (let index = wanted.length - 1; index >= 1; index -= 1) {
    if (keyOfPath(pool, wanted[index - 1]) >= keyOfPath(pool, wanted[index])) tailStart = index - 1;
    else break;
  }

  const ranks = new Map();
  for (let index = 0; index < tailStart; index += 1) ranks.set(wanted[index], tailStart - index);

  const updates = [];
  for (const entry of pool) {
    const wantedRank = ranks.has(entry.path) ? ranks.get(entry.path) : null;
    const current = readSticky(entry.content);
    if (wantedRank === current) continue;
    const content = writeSticky(entry.content, wantedRank);
    if (content !== entry.content) updates.push({ path: entry.path, content });
  }
  return updates;
}
