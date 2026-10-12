const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'apps/portal/instrumentation.ts');
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('onRequestError')) {
  content += `\n
export async function onRequestError(err: Error, request: any, context: any) {
  const { serverLogger } = await import('@repo/logger');
  serverLogger.error(
    {
      err,
      request: {
        url: request.url,
        method: request.method,
      },
      context,
    },
    'Global request error'
  );
}
`;
  fs.writeFileSync(file, content);
  console.log('Patched instrumentation.ts');
} else {
  console.log('instrumentation.ts already has onRequestError');
}
