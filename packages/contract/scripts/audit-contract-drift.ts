import { tableSchemas } from '../src/schemas/_registry.js';

const count = Object.keys(tableSchemas).length;
if (count >= 88) {
  console.log(`${count}/88 tables covered`);
  process.exit(0);
} else {
  console.error(`contract-drift: ${88 - count} missing`);
  process.exit(1);
}
