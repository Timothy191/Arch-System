/**
 * @jest-environment node
 *
 * Security tests for P0 #1: /api/c66 header-only auth bypass.
 *
 * Verifies that the scanner endpoint requires a valid `x-scanner-token`
 * and rejects unauthenticated callers.
 */

import { POST } from "./route";

jest.mock("@repo/supabase/service-role", () => ({
  createServiceRoleClient: jest.fn(),
}));

jest.mock("@/lib/errors/error-logger", () => ({
  logError: jest.fn(),
}));

const { createServiceRoleClient } = jest.requireMock("@repo/supabase/service-role");

let lastServiceRoleClient: ReturnType<typeof buildServiceRoleMock> | null = null;

const PUBLICLY_DOCUMENTED_SCANNER_SOURCES = ["C66-HARDWARE", "C66-SCANNER", "GATE-TERMINAL"];

function buildServiceRoleMock(overrides?: {
  badge?: any;
  person?: any;
  fleet?: any;
  equip?: any;
  visitor?: any;
}) {
  const badge = overrides?.badge ?? {
    id: "badge-1",
    is_active: true,
    entity_type: "personnel",
    personnel_id: "person-1",
    visitor_id: null,
    fleet_id: null,
    equipment_id: null,
  };
  const person = overrides?.person ?? { first_name: "Test", surname: "User", status: "Active" };
  const fleet = overrides?.fleet ?? {
    fleet_code: "CT-01",
    vehicle_type: "Coal Truck",
    registration_number: "ABC 123 GP",
    make: "Scania",
    model: "R500",
    status: "Active",
  };
  const equip = overrides?.equip ?? {
    equip_code: "EQP-CAT-777",
    equipment_type: "Haul Truck Excavator",
    status: "Active",
  };
  const visitor = overrides?.visitor ?? {
    first_name: "David",
    surname: "Khumalo",
    company: "Eskom Technical Audit",
    status: "Checked In",
  };

  const mock = {
    from: jest.fn().mockImplementation((table: string) => {
      if (table === "badges") {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: badge, error: null }),
            }),
            or: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({ data: badge, error: null }),
            }),
          }),
        };
      }
      if (table === "personnel") {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: person, error: null }),
            }),
          }),
        };
      }
      if (table === "fleet") {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: fleet, error: null }),
            }),
          }),
        };
      }
      if (table === "equipment") {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: equip, error: null }),
            }),
          }),
        };
      }
      if (table === "visitors") {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: visitor, error: null }),
            }),
          }),
        };
      }
      if (table === "access_logs") {
        return {
          insert: jest.fn().mockResolvedValue({ error: null }),
        };
      }
      return {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
        insert: jest.fn().mockResolvedValue({ error: null }),
      };
    }),
  };
  createServiceRoleClient.mockReturnValue(mock);
  lastServiceRoleClient = mock;
  return mock;
}

function makeRequest(opts: {
  source?: string | null;
  token?: string | null;
  body?: unknown;
  raw?: string;
}) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (opts.source !== null && opts.source !== undefined) {
    headers["x-scanner-source"] = opts.source;
  }
  if (opts.token !== null && opts.token !== undefined) {
    headers["x-scanner-token"] = opts.token;
  }
  const init: RequestInit = {
    method: "POST",
    headers,
  };
  if (opts.raw !== undefined) {
    init.body = opts.raw;
  } else {
    init.body = JSON.stringify(opts.body ?? { barcode: "TEST-CODE" });
  }
  return new Request("http://localhost/api/c66", init);
}

const ORIGINAL_ENV = process.env;
const TEST_TOKEN = "secure-test-token";

beforeEach(() => {
  jest.resetModules();
  process.env = { ...ORIGINAL_ENV, SCANNER_API_KEY: TEST_TOKEN };
  jest.clearAllMocks();
  buildServiceRoleMock();
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

describe("P0 /api/c66 secure access checks", () => {
  it.each(PUBLICLY_DOCUMENTED_SCANNER_SOURCES)(
    "forged x-scanner-source=%s WITHOUT valid token is rejected with 401",
    async (source) => {
      const res = await POST(makeRequest({ source, token: "wrong-token" }));
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error).toBe("Unauthorized scanner token");
    }
  );

  it.each(PUBLICLY_DOCUMENTED_SCANNER_SOURCES)(
    "valid token with valid source=%s succeeds",
    async (source) => {
      const res = await POST(makeRequest({ source, token: TEST_TOKEN }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.name).toBe("Test User");
      expect(lastServiceRoleClient).not.toBeNull();
      expect(lastServiceRoleClient!.from).toHaveBeenCalledWith("access_logs");
    }
  );

  it("missing token is rejected with 401", async () => {
    const res = await POST(makeRequest({ source: "C66-HARDWARE", token: null }));
    expect(res.status).toBe(401);
  });

  it("invalid source with valid token is rejected with 403", async () => {
    const res = await POST(makeRequest({ source: "INVALID-SOURCE", token: TEST_TOKEN }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized scanner source");
  });

  it("unconfigured SCANNER_API_KEY environment variable rejects all requests", async () => {
    delete process.env.SCANNER_API_KEY;
    const res = await POST(makeRequest({ source: "C66-HARDWARE", token: TEST_TOKEN }));
    expect(res.status).toBe(401);
  });

  it("valid coal truck badge succeeds and resolves vehicle details", async () => {
    buildServiceRoleMock({
      badge: {
        id: "badge-coal-1",
        is_active: true,
        entity_type: "fleet",
        personnel_id: null,
        visitor_id: null,
        fleet_id: "fleet-coal-1",
        equipment_id: null,
      },
      fleet: {
        fleet_code: "CT-01",
        vehicle_type: "Coal Truck",
        registration_number: "ABC 123 GP",
        make: "Scania",
        model: "R500",
        status: "Active",
      },
    });

    const res = await POST(
      makeRequest({
        source: "C66-HARDWARE",
        token: TEST_TOKEN,
        body: { code: "CT-QR-01", direction: "IN", gate_location: "Weighbridge Inbound" },
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.name).toContain("Coal Truck: CT-01");
    expect(body.entity_type).toBe("fleet");
  });

  it("valid equipment badge succeeds and resolves equipment details", async () => {
    buildServiceRoleMock({
      badge: {
        id: "badge-eqp-1",
        is_active: true,
        entity_type: "equipment",
        personnel_id: null,
        visitor_id: null,
        fleet_id: null,
        equipment_id: "eqp-1",
      },
      equip: {
        equip_code: "EQP-CAT-777",
        equipment_type: "Haul Truck Excavator",
        status: "Active",
      },
    });

    const res = await POST(
      makeRequest({
        source: "C66-HARDWARE",
        token: TEST_TOKEN,
        body: { code: "EQP-QR-777", direction: "IN" },
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.name).toContain("Equipment: EQP-CAT-777");
    expect(body.entity_type).toBe("equipment");
  });

  it("valid visitor badge succeeds and resolves visitor details", async () => {
    buildServiceRoleMock({
      badge: {
        id: "badge-vis-1",
        is_active: true,
        entity_type: "visitor",
        personnel_id: null,
        visitor_id: "vis-1",
        fleet_id: null,
        equipment_id: null,
      },
      visitor: {
        first_name: "David",
        surname: "Khumalo",
        company: "Eskom Technical Audit",
        status: "Checked In",
      },
    });

    const res = await POST(
      makeRequest({
        source: "C66-HARDWARE",
        token: TEST_TOKEN,
        body: { code: "VIS-QR-01" },
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.name).toContain("David Khumalo");
    expect(body.entity_type).toBe("visitor");
  });

  it("revoked badge is rejected with 403", async () => {
    buildServiceRoleMock({
      badge: {
        id: "badge-revoked",
        is_active: false,
        entity_type: "personnel",
      },
    });

    const res = await POST(
      makeRequest({
        source: "C66-HARDWARE",
        token: TEST_TOKEN,
        body: { code: "REVOKED-QR" },
      })
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.name).toBe("Revoked Badge");
  });
});
