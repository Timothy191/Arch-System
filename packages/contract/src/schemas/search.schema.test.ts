import {
  mineSearchQuerySchema,
  mineSearchResponseSchema,
  mineSearchResultItemSchema,
  searchCategoryEnum,
} from './search.schema';

describe('Search Schemas (Meilisearch Parity)', () => {
  it('validates a valid search query with default options', () => {
    const parsed = mineSearchQuerySchema.parse({
      query: 'Caterpillar 797F',
    });

    expect(parsed.query).toBe('Caterpillar 797F');
    expect(parsed.category).toBe('all');
    expect(parsed.limit).toBe(20);
    expect(parsed.offset).toBe(0);
    expect(parsed.typoTolerance).toBe(true);
    expect(parsed.sortBy).toBe('relevance');
  });

  it('rejects empty queries or oversized limits', () => {
    expect(() => mineSearchQuerySchema.parse({ query: '   ' })).toThrow();
    expect(() =>
      mineSearchQuerySchema.parse({
        query: 'Drill rig',
        limit: 500,
      })
    ).toThrow();
  });

  it('validates a structured search result item and response payload', () => {
    const resultItem = mineSearchResultItemSchema.parse({
      id: 'eq-797-01',
      category: 'equipment',
      title: 'Haul Truck 797-01',
      subtitle: 'Pit North / Active',
      department: 'production',
      score: 0.98,
      url: '/production/fleet/eq-797-01',
      metadata: { fleetId: 'FL-01' },
      highlights: [
        {
          field: 'title',
          snippet: 'Haul <em>Truck</em> 797-01',
          matchPositions: [[5, 10]],
        },
      ],
    });

    expect(resultItem.id).toBe('eq-797-01');
    expect(resultItem.score).toBe(0.98);

    const response = mineSearchResponseSchema.parse({
      hits: [resultItem],
      totalHits: 1,
      query: 'truck',
      processingTimeMs: 12.4,
      limit: 20,
      offset: 0,
      hasMore: false,
    });

    expect(response.totalHits).toBe(1);
    expect(response.hits[0]?.title).toBe('Haul Truck 797-01');
  });
});
