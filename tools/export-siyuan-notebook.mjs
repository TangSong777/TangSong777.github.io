#!/usr/bin/env node
// Rock-only SiYuan 3.8.1 adapter. Raw archives stay outside the Git repository.
import fs from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { Readable, Transform } from 'node:stream';
import { createHash } from 'node:crypto';
import yauzl from 'yauzl';

const repo = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const base = 'http://127.0.0.1:6806';
const workspaceConfig = '/srv/siyuan/workspace/conf/conf.json';
export const exportOptions = Object.freeze({
  addTitle: true, includeSubDocs: true, includeRelatedDocs: false,
  markdownYFM: true, removeAssetsID: true, inlineMemo: false,
  blockRefMode: 4, blockEmbedMode: 1, fileAnnotationRefMode: 0,
  blockRefTextLeft: '', blockRefTextRight: '', tagOpenMarker: '#', tagCloseMarker: '#',
});

export async function createClient() {
  // The token never travels through the shell, command-line arguments or logs.
  const config = JSON.parse(await fs.readFile(workspaceConfig, 'utf8'));
  const token = process.env.SIYUAN_TOKEN_FILE
    ? (await fs.readFile(process.env.SIYUAN_TOKEN_FILE, 'utf8')).trim() : config.api?.token;
  if (!token) throw new Error('思源 API Token 未配置');
  const headers = { Authorization: `Token ${token}`, 'Content-Type': 'application/json' };
  async function api(endpoint, body = {}, timeout = 60000) {
    const response = await fetch(base + endpoint, {method:'POST', headers, body:JSON.stringify(body), redirect:'error', signal:AbortSignal.timeout(timeout)});
    if (!response.ok) throw new Error(`${endpoint}: HTTP ${response.status}`);
    const result = await response.json();
    // Server error messages may contain credentials/paths; only expose codes.
    if (result.code !== 0) throw new Error(`${endpoint}: API code ${result.code}`);
    return result.data;
  }
  const version = await api('/api/system/version');
  if (version !== '3.8.1') throw new Error(`思源版本 ${version} 尚未适配，请先检查 API 兼容性`);
  return { api, headers, config };
}

export async function extractArchive(archive, destination) {
  await fs.mkdir(destination, {recursive:true, mode:0o700});
  const zip = await new Promise((resolve,reject) => yauzl.open(archive, {lazyEntries:true, strictFileNames:true, validateEntrySizes:true}, (e,z) => e ? reject(e) : resolve(z)));
  const seen = new Set();
  let files = 0, markdown = 0, bytes = 0;
  await new Promise((resolve,reject) => {
    const fail = error => { zip.close(); reject(error); };
    zip.on('error', fail);
    zip.on('end', resolve);
    zip.on('entry', entry => {
      (async () => {
        const name = entry.fileName;
        const parts = name.replace(/\/$/, '').split('/');
        if (!name || name.includes('\\') || parts.some(p => !p || p === '.' || p === '..' || p.includes(':') || /[\x00-\x1f]/.test(p))) throw new Error('导出 ZIP 包含不安全路径');
        const canonical = parts.join('/').normalize('NFC').toLowerCase();
        if (seen.has(canonical)) throw new Error('导出 ZIP 存在重复路径');
        seen.add(canonical);
        const mode = (entry.externalFileAttributes >>> 16) & 0xf000;
        if (mode && mode !== 0x8000 && mode !== 0x4000) throw new Error('导出 ZIP 含符号链接或特殊文件');
        const target = path.resolve(destination,...parts);
        if (!target.startsWith(path.resolve(destination) + path.sep)) throw new Error('导出 ZIP 路径越界');
        if (name.endsWith('/')) { await fs.mkdir(target,{recursive:true,mode:0o700}); return; }
        files++;
        bytes += entry.uncompressedSize;
        if (files > 20000 || bytes > 1024 ** 3 || entry.uncompressedSize > 128 * 1024 ** 2) throw new Error('导出 ZIP 超出大小限制');
        if (name.toLowerCase().endsWith('.md')) markdown++;
        else if (!parts.includes('assets')) throw new Error('导出 ZIP 存在 Markdown/assets 之外的文件');
        await fs.mkdir(path.dirname(target),{recursive:true,mode:0o700});
        const input = await new Promise((res,rej) => zip.openReadStream(entry,(e,s) => e ? rej(e) : res(s)));
        await pipeline(input,createWriteStream(target,{flags:'wx',mode:0o600}));
      })().then(() => zip.readEntry(),fail);
    });
    zip.readEntry();
  });
  if (markdown < 1) throw new Error('导出 ZIP 没有 Markdown');
  return {files, markdown, bytes};
}

export async function exportNotebook({install = false} = {}) {
  process.umask(0o077);
  const {api,headers} = await createClient();
  const listing = await api('/api/notebook/lsNotebooks');
  const matches = listing.notebooks.filter(n => n.name === '学习笔记' && !n.closed);
  if (matches.length !== 1) throw new Error('需要恰好一个已打开的“学习笔记”笔记本');
  const staging = '/srv/blog/staging';
  await fs.mkdir(staging,{recursive:true,mode:0o700});
  const runDir = await fs.mkdtemp(path.join(staging,'siyuan-export-'));
  await fs.chmod(runDir,0o700);
  console.log('[导出] 正在通过思源 API 导出学习笔记');
  const result = await api('/api/export/exportNotebookMd',{notebook:matches[0].id,...exportOptions},600000);
  const zipUrl = new URL(result?.zip || '',base);
  if (!result?.zip || zipUrl.origin !== base || !zipUrl.pathname.startsWith('/export/') || !zipUrl.pathname.endsWith('.zip')) throw new Error('API 返回的 ZIP 地址不合法');
  const response = await fetch(zipUrl,{headers,redirect:'error',signal:AbortSignal.timeout(600000)});
  if (!response.ok || !response.body) throw new Error(`导出 ZIP 下载失败：HTTP ${response.status}`);
  let size = 0;
  const hash = createHash('sha256');
  const limit = new Transform({transform(chunk,encoding,callback) {
    size += chunk.length;
    if (size > 256 * 1024 ** 2) return callback(new Error('ZIP 超过 256 MiB 限制'));
    hash.update(chunk); callback(null,chunk);
  }});
  const archive = path.join(runDir,'export.zip');
  await pipeline(Readable.fromWeb(response.body),limit,createWriteStream(archive,{flags:'wx',mode:0o600}));
  const extracted = path.join(runDir,'extracted');
  const counts = await extractArchive(archive,extracted);
  const entries = await fs.readdir(extracted,{withFileTypes:true});
  const raw = entries.length === 1 && entries[0].isDirectory() && ['学习笔记','学习笔记.md'].includes(entries[0].name)
    ? path.join(extracted,entries[0].name) : extracted;
  // Check front matter on a real note: options must actually be honored.
  async function firstMd(dir) {
    for (const e of await fs.readdir(dir,{withFileTypes:true})) {
      if (e.name === 'assets') continue;
      if (e.isFile() && e.name.endsWith('.md')) return path.join(dir,e.name);
      if (e.isDirectory()) { const found = await firstMd(path.join(dir,e.name)); if (found) return found; }
    }
  }
  const sample = await firstMd(raw);
  if (!sample || !(await fs.readFile(sample,'utf8')).startsWith('---\n')) throw new Error('API 导出未包含预期 YAML front matter');
  const report = {version:1, exportedAt:new Date().toISOString(),...counts,zipBytes:size,sha256:hash.digest('hex'),raw,installed:false};
  if (install) {
    const origin = path.join(repo,'origin');
    await fs.mkdir(origin,{recursive:true,mode:0o700});
    const target = path.join(origin,'学习笔记.md');
    const backup = path.join(runDir,'previous-origin');
    let old = false;
    try { await fs.rename(target,backup); old = true; } catch (e) { if(e.code !== 'ENOENT') throw e; }
    try { await fs.rename(raw,target); } catch (e) { if(old) await fs.rename(backup,target); throw e; }
    report.raw = target;
    report.installed = true;
  }
  await fs.writeFile(path.join(runDir,'report.json'),JSON.stringify(report,null,2)+'\n',{mode:0o600});
  console.log(`[导出完成] Markdown ${counts.markdown}，文件 ${counts.files}，ZIP ${size} 字节`);
  console.log(`[原稿] ${report.raw}`);
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--install')) {console.error('用法：node tools/export-siyuan-notebook.mjs [--install]'); process.exitCode=2;}
  else exportNotebook({install:args.includes('--install')}).catch(e => {console.error(`[导出失败] ${e.message}`);process.exitCode=1;});
}
