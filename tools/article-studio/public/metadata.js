(function attachArticleMetadata(global) {
  const knownKeys = new Set(['title', 'date', 'updated', 'categories', 'tags', 'description']);

  function splitDocument(markdown) {
    const newline = markdown.includes('\r\n') ? '\r\n' : '\n';
    const match = markdown.match(/^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/);
    if (!match) return { hasFrontMatter: false, lines: [], body: markdown, bodyStart: 0, newline };
    return {
      hasFrontMatter: true,
      lines: match[1].split(/\r?\n/),
      body: markdown.slice(match[0].length),
      bodyStart: match[0].length,
      newline,
    };
  }

  function collectEntries(lines) {
    const entries = [];
    for (let index = 0; index < lines.length; index += 1) {
      const match = lines[index].match(/^([A-Za-z_][\w-]*):(?:[ \t]*(.*))?$/);
      if (!match) continue;
      if (entries.length) entries.at(-1).end = index;
      entries.push({ key: match[1], value: match[2] || '', start: index, end: lines.length });
    }
    return entries;
  }

  function unquote(value) {
    const text = String(value || '').trim();
    if (text.startsWith('"') && text.endsWith('"')) {
      try { return JSON.parse(text); } catch { return text.slice(1, -1); }
    }
    if (text.startsWith("'") && text.endsWith("'")) return text.slice(1, -1).replace(/''/g, "'");
    return text === 'null' || text === '~' ? '' : text;
  }

  function splitFlowList(value) {
    const inner = value.trim().replace(/^\[/, '').replace(/\]$/, '');
    if (!inner.trim()) return [];
    const items = [];
    let current = '';
    let quote = '';
    let escaped = false;
    for (const character of inner) {
      if (escaped) {
        current += character;
        escaped = false;
      } else if (quote === '"' && character === '\\') {
        current += character;
        escaped = true;
      } else if (quote) {
        current += character;
        if (character === quote) quote = '';
      } else if (character === '"' || character === "'") {
        quote = character;
        current += character;
      } else if (character === ',') {
        items.push(unquote(current));
        current = '';
      } else {
        current += character;
      }
    }
    items.push(unquote(current));
    return items.map((item) => item.trim()).filter(Boolean);
  }

  function entryValue(entry, lines) {
    if (!entry) return '';
    return unquote(entry.value || lines.slice(entry.start + 1, entry.end).join('\n').trim());
  }

  function entryList(entry, lines) {
    if (!entry) return [];
    const inline = entry.value.trim();
    if (inline.startsWith('[') && inline.endsWith(']')) return splitFlowList(inline);
    if (inline) return [unquote(inline)].filter(Boolean);
    return lines.slice(entry.start + 1, entry.end)
      .map((line) => line.match(/^\s*-\s*(.*)$/)?.[1])
      .filter((value) => value !== undefined)
      .map(unquote)
      .filter(Boolean);
  }

  function toDateTimeLocal(value) {
    const text = unquote(value);
    const match = text.match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2})(?::(\d{2}))?)?/);
    if (!match) return '';
    return `${match[1]}T${match[2] || '00:00'}:${match[3] || '00'}`;
  }

  function currentLocalDateTime(date = new Date()) {
    const pad = (value) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }

  function read(markdown) {
    const document = splitDocument(markdown);
    const entries = collectEntries(document.lines);
    const byKey = new Map(entries.map((entry) => [entry.key, entry]));
    return {
      title: entryValue(byKey.get('title'), document.lines),
      date: toDateTimeLocal(entryValue(byKey.get('date'), document.lines)),
      updated: toDateTimeLocal(entryValue(byKey.get('updated'), document.lines)),
      categories: entryList(byKey.get('categories'), document.lines),
      tags: entryList(byKey.get('tags'), document.lines),
      description: entryValue(byKey.get('description'), document.lines),
    };
  }

  function yamlString(value) {
    return JSON.stringify(String(value || ''));
  }

  function yamlList(values) {
    return `[${values.map(yamlString).join(', ')}]`;
  }

  function cleanList(values) {
    const source = Array.isArray(values) ? values : String(values || '').split(/[,，\n]+/);
    return [...new Set(source.map((value) => String(value).trim()).filter(Boolean))];
  }

  function fromDateTimeLocal(value) {
    const match = String(value || '').match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::(\d{2}))?$/);
    if (!match) return '';
    return `${match[1]} ${match[2]}:${match[3] || '00'}`;
  }

  function sameList(a, b) {
    if (a.length !== b.length) return false;
    return a.every((value, index) => value === b[index]);
  }

  function update(markdown, metadata) {
    const document = splitDocument(markdown);
    const lines = document.lines.slice();
    const entries = collectEntries(lines);
    const byKey = new Map(entries.map((entry) => [entry.key, entry]));
    const startOf = new Map(entries.map((entry) => [entry.start, entry]));
    const original = read(markdown);

    const title = String(metadata.title || '').trim();
    const dateLocal = String(metadata.date || '').trim();
    const updatedLocal = String(metadata.updated || '').trim();
    const categories = cleanList(metadata.categories);
    const tags = cleanList(metadata.tags);
    const description = String(metadata.description || '').trim();

    const date = fromDateTimeLocal(dateLocal);
    if (!title) throw new Error('文章标题不能为空。');
    if (!date) throw new Error('请选择有效的发布时间。');

    /**
     * 字段是否被用户改动过。
     * 原文没有该字段时一律视为「改动」，这样新填的值才能写进去。
     */
    function changed(key) {
      if (!byKey.has(key)) return true;
      switch (key) {
        case 'title': return original.title !== title;
        case 'date': return original.date !== dateLocal;
        case 'updated': return original.updated !== updatedLocal;
        case 'categories': return !sameList(original.categories, categories);
        case 'tags': return !sameList(original.tags, tags);
        case 'description': return original.description !== description;
        default: return true;
      }
    }

    /** 该字段这次需要写出的行；返回 null 表示不写 */
    function serialized(key) {
      switch (key) {
        case 'title': return [`title: ${yamlString(title)}`];
        case 'date': return [`date: ${date}`];
        case 'updated': return updatedLocal ? [`updated: ${fromDateTimeLocal(updatedLocal)}`] : null;
        case 'categories': return [`categories: ${yamlList(categories)}`];
        case 'tags': return [`tags: ${yamlList(tags)}`];
        case 'description': return description ? [`description: ${yamlString(description)}`] : null;
        default: return null;
      }
    }

    /** 该字段在原文没有时要不要新建 */
    function shouldCreate(key) {
      switch (key) {
        case 'title':
        case 'date': return true;
        case 'categories': return categories.length > 0;
        case 'tags': return tags.length > 0;
        case 'description': return description.length > 0;
        case 'updated': return updatedLocal.length > 0;
        default: return false;
      }
    }

    const output = [];
    const written = new Set();
    let index = 0;

    while (index < lines.length) {
      const entry = startOf.get(index);
      if (!entry) {
        output.push(lines[index]);
        index += 1;
        continue;
      }

      const block = lines.slice(entry.start, entry.end);

      if (!knownKeys.has(entry.key)) {
        output.push(...block);            // 未知字段：原样、原位
      } else if (!changed(entry.key)) {
        output.push(...block);            // 没改：原样、原位（引号与 null 写法都保住）
        written.add(entry.key);
      } else {
        const next = serialized(entry.key);
        if (next) {
          output.push(...next);           // 真的改了：重新序列化
          written.add(entry.key);
        }
        // next 为 null 表示用户清空了这个可选字段 → 整块删掉
      }

      index = entry.end;
    }

    for (const key of knownKeys) {
      if (written.has(key) || byKey.has(key)) continue;
      if (!shouldCreate(key)) continue;
      const next = serialized(key);
      if (next) output.push(...next);
    }

    while (output.length && !output[0].trim()) output.shift();
    while (output.length && !output.at(-1).trim()) output.pop();

    const separator = document.newline;
    const bodyPrefix = document.hasFrontMatter ? separator : `${separator}${separator}`;
    return `---${separator}${output.join(separator)}${separator}---${bodyPrefix}${document.body}`;
  }

  global.ArticleMetadata = Object.freeze({ splitDocument, read, update, toDateTimeLocal, currentLocalDateTime, fromDateTimeLocal });
}(globalThis));
