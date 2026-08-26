import fs from 'fs';
import path from 'path';

const status = process.argv[2] || 'UNKNOWN';
const repoRoot = path.resolve(import.meta.dirname, '..');
const logPath = path.join(repoRoot, 'run/dev.log');
const portalLogPath = path.join(repoRoot, 'run/portal.log');
const reportPath = path.join(repoRoot, 'dev-report.md');

let logText = '';
try {
  logText = fs.readFileSync(logPath, 'utf8');
} catch (e) {
  logText = 'No dev log found.';
}

// Clean ANSI escape codes
const cleanText = logText.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');

const lines = cleanText.split('\n');
const parsedChecks = [];
let currentPhase = null;

for (const line of lines) {
  // Phase matching: "PHASE 0 › Pre-flight" or similar
  const phaseMatch = line.match(/^\s*PHASE\s+([^\s›]+)\s*›\s*(.*)/i);
  if (phaseMatch) {
    currentPhase = {
      name: phaseMatch[1],
      title: phaseMatch[2].trim(),
      checks: []
    };
    parsedChecks.push(currentPhase);
    continue;
  }

  // Check matching: "  [OK] Temp artifacts           cleaned"
  const checkMatch = line.match(/^\s*\[(OK|ERR|SKIP|WARN|INFO)\]\s+(.*?)(?:\s\s+(.*))?$/);
  if (checkMatch && currentPhase) {
    currentPhase.checks.push({
      status: checkMatch[1],
      label: checkMatch[2].trim(),
      detail: (checkMatch[3] || '').trim()
    });
  }
}

// Get Node & pnpm versions
const nodeVersion = process.version;
let pnpmVersion = 'Unknown';
try {
  const pnpmPkg = fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8');
  const pkg = JSON.parse(pnpmPkg);
  pnpmVersion = pkg.packageManager ? pkg.packageManager.split('@')[1] : 'Unknown';
} catch (e) {}

let md = `# Development Boot Report\n\n`;
md += `- **Status**: ${status === 'SUCCESS' ? '✅ SUCCESS' : '❌ ' + status}\n`;
md += `- **Timestamp**: ${new Date().toISOString()}\n`;
md += `- **Node.js**: ${nodeVersion}\n`;
md += `- **pnpm**: ${pnpmVersion}\n\n`;

md += `## Boot Log Checklist\n\n`;

if (parsedChecks.length === 0) {
  md += `No phase steps were completed.\n\n`;
} else {
  for (const phase of parsedChecks) {
    md += `### Phase ${phase.name}: ${phase.title}\n\n`;
    for (const check of phase.checks) {
      let icon = '⚪';
      if (check.status === 'OK') icon = '✅';
      else if (check.status === 'ERR') icon = '❌';
      else if (check.status === 'WARN') icon = '⚠️';
      else if (check.status === 'SKIP') icon = '⏭️';
      else if (check.status === 'INFO') icon = 'ℹ️';

      md += `- ${icon} **${check.label}**`;
      if (check.detail) {
        md += ` - *${check.detail}*`;
      }
      md += `\n`;
    }
    md += `\n`;
  }
}

if (status !== 'SUCCESS') {
  md += `## Troubleshooting & Diagnostics\n\n`;
  
  md += `### Last 50 lines of dev.log\n\`\`\`text\n`;
  const devLogLines = cleanText.split('\n').slice(-50).join('\n');
  md += devLogLines + `\n\`\`\`\n\n`;

  if (fs.existsSync(portalLogPath)) {
    try {
      const portalLog = fs.readFileSync(portalLogPath, 'utf8');
      const cleanPortal = portalLog.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
      md += `### Last 50 lines of portal.log\n\`\`\`text\n`;
      const portalLogLines = cleanPortal.split('\n').slice(-50).join('\n');
      md += portalLogLines + `\n\`\`\`\n\n`;
    } catch (e) {}
  }
}

fs.writeFileSync(reportPath, md, 'utf8');
console.log(`Generated dev-report.md`);
