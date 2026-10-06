import { offlineMutationBatchSchema, offlineSmrMutationSchema } from './offline-mutations.schema';

const validMutation = {
  id: 'd290f1ee-6c54-4b01-90e6-d701748f0851',
  hlc: { wall: 1_760_000_000_000, counter: 0, node: 'field-terminal-1' },
  entity: 'smr' as const,
  entityId: 'machine-1',
  op: 'smr.update' as const,
  payload: {
    meterId: 'machine-1',
    reading: 42.5,
    readingAt: '2026-10-05T12:00:00.000Z',
    deviceId: 'field-terminal-1',
  },
};

describe('offline mutation contracts', () => {
  it('accepts a valid SMR mutation batch', () => {
    expect(
      offlineMutationBatchSchema.safeParse({
        clientHlc: validMutation.hlc,
        mutations: [validMutation],
      }).success
    ).toBe(true);
  });

  it('rejects unsupported operations and negative SMR readings', () => {
    expect(offlineSmrMutationSchema.safeParse({ ...validMutation, op: 'smr.delete' }).success).toBe(
      false
    );
    expect(
      offlineSmrMutationSchema.safeParse({
        ...validMutation,
        payload: { ...validMutation.payload, reading: -1 },
      }).success
    ).toBe(false);
  });

  it('rejects batches over the per-request limit', () => {
    const mutations = Array.from({ length: 501 }, (_, index) => ({
      ...validMutation,
      id: `d290f1ee-6c54-4b01-90e6-${String(index).padStart(12, '0')}`,
    }));

    expect(
      offlineMutationBatchSchema.safeParse({
        clientHlc: validMutation.hlc,
        mutations,
      }).success
    ).toBe(false);
  });

  it('rejects caller-provided tenant fields', () => {
    expect(
      offlineMutationBatchSchema.safeParse({
        tenantId: 'd290f1ee-6c54-4b01-90e6-d701748f0851',
        clientHlc: validMutation.hlc,
        mutations: [validMutation],
      }).success
    ).toBe(false);
  });
});
