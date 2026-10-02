#!/usr/bin/env node
/**
 * 校验三份部署副本是否一致：根目录（唯一真源）/ public/ / coffee-capital-cf-deploy.zip
 * 用法: node tools/check-sync.mjs [--fix]
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, copyFileSync, renameSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ZIP_NAME = 'coffee-capital-cf-deploy.zip';
const MIRROR_DIR = join(ROOT, 'public');
const ZIP_PATH = join(ROOT, ZIP_NAME);

const DEPLOY_FILES = [
  'index.html',
  'index.legacy.html',
  'styles.css',
  'game.js',
  'tree.js',
  'save.js',
  'device.js',
  '_worker.js',
  '_headers',
  'wrangler.jsonc',
];

const sha256Of = (buffer) => createHash('sha256').update(buffer).digest('hex');
const hashLocal = (absPath) => sha256Of(readFileSync(absPath));
const sourceFiles = () => DEPLOY_FILES.filter((file) => existsSync(join(ROOT, file)));

function runPowerShell(script, env) {
  return execFileSync(
    'powershell',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
    { env: { ...process.env, ...env }, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
  ).trim();
}

// 读取 zip 内每个条目的 sha256，避免依赖外部 zip 命令
function hashZipEntries(zipPath) {
  const script = `
    $ErrorActionPreference = 'Stop'
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $archive = [System.IO.Compression.ZipFile]::OpenRead($env:SYNC_ZIP)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    $rows = @()
    foreach ($entry in $archive.Entries) {
      $stream = $entry.Open()
      $buffered = New-Object System.IO.MemoryStream
      $stream.CopyTo($buffered)
      $stream.Dispose()
      $hex = -join ($sha.ComputeHash($buffered.ToArray()) | ForEach-Object { $_.ToString('x2') })
      $buffered.Dispose()
      $rows += [pscustomobject]@{ name = $entry.FullName; sha256 = $hex }
    }
    $archive.Dispose()
    ConvertTo-Json -Compress -InputObject $rows
  `;
  const parsed = JSON.parse(runPowerShell(script, { SYNC_ZIP: zipPath }));
  const list = Array.isArray(parsed) ? parsed : [parsed];
  return new Map(list.map((item) => [item.name.replace(/\\/g, '/'), item.sha256]));
}

function collectDivergences() {
  const problems = [];
  const staleInMirror = [];
  let zipStale = false;

  const rootHashes = new Map();
  for (const file of DEPLOY_FILES) {
    const sourcePath = join(ROOT, file);
    if (!existsSync(sourcePath)) {
      problems.push(`根目录缺少 ${file}`);
      continue;
    }
    const hash = hashLocal(sourcePath);
    rootHashes.set(file, hash);

    const mirrorPath = join(MIRROR_DIR, file);
    if (!existsSync(mirrorPath)) {
      problems.push(`public/ 缺少 ${file}`);
      staleInMirror.push(file);
    } else if (hashLocal(mirrorPath) !== hash) {
      problems.push(`public/${file} 与根目录不一致`);
      staleInMirror.push(file);
    }
  }

  if (!existsSync(ZIP_PATH)) {
    problems.push(`根目录缺少 ${ZIP_NAME}`);
    return { problems, staleInMirror, zipStale, rootHashes };
  }

  const zipEntries = hashZipEntries(ZIP_PATH);
  for (const [file, hash] of rootHashes) {
    if (!zipEntries.has(file)) {
      problems.push(`${ZIP_NAME} 内缺少 ${file}`);
      zipStale = true;
    } else if (zipEntries.get(file) !== hash) {
      problems.push(`${ZIP_NAME} 内的 ${file} 与根目录不一致`);
      zipStale = true;
    }
  }
  for (const name of zipEntries.keys()) {
    if (!DEPLOY_FILES.includes(name)) {
      problems.push(`${ZIP_NAME} 内含预期外条目 ${name}`);
      zipStale = true;
    }
  }

  const mirrorZip = join(MIRROR_DIR, ZIP_NAME);
  if (existsSync(mirrorZip) && hashLocal(mirrorZip) !== hashLocal(ZIP_PATH)) {
    problems.push(`public/${ZIP_NAME} 与根目录 zip 不一致`);
  }

  return { problems, staleInMirror, zipStale, rootHashes };
}

function rebuildZip(files) {
  // 先写入临时包并逐条校验，失败时保留原有 zip
  const tempPath = `${ZIP_PATH}.tmp`;
  const script = `
    $ErrorActionPreference = 'Stop'
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    if (Test-Path -LiteralPath $env:SYNC_ZIP) { Remove-Item -LiteralPath $env:SYNC_ZIP -Force }
    $archive = [System.IO.Compression.ZipFile]::Open($env:SYNC_ZIP, 'Create')
    foreach ($file in ($env:SYNC_FILES | ConvertFrom-Json)) {
      $full = Join-Path $env:SYNC_ROOT $file
      [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
        $archive, $full, $file, [System.IO.Compression.CompressionLevel]::Optimal
      ) | Out-Null
    }
    $archive.Dispose()
    'ok'
  `;
  runPowerShell(script, {
    SYNC_ZIP: tempPath,
    SYNC_ROOT: ROOT,
    SYNC_FILES: JSON.stringify(files),
  });

  const entries = hashZipEntries(tempPath);
  const mismatched = files.filter((file) => entries.get(file) !== hashLocal(join(ROOT, file)));
  if (mismatched.length > 0 || entries.size !== files.length) {
    renameSync(tempPath, `${ZIP_PATH}.rejected`);
    console.error(`重建包校验未通过，原 zip 保持不变，可疑产物已留作 ${ZIP_NAME}.rejected`);
    process.exit(1);
  }
  renameSync(tempPath, ZIP_PATH);
}

function fix({ staleInMirror, zipStale }) {
  const files = sourceFiles();
  for (const file of staleInMirror) {
    copyFileSync(join(ROOT, file), join(MIRROR_DIR, file));
  }
  if (staleInMirror.length > 0) {
    console.log(`已按根目录重写 public/ 的 ${staleInMirror.length} 个文件`);
  }
  if (zipStale) {
    rebuildZip(files);
    console.log(`已按根目录重建 ${ZIP_NAME}`);
  }
  const mirrorZip = join(MIRROR_DIR, ZIP_NAME);
  if (zipStale && existsSync(mirrorZip)) {
    copyFileSync(ZIP_PATH, mirrorZip);
  }
  if (staleInMirror.length === 0 && !zipStale) {
    console.log('无需修复，三份副本已一致');
  }
}

const doFix = process.argv.slice(2).includes('--fix');
const state = collectDivergences();

if (doFix) {
  if (state.problems.length > 0) {
    fix(state);
    const after = collectDivergences();
    if (after.problems.length === 0) {
      console.log(`修复完成，三份副本一致`);
      process.exit(0);
    }
    console.error(`修复后仍存在分歧：`);
    for (const problem of after.problems) console.error(`  - ${problem}`);
    process.exit(1);
  }
  console.log('无需修复，三份副本已一致');
  process.exit(0);
}

if (state.problems.length === 0) {
  console.log(`同步校验通过：根目录 / public/ / ${ZIP_NAME} 共 ${DEPLOY_FILES.length} 个文件一致`);
  process.exit(0);
}

console.error(`发现 ${state.problems.length} 处不一致：`);
for (const problem of state.problems) console.error(`  - ${problem}`);
console.error(`运行 node tools/check-sync.mjs --fix 以根目录为准修复。`);
process.exit(1);
