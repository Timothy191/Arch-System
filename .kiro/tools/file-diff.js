#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const PROJ = '/home/timothy/Project/Arch-Mk2';

function readStdin() {
  return new Promise(resolve => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', c => { data += c; });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', () => resolve(''));
  });
}

function getGitDiff(filePath) {
  const relPath = path.relative(PROJ, filePath);
  try {
    const staged = execSync(`git diff --cached -- "${relPath}"`, { cwd: PROJ, encoding: 'utf8', maxBuffer: 102400 });
    const working = execSync(`git diff -- "${relPath}"`, { cwd: PROJ, encoding: 'utf8', maxBuffer: 102400 });
    return { staged, working, hasChanges: staged.length > 0 || working.length > 0 };
  } catch {
    return { staged: '', working: '', hasChanges: false };
  }
}

function getFileDiff(oldContent, newContent, filePath) {
  const lines = [];
  const oldLines = (oldContent || '').split('\n');
  const newLines = (newContent || '').split('\n');
  const maxLen = Math.max(oldLines.length, newLines.length);
  let added = 0, removed = 0;

  for (let i = 0; i < maxLen; i++) {
    if (i >= oldLines.length) {
      lines.push({ type: 'added', line: i + 1, content: newLines[i] });
      added++;
    } else if (i >= newLines.length) {
      lines.push({ type: 'removed', line: i + 1, content: oldLines[i] });
      removed++;
    } else if (oldLines[i] !== newLines[i]) {
      lines.push({ type: 'removed', line: i + 1, content: oldLines[i] });
      lines.push({ type: 'added', line: i + 1, content: newLines[i] });
      removed++;
      added++;
    }
  }

  return { lines, added, removed, total: lines.length };
}

async function main() {
  const raw = await readStdin();
  let input = {};
  try { input = JSON.parse(raw); } catch { input = {}; }

  const filePath = input.file_path || input.filePath || '';
  const newContent = input.new_string || input.content || '';
  const oldContent = input.old_string || '';

  if (!filePath && !newContent) {
    console.error('[file-diff] Usage: pipe JSON with file_path, new_string, old_string');
    process.exit(1);
  }

  let result;

  if (filePath && !newContent) {
    result = getGitDiff(filePath);
  } else if (filePath && newContent) {
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(PROJ, filePath);
    const existing = fs.existsSync(absolutePath) ? fs.readFileSync(absolutePath, 'utf8') : (oldContent || '');
    result = getFileDiff(existing, newContent, filePath);
  } else {
    result = getFileDiff(oldContent || '', newContent, '(inline)');
  }

  if (result.total > 200) {
    result.truncated = true;
    result.lines = result.lines.slice(0, 200);
  }

  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

main().catch(err => {
  console.error(`[file-diff] Error: ${err.message}`);
  process.exit(1);
});
