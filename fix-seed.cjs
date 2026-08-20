const fs = require('fs');
let code = fs.readFileSync('packages/supabase/src/seed.ts', 'utf8');

// The daily_logs should use shift, others use shift_type.
code = code.replace(/await supabase\.from\("machine_operations"\)\.insert\(\{(.*?)\}\);/gs, (match, p1) => {
  return match.replace(/shift: "day"/g, 'shift_type: "day"');
});

code = code.replace(/await supabase\.from\("hourly_loads"\)\.insert\(\{(.*?)\}\);/gs, (match, p1) => {
  return match.replace(/shift: "day"/g, 'shift_type: "day"');
});

fs.writeFileSync('packages/supabase/src/seed.ts', code);
