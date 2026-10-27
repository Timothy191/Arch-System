#!/usr/bin/env node

/**
 * verify-c66-database.mjs
 *
 * End-to-end database verification script for Chainway C66 Android scanners.
 * Verifies:
 * 1. Badge lookup via QR code and UHF RFID/NFC code
 * 2. Identity resolution across personnel records
 * 3. Log insertion into `access_logs` table with device timestamps
 * 4. Access denial logging for unrecognized / revoked badges
 * 5. Clean-up of transient test verification records
 */

import { createRequire } from 'node:module';

const require = createRequire(`${process.cwd()}/packages/supabase/index.js`);
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY;
const SCANNER_API_KEY = process.env.SCANNER_API_KEY;

const KNOWN_QR_CODE = 'BADGE-EMP-ALICE';
const KNOWN_RFID_CODE = 'C66-RFID-ALICE-01';
const TEST_SCANNER_ID = 'C66-VERIFY-SUITE-01';
const TEST_GATE_LOCATION = 'Main Gate North Turnstile';
const LOG_RETENTION_CLEANUP = true;
const TIMESTAMP_EPSILON_MS = 2000;
const OFFSET_FIVE_MIN_MS = 300000;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Error: Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables.');
  console.error('   Run with: node --env-file=apps/portal/.env scripts/verify-c66-database.mjs');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const verificationResults = [];

async function runScenarioA_QRCodeLookup() {
  console.log('\n🔍 [Scenario A] Verifying Badge Lookup via QR Code...');
  const { data: badgeRecord, error: badgeLookupError } = await supabase
    .from('badges')
    .select('id, qr_code, rfid_code, entity_type, personnel_id, is_active')
    .eq('qr_code', KNOWN_QR_CODE)
    .single();

  if (badgeLookupError || !badgeRecord) {
    verificationResults.push({
      testName: 'QR Code Lookup',
      isPassed: false,
      message: `Failed to find badge by QR code: ${badgeLookupError?.message ?? 'Not found'}`,
    });
    console.error('  ❌ FAILED: Badge not found by QR code.');
    return;
  }

  const { data: personRecord, error: personError } = await supabase
    .from('personnel')
    .select('first_name, surname, emp_code, status')
    .eq('id', badgeRecord.personnel_id)
    .single();

  if (personError || !personRecord) {
    verificationResults.push({
      testName: 'QR Code Personnel Resolution',
      isPassed: false,
      message: `Failed to resolve personnel: ${personError?.message ?? 'Not found'}`,
    });
    console.error('  ❌ FAILED: Personnel resolution failed.');
    return;
  }

  verificationResults.push({
    testName: 'QR Code Lookup & Identity Resolution',
    isPassed: true,
    message: `Resolved badge ${badgeRecord.qr_code} to ${personRecord.first_name} ${personRecord.surname} (${personRecord.emp_code})`,
    details: { badgeId: badgeRecord.id, status: personRecord.status },
  });
  console.log(
    `  ✅ PASSED: Matched badge to ${personRecord.first_name} ${personRecord.surname} (Status: ${personRecord.status})`
  );
}

async function runScenarioB_RFIDLookup() {
  console.log('\n📡 [Scenario B] Verifying Badge Lookup via UHF RFID Code...');
  const { data: badgeRecord, error: rfidLookupError } = await supabase
    .from('badges')
    .select('id, qr_code, rfid_code, entity_type, personnel_id, is_active')
    .eq('rfid_code', KNOWN_RFID_CODE)
    .single();

  if (rfidLookupError || !badgeRecord) {
    verificationResults.push({
      testName: 'RFID Code Lookup',
      isPassed: false,
      message: `Failed to find badge by RFID code: ${rfidLookupError?.message ?? 'Not found'}`,
    });
    console.error('  ❌ FAILED: Badge not found by RFID code.');
    return;
  }

  verificationResults.push({
    testName: 'RFID Code Lookup',
    isPassed: true,
    message: `Successfully resolved RFID ${badgeRecord.rfid_code} to Badge ID ${badgeRecord.id}`,
    details: { badgeId: badgeRecord.id, qrCode: badgeRecord.qr_code },
  });
  console.log(`  ✅ PASSED: Matched RFID ${KNOWN_RFID_CODE} to Badge ID ${badgeRecord.id}`);
}

async function runScenarioC_AccessLogPersistenceWithTimestamp() {
  console.log('\n📝 [Scenario C] Verifying Access Log Persistence with Device Timestamp...');
  const testScannedAt = new Date(Date.now() - OFFSET_FIVE_MIN_MS).toISOString();

  const { data: badgeRecord } = await supabase
    .from('badges')
    .select('id, department_id')
    .eq('qr_code', KNOWN_QR_CODE)
    .single();

  const insertPayload = {
    badge_id: badgeRecord?.id ?? null,
    access_type: 'personnel',
    direction: 'IN',
    gate_location: TEST_GATE_LOCATION,
    access_granted: true,
    denial_reason: null,
    department_id: badgeRecord?.department_id ?? null,
    alcohol_tested: 'Approved',
    operator: 'C66-Automated-Verifier',
    device_id: TEST_SCANNER_ID,
    scanned_at: testScannedAt,
  };

  const { data: insertedRows, error: insertError } = await supabase
    .from('access_logs')
    .insert([insertPayload])
    .select('id, badge_id, gate_location, access_granted, scanned_at, device_id');

  if (insertError || !insertedRows || insertedRows.length === 0) {
    verificationResults.push({
      testName: 'Access Log Insertion',
      isPassed: false,
      message: `Insert failed: ${insertError?.message ?? 'No data returned'}`,
    });
    console.error('  ❌ FAILED: Could not insert access log entry.');
    return;
  }

  const insertedLog = insertedRows[0];
  const timeDifferenceMs = Math.abs(
    new Date(insertedLog.scanned_at).getTime() - new Date(testScannedAt).getTime()
  );
  const isTimePreserved = timeDifferenceMs < TIMESTAMP_EPSILON_MS;

  if (!isTimePreserved) {
    verificationResults.push({
      testName: 'Timestamp Fidelity',
      isPassed: false,
      message: `Timestamp mismatch. Expected ${testScannedAt}, got ${insertedLog.scanned_at}`,
    });
    console.error('  ❌ FAILED: Device timestamp was not preserved.');
    return;
  }

  verificationResults.push({
    testName: 'Access Log Insertion & Timestamp Fidelity',
    isPassed: true,
    message: `Log record ${insertedLog.id} inserted with preserved timestamp ${insertedLog.scanned_at}`,
    details: { logId: insertedLog.id },
  });
  console.log(`  ✅ PASSED: Inserted log ${insertedLog.id} with exact device timestamp preserved.`);
}

async function runScenarioD_UnknownBadgeAccessDenial() {
  console.log('\n🚫 [Scenario D] Verifying Access Denial Logging for Unrecognized Badge...');
  const testScannedAt = new Date().toISOString();

  const insertPayload = {
    badge_id: null,
    access_type: 'UNKNOWN',
    direction: 'IN',
    gate_location: TEST_GATE_LOCATION,
    access_granted: false,
    denial_reason: 'DENIED - Unrecognized Badge / RFID',
    department_id: null,
    alcohol_tested: 'Approved',
    operator: 'C66-Automated-Verifier',
    device_id: TEST_SCANNER_ID,
    scanned_at: testScannedAt,
  };

  const { data: insertedRows, error: insertError } = await supabase
    .from('access_logs')
    .insert([insertPayload])
    .select('id, access_granted, denial_reason');

  if (insertError || !insertedRows || insertedRows.length === 0) {
    verificationResults.push({
      testName: 'Unknown Badge Denial Logging',
      isPassed: false,
      message: `Denial log insert failed: ${insertError?.message ?? 'No data'}`,
    });
    console.error('  ❌ FAILED: Could not log denial event.');
    return;
  }

  const denialLog = insertedRows[0];
  const isCorrectDenial =
    denialLog.access_granted === false &&
    denialLog.denial_reason === 'DENIED - Unrecognized Badge / RFID';

  if (!isCorrectDenial) {
    verificationResults.push({
      testName: 'Unknown Badge Denial Logging',
      isPassed: false,
      message: `Incorrect denial record: granted=${denialLog.access_granted}, reason=${denialLog.denial_reason}`,
    });
    console.error('  ❌ FAILED: Denial record did not have expected reason or flag.');
    return;
  }

  verificationResults.push({
    testName: 'Unknown Badge Denial Logging',
    isPassed: true,
    message: `Logged denial record ${denialLog.id} with reason '${denialLog.denial_reason}'`,
  });
  console.log('  ✅ PASSED: Unrecognized badge logged with status access_granted=false.');
}

async function cleanupTestLogs() {
  if (!LOG_RETENTION_CLEANUP) return;
  console.log('\n🧹 Cleaning up test verification rows...');
  const { error: deleteError } = await supabase
    .from('access_logs')
    .delete()
    .eq('device_id', TEST_SCANNER_ID);

  if (deleteError) {
    console.warn(`  ⚠️ Warning: Could not clean up test logs: ${deleteError.message}`);
  } else {
    console.log('  ✅ Cleaned up transient test rows.');
  }
}

async function main() {
  console.log('=================================================================');
  console.log('🚀 Chainway C66 Scanner Database End-to-End Verification Suite');
  console.log('=================================================================');
  console.log(`Target Supabase URL: ${SUPABASE_URL}`);
  console.log(`Scanner Key Configured: ${SCANNER_API_KEY ? 'YES' : 'NO'}`);

  try {
    await runScenarioA_QRCodeLookup();
    await runScenarioB_RFIDLookup();
    await runScenarioC_AccessLogPersistenceWithTimestamp();
    await runScenarioD_UnknownBadgeAccessDenial();
    await cleanupTestLogs();
  } catch (error) {
    console.error('❌ Unhandled error during verification:', error);
  }

  console.log('\n=================================================================');
  console.log('📊 Verification Summary');
  console.log('=================================================================');
  let passCount = 0;
  for (const res of verificationResults) {
    const symbol = res.isPassed ? '✅' : '❌';
    console.log(`${symbol} ${res.testName}: ${res.message}`);
    if (res.isPassed) passCount += 1;
  }

  console.log(`\nResults: ${passCount} / ${verificationResults.length} passed.`);
  if (passCount === verificationResults.length && verificationResults.length > 0) {
    console.log('🎉 ALL DATABASE VERIFICATION CHECKS PASSED!\n');
    process.exit(0);
  } else {
    console.error('❌ Some checks failed.\n');
    process.exit(1);
  }
}

main();
