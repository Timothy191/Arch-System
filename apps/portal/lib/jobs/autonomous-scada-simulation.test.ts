const mockLogError = jest.fn();
jest.mock('@/lib/errors/error-logger', () => ({
  logError: (...args: unknown[]) => mockLogError(...args),
}));

const mockRecordJobExecution = jest.fn();
jest.mock('@/lib/observability/simple-metrics', () => ({
  recordJobExecution: (...args: unknown[]) => mockRecordJobExecution(...args),
}));

const mockFrom = jest.fn();
jest.mock('@repo/supabase/service-role', () => ({
  createServiceRoleClient: jest.fn(() => ({ from: mockFrom })),
}));

var capturedHandler: ((ctx: { step: Record<string, unknown> }) => Promise<unknown>) | undefined;

jest.mock('@repo/utils/inngest', () => ({
  inngest: {
    createFunction: jest.fn(
      (_opts: unknown, fn: (ctx: { step: Record<string, unknown> }) => Promise<unknown>) => {
        capturedHandler = fn;
        return { handler: fn };
      }
    ),
  },
}));

import './autonomous-scada-simulation';

function invokeHandler(ctx: { step: Record<string, unknown> }): Promise<unknown> {
  if (!capturedHandler) {
    throw new Error('Inngest handler was not registered');
  }
  return capturedHandler(ctx);
}

describe('autonomousScadaSimulationFn', () => {
  beforeEach(() => {
    mockFrom.mockReset();
    mockLogError.mockReset();
    mockRecordJobExecution.mockReset();
  });

  it('returns early when no active machines are returned or a query error occurs', async () => {
    const mockLimit = jest.fn().mockResolvedValue({ data: [], error: null });
    const mockEq = jest.fn().mockReturnValue({ limit: mockLimit });
    const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'machines') return { select: mockSelect };
      return {};
    });

    const result = await invokeHandler({ step: {} });

    expect(result).toEqual({
      success: true,
      message: 'No active machines to simulate',
    });
    expect(mockRecordJobExecution).toHaveBeenCalledWith(
      'autonomous-scada-simulation',
      expect.any(Number),
      true
    );
  });

  it('inserts simulated SCADA telemetry for active machines with drill_rig bit_depth handling', async () => {
    const machines = [
      { id: 'mach-drill-1', machine_type: 'drill_rig', name: 'Drill Rig Alpha' },
      { id: 'mach-truck-2', machine_type: 'dump_truck', name: 'Haul Truck Beta' },
    ];
    const mockLimit = jest.fn().mockResolvedValue({ data: machines, error: null });
    const mockEq = jest.fn().mockReturnValue({ limit: mockLimit });
    const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
    const mockInsert = jest.fn().mockResolvedValue({ error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'machines') return { select: mockSelect };
      if (table === 'scada_telemetry') return { insert: mockInsert };
      return {};
    });

    const result = await invokeHandler({ step: {} });

    expect(result).toEqual({
      success: true,
      simulated_count: 2,
    });
    expect(mockInsert).toHaveBeenCalledTimes(2);

    const drillInsert = mockInsert.mock.calls[0][0];
    expect(drillInsert).toMatchObject({
      machine_id: 'mach-drill-1',
      sensor_id: 'sys_gen_mach-drill-1',
      metadata: expect.objectContaining({
        machine_id: 'mach-drill-1',
        bit_depth: expect.any(Number),
      }),
    });

    const truckInsert = mockInsert.mock.calls[1][0];
    expect(truckInsert).toMatchObject({
      machine_id: 'mach-truck-2',
      sensor_id: 'sys_gen_mach-truck-2',
      metadata: expect.objectContaining({
        machine_id: 'mach-truck-2',
        bit_depth: null,
      }),
    });

    expect(mockRecordJobExecution).toHaveBeenCalledWith(
      'autonomous-scada-simulation',
      expect.any(Number),
      true
    );
  });

  it('logs fatal errors, records failed execution metric, and rethrows', async () => {
    const fatalError = new Error('Supabase connection refused');
    mockFrom.mockImplementation(() => {
      throw fatalError;
    });

    await expect(invokeHandler({ step: {} })).rejects.toThrow('Supabase connection refused');

    expect(mockLogError).toHaveBeenCalledWith(fatalError, {
      context: 'autonomous_scada_simulation_fatal',
    });
    expect(mockRecordJobExecution).toHaveBeenCalledWith(
      'autonomous-scada-simulation',
      expect.any(Number),
      false
    );
  });
});
