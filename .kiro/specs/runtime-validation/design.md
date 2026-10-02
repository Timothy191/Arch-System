# Runtime Validation Design

## Architecture Flow

### K6 Authenticated Load Flow
```text
K6 Runner (setup)
 ↓
Supabase Auth (POST /auth/v1/token?grant_type=password)
 ↓
Retrieve JWT and Session Cookie
 ↓
K6 Runner (default phase)
 ↓
Next.js Route (`/api/control-room/shift-closeout`)
 ↓
Employee Authentication (`getAuthenticatedEmployee(supabase)`)
 ↓
Contract Validation (`shiftCloseoutPayloadSchema`)
 ↓
Idempotency Check
 ↓
Business Logic (RPC `atomic_shift_closeout`)
 ↓
PostgreSQL & Redis Cache invalidation
 ↓
Response (200/201 vs 409 Conflict)
```

### MCP Verification Architecture
- **Redis MCP:** A restart of the actual Antigravity daemon is necessary to flush environment variables. We will kill the `plantcor-redis` or MCP node process and then execute a `ping` or `set/get` command using `call_mcp_tool`.
- **Firecrawl MCP:** Similarly, restart if necessary and execute a `firecrawl_scrape` on a safe, static URL (e.g., `example.com`) to prove actual credential expansion.

### Hardware Simulation Architecture
```text
RawSocketBridge (ZPL printer integration)
 ↓
Mock TCP Server (`scripts/mock/zpl-printer.ts`)
 ↓
Captured Byte Stream
 ↓
Validate formatting matches expected ZPL
```

## Security Model
- K6 test will use existing `TEST_EMAIL` from environment/seeds. The credential will not be hardcoded in the K6 script.
- MCP tests will use securely resolved ENV variables, not plaintext outputs.
