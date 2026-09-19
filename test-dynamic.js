const fs = require('fs');
let content = fs.readFileSync('apps/portal/app/layout.tsx', 'utf-8');
content = content.replace(
  /const MacMenuBar = dynamic\([\s\S]*?\);/,
  'import { MacMenuBar } from "@repo/ui/MacMenuBar";'
);
fs.writeFileSync('apps/portal/app/layout.tsx', content);
