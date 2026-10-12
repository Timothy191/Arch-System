const fs = require('fs');
const path = 'libs/features/departments/data-access/src/departments.ts';
let content = fs.readFileSync(path, 'utf8');

const tabsDefinition = `
/**
 * Database specific tabs - focused on schema definitions and telemetry
 */
export const DATABASE_TABS = [
  { name: 'dashboard', label: 'Dashboard', icon: 'BarChart2' },
  { name: 'schemas', label: 'Schemas', icon: 'Database' },
  { name: 'panels', label: 'Panels', icon: 'Activity' },
  { name: 'reports', label: 'Reports', icon: 'FileText' },
] as const;

`;

if (!content.includes('DATABASE_TABS')) {
  content = content.replace(
    /const DEPARTMENT_TABS_MAP/,
    tabsDefinition + 'const DEPARTMENT_TABS_MAP'
  );
  content = content.replace(
    /drilling: DRILLING_TABS,/,
    'drilling: DRILLING_TABS,\n  database: DATABASE_TABS,'
  );
  fs.writeFileSync(path, content);
  console.log('Patched departments.ts');
} else {
  console.log('Already patched');
}
