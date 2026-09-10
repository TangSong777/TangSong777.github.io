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

  function update(markdown, metadata) {
    const document = splitDocument(markdown);
    const entries = collectEntries(document.lines);
    const removedIndexes = new Set();
    for (const entry of entries) {
      if (!knownKeys.has(entry.key)) continue;
      for (let index = entry.start; index < entry.end; index += 1) removedIndexes.add(index);
    }

    const remaining = document.lines.filter((line, index) => !removedIndexes.has(index));
    while (remaining.length && !remaining[0].trim()) remaining.shift();
    while (remaining.length && !remaining.at(-1).trim()) remaining.pop();

    const date = fromDateTimeLocal(metadata.date);
    if (!String(metadata.title || '').trim()) throw new Error('文章标题不能为空。');
    if (!date) throw new Error('请选择有效的发布时间。');

    const fields = [
      `title: ${yamlString(String(metadata.title).trim())}`,
      `date: ${date}`,
    ];
    const updated = fromDateTimeLocal(metadata.updated);
    if (updated) fields.push(`updated: ${updated}`);
    fields.push(`categories: ${yamlList(cleanList(metadata.categories))}`);
    fields.push(`tags: ${yamlList(cleanList(metadata.tags))}`);
    fields.push(`description: ${yamlString(String(metadata.description || '').trim())}`);
    if (remaining.length) fields.push('', ...remaining);

    const separator = document.newline;
    const bodyPrefix = document.hasFrontMatter ? separator : `${separator}${separator}`;
    return `---${separator}${fields.join(separator)}${separator}---${bodyPrefix}${document.body}`;
  }

  global.ArticleMetadata = Object.freeze({ splitDocument, read, update, toDateTimeLocal, currentLocalDateTime, fromDateTimeLocal });
}(globalThis));
