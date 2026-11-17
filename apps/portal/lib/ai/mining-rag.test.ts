import {
  buildOperationalGraphContext,
  formatBreakdownText,
  formatShiftNoteText,
  indexBreakdownVector,
  indexShiftNoteVector,
  searchOperationalGraphRag,
  searchShiftIntelligence,
  searchSimilarBreakdowns,
} from './mining-rag';

let mockInsert: jest.Mock;
let mockRpc: jest.Mock;
const mockSearchAvailability = jest.fn();
const mockEnsureVectorIndex = jest.fn();
const mockUpsertVector = jest.fn();
const mockSearchVectors = jest.fn();

jest.mock('@repo/redis/search', () => ({
  searchAvailability: (...args: unknown[]) => mockSearchAvailability(...args),
  ensureVectorIndex: (...args: unknown[]) => mockEnsureVectorIndex(...args),
  upsertVector: (...args: unknown[]) => mockUpsertVector(...args),
  searchVectors: (...args: unknown[]) => mockSearchVectors(...args),
}));

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
    mockSearchAvailability
      .mockReset()
      .mockResolvedValue({ available: false, reason: 'unreachable' });
    mockEnsureVectorIndex.mockReset().mockResolvedValue(true);
    mockUpsertVector.mockReset().mockResolvedValue(true);
    mockSearchVectors.mockReset().mockResolvedValue([]);
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

    it('dual-writes breakdown vector to Redis Stack when available', async () => {
      mockSearchAvailability.mockResolvedValueOnce({ available: true });
      const res = await indexBreakdownVector(
        {
          id: 'brk-stack-1',
          fleet_id: 'EX-10',
          machine_type: 'Excavator',
          reason: 'Track tensioner leak',
        },
        'user-1'
      );
      expect(res.success).toBe(true);
      expect(mockEnsureVectorIndex).toHaveBeenCalledTimes(1);
      expect(mockUpsertVector).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'row-123',
          fields: expect.objectContaining({
            session_id: 'breakdowns',
            user_id: 'user-1',
            breakdown_id: 'brk-stack-1',
          }),
        })
      );
    });

    it('reads through Redis Stack for searchSimilarBreakdowns when hits exist', async () => {
      mockSearchAvailability.mockResolvedValueOnce({ available: true });
      mockSearchVectors.mockResolvedValueOnce([
        {
          id: 'vec-redis-1',
          score: 0.1,
          fields: {
            user_id: 'user-1',
            breakdown_id: 'brk-99',
            fleet_id: 'EX-20',
            machine_type: 'Excavator',
            content: 'Machine: EX-20 | Issue: Boom cylinder seal',
            repair_notes: 'Replaced seal kit',
            created_at: '2026-11-16T12:00:00Z',
          },
        },
      ]);

      const res = await searchSimilarBreakdowns('boom cylinder seal', 'user-1');
      expect(mockRpc).not.toHaveBeenCalled();
      expect(res).toHaveLength(1);
      expect(res[0]!.breakdownId).toBe('brk-99');
      expect(res[0]!.score).toBe(95);
    });

    it('falls back to Postgres pgvector when Redis Stack returns empty', async () => {
      mockSearchAvailability.mockResolvedValueOnce({ available: true });
      mockSearchVectors.mockResolvedValueOnce([]);
      mockRpc.mockResolvedValueOnce({ data: [], error: null });

      const res = await searchSimilarBreakdowns('unknown issue', 'user-1');
      expect(mockRpc).toHaveBeenCalledTimes(1);
      expect(res).toEqual([]);
    });
  });

  describe('Operational GraphRAG (buildOperationalGraphContext & searchOperationalGraphRag)', () => {
    it('builds SAME_FLEET, SAME_MACHINE_TYPE, and CORRELATED_SHIFT_DELAY edges with fleet summaries', () => {
      const ctx = buildOperationalGraphContext(
        [
          {
            id: 'brk-1',
            fleetId: 'EX01',
            machineType: 'Excavator',
            reason: 'Boom cylinder seal leak',
            score: 94,
            createdAt: '2026-11-16T08:00:00Z',
          },
          {
            id: 'brk-2',
            fleetId: 'EX01',
            machineType: 'Excavator',
            reason: 'Hydraulic pressure drop',
            score: 89,
            createdAt: '2026-11-15T10:00:00Z',
          },
          {
            id: 'brk-3',
            fleetId: 'EX02',
            machineType: 'Excavator',
            reason: 'Swing bearing wear',
            score: 82,
            createdAt: '2026-11-14T10:00:00Z',
          },
        ],
        [
          {
            id: 'note-1',
            shiftType: 'day',
            noteDate: '2026-11-16',
            content: 'EX01 paused 45 min for hydraulic boom inspection on bench 2',
            score: 91,
            createdAt: '2026-11-16T09:00:00Z',
          },
        ]
      );

      expect(ctx.fleetSummary.EX01).toEqual({
        fleetId: 'EX01',
        machineType: 'Excavator',
        breakdownCount: 2,
        relatedShiftCount: 2,
      });
      expect(ctx.edges).toEqual(
        expect.arrayContaining([
          { sourceId: 'brk-1', targetId: 'brk-2', relation: 'SAME_FLEET', weight: 0.95 },
          { sourceId: 'brk-1', targetId: 'brk-3', relation: 'SAME_MACHINE_TYPE', weight: 0.65 },
          {
            sourceId: 'brk-1',
            targetId: 'note-1',
            relation: 'CORRELATED_SHIFT_DELAY',
            weight: 0.85,
          },
        ])
      );
    });

    it('retrieves breakdown and shift intelligence in parallel via searchOperationalGraphRag', async () => {
      mockRpc
        .mockResolvedValueOnce({
          data: [
            {
              id: 'brk-rag-1',
              content: 'Fleet: DT05 | Dump Truck | Brake overheating',
              combined_score: 0.9,
              created_at: '2026-11-16T07:00:00Z',
              metadata: { fleet_id: 'DT05', machine_type: 'Dump Truck' },
            },
          ],
          error: null,
        })
        .mockResolvedValueOnce({
          data: [
            {
              id: 'note-rag-1',
              content: 'DT05 ramp haulage delay 30 min due to brake check',
              combined_score: 0.87,
              created_at: '2026-11-16T08:00:00Z',
              metadata: { shift_type: 'day', note_date: '2026-11-16' },
            },
          ],
          error: null,
        });

      const ctx = await searchOperationalGraphRag('DT05 brake', 'user-1', 3);
      expect(mockRpc).toHaveBeenCalledTimes(2);
      expect(ctx.seedBreakdowns).toHaveLength(1);
      expect(ctx.relatedShiftNotes).toHaveLength(1);
      expect(ctx.edges).toHaveLength(1);
      expect(ctx.edges[0]?.relation).toBe('CORRELATED_SHIFT_DELAY');
    });
  });
});
