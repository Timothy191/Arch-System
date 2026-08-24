const fs = require('fs');

const files = [
  "apps/portal/app/(departments)/[department]/shift-compilation/ShiftCompilationClient.tsx",
  "apps/portal/app/(departments)/[department]/shift-compilation/actions.ts",
  "apps/portal/app/(departments)/[department]/shift-compilation/page.tsx",
  "libs/features/departments/ui/src/control-room/BreakdownsShiftWidget.tsx",
  "libs/features/departments/ui/src/control-room/FleetKpiTable.test.tsx",
  "libs/features/departments/ui/src/control-room/FleetKpiTable.tsx",
  "libs/features/departments/ui/src/control-room/ProductionSummaryCard.test.tsx",
  "libs/features/departments/ui/src/control-room/ProductionSummaryCard.tsx",
  "libs/features/departments/ui/src/control-room/ShiftCompilationHeader.tsx",
  "libs/features/departments/ui/src/control-room/TireAlertsBanner.tsx",
  "libs/features/departments/ui/src/control-room/UnifiedShiftCloseoutModal.tsx"
];

for (const f of files) {
  if (!fs.existsSync(f)) continue;
  let content = fs.readFileSync(f, 'utf8');
  
  // Replace direct @repo/contract imports
  // First handle 'import type { ... }'
  content = content.replace(/import\s+type\s+\{([^}]+)\}\s+from\s+["']@repo\/contract["']/g, (match, imports) => {
    return `import type { ${imports} } from "@repo/contract/types/shift-compilation.types"`;
  });

  // Then handle 'import { ... }' (which might mix schemas and types)
  content = content.replace(/import\s+\{([^}]+)\}\s+from\s+["']@repo\/contract["']/g, (match, imports) => {
    const items = imports.split(',').map(i => i.trim()).filter(Boolean);
    const schemas = items.filter(i => i.toLowerCase().includes('schema') || i.endsWith('Schema'));
    const types = items.filter(i => !schemas.includes(i) && !i.startsWith('type '));
    const explicitTypes = items.filter(i => i.startsWith('type ')).map(i => i.replace(/^type\s+/, ''));
    
    let replacement = [];
    if (schemas.length > 0) {
      replacement.push(`import { ${schemas.join(', ')} } from "@repo/contract/schemas/shift-compilation.schema"`);
    }
    const combinedTypes = [...types, ...explicitTypes];
    if (combinedTypes.length > 0) {
      replacement.push(`import type { ${combinedTypes.join(', ')} } from "@repo/contract/types/shift-compilation.types"`);
    }
    return replacement.join(';\n');
  });

  // Fix React redeclare
  content = content.replace(/import\s+React(,\s+\{[^}]+\})?\s+from\s+["']react["'];?\n/g, (match, hooks) => {
    if (hooks) {
      return `import ${hooks.replace(/^,\s+/, '')} from "react";\n`;
    }
    return '';
  });
  
  // Fix React redeclare when it is just import React from "react"
  content = content.replace(/import\s+React\s+from\s+["']react["'];?\n/g, "");

  // Fix unused DatabaseError
  if (f.includes('actions.ts')) {
    content = content.replace(/DatabaseError,\s*/g, '');
    content = content.replace(/,\s*DatabaseError/g, '');
  }

  fs.writeFileSync(f, content);
}
console.log('Fixed lint issues.');
