const fs = require('fs');
const env = fs.readFileSync('apps/portal/.env', 'utf8');
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/SUPABASE_SERVICE_KEY=(.*)/);

async function main() {
  const url = urlMatch[1].trim() + '/rest/v1/departments?select=*';
  const res = await fetch(url, {
    headers: {
      apikey: keyMatch[1].trim(),
      Authorization: 'Bearer ' + keyMatch[1].trim(),
    },
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}
main();
