import {
  indexBreakdownAction,
  indexShiftNoteAction,
  searchBreakdownDiagnosticsAction,
  searchShiftIntelligenceAction,
} from './vector-search';

let mockGetAuthenticatedEmployee: jest.Mock;
let mockSearchSimilarBreakdowns: jest.Mock;
let mockSearchShiftIntelligence: jest.Mock;
let mockIndexBreakdownVector: jest.Mock;
let mockIndexShiftNoteVector: jest.Mock;

jest.mock('@repo/supabase', () => ({
  getAuthenticatedEmployee: (...args: unknown[]) => mockGetAuthenticatedEmployee(...args),
}));

jest.mock('@/lib/ai/mining-rag', () => ({
  searchSimilarBreakdowns: (...args: unknown[]) => mockSearchSimilarBreakdowns(...args),
  searchShiftIntelligence: (...args: unknown[]) => mockSearchShiftIntelligence(...args),
  indexBreakdownVector: (...args: unknown[]) => mockIndexBreakdownVector(...args),
  indexShiftNoteVector: (...args: unknown[]) => mockIndexShiftNoteVector(...args),
}));

jest.mock('@/lib/errors/error-logger', () => ({
  logError: jest.fn(),
}));

describe('vector-search server actions', () => {
  beforeEach(() => {
    mockGetAuthenticatedEmployee = jest.fn().mockResolvedValue({
      user: { id: 'u-100' },
      employee: { id: 'emp-1', role: 'technician' },
    });
    mockSearchSimilarBreakdowns = jest.fn().mockResolvedValue([
      {
        id: 'res-1',
        fleetId: 'EX01',
        machineType: 'Excavator',
        reason: 'Hydraulic failure',
        score: 89,
        createdAt: '2026-10-08T12:00:00Z',
      },
    ]);
    mockSearchShiftIntelligence = jest.fn().mockResolvedValue([
      {
        id: 'res-2',
        shiftType: 'night',
        noteDate: '2026-10-08',
        content: 'Bench blasted',
        score: 95,
        createdAt: '2026-10-08T06:00:00Z',
      },
    ]);
    mockIndexBreakdownVector = jest.fn().mockResolvedValue({ success: true, id: 'row-1' });
    mockIndexShiftNoteVector = jest.fn().mockResolvedValue({ success: true, id: 'row-2' });
  });

  describe('searchBreakdownDiagnosticsAction', () => {
    it('rejects unauthenticated requests', async () => {
      mockGetAuthenticatedEmployee.mockResolvedValueOnce(null);
      const res = await searchBreakdownDiagnosticsAction('hydraulic leak');
      expect(res.success).toBe(false);
      expect(res.error).toBe('Unauthorized');
    });

    it('returns empty array for empty query', async () => {
      const res = await searchBreakdownDiagnosticsAction('');
      expect(res.success).toBe(true);
      expect(res.data).toEqual([]);
      expect(mockSearchSimilarBreakdowns).not.toHaveBeenCalled();
    });

    it('returns search results for valid query', async () => {
      const res = await searchBreakdownDiagnosticsAction('transmission slipping');
      expect(res.success).toBe(true);
      expect(res.data).toHaveLength(1);
      expect(res.data![0]!.fleetId).toBe('EX01');
      expect(mockSearchSimilarBreakdowns).toHaveBeenCalledWith('transmission slipping', 'u-100');
    });
  });

  describe('searchShiftIntelligenceAction', () => {
    it('returns shift intelligence data', async () => {
      const res = await searchShiftIntelligenceAction('haul road condition');
      expect(res.success).toBe(true);
      expect(res.data).toHaveLength(1);
      expect(res.data![0]!.shiftType).toBe('night');
    });
  });

  describe('indexBreakdownAction', () => {
    it('rejects when required fields are missing', async () => {
      const res = await indexBreakdownAction({
        id: 'b-1',
        fleet_id: '',
        machine_type: 'Excavator',
        reason: '',
      });
      expect(res.success).toBe(false);
      expect(res.code).toBe('VALIDATION_ERROR');
    });

    it('indexes breakdown successfully', async () => {
      const res = await indexBreakdownAction({
        id: 'b-1',
        fleet_id: 'EX01',
        machine_type: 'Excavator',
        reason: 'Oil leak',
      });
      expect(res.success).toBe(true);
      expect(res.data).toEqual({ indexed: true });
    });
  });

  describe('indexShiftNoteAction', () => {
    it('indexes shift note successfully', async () => {
      const res = await indexShiftNoteAction({
        id: 's-1',
        shift_type: 'day',
        note_date: '2026-10-08',
        note_text: 'Pit operations running normally',
      });
      expect(res.success).toBe(true);
      expect(res.data).toEqual({ indexed: true });
    });
  });
});
