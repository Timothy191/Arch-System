const fs = require('fs');
const file = 'apps/portal/app/api/auth/login/route.ts';
let code = fs.readFileSync(file, 'utf8');

const regex =
  /if \(origin\) \{\s*\/\/ Origin header is always protocol \+ host \+ port; compare directly\s*if \(origin !== appOrigin\) \{\s*return NextResponse\.json\(\{ error: 'Invalid request origin' \}, \{ status: 403 \}\);\s*\}\s*\}/;

const replacement = `if (origin) {
        // Origin header is always protocol + host + port; compare directly
        const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
        const hostOrigin = host ? (host.includes('localhost') ? \`http://\${host}\` : \`https://\${host}\`) : null;
        
        if (origin !== appOrigin && origin !== hostOrigin) {
          return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
        }
      }`;

code = code.replace(regex, replacement);

const refererRegex =
  /if \(refUrl\.origin !== appOrigin\) \{\s*return NextResponse\.json\(\{ error: 'Invalid request origin' \}, \{ status: 403 \}\);\s*\}/;
const refererReplacement = `const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
          const hostOrigin = host ? (host.includes('localhost') ? \`http://\${host}\` : \`https://\${host}\`) : null;
          if (refUrl.origin !== appOrigin && refUrl.origin !== hostOrigin) {
            return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
          }`;

code = code.replace(refererRegex, refererReplacement);

fs.writeFileSync(file, code);
