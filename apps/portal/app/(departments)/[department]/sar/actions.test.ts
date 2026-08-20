/**
 * @jest-environment node
 */
import { ingestInSARGeoTIFFAction, getDeformationPointsAction } from "./actions";

jest.mock("@repo/supabase/server", () => ({
  createServerSupabaseClient: jest.fn(),
}));

jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
}));

const { createServerSupabaseClient } = jest.requireMock("@repo/supabase/server");

describe("InSAR GeoTIFF Server Actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("ingestInSARGeoTIFFAction", () => {
    it("returns error on invalid input payload", async () => {
      const result = await ingestInSARGeoTIFFAction({ invalid: "data" } as any);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Validation error");
    });

    it("returns error when user is unauthorized", async () => {
      createServerSupabaseClient.mockResolvedValue({
        auth: {
          getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
        },
      });

      const result = await ingestInSARGeoTIFFAction({
        department_id: "123e4567-e89b-12d3-a456-426614174000",
        satellite_name: "Sentinel-1",
        pass_direction: "ascending",
        acquisition_date: "2026-08-20",
        reference_date: "2026-08-01",
        location_name: "Ramp B",
        min_lat: -25.74,
        max_lat: -25.7,
        min_lon: 28.22,
        max_lon: 28.26,
        max_displacement_mm: -12.0,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unauthorized access");
    });

    it("successfully inserts InSAR deformation record", async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: "user-123" } },
            error: null,
          }),
        },
        from: jest.fn().mockReturnValue({
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: "sat-rec-123", location_name: "Ramp B" },
                error: null,
              }),
            }),
          }),
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({ data: { id: "safety-dept-123" } }),
            }),
          }),
        }),
      };

      createServerSupabaseClient.mockResolvedValue(mockSupabase);

      const result = await ingestInSARGeoTIFFAction({
        department_id: "123e4567-e89b-12d3-a456-426614174000",
        satellite_name: "Sentinel-1",
        pass_direction: "ascending",
        acquisition_date: "2026-08-20",
        reference_date: "2026-08-01",
        location_name: "Ramp B",
        min_lat: -25.74,
        max_lat: -25.7,
        min_lon: 28.22,
        max_lon: 28.26,
        max_displacement_mm: -20.0,
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe("getDeformationPointsAction", () => {
    it("fetches deformation records for department", async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: "user-123" } },
          }),
        },
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({
                data: [{ id: "def-1", location_name: "Pit Wall A" }],
                error: null,
              }),
            }),
          }),
        }),
      };

      createServerSupabaseClient.mockResolvedValue(mockSupabase);

      const result = await getDeformationPointsAction({
        departmentId: "123e4567-e89b-12d3-a456-426614174000",
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });
  });
});
