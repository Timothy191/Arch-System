export interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  latencyMs: number;
  error?: string;
}

export interface ApiResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  latencyMs: number;
  services: Record<string, ServiceHealth>;
}

/**
 * Creates a standardized API response with fallback logic.
 *
 * @param serviceHealth - Health status of each service
 * @param options - Configuration options
 * @returns Standardized API response
 */
export function createApiResponse(
  serviceHealth: Record<string, ServiceHealth>,
  options: {
    defaultStatus?: 'healthy' | 'degraded' | 'unhealthy';
    defaultLatency?: number;
    httpStatus?: number;
  } = {}
): ApiResponse {
  const {
    defaultStatus = 'healthy',
    defaultLatency = 100,
    httpStatus: _httpStatus = 200,
  } = options;

  const services = Object.fromEntries(
    Object.entries(serviceHealth).map(([name, health]) => [name, health])
  );

  return {
    status: defaultStatus,
    timestamp: new Date().toISOString(),
    latencyMs: defaultLatency,
    services,
  };
}
