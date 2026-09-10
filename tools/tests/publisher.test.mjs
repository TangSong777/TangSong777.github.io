import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { extractArchive } from '../export-siyuan-notebook.mjs';
import { allowedArticleDraftPath, allowedPublicationPath, installVerified, rollback } from '../publish-siyuan-notes.mjs';

async function fixture(t) {
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'notes-publisher-test-'));
  t.after(()=>fs.rm(root,{recursive:true,force:true}));
  return root;
}
async function put(root,name,text) {
  const target=path.join(root,name);await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,text);
}
function crc32(bytes) {
  let crc=0xffffffff;
  for(const byte of bytes) {crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
  return (crc^0xffffffff)>>>0;
}
// Small uncompressed ZIP fixture writer, independent of the production reader.
function zip(entries) {
  const local=[],central=[];let offset=0;
  for(const {name,body='---\ntitle: fixture\n---\n',mode=0x81a4} of entries) {
    const filename=Buffer.from(name),data=Buffer.from(body),checksum=crc32(data);
    const header=Buffer.alloc(30);header.writeUInt32LE(0x04034b50);header.writeUInt16LE(20,4);header.writeUInt16LE(0x800,6);
    header.writeUInt32LE(checksum,14);header.writeUInt32LE(data.length,18);header.writeUInt32LE(data.length,22);header.writeUInt16LE(filename.length,26);
    const center=Buffer.alloc(46);center.writeUInt32LE(0x02014b50);center.writeUInt16LE(0x0314,4);center.writeUInt16LE(20,6);center.writeUInt16LE(0x800,8);
    center.writeUInt32LE(checksum,16);center.writeUInt32LE(data.length,20);center.writeUInt32LE(data.length,24);center.writeUInt16LE(filename.length,28);
    center.writeUInt32LE((mode*65536)>>>0,38);center.writeUInt32LE(offset,42);
    local.push(header,filename,data);central.push(center,filename);offset+=header.length+filename.length+data.length;
  }
  const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
  return Buffer.concat([...local,directory,end]);
}

test('only notebook outputs can enter automated commits',()=>{
  assert.equal(allowedPublicationPath('source/siyuan/Python笔记/index.md'),true);
  assert.equal(allowedPublicationPath('source/js/siyuan-data.js'),true);
  for(const file of ['origin/学习笔记.md/a.md','source/_posts/article.md','tools/private.txt','.env','source/siyuan/能力体系/index.md','source/siyuan/../_posts/article.md','source/siyuan-other/x.md'])assert.equal(allowedPublicationPath(file),false,file);
});
test('note automation tolerates only ordinary article drafts',()=>{
  for(const file of ['source/_posts/article.md','source/_posts/随笔/文章.md','source/images/posts/article/a.png'])assert.equal(allowedArticleDraftPath(file),true,file);
  for(const file of ['source/_posts/siyuan/笔记.md','source/siyuan/笔记/index.md','tools/a.mjs','.github/workflows/pages.yml','source/_posts/../secret.md'])assert.equal(allowedArticleDraftPath(file),false,file);
});
test('ZIP extraction preserves Chinese filenames and rejects unsafe entries',async t=>{
  const root=await fixture(t);
  const good=path.join(root,'good.zip');await fs.writeFile(good,zip([{name:'学习笔记.md/Python 笔记.md'}]));
  assert.equal((await extractArchive(good,path.join(root,'good'))).markdown,1);
  assert.match(await fs.readFile(path.join(root,'good/学习笔记.md/Python 笔记.md'),'utf8'),/title: fixture/);
  const bad=[
    [{name:'../outside.md'}], [{name:'/absolute.md'}], [{name:'x\\escape.md'}],
    [{name:'link.md',mode:0xa1ff,body:'/etc/passwd'}],
    [{name:'A.md'},{name:'a.md'}], [{name:'unexpected.exe'}],
  ];
  for(const [index,entries] of bad.entries()) {
    const archive=path.join(root,`bad-${index}.zip`);await fs.writeFile(archive,zip(entries));
    await assert.rejects(extractArchive(archive,path.join(root,`bad-${index}`)));
  }
  await assert.rejects(fs.stat(path.join(root,'outside.md')),{code:'ENOENT'});
});
test('partial installation failure restores every previous output',async t=>{
  const root=await fixture(t),repo=path.join(root,'repo'),stage=path.join(root,'stage'),backup=path.join(root,'backup');
  await put(repo,'source/siyuan/index.md','original');
  await put(repo,'source/images/siyuan/a.png','original-image');
  await put(repo,'source/js/siyuan-data.js','original-data');
  await put(stage,'source/siyuan/index.md','replacement');
  // Missing images triggers failure after the first output was already replaced.
  await assert.rejects(installVerified(stage,path.join(root,'raw'),backup,repo));
  assert.equal(await fs.readFile(path.join(repo,'source/siyuan/index.md'),'utf8'),'original');
  assert.equal(await fs.readFile(path.join(repo,'source/images/siyuan/a.png'),'utf8'),'original-image');
  assert.equal(await fs.readFile(path.join(repo,'source/js/siyuan-data.js'),'utf8'),'original-data');
});
test('successful install can roll back without touching ordinary articles',async t=>{
  const root=await fixture(t),repo=path.join(root,'repo'),stage=path.join(root,'stage'),backup=path.join(root,'backup'),raw=path.join(root,'raw');
  await put(repo,'source/_posts/article.md','author draft');
  await put(repo,'source/siyuan/index.md','original');
  for(const [name,value] of [['source/siyuan/index.md','next'],['source/images/siyuan/a.png','image'],['source/js/siyuan-data.js','data'],['public/index.html','html']])await put(stage,name,value);
  await put(raw,'学习笔记.md','raw');
  const moves=await installVerified(stage,raw,backup,repo);
  assert.equal(await fs.readFile(path.join(repo,'source/siyuan/index.md'),'utf8'),'next');
  await rollback(moves);
  assert.equal(await fs.readFile(path.join(repo,'source/siyuan/index.md'),'utf8'),'original');
  assert.equal(await fs.readFile(path.join(repo,'source/_posts/article.md'),'utf8'),'author draft');
});
