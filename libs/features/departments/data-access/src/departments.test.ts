import { fetchLiveDepartmentMetrics } from './department-live-metrics';
import {
  ACCESS_CONTROL_TABS,
  ADMIN_DEPARTMENT,
  DEPARTMENTS,
  getDepartmentTabs,
  OFFICE_TABS,
  PLANT_INVENTORY_TABS,
  PLANT_PROCESSING_TABS,
  PRESENTATION_TABS,
  PRODUCTION_TABS,
  PRODUCTIVITY_TOOLS,
} from './departments';

describe('DEPARTMENTS registry', () => {
  it('defines all active departments with valid configurations and no static fake trend on admin', () => {
    expect(DEPARTMENTS.length).toBeGreaterThanOrEqual(7);
    expect(ADMIN_DEPARTMENT.trend).toBeUndefined();

    const names = new Set<string>();
    const routes = new Set<string>();

    for (const dept of DEPARTMENTS) {
      expect(dept.name).toBeDefined();
      expect(dept.name.length).toBeGreaterThan(0);
      expect(names.has(dept.name)).toBe(false);
      names.add(dept.name);

      expect(dept.displayName).toBeDefined();
      expect(dept.route).toMatch(/^\/[a-z0-9-]+(?:\/[a-z0-9-]+)*$/);
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
          expect(action.href).toMatch(
            /^\/[a-z0-9-]+(?:\/[a-z0-9-]+)*(?:\?[a-z0-9-]+=[a-z0-9-]+(?:&[a-z0-9-]+=[a-z0-9-]+)*)?$/
          );

          expect(actionLabels.has(action.label)).toBe(false);
          actionLabels.add(action.label);

          expect(actionHrefs.has(action.href)).toBe(false);
          actionHrefs.add(action.href);
        }
      }
    }
  });

  it('contains critical operational departments ordered as admin, access-control, production, drilling', () => {
    const departmentNames = DEPARTMENTS.map((dept) => dept.name);
    expect(departmentNames.slice(0, 4)).toEqual([
      'admin',
      'access-control',
      'production',
      'drilling',
    ]);
    expect(departmentNames).toContain('drilling');
    expect(departmentNames).toContain('production');
    expect(departmentNames).toContain('plant-processing');
    expect(departmentNames).toContain('plant-inventory');
    expect(departmentNames).toContain('access-control');
    expect(departmentNames).toContain('engineering');
    expect(departmentNames).toContain('control-room');
    expect(departmentNames).toContain('admin');
    expect(departmentNames).toContain('overview');
    expect(departmentNames).toContain('office');
    expect(departmentNames).toContain('presentation');
    expect(departmentNames).toContain('executive');
    expect(departmentNames).not.toContain('safety');
    expect(departmentNames).not.toContain('training');
    expect(departmentNames).not.toContain('satellite-monitoring');
  });

  it('defines valid productivity tools with unique names', () => {
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

  it('returns dedicated Plant & Processing tabs (Dashboard, Hourly Sheet, Delays, Reports) without Daily Log, History, Machines, or Tools', () => {
    const tabs = getDepartmentTabs('plant-processing');
    expect(tabs).toBe(PLANT_PROCESSING_TABS);
    expect(tabs.map((tab) => tab.name)).toEqual(['dashboard', 'hourly-sheet', 'delays', 'reports']);
  });

  it('returns dedicated Plant Inventory tabs (Dashboard, Inventory List, Item List, Stock Required, Reports, History of Used)', () => {
    const tabs = getDepartmentTabs('plant-inventory');
    expect(tabs).toBe(PLANT_INVENTORY_TABS);
    expect(tabs.map((tab) => ({ name: tab.name, label: tab.label }))).toEqual([
      { name: 'dashboard', label: 'Dashboard' },
      { name: 'daily-log', label: 'Inventory List' },
      { name: 'machines', label: 'Item List' },
      { name: 'history', label: 'Stock Required' },
      { name: 'reports', label: 'Reports' },
      { name: 'tools', label: 'History of Used' },
    ]);
  });

  it('returns dedicated Availability & Utilization tabs', () => {
    const tabs = getDepartmentTabs('availability-utilization');
    expect(tabs.map((tab) => tab.label)).toEqual([
      '30-Day Activity',
      'Monthly Summary',
      'Shift View',
      'PDF Report',
      'Archived',
    ]);
  });

  it('returns dedicated Office tabs (Office Workspace, Office Panels, Documents) without Daily Log, Reports, or History', () => {
    const tabs = getDepartmentTabs('office');
    expect(tabs).toBe(OFFICE_TABS);
    expect(tabs.map((tab) => tab.name)).toEqual(['dashboard', 'panels', 'documents']);
  });

  it('returns dedicated Presentation tabs (Deck, System Documentation, Architecture, Investor Pack)', () => {
    const tabs = getDepartmentTabs('presentation');
    expect(tabs).toBe(PRESENTATION_TABS);
    expect(tabs.map((tab) => tab.name)).toEqual([
      'dashboard',
      'documentation',
      'architecture',
      'investor-pack',
    ]);
  });

  it('gives Drilling core operational tabs without Tools and updates Production and Access Control labels', () => {
    const drillingTabs = getDepartmentTabs('drilling');
    expect(drillingTabs.map((tab) => tab.name)).toEqual([
      'dashboard',
      'drilling-operations',
      'daily-log',
      'history',
      'reports',
    ]);
    expect(drillingTabs.map((tab) => tab.name)).not.toContain('machines');
    expect(drillingTabs.map((tab) => tab.name)).not.toContain('tools');

    const engineeringTabs = getDepartmentTabs('engineering');
    expect(engineeringTabs.map((tab) => tab.name)).toEqual([
      'dashboard',
      'breakdowns',
      'tire-management',
      'daily-log',
      'machines',
      'history',
      'reports',
    ]);
    expect(engineeringTabs.map((tab) => tab.name)).not.toContain('tools');

    const productionTabs = getDepartmentTabs('production');
    expect(productionTabs).toBe(PRODUCTION_TABS);
    expect(productionTabs.map((tab) => ({ name: tab.name, label: tab.label }))).toEqual([
      { name: 'dashboard', label: 'Dashboard' },
      { name: 'daily-log', label: 'Targets' },
      { name: 'machines', label: 'Machines' },
      { name: 'history', label: 'Performance' },
      { name: 'reports', label: 'Reports' },
    ]);

    const accessControlTabs = getDepartmentTabs('access-control');
    expect(accessControlTabs).toBe(ACCESS_CONTROL_TABS);
    expect(accessControlTabs.map((tab) => ({ name: tab.name, label: tab.label }))).toContainEqual({
      name: 'muster',
      label: 'On-Site',
    });
    expect(accessControlTabs.map((tab) => ({ name: tab.name, label: tab.label }))).toContainEqual({
      name: 'expired',
      label: 'Expired',
    });
  });

  it('populates real admin overlay in fetchLiveDepartmentMetrics from live employees, system_logs, and departments counts', async () => {
    const createCountQuery = (countValue: number) => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      count: countValue,
    });

    const mockHealthyDb = {
      from: jest.fn((table: string) => {
        if (table === 'employees') return createCountQuery(184);
        if (table === 'system_logs') return createCountQuery(0);
        if (table === 'departments') return createCountQuery(12);
        if (table === 'machines') {
          return {
            select: jest.fn().mockReturnThis(),
            is: jest.fn(async () => ({ data: [{ active: true }, { active: true }] })),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          is: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn(async () => ({ data: null })),
        };
      }),
    };

    const healthyOverlays = await fetchLiveDepartmentMetrics(mockHealthyDb, '2026-11-26');
    expect(healthyOverlays.admin).toEqual({
      stats: {
        label: 'Active Users',
        value: '184 (12 depts)',
      },
      trend: [184, 12, 2, 0],
      status: 'active',
    });

    const mockAlertDb = {
      from: jest.fn((table: string) => {
        if (table === 'employees') return createCountQuery(184);
        if (table === 'system_logs') return createCountQuery(3);
        if (table === 'departments') return createCountQuery(12);
        if (table === 'machines') {
          return {
            select: jest.fn().mockReturnThis(),
            is: jest.fn(async () => ({ data: [{ active: true }] })),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          is: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn(async () => ({ data: null })),
        };
      }),
    };

    const alertOverlays = await fetchLiveDepartmentMetrics(mockAlertDb, '2026-11-26');
    expect(alertOverlays.admin).toEqual({
      stats: {
        label: 'Staff · Open Logs',
        value: '184 · 3 open',
      },
      trend: [184, 12, 1, 3],
      status: 'alert',
    });
  });
});
