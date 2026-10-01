const fs = require('fs');
const env = fs.readFileSync('apps/portal/.env', 'utf8');
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/SUPABASE_SERVICE_KEY=(.*)/);

async function main() {
  const url = urlMatch[1].trim() + '/rest/v1/rpc/get_access_control_metrics_jsonb';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: keyMatch[1].trim(),
      Authorization: 'Bearer ' + keyMatch[1].trim(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_department_id: '0147345f-9b85-4459-adeb-afcb8b662780' }),
  });
  const data = await res.text();
  console.log(res.status, data);
}
main();
