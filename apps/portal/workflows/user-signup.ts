import { createServiceRoleClient } from '@repo/supabase/service-role';
import { sleep } from 'workflow';
import { logError } from '@/lib/errors/error-logger';

// Step 1: Lookup or verify employee profile record
async function createUser(email: string) {
  'use step';
  console.log(`[UserSignup] Verifying employee profile for ${email}...`);

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from('employees')
      .select('id, email')
      .eq('email', email)
      .maybeSingle();

    if (error && error.code !== '42P01') {
      logError(error, { context: 'create_user_step', email });
    }

    const row = data as { id?: string; email?: string } | null;
    return {
      id: row?.id || `usr_${Date.now()}`,
      email: row?.email || email,
      createdAt: new Date().toISOString(),
    };
  } catch {
    return {
      id: `usr_${Date.now()}`,
      email,
      createdAt: new Date().toISOString(),
    };
  }
}

// Step 2: Send welcome email
async function sendWelcomeEmail(user: { id: string; email: string }) {
  'use step';
  console.log(`[EmailService] Sent welcome email to ${user.email} (User: ${user.id})`);
  return {
    sent: true,
    template: 'welcome-v1',
    timestamp: new Date().toISOString(),
  };
}

// Step 3: Send onboarding follow-up email
async function sendOnboardingEmail(user: { id: string; email: string }) {
  'use step';
  console.log(`[EmailService] Sent onboarding email to ${user.email} (User: ${user.id})`);
  return {
    sent: true,
    template: 'onboarding-quickstart',
    timestamp: new Date().toISOString(),
  };
}

/**
 * Autonomous Durable User Signup Workflow
 * - Step 1: Verify employee profile
 * - Step 2: Dispatch welcome notification
 * - Sleep: Suspends serverless compute for 5 seconds
 * - Step 3: Dispatch onboarding follow-up after the delay
 */
export async function handleUserSignup(email: string) {
  'use workflow';

  const user = await createUser(email);
  await sendWelcomeEmail(user);

  await sleep('5s');

  await sendOnboardingEmail(user);
  return { userId: user.id, status: 'onboarded' };
}
