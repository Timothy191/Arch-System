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

function executeStep(step) {
  const { action, params } = step;

  switch (action) {
    case 'read': {
      const filePath = params.file_path || params.filePath;
      if (!filePath) return { step: 'read', error: 'No file_path', status: 'error' };
      const absPath = path.isAbsolute(filePath) ? filePath : path.join(PROJ, filePath);
      if (!fs.existsSync(absPath)) return { step: 'read', error: `File not found: ${filePath}`, status: 'error' };
      const content = fs.readFileSync(absPath, 'utf8');
      return { step: 'read', filePath, status: 'ok', output: { content, size: content.length } };
    }

    case 'edit': {
      const filePath = params.file_path || params.filePath;
      const oldStr = params.old_string || params.oldString;
      const newStr = params.new_string || params.newString;
      if (!filePath || oldStr === undefined) return { step: 'edit', error: 'Missing file_path or old_string', status: 'error' };
      const absPath = path.isAbsolute(filePath) ? filePath : path.join(PROJ, filePath);
      if (!fs.existsSync(absPath)) return { step: 'edit', error: `File not found: ${filePath}`, status: 'error' };
      let content = fs.readFileSync(absPath, 'utf8');
      if (!content.includes(oldStr)) return { step: 'edit', error: 'old_string not found', status: 'error' };
      content = content.replace(oldStr, newStr || '');
      fs.writeFileSync(absPath, content);
      return { step: 'edit', filePath, status: 'ok', output: { replaced: true } };
    }

    case 'write': {
      const filePath = params.file_path || params.filePath;
      const content = params.content || '';
      if (!filePath) return { step: 'write', error: 'No file_path', status: 'error' };
      const absPath = path.isAbsolute(filePath) ? filePath : path.join(PROJ, filePath);
      fs.mkdirSync(path.dirname(absPath), { recursive: true });
      fs.writeFileSync(absPath, content);
      return { step: 'write', filePath, status: 'ok', output: { size: content.length } };
    }

    case 'bash': {
      const cmd = params.command || params.cmd || '';
      if (!cmd) return { step: 'bash', error: 'No command', status: 'error' };
      try {
        const result = execSync(cmd, { cwd: PROJ, encoding: 'utf8', maxBuffer: 102400, timeout: 30000 });
        return { step: 'bash', command: cmd.slice(0, 100), status: 'ok', output: { stdout: result.slice(0, 5000), exitCode: 0 } };
      } catch (err) {
        return { step: 'bash', command: cmd.slice(0, 100), status: 'ok', output: { stdout: err.stdout?.slice(0, 5000) || '', stderr: err.stderr?.slice(0, 5000) || '', exitCode: err.status || 1 } };
      }
    }

    case 'lint': {
      const filePath = params.file_path || params.filePath;
      if (!filePath) return { step: 'lint', error: 'No file_path', status: 'error' };
      const relPath = path.relative(PROJ, filePath);
      try {
        const result = execSync(`pnpm exec eslint "${relPath}" --max-warnings 0`, { cwd: PROJ, encoding: 'utf8', maxBuffer: 102400, timeout: 15000 });
        return { step: 'lint', filePath, status: 'ok', output: { passed: true, message: 'Lint passed' } };
      } catch (err) {
        return { step: 'lint', filePath, status: 'ok', output: { passed: false, message: err.stderr?.slice(0, 2000) || err.stdout?.slice(0, 2000) || 'Lint failed' } };
      }
    }

    case 'typecheck': {
      try {
        const result = execSync('pnpm typecheck', { cwd: PROJ, encoding: 'utf8', maxBuffer: 102400, timeout: 60000 });
        return { step: 'typecheck', status: 'ok', output: { passed: true, message: 'Typecheck passed' } };
      } catch (err) {
        return { step: 'typecheck', status: 'ok', output: { passed: false, message: err.stderr?.slice(0, 2000) || err.stdout?.slice(0, 2000) || 'Typecheck failed' } };
      }
    }

    default:
      return { step: action, error: `Unknown action: ${action}`, status: 'error' };
  }
}

async function main() {
  const raw = await readStdin();
  let input = {};
  try { input = JSON.parse(raw); } catch { input = { steps: [] }; }

  const steps = input.steps || (input.step ? [input] : []);
  if (steps.length === 0) {
    console.log(JSON.stringify({ error: 'No steps provided. Use { steps: [...] } or a single step.', usage: 'See .kiro/tools/composer.js' }));
    process.exit(1);
  }

  const results = [];
  let failed = false;

  for (const step of steps) {
    const result = executeStep(step);
    results.push(result);
    if (result.status === 'error') {
      failed = true;
      if (input.stopOnError !== false) break;
    }
  }

  const output = { results, failed, total: results.length, succeeded: results.filter(r => r.status === 'ok').length };

  if (input.combineReads) {
    const readResults = results.filter(r => r.step === 'read' && r.status === 'ok');
    if (readResults.length > 0) {
      output.combined = readResults.map(r => ({ file: r.filePath, content: r.output.content }));
    }
  }

  console.log(JSON.stringify(output, null, 2));
  process.exit(failed ? 1 : 0);
}

main().catch(err => {
  console.error(`[composer] Error: ${err.message}`);
  process.exit(1);
});
