import type { Identify } from 'flags';
import { dedupe } from 'flags/next';
import type { Entities } from './types';

/**
 * Identify function providing the evaluation context from cookies and headers.
 * Deduped per request to prevent redundant evaluations.
 */
export const identify: Identify<Entities> = dedupe(async ({ cookies, headers }) => {
  // Extract user authentication and contextual headers
  const authCookie = cookies.get('sb-access-token') || cookies.get('supabase-auth-token');
  const userId = headers.get('x-user-id') || (authCookie ? 'authenticated-operator' : undefined);
  const userPlan = headers.get('x-user-plan') || 'standard';
  const userDept = headers.get('x-user-department') || 'mining-operations';
  const userRole = headers.get('x-user-role') || 'operator';

  return {
    user: {
      id: userId,
      plan: userPlan,
      department: userDept,
      role: userRole,
    },
    department: {
      id: userDept,
      name: userDept,
      site: 'site-a',
    },
  };
});
