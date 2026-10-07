import { handleCallback } from '@vercel/queue';

export const POST = handleCallback(
  async (message, metadata) => {
    try {
      console.log(`[Queue] Processing order message`, message);
      console.log(`[Queue] Metadata`, metadata);

      // Simulate processing that might throw an error
      if (!message || Object.keys(message).length === 0) {
        throw new Error('Invalid message payload: missing data');
      }

      // Process successful
      console.log('[Queue] Successfully processed order');
    } catch (error) {
      console.error(`[Queue] Error processing message ${metadata?.messageId}:`, error);
      throw error; // Re-throw to trigger retry mechanism
    }
  },
  {
    retry: (error, metadata) => {
      console.log(`[Queue] Retry attempt ${metadata.deliveryCount} for ${metadata.messageId}`);

      // Stop retrying after 5 attempts
      if (metadata.deliveryCount > 5) {
        console.warn(
          `[Queue] Max retries reached for ${metadata.messageId}, acknowledging to discard.`
        );
        return { acknowledge: true };
      }

      // Exponential backoff
      const delay = Math.min(300, 2 ** metadata.deliveryCount * 5);
      return { afterSeconds: delay };
    },
  }
);
