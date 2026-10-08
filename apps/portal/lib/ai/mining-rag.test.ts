import {
  formatBreakdownText,
  formatShiftNoteText,
  indexBreakdownVector,
  indexShiftNoteVector,
  searchShiftIntelligence,
  searchSimilarBreakdowns,
} from './mining-rag';

let mockInsert: jest.Mock;
let mockRpc: jest.Mock;

jest.mock('@repo/supabase/server', () => ({
  createServerSupabaseClient: jest.fn().mockImplementation(() =>
    Promise.resolve({
      from: jest.fn(() => ({
        insert: (...args: unknown[]) => mockInsert(...args),
      })),
      rpc: (...args: unknown[]) => mockRpc(...args),
    })
  ),
}));

jest.mock('./embeddings', () => ({
  generateEmbedding: jest.fn().mockResolvedValue(new Array(768).fill(0.05)),
}));

jest.mock('@/lib/errors/error-logger', () => ({
  logError: jest.fn(),
}));

describe('mining-rag domain vector search', () => {
  beforeEach(() => {
    mockInsert = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: { id: 'row-123' }, error: null }),
      }),
    });
    mockRpc = jest.fn().mockResolvedValue({ data: [], error: null });
    jest.clearAllMocks();
  });

  describe('formatters', () => {
    it('formats breakdown text with all fields', () => {
      const text = formatBreakdownText({
        id: 'b-1',
        fleet_id: 'EX01',
        machine_type: 'Excavator',
        reason: 'Hydraulic boom pump failure',
        repair_notes: 'Replaced seals and flushed fluid',
        status: 'completed',
      });
      expect(text).toContain('Fleet: EX01');
      expect(text).toContain('Type: Excavator');
      expect(text).toContain('Symptom/Reason: Hydraulic boom pump failure');
      expect(text).toContain('Repair/Resolution: Replaced seals and flushed fluid');
    });

    it('formats shift note text', () => {
      const text = formatShiftNoteText({
        id: 's-1',
        shift_type: 'night',
        note_date: '2026-10-08',
        note_text: 'Water accumulation on haul ramp 3',
        delay_minutes: 45,
      });
      expect(text).toContain('Shift: NIGHT');
      expect(text).toContain('Date: 2026-10-08');
      expect(text).toContain('Observation: Water accumulation on haul ramp 3');
      expect(text).toContain('Delay: 45 min');
    });
  });

  describe('indexing', () => {
    it('indexes a breakdown vector into memory_embeddings', async () => {
      const res = await indexBreakdownVector(
        {
          id: 'b-1',
          fleet_id: 'DT02',
          machine_type: 'Dump Truck',
          reason: 'Transmission overheating',
        },
        'user-1'
      );
      expect(res.success).toBe(true);
      expect(res.id).toBe('row-123');
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          session_id: 'breakdowns',
          user_id: 'user-1',
          memory_type: 'semantic',
        })
      );
    });

    it('indexes a shift note vector into memory_embeddings', async () => {
      const res = await indexShiftNoteVector(
        {
          id: 's-1',
          shift_type: 'day',
          note_date: '2026-10-08',
          note_text: 'Pit bench blasting completed on time',
        },
        'user-1'
      );
      expect(res.success).toBe(true);
      expect(res.id).toBe('row-123');
    });
  });

  describe('searchSimilarBreakdowns', () => {
    it('returns empty array on empty query', async () => {
      const res = await searchSimilarBreakdowns('', 'user-1');
      expect(res).toEqual([]);
    });

    it('returns formatted search results on RPC match', async () => {
      mockRpc.mockResolvedValueOnce({
        data: [
          {
            id: 'm-1',
            content: 'Fleet: EX01 | Hydraulic leak | Replaced O-ring',
            combined_score: 0.88,
            created_at: '2026-10-08T10:00:00Z',
            metadata: {
              fleet_id: 'EX01',
              machine_type: 'Excavator',
              breakdown_id: 'b-99',
              repair_notes: 'Replaced O-ring',
            },
          },
        ],
        error: null,
      });

      const res = await searchSimilarBreakdowns('hydraulic leak excavator', 'user-1');
      expect(res).toHaveLength(1);
      expect(res[0]!.fleetId).toBe('EX01');
      expect(res[0]!.score).toBe(88);
      expect(res[0]!.repairNotes).toBe('Replaced O-ring');
    });
  });

  describe('searchShiftIntelligence', () => {
    it('returns shift intelligence results on RPC match', async () => {
      mockRpc.mockResolvedValueOnce({
        data: [
          {
            id: 'm-2',
            content: 'Shift: NIGHT | Water on ramp',
            combined_score: 0.92,
            created_at: '2026-10-08T06:00:00Z',
            metadata: {
              shift_type: 'night',
              note_date: '2026-10-08',
              note_id: 's-44',
            },
          },
        ],
        error: null,
      });

      const res = await searchShiftIntelligence('water on ramp', 'user-1');
      expect(res).toHaveLength(1);
      expect(res[0]!.shiftType).toBe('night');
      expect(res[0]!.score).toBe(92);
    });
  });
});
