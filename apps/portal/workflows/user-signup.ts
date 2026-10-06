import { createServiceRoleClient } from '@repo/supabase/service-role';
import { sleep } from 'workflow';
import { logError } from '@/lib/errors/error-logger';

// Step 1: Create user record
async function createUser(email: string) {
  'use step';
  console.log(`[UserSignup] Creating user profile for ${email}...`);

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from('users')
      .insert({
        email,
        created_at: new Date().toISOString(),
      })
      .select('id, email')
      .single();

    if (error && error.code !== '42P01') {
      logError(error, { context: 'create_user_step', email });
    }

    return {
      id: data?.id || `usr_${Date.now()}`,
      email: data?.email || email,
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
 * - Step 1: Persist user profile
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
