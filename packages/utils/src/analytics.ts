/**
 * Business Analytics and Event Tracking Utility
 * Provides a unified interface for tracking user behavior and system events.
 */

type AnalyticsEvent = {
  eventName: string;
  properties?: Record<string, any>;
  userId?: string;
  departmentId?: string;
};

export const analytics = {
  /**
   * Tracks a user action or system event.
   * In a real-world scenario, this would post to Mixpanel, PostHog, or a custom Postgres table.
   */
  track: (event: AnalyticsEvent) => {
    if (typeof window !== "undefined") {
      // Client-side tracking: send to an API endpoint that handles the external integration
      fetch("/api/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...event, timestamp: new Date().toISOString() }),
        keepalive: true,
      }).catch(() => {
        /* ignore */
      });
    } else {
      // Server-side tracking (e.g., from Server Actions or API routes)
      // eslint-disable-next-line no-console
      console.log("[ANALYTICS]", JSON.stringify({ ...event, timestamp: new Date().toISOString() }));
      // e.g., await db.insert(analyticsTable).values(...)
    }
  },

  /**
   * Sets the current user context for subsequent events.
   */
  identify: (userId: string, traits?: Record<string, any>) => {
    if (typeof window !== "undefined") {
      fetch("/api/analytics/identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, traits }),
        keepalive: true,
      }).catch(() => {
        /* ignore */
      });
    } else {
      // eslint-disable-next-line no-console
      console.log(`[ANALYTICS IDENTIFY] User: ${userId}`, traits);
    }
  },
};
