import { DEPARTMENTS, PRODUCTIVITY_TOOLS } from "./departments";

describe("DEPARTMENTS registry", () => {
  it("defines all active departments with valid configurations", () => {
    expect(DEPARTMENTS.length).toBeGreaterThanOrEqual(8);

    const names = new Set<string>();
    const routes = new Set<string>();

    for (const dept of DEPARTMENTS) {
      expect(dept.name).toBeDefined();
      expect(dept.name.length).toBeGreaterThan(0);
      expect(names.has(dept.name)).toBe(false);
      names.add(dept.name);

      expect(dept.displayName).toBeDefined();
      expect(dept.route).toMatch(/^\/[a-z0-9-]+$/);
      expect(routes.has(dept.route)).toBe(false);
      routes.add(dept.route);

      expect(dept.icon).toBeDefined();
      expect(dept.color).toBeDefined();
      expect(dept.description).toBeDefined();

      if (dept.actions) {
        expect(Array.isArray(dept.actions)).toBe(true);
        const actionLabels = new Set<string>();
        const actionHrefs = new Set<string>();

        for (const action of dept.actions) {
          expect(action.label).toBeDefined();
          expect(action.label.length).toBeGreaterThan(0);
          expect(action.href).toMatch(/^\/[a-z0-9-?=&]+$/);

          // Ensure no duplicate action labels or duplicate hrefs within the same department
          expect(actionLabels.has(action.label)).toBe(false);
          actionLabels.add(action.label);

          expect(actionHrefs.has(action.href)).toBe(false);
          actionHrefs.add(action.href);
        }
      }
    }
  });

  it("contains critical operational departments", () => {
    const departmentNames = DEPARTMENTS.map((d) => d.name);
    expect(departmentNames).toContain("drilling");
    expect(departmentNames).toContain("production");
    expect(departmentNames).toContain("access-control");
    expect(departmentNames).toContain("access-card-actions");
    expect(departmentNames).toContain("engineering");
    expect(departmentNames).toContain("control-room");
    expect(departmentNames).toContain("admin");
    expect(departmentNames).toContain("overview");
    expect(departmentNames).not.toContain("safety");
    expect(departmentNames).not.toContain("training");
    expect(departmentNames).not.toContain("satellite-monitoring");
  });

  it("defines valid productivity tools with unique names", () => {
    expect(PRODUCTIVITY_TOOLS.length).toBeGreaterThan(0);
    const toolNames = new Set<string>();

    for (const tool of PRODUCTIVITY_TOOLS) {
      expect(tool.name).toBeDefined();
      expect(toolNames.has(tool.name)).toBe(false);
      toolNames.add(tool.name);
      expect(tool.displayName).toBeDefined();
      expect(tool.icon).toBeDefined();
    }
  });
});
