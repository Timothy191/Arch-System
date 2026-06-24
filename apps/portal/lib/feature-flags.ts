/**
 * Feature Flag Client
 * Usage: const { enabled, variant } = await getFeatureFlag('new-dashboard', userId)
 */

import { createServerSupabaseClient } from "@repo/supabase/server";

interface FeatureFlagResult {
  enabled: boolean;
  variant: string | null;
  config?: Record<string, unknown>;
}

export async function getFeatureFlag(flagKey: string, userId?: string): Promise<FeatureFlagResult> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase.rpc("evaluate_feature_flag", {
    p_flag_key: flagKey,
    p_user_id: userId || null,
    p_session_id: null,
  });

  if (error || !data) {
    return { enabled: false, variant: null };
  }

  return {
    enabled: data.enabled,
    variant: data.variant,
    config: data.config,
  };
}

/**
 * Log conversion event for A/B test analytics
 */
export async function logConversion(
  flagKey: string,
  userId: string,
  variant: string,
  metricName: string,
  metricValue?: number,
): Promise<void> {
  const supabase = await createServerSupabaseClient();

  await supabase.from("ab_test_results").insert({
    flag_key: flagKey,
    user_id: userId,
    variant,
    metric_name: metricName,
    metric_value: metricValue,
    converted: true,
  });
}

/**
 * Server-side feature flag check for middleware/routes
 */
export async function isFeatureEnabled(flagKey: string): Promise<boolean> {
  const result = await getFeatureFlag(flagKey);
  return result.enabled;
}
