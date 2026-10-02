import { createBrowserClient } from '@supabase/ssr';
import dotenv from 'dotenv';

dotenv.config({ path: 'apps/portal/.env' });

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function main() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'admin@plantcor.os',
    password: 'Yugioh@123#',
  });
  if (error) throw error;

  // Storage was updated. What is the format?
  // Let's get the item from storage.
  const stored = await supabase.auth.storage.getItem(`sb-mrwhtxbhrzyttlsyuofc-auth-token`);
  console.log('STORED:', stored);
}

main().catch(console.error);
