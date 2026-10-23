import {
  dropVectorIndex,
  encodeVector,
  ensureVectorIndex,
  searchAvailability,
  searchVectors,
  upsertVector,
  type VectorIndexSpec,
  vectorIndexStats,
  vectorKey,
} from '../src/search';

const mockSend = jest.fn();
const mockSendSafe = jest.fn();
const mockDetectCapabilities = jest.fn();

jest.mock('../src/client', () => ({
  getRedisClient: jest.fn(async () => ({ isMock: true })),
}));

jest.mock('../src/raw', () => {
  const original = jest.requireActual('../src/raw');
  return {
    ...original,
    send: (...args: unknown[]) => mockSend(...args),
    sendSafe: (...args: unknown[]) => mockSendSafe(...args),
    detectCapabilities: (...args: unknown[]) => mockDetectCapabilities(...args),
  };
});

const spec: VectorIndexSpec = {
  indexName: 'arch:vector:documents',
  keyPrefix: 'arch:vector:doc:',
  vectorField: 'embedding',
  dimension: 4,
  textFields: ['content'],
  numericFields: ['department_id'],
};

const tcpCapabilities = { transport: 'tcp', search: true } as never;
const restCapabilities = { transport: 'serverless-rest', search: true } as never;
const plainCapabilities = { transport: 'tcp', search: false } as never;

describe('RediSearch Vector Accelerator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDetectCapabilities.mockResolvedValue(tcpCapabilities);
  });

  describe('searchAvailability', () => {
    test('is available on TCP with the search module loaded', async () => {
      await expect(searchAvailability()).resolves.toEqual({ available: true });
    });

    test('reports the missing module rather than guessing', async () => {
      mockDetectCapabilities.mockResolvedValue(plainCapabilities);
      await expect(searchAvailability()).resolves.toEqual({
        available: false,
        reason: 'no-search-module',
      });
    });

    test('refuses serverless REST because packed float32 cannot round-trip JSON', async () => {
      mockDetectCapabilities.mockResolvedValue(restCapabilities);
      await expect(searchAvailability()).resolves.toEqual({
        available: false,
        reason: 'serverless-rest',
      });
    });

    test('treats a failed probe as unreachable', async () => {
      mockDetectCapabilities.mockRejectedValue(new Error('connection refused'));
      await expect(searchAvailability()).resolves.toEqual({
        available: false,
        reason: 'unreachable',
      });
    });
  });

  describe('encodeVector', () => {
    test('packs little-endian float32 bytes', () => {
      const encoded = encodeVector(new Float32Array([1, 0, 0, 0]));
      expect(Buffer.isBuffer(encoded)).toBe(true);
      expect(encoded.length).toBe(16);
      expect([...encoded.subarray(0, 4)]).toEqual([0x00, 0x00, 0x80, 0x3f]);
      expect([...encoded.subarray(4)]).toEqual(new Array(12).fill(0));
    });

    test('vectorKey prefixes the document id', () => {
      expect(vectorKey(spec, 'doc-7')).toBe('arch:vector:doc:doc-7');
    });
  });

  describe('ensureVectorIndex', () => {
    test('issues FT.CREATE with a hash prefix and HNSW attributes', async () => {
      mockSend.mockResolvedValueOnce('OK');

      await expect(ensureVectorIndex(spec)).resolves.toBe(true);
      expect(mockSend).toHaveBeenCalledWith(expect.anything(), [
        'FT.CREATE',
        'arch:vector:documents',
        'ON',
        'HASH',
        'PREFIX',
        1,
        'arch:vector:doc:',
        'SCHEMA',
        'content',
        'TEXT',
        'department_id',
        'NUMERIC',
        'embedding',
        'VECTOR',
        'HNSW',
        10,
        'TYPE',
        'FLOAT32',
        'DISTANCE_METRIC',
        'COSINE',
        'DIM',
        4,
        'M',
        16,
        'EF_CONSTRUCTION',
        200,
      ]);
    });

    test('counts an existing index as success', async () => {
      mockSend.mockRejectedValueOnce(new Error('Index already exists'));
      await expect(ensureVectorIndex(spec)).resolves.toBe(true);
    });

    test('does nothing when the module is absent', async () => {
      mockDetectCapabilities.mockResolvedValue(plainCapabilities);
      await expect(ensureVectorIndex(spec)).resolves.toBe(false);
      expect(mockSend).not.toHaveBeenCalled();
    });
  });

  describe('upsertVector', () => {
    test('writes the packed vector and stringified fields to the hash', async () => {
      mockSend.mockResolvedValueOnce(2);

      await expect(
        upsertVector({
          spec,
          id: 'doc-1',
          vector: new Float32Array([1, 0, 0, 0]),
          fields: { content: 'conveyor stall', department_id: 12 },
        })
      ).resolves.toBe(true);

      const [, args] = mockSend.mock.calls[0] as [unknown, unknown[]];
      expect(args.slice(0, 2)).toEqual(['HSET', 'arch:vector:doc:doc-1']);
      expect(args[2]).toBe('embedding');
      expect(Buffer.isBuffer(args[3])).toBe(true);
      expect(args.slice(4)).toEqual(['content', 'conveyor stall', 'department_id', '12']);
    });

    test('swallows transport failures', async () => {
      mockSend.mockRejectedValueOnce(new Error('closed'));
      await expect(
        upsertVector({ spec, id: 'doc-1', vector: new Float32Array([0, 0, 0, 0]) })
      ).resolves.toBe(false);
    });
  });

  describe('searchVectors', () => {
    test('builds the KNN expression with PARAMS and DIALECT', async () => {
      mockSend.mockResolvedValueOnce([0]);

      await searchVectors({
        spec,
        vector: new Float32Array([1, 0, 0, 0]),
        k: 3,
        filter: '@department:{drilling}',
        returns: ['content'],
      });

      const [, args] = mockSend.mock.calls[0] as [unknown, unknown[]];
      expect(args.slice(0, 3)).toEqual([
        'FT.SEARCH',
        'arch:vector:documents',
        '@department:{drilling}=>[KNN 3 @embedding $VEC]',
      ]);
      expect(args.slice(3, 6)).toEqual(['PARAMS', 2, 'VEC']);
      expect(Buffer.isBuffer(args[6])).toBe(true);
      expect(args.slice(7, 10)).toEqual(['LIMIT', 0, 3]);
      expect(args[10]).toBe('RETURN');
      expect(args.slice(11)).toEqual([4, '__vector_score', 'AS', 'score', 'content', 'DIALECT', 2]);
    });

    test('parses the RESP2 flat reply', async () => {
      mockSend.mockResolvedValueOnce([
        1,
        'arch:vector:doc:doc-1',
        ['score', '0.25', 'content', 'conveyor stall'],
      ]);

      await expect(
        searchVectors({ spec, vector: new Float32Array([1, 0, 0, 0]) })
      ).resolves.toEqual([
        {
          id: 'arch:vector:doc:doc-1',
          score: 0.25,
          fields: { score: '0.25', content: 'conveyor stall' },
        },
      ]);
    });

    test('parses the RESP3 nested reply', async () => {
      mockSend.mockResolvedValueOnce([
        1,
        ['arch:vector:doc:doc-2', '0.5', ['content', 'haul cycle']],
      ]);

      const matches = await searchVectors({
        spec,
        vector: new Float32Array([1, 0, 0, 0]),
      });

      expect(matches).toHaveLength(1);
      expect(matches[0]).toMatchObject({ id: 'arch:vector:doc:doc-2', score: 0.5 });
    });

    test('answers empty when the index is missing', async () => {
      mockSend.mockRejectedValueOnce(new Error('Index not found'));
      await expect(
        searchVectors({ spec, vector: new Float32Array([1, 0, 0, 0]) })
      ).resolves.toEqual([]);
    });

    test('answers empty when the module is absent', async () => {
      mockDetectCapabilities.mockResolvedValue(plainCapabilities);
      await expect(
        searchVectors({ spec, vector: new Float32Array([1, 0, 0, 0]) })
      ).resolves.toEqual([]);
      expect(mockSend).not.toHaveBeenCalled();
    });
  });

  describe('vectorIndexStats', () => {
    test('reads nested FT.INFO rows', async () => {
      mockSendSafe.mockResolvedValueOnce([
        ['index_name', 'arch:vector:documents'],
        ['num_docs', '17'],
        ['prefixes', [['arch:vector:doc:']]],
      ]);

      const stats = await vectorIndexStats('arch:vector:documents');
      expect(stats).toMatchObject({ exists: true, numDocs: 17 });
    });

    test('reads flat FT.INFO pairs', async () => {
      mockSendSafe.mockResolvedValueOnce(['num_docs', '4', 'prefix', ['arch:vector:doc:']]);

      const stats = await vectorIndexStats('arch:vector:documents');
      expect(stats.numDocs).toBe(4);
      expect(stats.prefixes).toEqual(['arch:vector:doc:']);
    });

    test('reports a missing index as absent', async () => {
      mockSendSafe.mockResolvedValueOnce(null);
      await expect(vectorIndexStats('arch:vector:documents')).resolves.toEqual({
        indexName: 'arch:vector:documents',
        exists: false,
        numDocs: 0,
        prefixes: [],
      });
    });
  });

  describe('dropVectorIndex', () => {
    test('returns true on OK and false on rejection', async () => {
      mockSend.mockResolvedValueOnce('OK');
      await expect(dropVectorIndex('arch:vector:documents')).resolves.toBe(true);

      mockSend.mockRejectedValueOnce(new Error('no such index'));
      await expect(dropVectorIndex('arch:vector:documents')).resolves.toBe(false);
    });
  });
});
