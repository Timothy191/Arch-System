#!/usr/bin/env node
// @ts-check
import { runCli } from '../src/cli.mjs';

try {
  const exitCode = await runCli(process.argv.slice(2));
  process.exit(typeof exitCode === 'number' ? exitCode : 0);
} catch (err) {
  console.error('Fatal Watchdog CLI Exception:', err);
  process.exit(2);
}
