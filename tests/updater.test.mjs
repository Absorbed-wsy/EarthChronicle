import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, mkdir, readFile, writeFile, copyFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const execute = promisify(execFile);
const windowsOnly = { skip: process.platform !== 'win32' };
const hash = text => createHash('sha256').update(text).digest('hex');
const quote = value => "'" + value.replaceAll("'", "''") + "'";
const windowsShell = () => path.join(process.env.SystemRoot || 'C:\\Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe');
const windowsEnv = () => Object.fromEntries(Object.entries(process.env).filter(([key]) => key.toLowerCase() !== 'psmodulepath'));
async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'earthchronicle-update-test-'));
  const target = path.join(root, 'installed'), update = path.join(root, 'update');
  await mkdir(path.join(target, 'data'), { recursive: true });
  await mkdir(path.join(update, 'files'), { recursive: true });
  await writeFile(path.join(target, 'server.mjs'), 'original server');
  await writeFile(path.join(target, 'data', 'personal.txt'), 'keep personal records');
  await copyFile(new URL('../desktop/ApplyUpdate.ps1', import.meta.url), path.join(update, 'ApplyUpdate.ps1'));
  const files = [];
  return {
    root, target, update, files,
    async payload(relative, contents) {
      const file = path.join(update, 'files', relative);
      await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, contents);
      files.push({ path: relative, sha256: hash(contents) });
    },
    async manifest(value = { version: '0.9-test', files }) { await writeFile(path.join(update, 'manifest.json'), JSON.stringify(value)); },
    async run(prefix = '', destination = target, script = path.join(update, 'ApplyUpdate.ps1')) {
      try {
        const command = '[Console]::OutputEncoding = New-Object Text.UTF8Encoding; ' + prefix + '& ' + quote(script) + ' -DestinationPath ' + quote(destination) + ' -ShutdownTimeoutSeconds 2';
        // A test runner launched from PowerShell 7 can otherwise make Windows
        // PowerShell 5 load incompatible 7.x modules via its inherited path.
        const output = await execute(windowsShell(), ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', command], { windowsHide: true, timeout: 20000, env: windowsEnv() });
        return { code: 0, ...output };
      } catch (error) { return { code: error.code, stdout: error.stdout || '', stderr: error.stderr || '' }; }
    },
    async cleanup() {
      assert.equal(path.dirname(path.resolve(root)), path.resolve(tmpdir()));
      assert.ok(path.basename(root).startsWith('earthchronicle-update-test-'));
      await rm(root, { recursive: true, force: true });
    },
  };
}

test('updater validates every manifest entry and target conflict before changing the installation', windowsOnly, async t => {
  const cases = [
    ['missing manifest', async () => {}],
    ['empty manifest', async f => f.manifest({ files: [] })],
    ['invalid hash', async f => f.manifest({ files: [{ path: 'server.mjs', sha256: '0'.repeat(64) }] })],
    ['escaping path', async f => f.manifest({ files: [{ path: '../outside.txt', sha256: hash('x') }] })],
    ['protected data', async f => f.manifest({ files: [{ path: 'data/personal.txt', sha256: hash('x') }] })],
    ['protected backups', async f => f.manifest({ files: [{ path: 'backups/previous.txt', sha256: hash('x') }] })],
    ['alternate data stream', async f => f.manifest({ files: [{ path: 'server.mjs:extra', sha256: hash('x') }] })],
    ['case-insensitive duplicate', async f => f.manifest({ files: [...f.files, { path: 'SERVER.MJS', sha256: hash('replacement server') }] })],
    ['directory at destination', async f => { await mkdir(path.join(f.target, 'blocked.js')); await f.payload('blocked.js', 'new'); await f.manifest(); }],
    ['file in destination parent', async f => { await writeFile(path.join(f.target, 'blocked'), 'existing file'); await f.payload('blocked/child.js', 'new'); await f.manifest(); }],
  ];
  for (const [name, configure] of cases) await t.test(name, async () => {
    const f = await fixture();
    try {
      await f.payload('server.mjs', 'replacement server'); await configure(f);
      const result = await f.run();
      assert.equal(result.code, 1, result.stdout + result.stderr);
      assert.equal(await readFile(path.join(f.target, 'server.mjs'), 'utf8'), 'original server');
      assert.equal(await readFile(path.join(f.target, 'data/personal.txt'), 'utf8'), 'keep personal records');
      assert.ok(!(await readdir(f.target)).includes('backups'), 'invalid input must fail before the backup/copy phase');
    } finally { await f.cleanup(); }
  });
});

test('valid update backs up all replaced files, preserves personal data and reports the manifest version', windowsOnly, async () => {
  const f = await fixture();
  try {
    await mkdir(path.join(f.target, 'runtime'));
    await copyFile(process.execPath, path.join(f.target, 'runtime/node.exe'));
    await copyFile(new URL('../desktop/backup-database.mjs', import.meta.url), path.join(f.update, 'backup-database.mjs'));
    const databaseFile = path.join(f.target, 'data/chronicle.sqlite'), database = new DatabaseSync(databaseFile);
    database.exec("CREATE TABLE personal (note TEXT); INSERT INTO personal VALUES ('keep my event');"); database.close();
    await f.payload('server.mjs', 'replacement server'); await f.payload('public/new.js', 'new asset');
    await f.payload('public/data/history.json', '{"events":[]}');
    await f.payload('public/data/geology/manifest.json', '{"snapshots":[]}'); await f.manifest();
    const result = await f.run(); assert.equal(result.code, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /0\.9-test/);
    assert.equal(await readFile(path.join(f.target, 'server.mjs'), 'utf8'), 'replacement server');
    assert.equal(await readFile(path.join(f.target, 'public/new.js'), 'utf8'), 'new asset');
    assert.equal(await readFile(path.join(f.target, 'public/data/history.json'), 'utf8'), '{"events":[]}');
    assert.equal(await readFile(path.join(f.target, 'public/data/geology/manifest.json'), 'utf8'), '{"snapshots":[]}');
    assert.equal(await readFile(path.join(f.target, 'data/personal.txt'), 'utf8'), 'keep personal records');
    const backups = await readdir(path.join(f.target, 'backups')); assert.equal(backups.length, 1);
    assert.equal(await readFile(path.join(f.target, 'backups', backups[0], 'server.mjs'), 'utf8'), 'original server');
    for (const file of [databaseFile, path.join(f.target, 'backups', backups[0], 'chronicle.sqlite')]) {
      const saved = new DatabaseSync(file, { readOnly: true });
      try { assert.equal(saved.prepare('SELECT note FROM personal').get().note, 'keep my event'); } finally { saved.close(); }
    }
  } finally { await f.cleanup(); }
});

test('updater normalizes Windows short path aliases and mixed separators before containment checks', windowsOnly, async t => {
  for (const variant of ['short alias', 'mixed separators']) await t.test(variant, async () => {
    const f = await fixture();
    try {
      await f.payload('server.mjs', 'replacement server'); await f.payload('public/new.js', 'new asset'); await f.manifest();
      let destination = f.target, prefix = '', script = path.join(f.update, 'ApplyUpdate.ps1');
      if (variant === 'short alias') {
        const command = `$fs=New-Object -ComObject Scripting.FileSystemObject; [pscustomobject]@{target=$fs.GetFolder(${quote(f.target)}).ShortPath;script=$fs.GetFile(${quote(script)}).ShortPath}|ConvertTo-Json -Compress`;
        const result = await execute(windowsShell(), ['-NoProfile', '-NonInteractive', '-Command', command], { windowsHide: true, timeout: 10000, env: windowsEnv() });
        const aliases = JSON.parse(result.stdout.trim()); destination = aliases.target; script = aliases.script;
        assert.ok(destination, 'Windows returned a usable folder path');
        t.diagnostic('short-alias destination: ' + destination);
      } else {
        // 8.3 aliases can be disabled on a drive. This variant independently
        // exercises a different but equivalent root spelling on every runner.
        prefix = `function Resolve-Path { [CmdletBinding()] param($Path,$LiteralPath) $resolved=Microsoft.PowerShell.Management\\Resolve-Path @PSBoundParameters; foreach($item in $resolved) { if($LiteralPath -eq ${quote(f.target)}) { [pscustomobject]@{Path=$item.Path.Replace('\\','/')} } else { $item } } }; `;
      }
      const result = await f.run(prefix, destination, script);
      assert.equal(result.code, 0, result.stdout + result.stderr);
      assert.equal(await readFile(path.join(f.target, 'server.mjs'), 'utf8'), 'replacement server');
      assert.equal(await readFile(path.join(f.target, 'public/new.js'), 'utf8'), 'new asset');
      assert.equal(await readFile(path.join(f.target, 'data/personal.txt'), 'utf8'), 'keep personal records');
    } finally { await f.cleanup(); }
  });
});

test('a mid-copy failure restores replaced files and removes newly installed files', windowsOnly, async () => {
  const f = await fixture();
  try {
    await writeFile(path.join(f.target, 'fail.js'), 'original second file');
    await f.payload('server.mjs', 'replacement server');
    await f.payload('new/nested.js', 'temporary new file');
    await f.payload('fail.js', 'replacement second file'); await f.manifest({ files: f.files });
    // Fault injection stays in the isolated PowerShell parent scope. Production
    // code has no testing hook, and no native window or server is launched.
    const failure = "function Copy-Item { param([string]$LiteralPath,[string]$Destination,[switch]$Force) if ($LiteralPath.EndsWith('\\files\\fail.js')) { throw 'Injected copy failure' }; Microsoft.PowerShell.Management\\Copy-Item @PSBoundParameters }; ";
    const result = await f.run(failure);
    assert.equal(result.code, 1, result.stdout + result.stderr); assert.match(result.stdout, /rolled back/);
    assert.equal(await readFile(path.join(f.target, 'server.mjs'), 'utf8'), 'original server');
    assert.equal(await readFile(path.join(f.target, 'fail.js'), 'utf8'), 'original second file');
    assert.ok(!(await readdir(f.target)).includes('new'));
    assert.equal(await readFile(path.join(f.target, 'data/personal.txt'), 'utf8'), 'keep personal records');
    const [backup] = await readdir(path.join(f.target, 'backups'));
    assert.equal(await readFile(path.join(f.target, 'backups', backup, 'fail.js'), 'utf8'), 'original second file');
  } finally { await f.cleanup(); }
});

test('updater waits for a WebView child after its native host exits and leaves files unchanged on timeout', windowsOnly, async t => {
 for (const variant of ['long executable path', 'short executable path']) await t.test(variant, async () => {
  const f = await fixture();
  try {
    await f.payload('server.mjs', 'replacement server'); await f.manifest();
    await writeFile(path.join(f.target, 'EarthChronicle.exe'), 'test placeholder; never executed');
    const quitMarker = quote(path.join(f.root, 'quit-requested.txt'));
    // Simulate process snapshots; no real executable is started or stopped.
    // CIM can report either the long path or a short alias used at launch.
    // Normalize the existing folder before constructing those two variants.
    const useShortPath = variant === 'short executable path' ? '$global:fixtureNativePath=(New-Object -ComObject Scripting.FileSystemObject).GetFile($global:fixtureNativePath).ShortPath;' : '';
    const processes = `$global:fixtureNativePath=Join-Path ([IO.Path]::GetFullPath(${quote(f.target)})) 'EarthChronicle.exe'; ${useShortPath} $global:probeCount=0; function Get-CimInstance { param($ClassName,$Filter)
      $global:probeCount++;
      if ($global:probeCount -eq 1) { [pscustomobject]@{Name='EarthChronicle.exe';ExecutablePath=$global:fixtureNativePath;ProcessId=190001;ParentProcessId=1;CreationDate='2026-01-01';CommandLine=''} }
      [pscustomobject]@{Name='msedgewebview2.exe';ExecutablePath='C:\\example\\msedgewebview2.exe';ProcessId=190002;ParentProcessId=190001;CreationDate='2026-01-01';CommandLine=''}
    }; function Start-Process { param($FilePath,$ArgumentList,$WindowStyle,[switch]$PassThru) [IO.File]::WriteAllText(${quitMarker},$ArgumentList) }; `;
    const result = await f.run(processes);
    assert.equal(result.code, 1, result.stdout + result.stderr); assert.match(result.stdout, /still running/);
    assert.equal(await readFile(path.join(f.root, 'quit-requested.txt'), 'utf8'), '--quit');
    assert.equal(await readFile(path.join(f.target, 'server.mjs'), 'utf8'), 'original server');
    assert.ok(!(await readdir(f.target)).includes('backups'));
  } finally { await f.cleanup(); }
 });
});
