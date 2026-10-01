const fs = require('fs');
const file = 'apps/portal/app/layout.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  "import { RouteBackground } from '@/components/RouteBackground';",
  `const RouteBackground = dynamic(
  () => import('@/components/RouteBackground').then((m) => ({ default: m.RouteBackground }))
);`
);

fs.writeFileSync(file, code);
