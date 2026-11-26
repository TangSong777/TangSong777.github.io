#!/usr/bin/env node
// Rock publishing coordinator. --preview does everything except installing,
// committing and pushing. --publish is intended for the authorized timer.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { syncFromS3 } from './sync-siyuan-s3.mjs';
import { exportNotebook } from './export-siyuan-notebook.mjs';
import { withRepositoryLock } from './siyuan-task-lock.mjs';

const repo = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const baseDir = '/srv/blog';
const generated = ['source/siyuan','source/images/siyuan','source/js/siyuan-data.js'];
const pendingFile = path.join(baseDir,'state/pending-push.json');
const transactionFile = path.join(baseDir,'state/install-in-progress.json');
const allowedRemotes = new Set([
  'https://github.com/TangSong777/TangSong777.github.io.git',
  'git@github.com:TangSong777/TangSong777.github.io.git',
]);

export function allowedPublicationPath(name) {
  return generated.some(root=>name===root || name.startsWith(root+'/')) &&
    !name.split('/').some(part=>part==='..' || part==='.' || part==='能力体系');
}

export function allowedArticleDraftPath(name) {
  const normalized=String(name||'').replaceAll('\\','/').replace(/^\/+/, '');
  const parts=normalized.split('/');
  if(parts.some(part=>!part || part==='.' || part==='..' || part.startsWith('.')))return false;
  if(normalized.startsWith('source/images/posts/'))return true;
  if(!normalized.startsWith('source/_posts/'))return false;
  return parts[2]?.toLowerCase()!=='siyuan';
}

// `git commit --only` 要求每个 pathspec 都能匹配到文件，因此提交范围只保留仍然
// 存在或仍被 Git 跟踪的生成路径；两者都不满足的路径既不暂存也不提交。
export function selectPublicationPaths(generated,tracked,present) {
  return generated.filter(name=>present.includes(name) || tracked.includes(name));
}

// 自动提交必须始终限定在生成路径上：`--only` 保证索引里其他已暂存内容不会被
// 提交，也不会被推送。
export function publicationCommitArgs(pathspecs,documents,timestamp) {
  return ['commit','--only',
    '-m',`fix(notes): 更新 S3 同步笔记 ${timestamp}`,
    '-m',`修复网站笔记与 S3 最新内容不同步；同步目录、资源与引用。公开文档 ${documents} 篇，已通过隐私与 Hexo 构建校验。`,
    '--',...pathspecs];
}

function command(executable,args,{cwd=repo,capture=false,allowFailure=false}={}) {
  return new Promise((resolve,reject)=>{
    const child = spawn(executable,args,{cwd,env:{...process.env,GIT_TERMINAL_PROMPT:'0',GCM_INTERACTIVE:'Never'},stdio:capture?['ignore','pipe','pipe']:'inherit'});
    let stdout='', stderr='';
    if(capture) {
      child.stdout.on('data',data=>{stdout+=data;});
      child.stderr.on('data',data=>{if(stderr.length<4096) stderr+=data;});
    }
    child.once('error',reject);
    child.once('exit',code=>{
      if(code!==0 && !allowFailure) reject(new Error(`${executable} ${args[0]} 失败（退出码 ${code}）；详细输出请在本机查看`));
      else resolve({code,stdout,stderr});
    });
  });
}
const git = async (...args)=>(await command('git',args,{capture:true})).stdout.trim();
async function exists(p) {try{await fs.lstat(p);return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}}
async function atomicJson(p,data) {
  await fs.mkdir(path.dirname(p),{recursive:true,mode:0o700});
  const temp=p+`.${process.pid}.tmp`;
  await fs.writeFile(temp,JSON.stringify(data,null,2)+'\n',{mode:0o600});
  await fs.rename(temp,p);
}
async function loadData(blog) {
  return JSON.parse((await fs.readFile(path.join(blog,'source/js/siyuan-data.js'),'utf8'))
    .replace(/^\s*window\.SiyuanKnowledgeData\s*=\s*/,'').replace(/;\s*$/,''));
}
async function fileManifest(root) {
  const map=new Map();
  async function visit(relative) {
    const full=path.join(root,relative);
    if(!await exists(full))return;
    const stat=await fs.lstat(full);
    if(stat.isSymbolicLink()) throw new Error(`不允许符号链接：${relative}`);
    if(stat.isDirectory()) {
      for(const name of (await fs.readdir(full)).sort()) await visit(path.posix.join(relative,name));
    } else if(stat.isFile()) {
      map.set(relative,createHash('sha256').update(await fs.readFile(full)).digest('hex'));
    } else throw new Error(`不允许特殊文件：${relative}`);
  }
  for(const entry of generated)await visit(entry);
  return map;
}
function equalManifests(a,b) {return a.size===b.size && [...a].every(([p,h])=>b.get(p)===h);}

// 自动发布只检查会影响发布正确性的仓库状态。工作区里与生成物无关的改动不再
// 阻断自动发布：提交始终由 `git commit --only` 限定在生成路径上，索引里其他
// 内容既不会被提交，也不会被推送。
export function repositoryGuardBlockers({branch,origin,pushUrls,trackedPrivate}) {
  if(branch!=='main')return '自动发布只允许 main 分支';
  if(!allowedRemotes.has(origin))return 'origin 不是授权的博客仓库';
  if(pushUrls.length!==1 || !allowedRemotes.has(pushUrls[0]))return '推送目标不是唯一的授权博客仓库';
  if(trackedPrivate)return '原稿或隐私列表已被 Git 跟踪';
  return '';
}

async function requireAuthorizedRepository() {
  const branch=await git('branch','--show-current');
  const origin=await git('remote','get-url','origin');
  const pushUrls=(await git('remote','get-url','--push','--all','origin')).split('\n').filter(Boolean);
  await git('check-ignore','origin/学习笔记.md/学习笔记.md','tools/siyuan-private-values.txt');
  const trackedPrivate=Boolean((await git('ls-files','origin','tools/siyuan-private-values.txt')).trim());
  const blocker=repositoryGuardBlockers({branch,origin,pushUrls,trackedPrivate});
  if(blocker)throw new Error(blocker);
}

async function pushPending() {
  if(!await exists(pendingFile))return false;
  const pending=JSON.parse(await fs.readFile(pendingFile,'utf8'));
  if(!/^[0-9a-f]{40}$/.test(pending.commit) || await git('rev-parse','HEAD')!==pending.commit)throw new Error('待推送记录与当前 HEAD 不一致，需人工检查');
  const commits=(await git('rev-list','origin/main..HEAD')).split('\n').filter(Boolean);
  if(commits.length>1 || commits.some(commit=>commit!==pending.commit))throw new Error('本地有非预期提交，停止自动推送');
  const names=(await command('git',['diff-tree','--root','--no-commit-id','--name-only','-z','-r',pending.commit],{capture:true})).stdout.split('\0').filter(Boolean);
  if(!names.length || names.some(name=>!allowedPublicationPath(name)))throw new Error('待推送提交包含白名单之外的文件');
  if(!(await git('log','-1','--format=%s')).startsWith('fix(notes):'))throw new Error('待推送提交不是自动笔记更新');
  await git('push','origin','HEAD:main');
  await fs.unlink(pendingFile);
  console.log('[推送完成] 已完成上次待推送的笔记提交');
  return true;
}

// 自动推送本地提交前，先排除可能泄露原稿或凭据的路径。
const forbiddenPushPaths = [
  /^origin\//,
  /(^|\/)siyuan-private-values\.txt$/,
  /(^|\/)\.env($|\.)/,
  /\.(pem|key|p12|pfx|ppk)$/i,
  /(^|\/)id_(ed25519|rsa|ecdsa)(\.|$)/,
  /(^|\/)\.ssh\//,
];

export function pushBlockersForNames(names) {
  return names.filter(name=>forbiddenPushPaths.some(pattern=>pattern.test(name)));
}

async function changedNamesOfCommit(commit) {
  const out=(await command('git',['diff-tree','--root','--no-commit-id','--name-only','-z','-r',commit],{capture:true})).stdout;
  return out.split('\0').filter(Boolean);
}

// 本地提交没人推送时，自动发布会一直被 ahead 卡住，直到有人想起来。这里在确认
// 提交不含原稿、隐私清单和私钥之后自动推送，让定时任务自己恢复。
async function pushUnsyncedCommits(commits) {
  const risky=[];
  for(const commit of commits)risky.push(...pushBlockersForNames(await changedNamesOfCommit(commit)));
  const unique=[...new Set(risky)];
  if(unique.length)throw new Error(`本地有 ${commits.length} 个未推送提交，且包含不允许自动推送的路径（${unique.slice(0,5).join('、')}）；请人工处理后再自动发布`);
  await git('push','origin','HEAD:main');
  console.log(`[自动推送] 已把 ${commits.length} 个未推送的本地提交同步到远端`);
}

async function prepareGit() {
  if(await exists(transactionFile))throw new Error('上次安装过程曾中断，请按 install-in-progress.json 检查备份与工作区后恢复；禁止自动覆盖');
  await requireAuthorizedRepository();
  await git('fetch','--prune','origin','main');
  if(await pushPending())return;
  const behind=Number((await git('rev-list','--left-right','--count','origin/main...HEAD')).split(/\s+/)[0]);
  if(behind) {
    // 远端有新提交时先快进：只要别处推送过一次，定时任务就不该一直停摆。
    const merged=await command('git',['merge','--ff-only','origin/main'],{capture:true,allowFailure:true});
    if(merged.code!==0)throw new Error(`远端有新提交但无法快进（${(merged.stderr.trim().split('\n').pop()||'未知原因')}）；请先更新 Rock 代码和依赖`);
    console.log(`[快进] 已快进 ${behind} 个远端提交`);
  }
  const ahead=(await git('rev-list','origin/main..HEAD')).split('\n').filter(Boolean);
  if(ahead.length)await pushUnsyncedCommits(ahead);
  if(!await git('config','user.name') || !await git('config','user.email'))throw new Error('尚未配置 Git 提交身份');
}

const keepStagingRuns = 6;

// 每次运行都会在 staging 留下约 145MB 的构建产物。定时发布频率提高后必须回收，
// 否则历史运行会把磁盘吃满；backups 保留给回滚，不在这里清理。
async function pruneOldRuns() {
  const dir = path.join(baseDir, 'staging');
  let entries;
  try { entries = await fs.readdir(dir, {withFileTypes: true}); }
  catch (e) { if (e.code === 'ENOENT') return; throw e; }
  const runs = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith('notes-publish-')) continue;
    const full = path.join(dir, entry.name);
    try { runs.push({full, mtime: (await fs.stat(full)).mtimeMs}); } catch {}
  }
  runs.sort((a, b) => b.mtime - a.mtime);
  for (const run of runs.slice(keepStagingRuns)) {
    await fs.rm(run.full, {recursive: true, force: true});
  }
}

async function makeStage(stage) {
  for(const name of ['source','scripts','themes','tools']) {
    const source=path.join(repo,name);
    if(await exists(source))await fs.cp(source,path.join(stage,name),{recursive:true,dereference:false});
  }
  for(const name of await fs.readdir(repo)) {
    if(/^_config.*\.ya?ml$/.test(name) || ['package.json','package-lock.json'].includes(name))await fs.copyFile(path.join(repo,name),path.join(stage,name));
  }
  // Dependencies are read-only inputs to the staging build; no npm install here.
  await fs.symlink(path.join(repo,'node_modules'),path.join(stage,'node_modules'),'dir');
  await fs.chmod(path.join(stage,'tools/siyuan-private-values.txt'),0o600);
}

export async function installVerified(stage,raw,backup,repoDir=repo) {
  const moves=[];
  const targets=[...generated,'public','origin/学习笔记.md'];
  try {
    for(const relative of targets) {
      const target=path.join(repoDir,relative);
      const replacement=relative.startsWith('origin/')?raw:path.join(stage,relative);
      const saved=path.join(backup,relative);
      await fs.mkdir(path.dirname(target),{recursive:true,mode:0o700});
      await fs.mkdir(path.dirname(saved),{recursive:true,mode:0o700});
      const old=await exists(target);
      if(old)await fs.rename(target,saved);
      const move={target,saved,replacement,old,installed:false};moves.push(move);
      await fs.rename(replacement,target);move.installed=true;
    }
  } catch(e) {await rollback(moves);e.installRolledBack=true;throw e;}
  return moves;
}
export async function rollback(moves) {
  for(const move of [...moves].reverse()) {
    if(move.installed && await exists(move.target)) {
      await fs.mkdir(path.dirname(move.replacement),{recursive:true,mode:0o700});
      await fs.rename(move.target,move.replacement);
    }
    if(move.old)await fs.rename(move.saved,move.target);
  }
}

async function main() {
  const args=process.argv.slice(2);
  const mode=args.find((arg)=>['--preview','--publish'].includes(arg));
  const allowPrivacyReduction=args.includes('--allow-privacy-reduction');
  if((mode !== '--preview' && mode !== '--publish') || args.some((arg)=>!['--preview','--publish','--allow-privacy-reduction'].includes(arg)) || (allowPrivacyReduction && mode !== '--publish')) {
    throw new Error('用法：node tools/publish-siyuan-notes.mjs --preview|--publish [--allow-privacy-reduction]');
  }
  const publish=mode==='--publish';
  await withRepositoryLock(async()=>{
    process.umask(0o077);
    if(publish)await prepareGit();
    await pruneOldRuns();
    const head=await git('rev-parse','HEAD');
    const status=await git('status','--porcelain','--untracked-files=all');
    const originalManifest=await fileManifest(repo);
    const previous=await loadData(repo);
    const startedAt=new Date().toISOString();
    const report={startedAt,mode:publish?'publish':'preview',status:'running',stage:'sync'};
    await fs.mkdir(path.join(baseDir,'staging'),{recursive:true,mode:0o700});
    const runDir=await fs.mkdtemp(path.join(baseDir,'staging/notes-publish-'));
    const reportPath=path.join(runDir,'report.json');
    let moves=[],committed=false,pathspecs=[];
    try {
      report.sync=await syncFromS3();
      report.stage='export';
      const exported=await exportNotebook();
      report.export={markdown:exported.markdown,sha256:exported.sha256};
      report.stage='convert';
      const stage=path.join(runDir,'site');await fs.mkdir(stage,{mode:0o700});
      await makeStage(stage);
      await command(process.execPath,[path.join(repo,'tools/import-siyuan-notes.mjs'),'--blog',stage,'--source',exported.raw,'--notebook-title','学习笔记']);
      const next=await loadData(stage);
      report.documents=next.documents.length;
      if(next.documents.length<1 || (previous.documents.length>0 && next.documents.length<previous.documents.length*0.8 && !allowPrivacyReduction))throw new Error('公开文档数量下降超过 20%，需要人工确认，停止发布；若确认是隐私规则变更，请显式使用 --allow-privacy-reduction');
      await command(process.execPath,[path.join(repo,'tools/check-siyuan-knowledge-base.mjs'),'--blog',stage,'--source-only','--strict']);
      report.stage='build';
      await command('npm',['run','build'],{cwd:stage});
      await command(process.execPath,[path.join(repo,'tools/check-siyuan-knowledge-base.mjs'),'--blog',stage,'--require-public','--strict']);
      const expectedManifest=await fileManifest(stage);
      if(!publish) {
        report.status='preview-passed';report.preview=stage;
        console.log(`[预演通过] ${stage}`);return;
      }
      if(head!==await git('rev-parse','HEAD') || status!==await git('status','--porcelain','--untracked-files=all') || !equalManifests(originalManifest,await fileManifest(repo)))throw new Error('构建期间仓库发生变化，停止安装生成物');
      if(equalManifests(originalManifest,expectedManifest)) {
        report.status='unchanged';console.log('[无变化] 公开内容一致，不创建空提交');
        await fs.rm(stage,{recursive:true,force:true});return;
      }
      report.stage='install';
      const backup=path.join(baseDir,'backups',path.basename(runDir));
      await fs.mkdir(backup,{recursive:true,mode:0o700});report.backup=backup;
      await atomicJson(transactionFile,{head,backup,stage,raw:exported.raw,targets:[...generated,'public','origin/学习笔记.md'],startedAt});
      moves=await installVerified(stage,exported.raw,backup);
      if(!equalManifests(expectedManifest,await fileManifest(repo)))throw new Error('安装后文件内容与通过校验的版本不一致');
      const trackedNames=[],presentNames=[];
      for(const name of generated) {
        if(await exists(path.join(repo,name))) presentNames.push(name);
        if((await command('git',['ls-files','--error-unmatch','--',name],{capture:true,allowFailure:true})).code===0) trackedNames.push(name);
      }
      pathspecs=selectPublicationPaths(generated,trackedNames,presentNames);
      if(!pathspecs.length) throw new Error('没有可提交的生成路径');
      await git('add','-A','--',...pathspecs);
      const names=(await command('git',['diff','--cached','--name-only','-z','--',...pathspecs],{capture:true})).stdout.split('\0').filter(Boolean);
      if(!names.length || names.some(name=>!allowedPublicationPath(name)))throw new Error('暂存区包含非授权路径');
      // Prove staged bytes match the exact files which passed the privacy/build gates.
      for(const name of names) {
        if(!expectedManifest.has(name)) {
          if(await exists(path.join(repo,name)))throw new Error('删除状态与输出清单不一致');
          continue;
        }
        const workHash=await git('hash-object','--',name);
        const stageHash=await git('rev-parse',`:${name}`);
        if(workHash!==stageHash)throw new Error('暂存内容与校验内容不一致');
      }
      // Markdown uses two trailing spaces for a hard line break. Keep the
      // safety check for other malformed whitespace, but do not reject this
      // valid Markdown syntax during the scheduled publication.
      await git('-c','core.whitespace=-blank-at-eol,-blank-at-eof,-space-before-tab,-indent-with-non-tab,-tab-in-indent,-cr-at-eol','diff','--cached','--check','--',...pathspecs);
      report.stage='commit';
      const timestamp=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',dateStyle:'short',timeStyle:'short'}).format(new Date());
      await git(...publicationCommitArgs(pathspecs,report.documents,timestamp));
      committed=true;report.commit=await git('rev-parse','HEAD');
      await atomicJson(pendingFile,{commit:report.commit,createdAt:new Date().toISOString()});
      await fs.unlink(transactionFile);
      report.stage='push';
      await git('push','origin','HEAD:main');
      await fs.unlink(pendingFile);
      report.status='pushed';console.log(`[已推送] ${report.commit}`);
    } catch(e) {
      report.status=committed?'push-pending':'failed';report.error=e.message;
      if(moves.length && !committed) {
        // Only unstage this run's generated paths; other index content is left untouched.
        if(pathspecs.length) await command('git',['restore','--staged','--',...pathspecs],{capture:true,allowFailure:true});
        await rollback(moves);report.rolledBack=true;
        await fs.unlink(transactionFile);
      }
      if(e.installRolledBack && !committed) {
        report.rolledBack=true;
        await fs.unlink(transactionFile);
      }
      throw e;
    } finally {
      report.finishedAt=new Date().toISOString();
      await atomicJson(reportPath,report);
      await atomicJson(path.join(baseDir,'state/last-run.json'),report);
      console.log(`[报告] ${reportPath}`);
    }
  });
}

if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error(`[发布停止] ${e.message}`);process.exitCode=1;});
