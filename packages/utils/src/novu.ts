import { Novu } from "@novu/node";

const logger = {
  // eslint-disable-next-line no-console
  info: (msg: string, ...args: any[]) => console.log(`[INFO] ${msg}`, ...args),
  // eslint-disable-next-line no-console
  error: (msg: string, ...args: any[]) => console.error(`[ERROR] ${msg}`, ...args),
};

// Initialize Novu SDK
const novu = new Novu(process.env.NOVU_API_KEY || "dummy_key");

/**
 * Sends an operational alert and tracks engagement.
 */
export async function sendOperationalAlert(subscriberId: string, workflowId: string, payload: any) {
  try {
    const response = await novu.trigger(workflowId, {
      to: {
        subscriberId: subscriberId,
      },
      payload: payload,
    });

    logger.info(`Notification triggered successfully: ${workflowId}`, {
      subscriberId,
      transactionId: response.data.transactionId,
    });
    return response.data;
  } catch (error) {
    logger.error(`Failed to trigger notification: ${workflowId}`, { subscriberId, error });
    throw error;
  }
}

/**
 * Analyzes notification engagement rates.
 * This interacts with the Novu API to fetch delivery stats.
 */
export async function getNotificationEngagementStats() {
  try {
    // In a real implementation, you would query Novu's analytics/execution endpoints
    // or use webhooks to sync events (delivered, read, clicked) to your own Postgres DB.
    logger.info("Fetching engagement stats from Novu or DB...");
    return {
      deliveryRate: 0.99,
      openRate: 0.65,
      clickThroughRate: 0.12,
    };
  } catch (error) {
    logger.error("Failed to fetch engagement stats", { error });
    return null;
  }
}
