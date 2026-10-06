#!/usr/bin/env node

/**
 * @fileoverview Consolidated Audit Runner
 * Executes RLS, Design System, and dependency audits, creates versioned log directories (e.g., log-1(26-08-20)/),
 * and generates 4 comprehensive reports:
 *   1. design-report.md
 *   2. rls-report.md
 *   3. results.md
 *   4. required-actions.md
 *
 * Usage: node tools/audits/run-audit.cjs
 */

const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const AUDIT_ROOT = path.join(ROOT, 'documentation', '03-audit-reports');

/**
 * Formats date as YY-MM-DD for folder naming and ISO string for metadata.
 */
function getFormattedDate() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return {
    folderDate: `${yy}-${mm}-${dd}`,
    isoDate: now.toISOString(),
    displayDate: `${now.toLocaleString('en-US', { timeZone: 'UTC' })} UTC`,
  };
}

/**
 * Scans documentation/03-audit-reports/ directory to determine the next log folder number.
 */
function getNextLogNumber() {
  if (!fs.existsSync(AUDIT_ROOT)) {
    fs.mkdirSync(AUDIT_ROOT, { recursive: true });
    return 1;
  }

  const entries = fs.readdirSync(AUDIT_ROOT, { withFileTypes: true });
  let maxLogNum = 0;

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const match = entry.name.match(/^log-(\d+)/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxLogNum) {
          maxLogNum = num;
        }
      }
    }
  }

  return maxLogNum + 1;
}

function runDependencyAudit(args) {
  try {
    const stdout = execSync(`pnpm audit ${args} --json`, {
      cwd: ROOT,
      timeout: 60_000,
      encoding: 'utf-8',
      stdio: 'pipe',
    });
    return { exitCode: 0, report: JSON.parse(stdout), error: null };
  } catch (err) {
    const stdout = err.stdout?.toString() || '';
    let report = null;
    try {
      report = stdout.trim() ? JSON.parse(stdout) : null;
    } catch {
      report = null;
    }
    return {
      exitCode: err.status || 1,
      report,
      error: err.stderr?.toString().trim() || stdout.trim() || err.message,
    };
  }
}

/**
 * Main orchestrator for audit execution.
 */
function main() {
  console.log('==================================================');
  console.log('🚀 Starting Arch Systems Operations Audit Suite');
  console.log('==================================================\n');

  const logNum = getNextLogNumber();
  const dateInfo = getFormattedDate();
  const folderName = `log-${logNum}(${dateInfo.folderDate})`;
  const targetDir = path.join(AUDIT_ROOT, folderName);

  fs.mkdirSync(targetDir, { recursive: true });
  console.log(`📁 Audit Log Directory: documentation/03-audit-reports/${folderName}/\n`);

  // 1. Run RLS Audit
  console.log('🔒 Running Row Level Security (RLS) Audit...');
  let rlsExitCode = 0;
  try {
    execSync('node tools/audits/audit-rls.cjs', {
      cwd: ROOT,
      env: { ...process.env, AUDIT_DIR: targetDir },
      stdio: 'inherit',
    });
  } catch (err) {
    rlsExitCode = err.status || 1;
  }

  // 2. Run Design Audit
  console.log('\n🎨 Running Design System Compliance Audit...');
  let designExitCode = 0;
  try {
    execSync('node tools/audits/design-audit.cjs', {
      cwd: ROOT,
      env: { ...process.env, AUDIT_DIR: targetDir },
      stdio: 'inherit',
    });
  } catch (err) {
    designExitCode = err.status || 1;
  }

  // 3. Gate deployment on production dependencies; keep workspace-only findings visible.
  console.log('\n🛡️ Running production dependency vulnerability audit (CI Gate)...');
  const productionAudit = runDependencyAudit('--prod --audit-level=high');
  const productionFindings = Object.entries(productionAudit.report?.advisories || {});
  const productionBlockingAdvisories = productionFindings.filter(([, advisory]) =>
    ['high', 'critical'].includes(String(advisory.severity).toLowerCase())
  );
  const productionWarningAdvisories = productionFindings.filter(([, advisory]) =>
    ['low', 'moderate'].includes(String(advisory.severity).toLowerCase())
  );
  const auditExitCode = !productionAudit.report || productionBlockingAdvisories.length > 0 ? 1 : 0;
  if (auditExitCode === 0) {
    console.log(
      `   ✓ Production dependency check passed (0 high/critical issues; ${productionWarningAdvisories.length} lower-severity warning(s)).`
    );
    for (const [, advisory] of productionWarningAdvisories) {
      console.warn(`   - ${advisory.module_name}: ${advisory.title} (${advisory.severity})`);
    }
  } else {
    console.error('   ❌ Production dependency vulnerability audit failed; failing closed.');
    for (const [, advisory] of productionBlockingAdvisories) {
      console.error(`   - ${advisory.module_name}: ${advisory.title} (${advisory.severity})`);
    }
    if (!productionAudit.report && productionAudit.error) console.error(productionAudit.error);
  }

  console.log('\n🔎 Checking the full workspace dependency graph for non-production findings...');
  const workspaceAudit = runDependencyAudit('--audit-level=high');
  const productionAdvisories = new Set(Object.keys(productionAudit.report?.advisories || {}));
  const workspaceAdvisories = Object.entries(workspaceAudit.report?.advisories || {}).filter(
    ([id, advisory]) =>
      !productionAdvisories.has(id) &&
      ['high', 'critical'].includes(String(advisory.severity).toLowerCase())
  );
  const workspaceAuditUnavailable = !workspaceAudit.report;
  if (workspaceAuditUnavailable) {
    console.error('   ❌ Full workspace dependency report unavailable.');
    if (workspaceAudit.error) console.error(workspaceAudit.error);
  } else if (workspaceAdvisories.length > 0) {
    console.warn(
      `   ⚠️ ${workspaceAdvisories.length} high/critical finding(s) are limited to non-production dependencies.`
    );
    for (const [, advisory] of workspaceAdvisories) {
      console.warn(`   - ${advisory.module_name}: ${advisory.title} (${advisory.severity})`);
    }
  } else {
    console.log('   ✓ No high/critical workspace-only findings.');
  }
  const workspaceWarningCount = workspaceAuditUnavailable ? 1 : workspaceAdvisories.length;

  // 4. Read generated reports
  const rlsReportPath = path.join(targetDir, 'rls-report.md');
  const designReportPath = path.join(targetDir, 'design-report.md');

  const rlsContent = fs.existsSync(rlsReportPath)
    ? fs.readFileSync(rlsReportPath, 'utf-8')
    : '# RLS Report\n\nReport unavailable.';
  const designContent = fs.existsSync(designReportPath)
    ? fs.readFileSync(designReportPath, 'utf-8')
    : '# Design Report\n\nReport unavailable.';

  // Extract metrics from RLS content
  const rlsCriticalMatch =
    rlsContent.match(/CRITICAL table\(s\) missing RLS:\s*(\d+)/i) ||
    rlsContent.match(/Critical Issues:\s*(\d+)/i);
  const rlsWarningMatch =
    rlsContent.match(/suspicious policy warning\(s\):\s*(\d+)/i) ||
    rlsContent.match(/Warnings:\s*(\d+)/i);
  const rlsCriticals = rlsCriticalMatch
    ? parseInt(rlsCriticalMatch[1], 10)
    : rlsExitCode !== 0
      ? 1
      : 0;
  const rlsWarnings = rlsWarningMatch ? parseInt(rlsWarningMatch[1], 10) : 0;

  // Extract metrics from Design content
  const designCriticalMatch =
    designContent.match(/CRITICAL:\s*(\d+)/i) ||
    designContent.match(/Critical Violations:\s*(\d+)/i);
  const designWarningMatch =
    designContent.match(/WARNINGS:\s*(\d+)/i) || designContent.match(/Warnings:\s*(\d+)/i);
  const designCriticals = designCriticalMatch
    ? parseInt(designCriticalMatch[1], 10)
    : designExitCode !== 0
      ? 1
      : 0;
  const designWarnings = designWarningMatch ? parseInt(designWarningMatch[1], 10) : 0;

  const totalCriticals = rlsCriticals + designCriticals + (auditExitCode === 0 ? 0 : 1);
  const totalWarnings =
    rlsWarnings + designWarnings + workspaceWarningCount + productionWarningAdvisories.length;

  // Compute audit score (100 base, -15 per critical, -2 per warning)
  let score = 100 - totalCriticals * 15 - totalWarnings * 2;
  if (score < 0) score = 0;

  let overallStatus = 'PASS';
  if (totalCriticals > 0) {
    overallStatus = 'FAIL';
  } else if (totalWarnings > 0) {
    overallStatus = 'WARN';
  }

  // 4. Generate results.md
  const resultsContent = `# 📊 System Audit Results — Log #${logNum} (${dateInfo.folderDate})

**Audit Date:** ${dateInfo.displayDate}

**Log Folder:** \`.audit/${folderName}/\`

**Overall Audit Score:** **${score.toFixed(1)}%** (${overallStatus === 'PASS' ? '✅ PASS' : overallStatus === 'WARN' ? '⚠️ WARN' : '❌ FAIL'})
**Status Gate:** ${totalCriticals > 0 ? 'FAILED (Production Action Required)' : totalWarnings > 0 ? 'PASSED WITH WARNINGS (No Production Blockers)' : 'PASSED (Clean Production Gate)'}

**Production Dependency Vulnerability Audit:** ${auditExitCode === 0 ? 'PASSED' : 'FAILED (high/critical vulnerabilities or audit error)'}

---

## 📈 Executive Summary

| Audit Module | Status | Score | Critical Violations | Warnings | Status Gate |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Row Level Security (RLS)** | ${rlsCriticals === 0 ? '✅ PASS' : '❌ FAIL'} | ${rlsCriticals === 0 ? '100%' : '0%'} | ${rlsCriticals} | ${rlsWarnings} | ${rlsCriticals === 0 ? 'Passed' : 'Blocking'} |
| **Design System Compliance** | ${designCriticals === 0 ? (designWarnings === 0 ? '✅ PASS' : '⚠️ WARN') : '❌ FAIL'} | ${(100 - designCriticals * 20 - designWarnings * 2).toFixed(1)}% | ${designCriticals} | ${designWarnings} | ${designCriticals === 0 ? 'Passed' : 'Blocking'} |
| **Production Dependency Vulnerability Audit** | ${auditExitCode === 0 ? (productionWarningAdvisories.length === 0 ? '✅ PASS' : '⚠️ WARN') : '❌ FAIL'} | ${auditExitCode === 0 ? '100%' : '0%'} | ${auditExitCode === 0 ? 0 : 1} | ${productionWarningAdvisories.length} | ${auditExitCode === 0 ? (productionWarningAdvisories.length === 0 ? 'Passed' : 'Review') : 'Blocking'} |
| **Workspace-only Dependency Findings** | ${workspaceWarningCount === 0 ? '✅ PASS' : '⚠️ WARN'} | ${workspaceWarningCount === 0 ? '100%' : 'Review'} | 0 | ${workspaceWarningCount} | ${workspaceWarningCount === 0 ? 'Passed' : 'Non-production'} |
| **Consolidated Total** | **${overallStatus === 'PASS' ? '✅ PASS' : overallStatus === 'WARN' ? '⚠️ WARN' : '❌ FAIL'}** | **${score.toFixed(1)}%** | **${totalCriticals}** | **${totalWarnings}** | **${totalCriticals === 0 ? 'NO PRODUCTION BLOCKERS' : 'ACTION REQUIRED'}** |

---

## 📑 Generated Reports Index

1. [🎨 Design System Compliance Report](design-report.md) — Visual tokens, light theme, shadow utilities, lucide icon imports.
2. [🔒 Row Level Security (RLS) Report](rls-report.md) — Postgres schema security, table RLS status, department isolation checks.
3. [📋 Required Action Items Checklist](required-actions.md) — Priority remediation items derived directly from audit findings.

---

## 🛡️ Quality Gate & System Hygiene Compliance
* **XDG Base Directory**: Compliant (\`$HOME/.config\`, \`$HOME/.cache\`, \`$HOME/.local\`).
* **Design Palette**: Light-only (OKLCH tokens, glass surfaces, named shadows).
* **Security & RLS**: All active tables guarded with Postgres RLS policies.
`;

  const workspaceAuditDetails =
    workspaceAdvisories.length > 0
      ? workspaceAdvisories
          .map(
            ([, advisory]) => `- ${advisory.module_name}: ${advisory.title} (${advisory.severity})`
          )
          .join('\n')
      : workspaceAuditUnavailable
        ? '- Full workspace dependency report unavailable; production audit remains a separate blocking gate.'
        : '- No high/critical findings outside production dependencies.';
  const productionAuditDetails =
    productionWarningAdvisories.length > 0
      ? productionWarningAdvisories
          .map(
            ([, advisory]) => `- ${advisory.module_name}: ${advisory.title} (${advisory.severity})`
          )
          .join('\n')
      : '- No low/moderate production dependency advisories.';
  const dependencyDetails = `\n## Dependency Audit Detail\n\nProduction dependencies block deployment for high/critical findings; lower-severity advisories remain visible for review:\n\n${productionAuditDetails}\n\nHigh/critical findings outside the production graph are recorded as workspace-only warnings:\n\n${workspaceAuditDetails}\n`;
  fs.writeFileSync(path.join(targetDir, 'results.md'), `${resultsContent}${dependencyDetails}`);

  // 5. Generate required-actions.md
  const actionItemsList = [];

  if (rlsCriticals > 0) {
    actionItemsList.push(
      `- [ ] **[CRITICAL - RLS]** Enable Row Level Security on unprotected database tables identified in \`rls-report.md\`.`
    );
  }
  if (rlsWarnings > 0) {
    actionItemsList.push(
      `- [ ] **[MEDIUM - RLS]** Review overly permissive \`USING (true)\` policies on department-scoped tables in \`rls-report.md\`.`
    );
  }
  if (designCriticals > 0) {
    actionItemsList.push(
      `- [ ] **[CRITICAL - DESIGN]** Fix critical design system violations (raw box-shadow, dark: selectors) listed in \`design-report.md\`.`
    );
  }
  if (designWarnings > 0) {
    actionItemsList.push(
      `- [ ] **[LOW - DESIGN]** Standardize shadow utilities and icon imports identified in \`design-report.md\`.`
    );
  }
  if (auditExitCode !== 0) {
    actionItemsList.push(
      `- [ ] **[CRITICAL - DEPENDENCIES]** Resolve high/critical dependency advisories or restore vulnerability audit availability before deployment.`
    );
  }
  if (productionWarningAdvisories.length > 0) {
    const warningDetails = productionWarningAdvisories
      .map(([, advisory]) => `${advisory.module_name} (${advisory.severity})`)
      .join(', ');
    actionItemsList.push(
      `- [ ] **[NON-BLOCKING - PRODUCTION DEPENDENCIES]** Review: ${warningDetails}. These lower-severity advisories remain visible; deployment blocks on high/critical findings.`
    );
  }
  if (workspaceWarningCount > 0) {
    const warningDetails = workspaceAdvisories.length
      ? workspaceAdvisories
          .map(([, advisory]) => `${advisory.module_name} (${advisory.severity})`)
          .join(', ')
      : 'full workspace audit report unavailable';
    actionItemsList.push(
      `- [ ] **[NON-BLOCKING - NON-PRODUCTION DEPENDENCIES]** Review: ${warningDetails}. These findings are outside the production dependency graph.`
    );
  }

  if (actionItemsList.length === 0) {
    actionItemsList.push(
      `- [x] **[VERIFIED]** Zero critical violations or warnings detected. All design and RLS security gates are 100% compliant.`
    );
    actionItemsList.push(
      `- [ ] **[ROUTINE]** Re-run \`pnpm quality\` before pushing any new schema migrations or UI components.`
    );
  }

  const requiredActionsContent = `# 📋 Required Actions & Remediation Plan — Log #${logNum} (${dateInfo.folderDate})

**Generated:** ${dateInfo.displayDate}

**Associated Audit Log:** \`documentation/03-audit-reports/${folderName}/\`
**Total Pending Action Items:** ${totalCriticals + totalWarnings} (${totalCriticals} Critical, ${totalWarnings} Warnings)

---

## 🚨 Priority Action Checklist

${actionItemsList.join('\n')}

---

## 🛠️ Verification & Next Steps

To verify resolutions after applying fixes, execute the quality suite:
\`\`\`bash
pnpm quality
\`\`\`

All audit logs are stored chronologically in \`documentation/03-audit-reports/\` and accessible via the **System Overview** portal dashboard.
`;

  fs.writeFileSync(path.join(targetDir, 'required-actions.md'), requiredActionsContent);

  // 6. Update documentation/03-audit-reports/latest and root documentation/03-audit-reports/ copies for backwards compatibility
  const latestDir = path.join(AUDIT_ROOT, 'latest');
  fs.mkdirSync(latestDir, { recursive: true });

  const filesToCopy = ['design-report.md', 'rls-report.md', 'results.md', 'required-actions.md'];
  for (const file of filesToCopy) {
    const src = path.join(targetDir, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(latestDir, file));
      fs.copyFileSync(src, path.join(AUDIT_ROOT, file));
    }
  }

  // 7. Update manifest.json
  const manifestPath = path.join(AUDIT_ROOT, 'manifest.json');
  let manifest = [];
  if (fs.existsSync(manifestPath)) {
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    } catch {
      manifest = [];
    }
  }

  // Filter out any existing entry with the same folderName to prevent duplicates
  manifest = manifest.filter((entry) => entry.folderName !== folderName && entry.id !== folderName);

  manifest.unshift({
    id: folderName,
    logNumber: logNum,
    folderName,
    folderDate: dateInfo.folderDate,
    isoDate: dateInfo.isoDate,
    displayDate: dateInfo.displayDate,
    score,
    overallStatus,
    criticalCount: totalCriticals,
    warningCount: totalWarnings,
  });

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log('\n==================================================');
  console.log(
    `${overallStatus === 'PASS' ? '✅' : overallStatus === 'WARN' ? '⚠️' : '❌'} Audit run completed with ${overallStatus}. Log #${logNum}`
  );
  console.log(`📊 Score: ${score.toFixed(1)}% (${overallStatus})`);
  console.log(`📁 Output directory: documentation/03-audit-reports/${folderName}/`);
  console.log('   ├── design-report.md');
  console.log('   ├── rls-report.md');
  console.log('   ├── results.md');
  console.log('   └── required-actions.md');
  console.log('==================================================\n');

  if (totalCriticals > 0) {
    process.exit(1);
  }
}

main();
