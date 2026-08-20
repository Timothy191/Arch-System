const fs = require('fs');
const path = require('path');
const glob = require('glob');

console.log('⚡ Running DevTools CSS Performance & Budget Auditor...');

const cssFiles = glob.sync('packages/{theme,ui}/src/**/*.css');
let warningCount = 0;
let totalSize = 0;

cssFiles.forEach((file) => {
  const content = fs.readFileSync(file, 'utf8');
  const stats = fs.statSync(file);
  totalSize += stats.size;

  // Check 1: Flag `transition: all`
  const matchesAll = content.match(/transition:\s*all\b/g);
  if (matchesAll) {
    console.warn(`⚠️ [CSS Budget Warning] ${file}: Contains ${matchesAll.length} instance(s) of "transition: all". Use explicit properties (transform, opacity).`);
    warningCount += matchesAll.length;
  }

  // Check 2: Deep nesting / Universal descendant selectors
  const matchesUniversal = content.match(/\*\s*\{/g);
  if (matchesUniversal) {
    console.warn(`⚠️ [CSS Budget Warning] ${file}: Contains universal selector block "* {}". Ensure scope is restricted.`);
    warningCount += matchesUniversal.length;
  }
});

const BUDGET_KB = 120;
const totalKB = (totalSize / 1024).toFixed(2);
console.log(`📊 Total CSS Bundle Size: ${totalKB} KB / Budget: ${BUDGET_KB} KB`);

if (totalSize > BUDGET_KB * 1024) {
  console.error(`❌ [CSS Budget Exceeded] Bundle size ${totalKB} KB exceeds maximum budget of ${BUDGET_KB} KB.`);
  process.exit(1);
}

if (warningCount > 10) {
  console.warn(`⚠️ Found ${warningCount} CSS performance warnings.`);
} else {
  console.log(`✅ CSS Performance Audit Passed successfully with ${warningCount} warnings.`);
}
