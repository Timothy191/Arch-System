import {
  classifyDeformationByVelocity,
  classifyDeformation,
  ALERT_THRESHOLDS,
  MAP_TILE_URLS,
  LAYER_META,
  fetchSentinel1Scenes,
  fetchSentinel2Scenes,
  getSTACQuicklookUrl,
  getSentinel1RevisitDates,
  generateDeformationReadings,
  formatSceneDate,
  DEFAULT_MINE_BBOX,
  DEFAULT_MINE_CENTER,
  type DeformationArea,
  type BoundingBox,
  type STACItem,
} from "./monitoring-api";

const TEST_BBOX: BoundingBox = {
  west: 28.0,
  south: -26.5,
  east: 28.5,
  north: -26.0,
};

describe("classifyDeformationByVelocity", () => {
  it("returns stable when velocity is below minor threshold", () => {
    expect(classifyDeformationByVelocity(1, "pit-wall")).toBe("stable");
    expect(classifyDeformationByVelocity(0, "tailings-dam")).toBe("stable");
  });

  it("returns minor when velocity is at or above minor threshold", () => {
    expect(classifyDeformationByVelocity(5, "pit-wall")).toBe("minor");
    expect(classifyDeformationByVelocity(3, "tailings-dam")).toBe("minor");
  });

  it("returns moderate when velocity is at or above moderate threshold", () => {
    expect(classifyDeformationByVelocity(15, "pit-wall")).toBe("moderate");
    expect(classifyDeformationByVelocity(8, "tailings-dam")).toBe("moderate");
  });

  it("returns critical when velocity is at or above critical threshold", () => {
    expect(classifyDeformationByVelocity(25, "pit-wall")).toBe("critical");
    expect(classifyDeformationByVelocity(15, "tailings-dam")).toBe("critical");
    expect(classifyDeformationByVelocity(35, "haul-road")).toBe("critical");
    expect(classifyDeformationByVelocity(10, "processing-plant")).toBe(
      "critical",
    );
  });

  it("uses absolute value — negative velocity classifies the same as positive", () => {
    expect(classifyDeformationByVelocity(-25, "pit-wall")).toBe("critical");
    expect(classifyDeformationByVelocity(-5, "pit-wall")).toBe("minor");
    expect(classifyDeformationByVelocity(-1, "pit-wall")).toBe("stable");
  });

  it("applies different thresholds per area type", () => {
    const areas: DeformationArea[] = [
      "pit-wall",
      "tailings-dam",
      "haul-road",
      "processing-plant",
    ];
    for (const area of areas) {
      const { critical } = ALERT_THRESHOLDS[area];
      expect(classifyDeformationByVelocity(critical, area)).toBe("critical");
      expect(classifyDeformationByVelocity(critical - 1, area)).not.toBe(
        "critical",
      );
    }
  });
});

describe("ALERT_THRESHOLDS", () => {
  it("has entries for all 4 area types", () => {
    const areas: DeformationArea[] = [
      "pit-wall",
      "tailings-dam",
      "haul-road",
      "processing-plant",
    ];
    for (const area of areas) {
      expect(ALERT_THRESHOLDS[area]).toBeDefined();
      expect(ALERT_THRESHOLDS[area].minor).toBeGreaterThan(0);
      expect(ALERT_THRESHOLDS[area].moderate).toBeGreaterThan(
        ALERT_THRESHOLDS[area].minor,
      );
      expect(ALERT_THRESHOLDS[area].critical).toBeGreaterThan(
        ALERT_THRESHOLDS[area].moderate,
      );
    }
  });
});

describe("MAP_TILE_URLS", () => {
  it("has URLs for all expected layer keys", () => {
    const expectedKeys = [
      "optical",
      "terrain",
      "sar",
      "ndvi",
      "geology",
      "osm",
      "none",
    ];
    for (const key of expectedKeys) {
      expect(MAP_TILE_URLS[key]).toBeTruthy();
      expect(MAP_TILE_URLS[key]).toMatch(/^https:\/\//);
    }
  });
});

describe("LAYER_META", () => {
  it("every layer has label, attribution, and description", () => {
    for (const [, meta] of Object.entries(LAYER_META)) {
      expect(meta.label).toBeTruthy();
      expect(meta.attribution).toBeTruthy();
      expect(meta.description).toBeTruthy();
    }
  });
});

describe("fetchSentinel1Scenes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns empty array when fetch fails", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("Network error"));
    const result = await fetchSentinel1Scenes(TEST_BBOX);
    expect(result).toEqual([]);
  });

  it("returns empty array on non-ok response", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 500 } as Response);
    const result = await fetchSentinel1Scenes(TEST_BBOX);
    expect(result).toEqual([]);
  });

  it("returns features array from STAC response", async () => {
    const mockFeature = {
      id: "S1A_IW_SLC__1SDV_20260101",
      type: "Feature",
      geometry: { type: "Polygon", coordinates: [] },
      properties: {
        datetime: "2026-01-01T00:00:00Z",
        platform: "sentinel-1a",
        constellation: "sentinel-1",
        instruments: ["c-sar"],
        "s1:polarisation": "VV+VH",
      },
      assets: {},
      links: [],
      bbox: [28.0, -26.5, 28.5, -26.0] as [number, number, number, number],
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        type: "FeatureCollection",
        features: [mockFeature],
      }),
    } as unknown as Response);

    const result = await fetchSentinel1Scenes(TEST_BBOX, 7);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("S1A_IW_SLC__1SDV_20260101");
  });

  it("builds URL with correct bbox parameters", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ features: [] }),
    } as unknown as Response);

    await fetchSentinel1Scenes(TEST_BBOX, 3);

    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain("SENTINEL-1");
    expect(url).toContain("28");
    expect(url).toContain("-26.5");
  });
});

describe("fetchSentinel2Scenes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns empty array when fetch fails", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("Network error"));
    const result = await fetchSentinel2Scenes(TEST_BBOX);
    expect(result).toEqual([]);
  });

  it("filters out scenes exceeding maxCloudCover", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        features: [
          {
            id: "low-cloud",
            properties: {
              datetime: "2026-01-01T00:00:00Z",
              platform: "sentinel-2a",
              constellation: "sentinel-2",
              instruments: [],
              "eo:cloud_cover": 10,
            },
            geometry: { type: "Polygon", coordinates: [] },
            assets: {},
            links: [],
            bbox: [28.0, -26.5, 28.5, -26.0],
          },
          {
            id: "high-cloud",
            properties: {
              datetime: "2026-01-01T00:00:00Z",
              platform: "sentinel-2a",
              constellation: "sentinel-2",
              instruments: [],
              "eo:cloud_cover": 80,
            },
            geometry: { type: "Polygon", coordinates: [] },
            assets: {},
            links: [],
            bbox: [28.0, -26.5, 28.5, -26.0],
          },
        ],
      }),
    } as unknown as Response);

    const result = await fetchSentinel2Scenes(TEST_BBOX, 30);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("low-cloud");
  });

  it("includes scenes with cloud cover exactly at threshold", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        features: [
          {
            id: "at-threshold",
            properties: {
              datetime: "2026-01-01T00:00:00Z",
              platform: "sentinel-2a",
              constellation: "sentinel-2",
              instruments: [],
              "eo:cloud_cover": 30,
            },
            geometry: { type: "Polygon", coordinates: [] },
            assets: {},
            links: [],
            bbox: [28.0, -26.5, 28.5, -26.0],
          },
        ],
      }),
    } as unknown as Response);

    const result = await fetchSentinel2Scenes(TEST_BBOX, 30);
    expect(result).toHaveLength(1);
  });

  it("excludes scenes with missing cloud cover (defaults to 100)", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        features: [
          {
            id: "no-cloud-data",
            properties: {
              datetime: "2026-01-01T00:00:00Z",
              platform: "sentinel-2a",
              constellation: "sentinel-2",
              instruments: [],
            },
            geometry: { type: "Polygon", coordinates: [] },
            assets: {},
            links: [],
            bbox: [28.0, -26.5, 28.5, -26.0],
          },
        ],
      }),
    } as unknown as Response);

    const result = await fetchSentinel2Scenes(TEST_BBOX, 30);
    expect(result).toHaveLength(0);
  });
});

describe("classifyDeformation (legacy, shift-based)", () => {
  it("returns stable for shift < 5mm", () => {
    expect(classifyDeformation(4)).toBe("stable");
    expect(classifyDeformation(0)).toBe("stable");
    expect(classifyDeformation(-4)).toBe("stable");
  });
  it("returns minor for 5 <= abs < 15", () => {
    expect(classifyDeformation(5)).toBe("minor");
    expect(classifyDeformation(14)).toBe("minor");
    expect(classifyDeformation(-10)).toBe("minor");
  });
  it("returns moderate for 15 <= abs < 30", () => {
    expect(classifyDeformation(15)).toBe("moderate");
    expect(classifyDeformation(29)).toBe("moderate");
  });
  it("returns critical for abs >= 30", () => {
    expect(classifyDeformation(30)).toBe("critical");
    expect(classifyDeformation(100)).toBe("critical");
    expect(classifyDeformation(-50)).toBe("critical");
  });
});

describe("getSTACQuicklookUrl", () => {
  function makeItem(
    assets: Record<string, { href: string; type: string }>,
  ): STACItem {
    return {
      id: "test",
      type: "Feature",
      geometry: { type: "Polygon", coordinates: [] },
      properties: {
        datetime: "",
        platform: "",
        constellation: "",
        instruments: [],
      },
      assets,
      links: [],
      bbox: [0, 0, 0, 0],
    };
  }

  it("returns QUICKLOOK href when present", () => {
    const item = makeItem({
      QUICKLOOK: { href: "https://example.com/ql.jpg", type: "image/jpeg" },
    });
    expect(getSTACQuicklookUrl(item)).toBe("https://example.com/ql.jpg");
  });

  it("falls back to thumbnail when QUICKLOOK missing", () => {
    const item = makeItem({
      thumbnail: { href: "https://example.com/thumb.jpg", type: "image/jpeg" },
    });
    expect(getSTACQuicklookUrl(item)).toBe("https://example.com/thumb.jpg");
  });

  it("returns null when no recognized asset key present", () => {
    const item = makeItem({
      B01: { href: "https://example.com/b01.tif", type: "image/tiff" },
    });
    expect(getSTACQuicklookUrl(item)).toBeNull();
  });
});

describe("getSentinel1RevisitDates", () => {
  it("returns 6 dates by default", () => {
    const start = new Date("2026-01-01");
    const dates = getSentinel1RevisitDates(start);
    expect(dates).toHaveLength(6);
  });

  it("spaces dates 12 days apart", () => {
    const start = new Date("2026-01-01");
    const dates = getSentinel1RevisitDates(start, 3);
    expect(dates[0]!.getTime()).toBe(start.getTime());
    const diff = dates[1]!.getTime() - dates[0]!.getTime();
    expect(diff).toBe(12 * 24 * 60 * 60 * 1000);
  });

  it("returns custom count", () => {
    const dates = getSentinel1RevisitDates(new Date(), 10);
    expect(dates).toHaveLength(10);
  });
});

describe("generateDeformationReadings", () => {
  it("returns 5 readings for the standard mine layout", () => {
    const readings = generateDeformationReadings(-26.25, 26.75);
    expect(readings).toHaveLength(5);
  });

  it("each reading has a valid level", () => {
    const readings = generateDeformationReadings(-26.25, 26.75);
    for (const r of readings) {
      expect(["stable", "minor", "moderate", "critical"]).toContain(r.level);
    }
  });

  it("each reading has a 6-month history", () => {
    const readings = generateDeformationReadings(-26.25, 26.75);
    for (const r of readings) {
      expect(r.history).toHaveLength(6);
    }
  });
});

describe("formatSceneDate", () => {
  it("formats an ISO datetime string to a readable label", () => {
    const formatted = formatSceneDate("2026-01-15T10:30:00Z");
    expect(typeof formatted).toBe("string");
    expect(formatted.length).toBeGreaterThan(0);
  });
});

describe("DEFAULT_MINE_BBOX and DEFAULT_MINE_CENTER", () => {
  it("bounding box has valid structure", () => {
    expect(DEFAULT_MINE_BBOX.west).toBeLessThan(DEFAULT_MINE_BBOX.east);
    expect(DEFAULT_MINE_BBOX.south).toBeLessThan(DEFAULT_MINE_BBOX.north);
  });

  it("center is within bbox", () => {
    expect(DEFAULT_MINE_CENTER.lat).toBeGreaterThanOrEqual(
      DEFAULT_MINE_BBOX.south,
    );
    expect(DEFAULT_MINE_CENTER.lat).toBeLessThanOrEqual(
      DEFAULT_MINE_BBOX.north,
    );
    expect(DEFAULT_MINE_CENTER.lon).toBeGreaterThanOrEqual(
      DEFAULT_MINE_BBOX.west,
    );
    expect(DEFAULT_MINE_CENTER.lon).toBeLessThanOrEqual(DEFAULT_MINE_BBOX.east);
  });
});
