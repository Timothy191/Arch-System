#!/usr/bin/env node

/**
 * @fileoverview Per-Department Real-World Verification & Test Runner
 *
 * Verifies all 13 operational departments defined in @repo/departments/data-access:
 *   1. Physical Next.js App Router entrypoint existence in apps/portal/app/
 *   2. Proxy redirect allowlist & RBAC registration in apps/portal/server/proxy.ts
 *   3. Canonical department registry & tab configuration in libs/features/departments/data-access
 *   4. Real Jest unit/integration test suite execution per department
 *
 * Usage:
 *   pnpm test:departments                       # Verify & test all 13 departments
 *   pnpm test:dept <slug>                       # Test a single department (e.g. control-room)
 *   pnpm test:departments --dept=drilling       # Filter by department slug
 *   pnpm test:departments --list                # List all 13 department test mappings
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const PORTAL_DIR = path.join(ROOT, 'apps', 'portal');

/**
 * Canonical 13-Department Verification Matrix
 */
const DEPARTMENT_MATRIX = [
  {
    slug: 'admin',
    displayName: 'Administration',
    route: '/admin',
    entryFile: 'apps/portal/app/admin/page.tsx',
    proxyPattern: '/admin',
    portalTests: [
      'app/admin/admin-auth.test.ts',
      'features/admin/actions/sites-minerals.test.ts',
      'features/admin/tabs/actions.test.ts',
      'features/admin/tabs/SitesTab.test.tsx',
      'app/api/admin/data/[table]/route.test.ts',
      'features/integrations/components/IntegrationManager.test.tsx',
      'features/integrations/components/IntegrationRulesPanel.test.tsx',
    ],
    e2eSpecs: ['e2e/permissions-roles.spec.ts'],
  },
  {
    slug: 'access-control',
    displayName: 'Access Control',
    route: '/access-control',
    entryFile: 'apps/portal/app/(departments)/access-control/page.tsx',
    proxyPattern: '/access-control',
    portalTests: [
      'app/(departments)/access-control/access-logs/access-logs.test.tsx',
      'app/(departments)/access-control/card-actions/actions.test.ts',
      'app/(departments)/access-control/components/DashboardEntityStatus.test.tsx',
      'app/(departments)/access-control/lib/__tests__/printer-detection.test.ts',
      'app/(departments)/access-control/muster/muster-roll-call-view.test.tsx',
      'app/api/c66/route.test.ts',
      'app/api/printers/route.test.ts',
    ],
    e2eSpecs: [
      'e2e/access-card-actions/card-actions.spec.ts',
      'e2e/access-card-actions/printing.spec.ts',
    ],
  },
  {
    slug: 'production',
    displayName: 'Production',
    route: '/production',
    entryFile: 'apps/portal/app/(departments)/[department]/page.tsx',
    proxyPattern: '/production',
    portalTests: [
      'features/departments/components/production/ProductionCommandCenterClient.test.tsx',
      'app/(departments)/[department]/daily-log/DailyLogForm.test.tsx',
      'app/(departments)/[department]/page.test.tsx',
      'lib/production-reconciliation.test.ts',
      'app/api/export/production/route.test.ts',
    ],
    e2eSpecs: ['e2e/data-entry.spec.ts'],
  },
  {
    slug: 'drilling',
    displayName: 'Drilling',
    route: '/drilling',
    entryFile: 'apps/portal/app/(departments)/[department]/page.tsx',
    proxyPattern: '/drilling',
    portalTests: [
      'app/(departments)/drilling/drilling-operations/actions.test.ts',
      'app/(departments)/drilling/drilling-operations/DrillingOperationsTable.test.tsx',
      'app/(departments)/drilling/reports/DrillingReportsDashboardClient.test.tsx',
      'app/api/telemetry/drilling/route.test.ts',
      'app/api/telemetry/drilling/stream/route.test.ts',
    ],
    e2eSpecs: ['e2e/department-navigation.spec.ts'],
  },
  {
    slug: 'plant-processing',
    displayName: 'Plant Processing',
    route: '/plant-processing',
    entryFile: 'apps/portal/app/(departments)/[department]/page.tsx',
    proxyPattern: '/plant-processing',
    portalTests: [
      'features/departments/components/plant-processing/plant-processing.test.tsx',
      'lib/department-live-metrics.test.ts',
    ],
    e2eSpecs: ['e2e/department-navigation.spec.ts'],
  },
  {
    slug: 'plant-inventory',
    displayName: 'Plant Inventory',
    route: '/plant-inventory',
    entryFile: 'apps/portal/app/(departments)/[department]/page.tsx',
    proxyPattern: '/plant-inventory',
    portalTests: [
      'features/departments/components/plant-inventory/PlantInventoryWorkspaceClient.test.tsx',
      'lib/department-live-metrics.test.ts',
    ],
    e2eSpecs: ['e2e/department-navigation.spec.ts'],
  },
  {
    slug: 'engineering',
    displayName: 'Engineering',
    route: '/engineering',
    entryFile: 'apps/portal/app/(departments)/engineering/page.tsx',
    proxyPattern: '/engineering',
    portalTests: [
      'app/(departments)/engineering/page.test.tsx',
      'app/(departments)/[department]/breakdowns/page.test.tsx',
      'app/(departments)/[department]/tire-management/page.test.tsx',
      'app/(departments)/[department]/engineering-notes/EngineeringNotesList.test.tsx',
      'app/(departments)/[department]/engineering-notes/EngineeringOverviewTable.test.tsx',
    ],
    e2eSpecs: ['e2e/department-navigation.spec.ts'],
  },
  {
    slug: 'control-room',
    displayName: 'Control Room',
    route: '/control-room',
    entryFile: 'apps/portal/app/(departments)/[department]/page.tsx',
    proxyPattern: '/control-room',
    portalTests: [
      'app/(departments)/control-room/components/ControlRoomQuickNav.test.tsx',
      'app/(departments)/control-room/components/SupervisorApprovalPanel.test.tsx',
      'app/(departments)/[department]/hourly-loads/actions.test.ts',
      'app/(departments)/[department]/hourly-loads/hourly-loads-keys.test.ts',
      'app/(departments)/[department]/machine-operations/actions.test.ts',
      'app/(departments)/[department]/machine-operations/MachineOperationsList.test.tsx',
      'app/(departments)/[department]/excavator-activity/ExcavatorActivityForm.test.tsx',
      'app/(departments)/[department]/excavator-activity/ExcavatorActivityList.test.tsx',
      'features/departments/components/control-room/ControlRoomPanels.test.tsx',
      'features/departments/components/control-room/ScadaPanel.load.test.tsx',
      'components/control-room/C66MachineOperatorScanner.test.tsx',
      'lib/control-room-shift-report.test.ts',
      'lib/actions/shift-closeout.test.ts',
      'app/api/control-room/shift-closeout/route.test.ts',
    ],
    e2eSpecs: [
      'e2e/control-room-machine-operations.spec.ts',
      'e2e/control-room-shift-closeout.spec.ts',
      'e2e/control-room-scada.spec.ts',
      'e2e/control-room-alerts.spec.ts',
    ],
  },
  {
    slug: 'availability-utilization',
    displayName: 'Availability & Utilization',
    route: '/availability-utilization',
    entryFile: 'apps/portal/app/(departments)/[department]/page.tsx',
    proxyPattern: '/availability-utilization',
    portalTests: [
      'app/(departments)/[department]/reports/predictive-maintenance.test.ts',
      'app/(departments)/[department]/reports/reports-analytics-helpers.test.ts',
      'app/(departments)/[department]/reports/ReportsDashboardClient.test.tsx',
      'app/(departments)/[department]/reports/ShiftReportA4Preview.test.tsx',
      'lib/reports/shift-integrity.test.ts',
    ],
    e2eSpecs: ['e2e/department-navigation.spec.ts'],
  },
  {
    slug: 'overview',
    displayName: 'System Overview',
    route: '/overview',
    entryFile: 'apps/portal/app/overview/page.tsx',
    proxyPattern: '/overview',
    portalTests: ['app/overview/page.test.tsx', 'app/api/codebase-maps/route.test.ts'],
    e2eSpecs: ['e2e/overview.spec.ts'],
  },
  {
    slug: 'database',
    displayName: 'Database',
    route: '/database',
    entryFile: 'apps/portal/app/(departments)/database/page.tsx',
    proxyPattern: '/database',
    portalTests: ['app/(departments)/database/page.test.tsx'],
    e2eSpecs: ['e2e/department-navigation.spec.ts'],
  },
  {
    slug: 'office',
    displayName: 'Office',
    route: '/office',
    entryFile: 'apps/portal/app/(departments)/office/page.tsx',
    proxyPattern: '/office',
    portalTests: [
      'app/(departments)/office/page.test.tsx',
      'features/departments/components/tools/GoogleWorkspacePanel.test.tsx',
      'features/departments/components/tools/UniverSheet.test.tsx',
    ],
    e2eSpecs: ['e2e/department-navigation.spec.ts'],
  },
  {
    slug: 'executive',
    displayName: 'Executive Dashboard',
    route: '/hub/executive',
    entryFile: 'apps/portal/app/hub/executive/page.tsx',
    proxyPattern: '/hub',
    portalTests: [
      'app/hub/executive/page.test.tsx',
      'app/hub/page.test.tsx',
      'features/hub/components/CoreOperationalModules.test.tsx',
      'lib/hub-departments.test.ts',
    ],
    e2eSpecs: ['e2e/executive-dashboard.spec.ts'],
  },
];

function parseCliArgs(argv) {
  const args = { dept: null, list: false };
  for (const arg of argv) {
    if (arg === '--list') {
      args.list = true;
    } else if (arg.startsWith('--dept=')) {
      args.dept = arg.slice('--dept='.length).trim();
    } else if (!arg.startsWith('-')) {
      args.dept = arg.trim();
    }
  }
  return args;
}

function verifyStaticContracts(departments) {
  const departmentsSource = fs.readFileSync(
    path.join(ROOT, 'libs/features/departments/data-access/src/departments.ts'),
    'utf8'
  );
  const proxySource = fs.readFileSync(path.join(ROOT, 'apps/portal/server/proxy.ts'), 'utf8');

  const contractMap = new Map();
  for (const dept of departments) {
    const entryExists = fs.existsSync(path.join(ROOT, dept.entryFile));
    const registeredInSsot = departmentsSource.includes(`name: '${dept.slug}'`);
    const registeredInProxy = proxySource.includes(dept.proxyPattern.replace('/', '\\/'));
    const missingTests = dept.portalTests.filter(
      (relPath) => !fs.existsSync(path.join(PORTAL_DIR, relPath))
    );

    contractMap.set(dept.slug, {
      entryExists,
      registeredInSsot,
      registeredInProxy,
      missingTests,
      valid: entryExists && registeredInSsot && registeredInProxy && missingTests.length === 0,
    });
  }
  return contractMap;
}

function main() {
  const args = parseCliArgs(process.argv.slice(2));

  if (args.list) {
    console.log('\n📋 Arch-System 13-Department Test Matrix:\n');
    for (const dept of DEPARTMENT_MATRIX) {
      console.log(
        `  • ${dept.slug.padEnd(26)} (${dept.route.padEnd(25)}) -> ${dept.portalTests.length} Jest suites, ${dept.e2eSpecs.length} E2E specs`
      );
    }
    process.exit(0);
  }

  const targetDepts = args.dept
    ? DEPARTMENT_MATRIX.filter((d) => d.slug === args.dept)
    : DEPARTMENT_MATRIX;

  if (targetDepts.length === 0) {
    console.error(
      `❌ Unknown department "${args.dept}". Valid slugs: ${DEPARTMENT_MATRIX.map((d) => d.slug).join(', ')}`
    );
    process.exit(1);
  }

  console.log('================================================================================');
  console.log(
    `🏭 [ARCH-SYSTEM DEPARTMENT VERIFIER] Testing ${targetDepts.length}/${DEPARTMENT_MATRIX.length} Department(s)...`
  );
  console.log('================================================================================\n');

  const contractResults = verifyStaticContracts(targetDepts);

  // Collect unique portal test files to execute in a single fast Jest process
  const uniqueTestFiles = [...new Set(targetDepts.flatMap((d) => d.portalTests))];
  const tmpJsonPath = path.join(ROOT, '.ci-local', 'dept-jest-results.json');
  fs.mkdirSync(path.dirname(tmpJsonPath), { recursive: true });
  if (fs.existsSync(tmpJsonPath)) {
    fs.unlinkSync(tmpJsonPath);
  }

  const startMs = Date.now();
  const jestRun = spawnSync(
    'pnpm',
    [
      '--filter',
      'portal',
      'exec',
      'jest',
      '--runInBand',
      '--runTestsByPath',
      '--json',
      `--outputFile=${tmpJsonPath}`,
      ...uniqueTestFiles,
    ],
    {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 120000,
    }
  );
  const totalElapsedMs = Date.now() - startMs;

  if (!fs.existsSync(tmpJsonPath)) {
    console.error('❌ Jest failed to produce JSON test output:');
    console.error(jestRun.stderr || jestRun.stdout);
    process.exit(1);
  }

  const jestReport = JSON.parse(fs.readFileSync(tmpJsonPath, 'utf8'));
  const fileResultMap = new Map();
  for (const suiteResult of jestReport.testResults || []) {
    const relPath = path.relative(PORTAL_DIR, suiteResult.name).replace(/\\/g, '/');
    const assertions = Array.isArray(suiteResult.assertionResults)
      ? suiteResult.assertionResults
      : [];
    const passedCount = assertions.filter((a) => a.status === 'passed').length;
    const failedCount = assertions.filter((a) => a.status === 'failed').length;
    const durationMs =
      typeof suiteResult.endTime === 'number' && typeof suiteResult.startTime === 'number'
        ? Math.max(0, suiteResult.endTime - suiteResult.startTime)
        : 0;
    fileResultMap.set(relPath, {
      status: suiteResult.status,
      passed: passedCount,
      failed: failedCount,
      durationMs,
      message: suiteResult.message || '',
    });
  }

  // Also run @repo/departments/data-access test when testing all departments
  let dataAccessPassed = true;
  if (!args.dept) {
    const libRun = spawnSync('pnpm', ['--filter', '@repo/departments/data-access', 'test'], {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 30000,
    });
    dataAccessPassed = libRun.status === 0;
  }

  console.log(
    `${'Department'.padEnd(26)} | ${'Route'.padEnd(25)} | ${'Contract'.padEnd(8)} | ${'Suites'.padEnd(7)} | ${'Tests'.padEnd(9)} | ${'Time'.padEnd(7)} | Status`
  );
  console.log('-'.repeat(100));

  let overallFailed = !dataAccessPassed;
  const departmentSummary = [];

  for (const dept of targetDepts) {
    const contract = contractResults.get(dept.slug);
    let suitesPassed = 0;
    let testsPassed = 0;
    let testsFailed = 0;
    let deptDurationMs = 0;
    const failureMessages = [];

    for (const relTest of dept.portalTests) {
      const res = fileResultMap.get(relTest);
      if (!res) {
        testsFailed++;
        failureMessages.push(`Suite did not run: ${relTest}`);
        continue;
      }
      if (res.status === 'passed' && res.failed === 0) {
        suitesPassed++;
      } else {
        failureMessages.push(res.message || `Failed suite: ${relTest}`);
      }
      testsPassed += res.passed;
      testsFailed += res.failed;
      deptDurationMs += res.durationMs;
    }

    const passedAll =
      contract.valid &&
      suitesPassed === dept.portalTests.length &&
      testsFailed === 0 &&
      testsPassed > 0;
    if (!passedAll) {
      overallFailed = true;
    }

    const contractBadge = contract.valid ? '✅ OK' : '❌ ERR';
    const suitesBadge = `${suitesPassed}/${dept.portalTests.length}`;
    const testsBadge = `${testsPassed} pass`;
    const timeBadge = `${deptDurationMs}ms`;
    const statusBadge = passedAll ? '✅ PASS' : '❌ FAIL';

    console.log(
      `${dept.slug.padEnd(26)} | ${dept.route.padEnd(25)} | ${contractBadge.padEnd(8)} | ${suitesBadge.padEnd(7)} | ${testsBadge.padEnd(9)} | ${timeBadge.padEnd(7)} | ${statusBadge}`
    );

    if (!contract.valid) {
      console.error(
        `   ↳ Contract failure for ${dept.slug}: entry=${contract.entryExists}, ssot=${contract.registeredInSsot}, proxy=${contract.registeredInProxy}, missingTests=${contract.missingTests.join(',')}`
      );
    }
    for (const msg of failureMessages) {
      console.error(`   ↳ ${msg.split('\n').slice(0, 8).join('\n     ')}`);
    }

    departmentSummary.push({
      slug: dept.slug,
      displayName: dept.displayName,
      route: dept.route,
      contractValid: contract.valid,
      suitesTotal: dept.portalTests.length,
      suitesPassed,
      testsPassed,
      testsFailed,
      durationMs: deptDurationMs,
      status: passedAll ? 'PASS' : 'FAIL',
    });
  }

  const reportPayload = {
    timestamp: new Date().toISOString(),
    totalDepartments: targetDepts.length,
    passedDepartments: departmentSummary.filter((d) => d.status === 'PASS').length,
    uniqueSuitesExecuted: uniqueTestFiles.length,
    totalWallClockMs: totalElapsedMs,
    departments: departmentSummary,
  };

  const reportOutPath = path.join(ROOT, '.ci-local', 'department-test-report.json');
  fs.writeFileSync(reportOutPath, JSON.stringify(reportPayload, null, 2));

  console.log('================================================================================');
  if (overallFailed) {
    console.error(
      `❌ [DEPARTMENT VERIFICATION FAILED] ${reportPayload.passedDepartments}/${reportPayload.totalDepartments} departments passed (${totalElapsedMs}ms)`
    );
    process.exit(1);
  }

  console.log(
    `✅ [DEPARTMENT VERIFICATION PASSED] ${reportPayload.passedDepartments}/${reportPayload.totalDepartments} departments verified across ${uniqueTestFiles.length} unique test suites (${totalElapsedMs}ms)`
  );
  console.log(`📄 Report written to: .ci-local/department-test-report.json`);
  console.log('================================================================================\n');
}

main();
