# 🔄 API Routes with Fallback Patterns

This document covers the systematic approach to API routes with fallback mechanisms in the Arch-Systems portal. It ensures reliability, graceful degradation, and consistent error handling across all API endpoints.

---

## 1. API Response Structure

All API routes follow a standardized JSON response format:

```json
{
  "status": "healthy" | "degraded" | "unhealthy",
  "timestamp": "2026-11-05T12:34:56.789Z",
  "latencyMs": 123,
  "services": {
    "[serviceName]": {
      "status": "healthy" | "degraded" | "unhealthy",
      "latencyMs": 45,
      "error": "optional error message"
    }
  }
}
```

### 1.1 Status Codes

| Status      | Meaning                       | HTTP Status | When to Use                           |
| :---------- | :---------------------------- | :---------- | :------------------------------------ |
| `healthy`   | All services operational      | `200`       | Normal operation                      |
| `degraded`  | One or more services impaired | `200`       | Partial failure, graceful degradation |
| `unhealthy` | Critical service failure      | `503`       | Critical failure, service unavailable |

### 1.2 Error Handling

- **Standardized error responses**: Use `AppError` hierarchy from `@repo/errors`.
- **Error codes**: Machine-readable codes for automation (e.g., `API_ERROR`, `TIMEOUT`, `PERMISSION_DENIED`).
- **User-friendly messages**: Clear, concise messages for end users.
- **No sensitive data**: Never expose internal details in error messages.

### 1.3 API Response Template

```ts
export async function GET() {
  const result = await executeApiCall();

  const response = {
    status: result.isHealthy ? 'healthy' : result.isDegraded ? 'degraded' : 'unhealthy',
    timestamp: new Date().toISOString(),
    latencyMs: result.latency,
    services: buildServiceStatusMap(result.services),
  };

  return NextResponse.json(response, {
    status: result.isHealthy ? 200 : result.isHealthy ? 200 : 503,
  });
}
```

---

## 2. Fallback Patterns

### 2.1 Tiered Fallback (Most Common)

- **Primary service**: Preferred API (e.g., Groq).
- **Secondary service**: Fallback API (e.g., OpenRouter).
- **Fallback response**: Generic error if all services fail.
- **Example**: `apps/portal/app/api/ai/operations-copilot/route.ts` (Groq → OpenRouter).

### 2.2 Graceful Degradation

- **Strategy**: Use simplified responses when primary service is unavailable.
- **Example**: Health check routes return minimal data when primary service is degraded.

### 2.3 Circuit Breaker Pattern

- **Implementation**: Track service health and disable endpoints temporarily during outages.
- **Tools**: Custom middleware or service health checks.

### 2.4 Fallback Response Patterns

| Pattern              | Description                                  | Example                                                                |
| :------------------- | :------------------------------------------- | :--------------------------------------------------------------------- |
| **Default fallback** | Generic error message when all services fail | `NextResponse.json({ error: 'Service unavailable' }, { status: 503 })` |
| **Minimal response** | Reduced data payload for degraded state      | Return only essential fields                                           |
| **Graceful error**   | User-friendly error with guidance            | `"Service temporarily unavailable, please try again"`                  |

---

## 3. API Fallback Utility (Recommended)

To ensure consistency across all API routes, create a reusable utility function.

### 3.1 Utility Location

Create the utility in `libs/shared/utils/api-fallback.ts`:

```ts
// libs/shared/utils/api-fallback.ts

import { NextResponse } from 'next/server';
import { AppError } from '@repo/errors';

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
  const { defaultStatus = 'healthy', defaultLatency = 100, httpStatus = 200 } = options;

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
```

### 3.2 Usage Example

```ts
// apps/portal/app/api/health/route.ts

import { createApiResponse } from '@/shared/utils/api-fallback';

export async function GET() {
  const supabaseHealth = await checkSupabaseHealth();
  const redisHealth = await checkRedisHealth();

  const response = createApiResponse(
    { supabase: supabaseHealth, redis: redisHealth },
    {
      defaultStatus: 'healthy',
      defaultLatency: 50,
      httpStatus: 200,
    }
  );

  return NextResponse.json(response);
}
```

---

## 4. API Fallback Implementation Checklist

- [ ] All API routes return standardized JSON response.
- [ ] Each route includes health status for all dependent services.
- [ ] Fallback mechanisms are implemented for primary APIs.
- [ ] Error responses use standardized `AppError` hierarchy.
- [ ] Error codes are machine-readable and consistent.
- [ ] API response structure is documented in `API_FALLBACK_PATTERNS.md`.

---

## 5. Verification & Testing

### 5.1 API Fallback Testing

- **Mock service failures**: Use `msw` or `nock` to simulate API errors.
- **Fallback verification**: Ensure graceful degradation occurs.
- **Error codes**: Verify standardized error responses.
- **Performance**: Measure response time with and without fallbacks.

### 5.2 Image Optimization Testing

- [ ] Pre-generated AVIF/WebP variants exist for all hero images.
- [ ] `unoptimized: true` is set in `next.config.mjs`.
- [ ] Remote patterns allowlist trusted CDNs only.
- [ ] Image sizes are verified with Lighthouse.
- [ ] Format is AVIF where supported, WebP fallback.

---

## 6. References

- `apps/portal/app/api/health/route.ts` — Health check with fallback pattern.
- `apps/portal/app/api/ai/operations-copilot/route.ts` — Tiered fallback (Groq → OpenRouter).
- `libs/shared/utils/api-fallback.ts` — Reusable API fallback utility.
- `docs/RENDERING_BEST_PRACTICES.md` — SSR/SSG/File Routing documentation.

---

**Final Note**: The portal's API strategy prioritizes reliability and graceful degradation. All routes should follow the standardized response format and implement fallback patterns consistently.
