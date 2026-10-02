import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: 'apps/portal/.env' });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'admin@plantcor.os',
  password: 'Yugioh@123#',
});
if (error) {
  console.error(error);
  process.exit(1);
}
console.log(JSON.stringify(data.session));
