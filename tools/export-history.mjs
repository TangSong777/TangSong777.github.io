#!/usr/bin/env node
/**
 * 导出思源《岁月史书》笔记本到 /srv/blog/history-source，供独立站点使用。
 * 复用 export-siyuan-notebook.mjs 的客户端与解压逻辑，仅更换笔记本与输出位置。
 */
import fs from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable, Transform } from 'node:stream';
import { createHash } from 'node:crypto';
import { createClient, extractArchive, exportOptions } from './export-siyuan-notebook.mjs';

const base = 'http://127.0.0.1:6806';
const notebookName = '岁月史书';
const target = '/srv/blog/history-source';

process.umask(0o077);
const { api, headers } = await createClient();
const listing = await api('/api/notebook/lsNotebooks');
const matches = listing.notebooks.filter((n) => n.name === notebookName && !n.closed);
if (matches.length !== 1) throw new Error(`需要恰好一个已打开的「${notebookName}」笔记本`);

const staging = '/srv/blog/staging';
await fs.mkdir(staging, { recursive: true, mode: 0o700 });
const runDir = await fs.mkdtemp(path.join(staging, 'history-export-'));
await fs.chmod(runDir, 0o700);

console.log(`[导出] 正在通过思源 API 导出${notebookName}`);
const result = await api('/api/export/exportNotebookMd', { notebook: matches[0].id, ...exportOptions }, 600000);
const zipUrl = new URL(result?.zip || '', base);
if (!result?.zip || zipUrl.origin !== base || !zipUrl.pathname.startsWith('/export/') || !zipUrl.pathname.endsWith('.zip')) {
  throw new Error('API 返回的 ZIP 地址不合法');
}
const response = await fetch(zipUrl, { headers, redirect: 'error', signal: AbortSignal.timeout(600000) });
if (!response.ok || !response.body) throw new Error(`导出 ZIP 下载失败：HTTP ${response.status}`);

let size = 0;
const hash = createHash('sha256');
const limit = new Transform({
  transform(chunk, encoding, callback) {
    size += chunk.length;
    if (size > 512 * 1024 ** 2) return callback(new Error('ZIP 超过 512 MiB 限制'));
    hash.update(chunk);
    callback(null, chunk);
  },
});
const archive = path.join(runDir, 'export.zip');
await pipeline(Readable.fromWeb(response.body), limit, createWriteStream(archive, { flags: 'wx', mode: 0o600 }));
const extracted = path.join(runDir, 'extracted');
const counts = await extractArchive(archive, extracted);

const entries = await fs.readdir(extracted, { withFileTypes: true });
const raw = entries.length === 1 && entries[0].isDirectory() && [notebookName, `${notebookName}.md`].includes(entries[0].name)
  ? path.join(extracted, entries[0].name)
  : extracted;

await fs.rm(target, { recursive: true, force: true });
await fs.mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
await fs.rename(raw, target);

console.log(`[导出完成] Markdown ${counts.markdown}，文件 ${counts.files}，ZIP ${size} 字节`);
console.log(`[原稿] ${target}`);
