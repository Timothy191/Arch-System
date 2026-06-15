#!/usr/bin/env node
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

async function main() {
  const workerId = process.argv[2] || 'unknown';
  const taskId = process.argv[3] || 'unknown';
  const runId = process.argv[4] || 'unknown';

  const raw = await readStdin();
  let input = {};
  try { input = JSON.parse(raw); } catch { input = {}; }

  const task = input.task || {};
  const context = input.context || {};
  const description = task.description || '';

  const result = {
    worker_id: workerId,
    task_id: taskId,
    run_id: runId,
    description: description.slice(0, 200),
    files_affected: task.files || [],
    status: 'ok',
    summary: `Worker ${workerId} completed: ${description.slice(0, 100)}`,
    started_at: new Date().toISOString(),
    completed_at: null,
    metadata: {
      has_context: Object.keys(context).length > 0,
      file_count: (task.files || []).length,
      dependency_count: (task.dependencies || []).length
    }
  };

  result.completed_at = new Date().toISOString();
  console.log(JSON.stringify(result));
  process.exit(0);
}

main().catch(err => {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
});
