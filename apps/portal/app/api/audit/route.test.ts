/**
 * @jest-environment node
 */
import { GET } from "./route";
import fs from "node:fs";
import path from "node:path";

jest.mock("node:fs", () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
}));

jest.mock("node:path", () => ({
  join: jest.fn(),
  dirname: jest.fn(),
  resolve: jest.fn(),
}));

const mockFs = jest.mocked(fs);
const mockPath = jest.mocked(path);

function buildFsScenario(
  overrides: {
    existsSync?: (_p: string | Buffer | URL) => boolean;
    readFileSync?: (_p: string | Buffer | URL, _encoding?: string) => string;
    pathJoin?: (..._args: string[]) => string;
    pathDirname?: (_p: string | Buffer | URL) => string;
    pathResolve?: (..._p: string[]) => string;
  } = {},
) {
  mockFs.existsSync.mockImplementation(overrides.existsSync || (() => false));
  mockFs.readFileSync.mockImplementation(overrides.readFileSync || (() => "{}"));
  mockPath.join.mockImplementation(overrides.pathJoin || ((...args) => args.join("/")));
  mockPath.dirname.mockImplementation(
    overrides.dirname ||
      ((p) => (typeof p === "string" ? p.slice(0, p.lastIndexOf("/") || 1) : String(p))),
  );
  mockPath.resolve.mockImplementation(overrides.pathResolve || ((...args) => args.join("/")));
}

function createRequest(url: string): Request {
  return new Request(url);
}

describe("GET /api/audit", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns manifest and report contents for the latest log", async () => {
    buildFsScenario({
      existsSync: (p: string) =>
        p.includes("manifest.json") ||
        p.includes("latest/results.md") ||
        p.includes("latest/required-actions.md") ||
        p.includes("latest/design-report.md") ||
        p.includes("latest/rls-report.md") ||
        p.includes("03-audit-reports"),
      readFileSync: (p: string) => {
        if (p.includes("manifest.json")) {
          return JSON.stringify([{ id: "log-1", date: "2026-01-01" }]);
        }
        if (p.includes("results.md")) return "# Results\n\nAll good.";
        if (p.includes("required-actions.md")) return "# Actions\n\nNone.";
        if (p.includes("design-report.md")) return "# Design\n\nOK.";
        if (p.includes("rls-report.md")) return "# RLS\n\nPassed.";
        return "{}";
      },
      pathJoin: (...args: string[]) => args.join("/"),
      pathDirname: (p: string) => {
        const last = p.lastIndexOf("/");
        return last > 0 ? p.slice(0, last) : p;
      },
      pathResolve: (...args: string[]) => args.join("/"),
    });

    const res = await GET(createRequest("http://localhost:3000/api/audit"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      manifest: [{ id: "log-1", date: "2026-01-01" }],
      activeLogId: "latest",
      results: "# Results\n\nAll good.",
      requiredActions: "# Actions\n\nNone.",
      designReport: "# Design\n\nOK.",
      rlsReport: "# RLS\n\nPassed.",
    });
  });

  it("uses the requested log id when provided", async () => {
    buildFsScenario({
      existsSync: (p: string) =>
        p.includes("manifest.json") ||
        p.includes("log-123/results.md") ||
        p.includes("log-123/required-actions.md") ||
        p.includes("log-123/design-report.md") ||
        p.includes("log-123/rls-report.md") ||
        p.includes("03-audit-reports"),
      readFileSync: (p: string) => {
        if (p.includes("manifest.json")) return "[]";
        if (p.includes("results.md")) return "# Results\n\nCustom log.";
        return "# Missing";
      },
      pathJoin: (...args: string[]) => args.join("/"),
      pathDirname: (p: string) => {
        const last = p.lastIndexOf("/");
        return last > 0 ? p.slice(0, last) : p;
      },
      pathResolve: (...args: string[]) => args.join("/"),
    });

    const res = await GET(createRequest("http://localhost:3000/api/audit?log=log-123"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.activeLogId).toBe("log-123");
    expect(body.results).toBe("# Results\n\nCustom log.");
  });

  it("falls back to audit root when the requested log directory does not exist", async () => {
    buildFsScenario({
      existsSync: (p: string) =>
        p.includes("manifest.json") ||
        p.includes("03-audit-reports") ||
        p.includes("results.md") ||
        p.includes("required-actions.md"),
      readFileSync: (p: string) => {
        if (p.includes("manifest.json")) return "[]";
        if (p.includes("results.md")) return "# Root results";
        return "# Missing";
      },
      pathJoin: (...args: string[]) => args.join("/"),
      pathDirname: (p: string) => {
        const last = p.lastIndexOf("/");
        return last > 0 ? p.slice(0, last) : p;
      },
      pathResolve: (...args: string[]) => args.join("/"),
    });

    const res = await GET(createRequest("http://localhost:3000/api/audit?log=missing-log"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.activeLogId).toBe("missing-log");
    expect(body.results).toBe("# Root results");
  });

  it("returns an empty manifest when manifest.json is missing", async () => {
    buildFsScenario({
      existsSync: (p: string) =>
        p.includes("latest/results.md") ||
        p.includes("latest/required-actions.md") ||
        p.includes("latest/design-report.md") ||
        p.includes("latest/rls-report.md") ||
        p.includes("03-audit-reports"),
      readFileSync: (p: string) => {
        if (p.includes("results.md")) return "# Results";
        return "# Missing";
      },
      pathJoin: (...args: string[]) => args.join("/"),
      pathDirname: (p: string) => {
        const last = p.lastIndexOf("/");
        return last > 0 ? p.slice(0, last) : p;
      },
      pathResolve: (...args: string[]) => args.join("/"),
    });

    const res = await GET(createRequest("http://localhost:3000/api/audit"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.manifest).toEqual([]);
  });

  it("returns an empty manifest when manifest.json contains invalid JSON", async () => {
    buildFsScenario({
      existsSync: (p: string) =>
        p.includes("manifest.json") ||
        p.includes("latest/results.md") ||
        p.includes("03-audit-reports"),
      readFileSync: (p: string) => {
        if (p.includes("manifest.json")) return "not-json";
        if (p.includes("results.md")) return "# Results";
        return "# Missing";
      },
      pathJoin: (...args: string[]) => args.join("/"),
      pathDirname: (p: string) => {
        const last = p.lastIndexOf("/");
        return last > 0 ? p.slice(0, last) : p;
      },
      pathResolve: (...args: string[]) => args.join("/"),
    });

    const res = await GET(createRequest("http://localhost:3000/api/audit"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.manifest).toEqual([]);
  });

  it("returns placeholder text when a report file is missing", async () => {
    buildFsScenario({
      existsSync: () => false,
      readFileSync: () => {
        throw new Error("readFileSync should not be called when existsSync returns false");
      },
      pathJoin: (...args: string[]) => args.join("/"),
      pathDirname: (p: string) => {
        const last = p.lastIndexOf("/");
        return last > 0 ? p.slice(0, last) : p;
      },
      pathResolve: (...args: string[]) => args.join("/"),
    });

    const res = await GET(createRequest("http://localhost:3000/api/audit"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.manifest).toEqual([]);
    expect(body.results).toBe("# results.md\n\nReport unavailable.");
    expect(body.requiredActions).toBe("# required-actions.md\n\nReport unavailable.");
    expect(body.designReport).toBe("# design-report.md\n\nReport unavailable.");
    expect(body.rlsReport).toBe("# rls-report.md\n\nReport unavailable.");
  });
});
