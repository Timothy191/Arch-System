import { Novu } from '@novu/node';
import { APIError, ValidationError } from '@repo/errors';

export interface DispatchOperationalAlertOptions {
  readonly subscriberId: string;
  readonly workflowId: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly transactionId?: string;
}

export interface OperationalAlertReceipt {
  readonly acknowledged: boolean;
  readonly status?: string;
  readonly transactionId?: string;
}

function getNovuClient(): Novu {
  const apiKey = process.env.NOVU_API_KEY?.trim();
  if (!apiKey) {
    throw new ValidationError('NOVU_API_KEY is not configured');
  }

  const backendUrl = process.env.NOVU_API_URL?.trim();
  return backendUrl ? new Novu(apiKey, { backendUrl }) : new Novu(apiKey);
}

/**
 * Validates trigger inputs, calls Novu workflow trigger API, and wraps transport failures
 * in a typed APIError without exposing secret credentials.
 */
export async function dispatchOperationalAlert(
  options: DispatchOperationalAlertOptions
): Promise<OperationalAlertReceipt> {
  const subscriberId = options.subscriberId.trim();
  const workflowId = options.workflowId.trim();

  if (!subscriberId) {
    throw new ValidationError('subscriberId is required to dispatch operational alert');
  }
  if (!workflowId) {
    throw new ValidationError('workflowId is required to dispatch operational alert');
  }

  const novu = getNovuClient();

  try {
    const response = await novu.trigger(workflowId, {
      to: { subscriberId },
      payload: options.payload as Parameters<Novu['trigger']>[1]['payload'],
      ...(options.transactionId ? { transactionId: options.transactionId } : {}),
    });

    const responseData = (response?.data ?? {}) as {
      acknowledged?: boolean;
      status?: string;
      transactionId?: string;
    };

    return {
      acknowledged: Boolean(responseData.acknowledged ?? true),
      ...(typeof responseData.status === 'string' ? { status: responseData.status } : {}),
      ...(typeof responseData.transactionId === 'string'
        ? { transactionId: responseData.transactionId }
        : {}),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new APIError(`Failed to trigger Novu workflow "${workflowId}": ${message}`, {
      statusCode: 502,
      cause: error,
    });
  }
}

/**
 * Backward-compatible wrapper for triggering an operational alert workflow in Novu.
 */
export async function sendOperationalAlert(
  subscriberId: string,
  workflowId: string,
  payload: Record<string, unknown>
): Promise<OperationalAlertReceipt> {
  return dispatchOperationalAlert({ subscriberId, workflowId, payload });
}
