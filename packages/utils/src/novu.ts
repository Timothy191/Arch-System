import { Novu } from '@novu/node';

const logger = {
  // eslint-disable-next-line no-console
  info: (msg: string, ...args: unknown[]) => console.log(`[INFO] ${msg}`, ...args),
  // eslint-disable-next-line no-console
  error: (msg: string, ...args: unknown[]) => console.error(`[ERROR] ${msg}`, ...args),
};

function getNovuClient(): Novu {
  const apiKey = process.env.NOVU_API_KEY;
  if (!apiKey) {
    throw new Error('NOVU_API_KEY is not configured');
  }
  return new Novu(apiKey);
}

/**
 * Sends an operational alert and tracks engagement.
 */
export async function sendOperationalAlert(
  subscriberId: string,
  workflowId: string,
  payload: Record<string, unknown>
) {
  try {
    const novu = getNovuClient();
    const response = await novu.trigger(workflowId, {
      to: {
        subscriberId: subscriberId,
      },
      payload: payload as Parameters<Novu['trigger']>[1]['payload'],
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
