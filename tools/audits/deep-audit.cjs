#!/usr/bin/env node

/**
 * @file tools/audits/deep-audit.cjs
 * @description DeepAudit 4-Agent Collaborative Security & Architecture Audit Orchestrator.
 * Adapted from lintsinghua/DeepAudit multi-agent audit architecture for Arch-System:
 *   Phase 1: Reconnaissance Agent — Maps API routes, Server Actions, migrations, Zod contracts, React UI
 *   Phase 2: Analysis Agent       — Executes AST & static security/architecture analyzers
 *   Phase 3: Verification Agent   — Cross-validates empirical results, SHA-256 digests, SSoT parity
 *   Phase 4: Orchestrator         — Computes DeepAudit Score (0-100) and optional report output
 *
 * Usage:
 *   node tools/audits/deep-audit.cjs          # Read-only check mode (default)
 *   node tools/audits/deep-audit.cjs --json   # Machine-readable JSON output
 *   node tools/audits/deep-audit.cjs --write  # Persist report to documentation/03-audit-reports/deep-audit-report.md
 */

const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { globSync } = require('glob');

const ROOT = path.resolve(__dirname, '..', '..');
const REPORT_DIR = path.join(ROOT, 'documentation', '03-audit-reports');
const REPORT_PATH = path.join(REPORT_DIR, 'deep-audit-report.md');
const JSON_MODE = process.argv.includes('--json');
const WRITE_REPORT = process.argv.includes('--write');

const MAX_SCORE = 100;
const CRITICAL_FAILURE_PENALTY = 20;
const VERIFICATION_FAILURE_PENALTY = 15;

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function runCommandCheck(spec) {
  const startMs = Date.now();
  const res = spawnSync(spec.command, spec.args, {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 120_000,
    maxBuffer: 16 * 1024 * 1024,
  });
  const durationMs = Date.now() - startMs;
  const combinedOutput = `${res.stdout || ''}\n${res.stderr || ''}`.trim();
  const exitCode = typeof res.status === 'number' ? res.status : 1;

  return {
    id: spec.id,
    name: spec.name,
    domain: spec.domain,
    cmd: `${spec.command} ${spec.args.join(' ')}`,
    passed: exitCode === 0,
    exitCode,
    durationMs,
    outputSha256: sha256(combinedOutput),
    evidenceLevel: spec.evidenceLevel,
    tail: combinedOutput.split('\n').slice(-10).join('\n'),
  };
}

/**
 * Phase 1: Reconnaissance Agent
 * Inventories exposed routes, Server Actions, database migrations, Zod contracts, and React modules.
 */
function runReconnaissance() {
  const apiRoutes = globSync('apps/portal/app/api/**/route.ts', { cwd: ROOT });
  const portalFiles = globSync('apps/portal/**/*.{ts,tsx}', {
    cwd: ROOT,
    ignore: ['**/node_modules/**', '**/.next/**', '**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
  });
  const serverActionFiles = portalFiles.filter((relPath) => {
    const content = fs.readFileSync(path.join(ROOT, relPath), 'utf8');
    return /^\s*['"]use server['"]\s*;?\s*$/m.test(content);
  });
  const migrations = globSync('packages/database/migrations/*.sql', { cwd: ROOT });
  const contractSchemas = globSync('packages/contract/src/schemas/*.schema.ts', { cwd: ROOT });
  const reactFiles = globSync(
    '{apps/portal/{app,components,features,hooks},packages/ui/src,libs/features/**/ui/src,libs/shared/hooks/src}/**/*.{ts,tsx}',
    {
      cwd: ROOT,
      ignore: [
        '**/node_modules/**',
        '**/.next/**',
        '**/dist/**',
        '**/*.d.ts',
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
        '**/*.stories.{ts,tsx}',
      ],
    }
  );

  return {
    apiRouteCount: apiRoutes.length,
    serverActionCount: serverActionFiles.length,
    migrationCount: migrations.length,
    contractSchemaCount: contractSchemas.length,
    reactFileCount: reactFiles.length,
  };
}

/**
 * Phase 2: Analysis Agent
 * Executes static security, authorization, RLS, React Doctor, contract drift, and supply-chain analyzers.
 */
function runAnalysis() {
  const analyzers = [
    {
      id: 'security-policy',
      name: 'Security Policy & Injection Scan',
      domain: 'Security',
      command: 'node',
      args: ['tools/audits/enforce-security-checks.cjs', '--ci'],
      evidenceLevel: 'E2',
    },
    {
      id: 'routing-actions',
      name: 'App Router & 8-Step Server Action Audit',
      domain: 'Auth & Mutations',
      command: 'node',
      args: ['tools/audits/audit-routing-and-actions.cjs'],
      evidenceLevel: 'E2',
    },
    {
      id: 'auth-matrix',
      name: 'Authorization Matrix Audit',
      domain: 'RBAC',
      command: 'node',
      args: ['tools/audits/audit-authorization-matrix.cjs', '--static-only'],
      evidenceLevel: 'E2',
    },
    {
      id: 'rls-matrix',
      name: 'PostgreSQL RLS Coverage Matrix',
      domain: 'Database',
      command: 'node',
      args: ['tools/audits/audit-rls-matrix.cjs'],
      evidenceLevel: 'E2',
    },
    {
      id: 'react-doctor',
      name: 'React Doctor Diagnostics',
      domain: 'React 19 & RSC',
      command: 'node',
      args: ['tools/audits/audit-react-doctor.cjs'],
      evidenceLevel: 'E2',
    },
    {
      id: 'contract-drift',
      name: 'Database-to-Contract Drift Audit',
      domain: 'Contracts',
      command: 'node',
      args: ['tools/audits/audit-contract-drift.cjs'],
      evidenceLevel: 'E2',
    },
    {
      id: 'supply-chain',
      name: 'Dependency & Supply-Chain Security',
      domain: 'Supply Chain',
      command: 'node',
      args: ['tools/audits/audit-supply-chain.cjs'],
      evidenceLevel: 'E2',
    },
  ];

  return analyzers.map(runCommandCheck);
}

/**
 * Phase 3: Verification Agent
 * Cross-validates analyzer results with independent SSoT and RSC boundary checks and builds digest evidence.
 */
function runVerification(analysisResults) {
  const verifiers = [
    {
      id: 'ssot-duplicates',
      name: 'Canonical SSoT Declaration Verification',
      domain: 'Architecture',
      command: 'node',
      args: ['tools/audits/audit-ssot-duplicates.cjs'],
      evidenceLevel: 'E4',
    },
    {
      id: 'server-components',
      name: 'React 19 RSC & Taint Cross-Validation',
      domain: 'React 19 & RSC',
      command: 'node',
      args: ['tools/audits/audit-server-components.cjs'],
      evidenceLevel: 'E4',
    },
  ];

  const verificationRuns = verifiers.map(runCommandCheck);
  const confirmedFindings = analysisResults.filter((item) => !item.passed);
  const verifiedFindings = verificationRuns.filter((item) => !item.passed);

  return {
    verificationRuns,
    confirmedFailureCount: confirmedFindings.length,
    verificationFailureCount: verifiedFindings.length,
  };
}

/**
 * Phase 4: Orchestrator & Report Generator
 * Aggregates all phase results into a deterministic verdict and optional Markdown report.
 */
function runOrchestrator(recon, analysis, verification) {
  const rawScore =
    MAX_SCORE -
    verification.confirmedFailureCount * CRITICAL_FAILURE_PENALTY -
    verification.verificationFailureCount * VERIFICATION_FAILURE_PENALTY;
  const score = Math.max(0, rawScore);
  const passed =
    verification.confirmedFailureCount === 0 && verification.verificationFailureCount === 0;

  const summary = {
    tool: 'deep-audit',
    passed,
    score,
    reconnaissance: recon,
    analysis,
    verification: verification.verificationRuns,
  };

  if (WRITE_REPORT) {
    if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });
    const rows = [...analysis, ...verification.verificationRuns]
      .map(
        (r) =>
          `| ${r.name} | ${r.domain} | ${r.passed ? 'PASS' : 'FAIL'} | ${r.evidenceLevel} | \`${r.outputSha256.slice(0, 12)}\` |`
      )
      .join('\n');

    const md = `# DeepAudit 4-Agent Security & Architecture Report

## Summary

- **Composite Score**: ${score}/100
- **Overall Verdict**: ${passed ? 'PASS' : 'FAIL'}

## Phase 1 — Reconnaissance Surface

- **API Routes**: ${recon.apiRouteCount}
- **Server Action Modules**: ${recon.serverActionCount}
- **SQL Migrations**: ${recon.migrationCount}
- **Zod Contract Schemas**: ${recon.contractSchemaCount}
- **React/UI Modules**: ${recon.reactFileCount}

## Phases 2 & 3 — Analysis & Empirical Verification

| Check | Domain | Verdict | Evidence | Digest |
| :--- | :--- | :--- | :--- | :--- |
${rows}
`;
    fs.writeFileSync(REPORT_PATH, md, 'utf8');
  }

  return summary;
}

function main() {
  if (!JSON_MODE) {
    console.log('========================================================');
    console.log('🔍 [DeepAudit] 4-Agent Security & Architecture Audit');
    console.log('========================================================');
  }

  const recon = runReconnaissance();
  if (!JSON_MODE) {
    console.log('\n1️⃣  Phase 1 — Reconnaissance Agent:');
    console.log(
      `   • Surface: ${recon.apiRouteCount} API routes, ${recon.serverActionCount} Server Action files, ${recon.migrationCount} migrations, ${recon.contractSchemaCount} Zod schemas, ${recon.reactFileCount} React/UI files`
    );
  }

  if (!JSON_MODE) {
    console.log('\n2️⃣  Phase 2 — Analysis Agent (7 security & architecture analyzers):');
  }
  const analysis = runAnalysis();
  if (!JSON_MODE) {
    for (const item of analysis) {
      const icon = item.passed ? '✅' : '❌';
      console.log(
        `   ${icon} [${item.domain}] ${item.name} (${item.durationMs}ms, sha256:${item.outputSha256.slice(0, 12)})`
      );
    }
  }

  if (!JSON_MODE) {
    console.log('\n3️⃣  Phase 3 — Verification Agent (Empirical Cross-Validation):');
  }
  const verification = runVerification(analysis);
  if (!JSON_MODE) {
    for (const item of verification.verificationRuns) {
      const icon = item.passed ? '✅' : '❌';
      console.log(
        `   ${icon} [${item.evidenceLevel}] ${item.name} (${item.durationMs}ms, sha256:${item.outputSha256.slice(0, 12)})`
      );
    }
  }

  const summary = runOrchestrator(recon, analysis, verification);

  if (JSON_MODE) {
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    process.exit(summary.passed ? 0 : 1);
  }

  console.log('\n4️⃣  Phase 4 — Orchestrator Verdict:');
  if (!summary.passed) {
    console.error(
      `❌ DeepAudit FAILED (Score: ${summary.score}/100, ${verification.confirmedFailureCount} analysis failure(s), ${verification.verificationFailureCount} verification failure(s)):\n`
    );
    for (const item of [...analysis, ...verification.verificationRuns]) {
      if (!item.passed) {
        console.error(`--- ${item.name} (exit ${item.exitCode}) ---`);
        console.error(item.tail);
      }
    }
    process.exit(1);
  }

  if (WRITE_REPORT) {
    console.log(`   📄 Report written to documentation/03-audit-reports/deep-audit-report.md`);
  }
  console.log(
    `✅ DeepAudit 4-Agent Security & Architecture Audit PASSED (Score: ${summary.score}/100, 0 Critical/High Violations).\n`
  );
  process.exit(0);
}

main();
