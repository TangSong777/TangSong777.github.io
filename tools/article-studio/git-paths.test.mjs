import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { parseGitPaths, articleDiffCheckArgs } from './server.mjs';

test('NUL paths preserve Chinese, spaces, quotes, tabs and newlines', () => {
  const names = ['source/_posts/输入法奇缘.md', 'source/images/posts/输入法奇缘/a b.png', 'a"b', 'a\tb', 'a\nb', ' trailing '];
  assert.deepEqual(parseGitPaths(names.join('\0') + '\0'), names);
  assert.deepEqual(parseGitPaths(''), []);
});

test('real Git quoted paths decode identically in untracked, staged and committed lists', async () => {
  const root = await mkdtemp(join(tmpdir(), 'studio-git-paths-'));
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
  try {
    git('init', '--quiet');
    git('config', 'core.quotePath', 'true');
    git('config', 'user.name', 'Test');
    git('config', 'user.email', 'test@example.invalid');
    const name = 'source/images/posts/输入法奇缘/截图 空格.png';
    await mkdir(join(root, 'source/images/posts/输入法奇缘'), { recursive: true });
    await writeFile(join(root, name), 'fixture');
    assert.deepEqual(parseGitPaths(git('ls-files', '--others', '--exclude-standard', '-z')), [name]);
    git('add', '--', name);
    assert.deepEqual(parseGitPaths(git('diff', '--cached', '--name-only', '-z')), [name]);
    git('commit', '--quiet', '-m', 'test fixture');
    assert.deepEqual(parseGitPaths(git('diff-tree', '--root', '--no-commit-id', '--name-only', '-z', '-r', 'HEAD')), [name]);
    await writeFile(join(root, name), 'changed');
    assert.deepEqual(parseGitPaths(git('diff', '--name-only', '-z')), [name]);
    const article = 'source/_posts/中文.md';
    await mkdir(join(root, 'source/_posts'), { recursive: true });
    const markdown = '## \n正文  \n下一行\n\n';
    await writeFile(join(root, article), markdown);
    git('add', '--', article);
    assert.doesNotThrow(() => git(...articleDiffCheckArgs([article])));
    await writeFile(join(root, article), '<<<<<<< HEAD\nleft\n=======\nright\n>>>>>>> branch\n');
    git('add', '--', article);
    assert.throws(() => git(...articleDiffCheckArgs([article])));
  } finally { await rm(root, { recursive: true, force: true }); }
});
