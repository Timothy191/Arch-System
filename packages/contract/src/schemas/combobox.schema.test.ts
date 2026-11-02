import {
  comboboxFilterResultSchema,
  comboboxOptionSchema,
  comboboxQuerySchema,
} from './combobox.schema';

describe('comboboxOptionSchema', () => {
  it('validates a complete combobox option item', () => {
    const option = {
      value: 'rig_101',
      label: 'Atlas Copco Pit Viper 271',
      group: 'Drilling Fleet',
      badge: 'Active',
      metadata: { department: 'drilling', fuelPercent: 88 },
    };

    const parsed = comboboxOptionSchema.safeParse(option);
    expect(parsed.success).toBe(true);
  });

  it('rejects an option missing a value or label', () => {
    const invalidOption = {
      label: 'No Value',
    };

    const parsed = comboboxOptionSchema.safeParse(invalidOption);
    expect(parsed.success).toBe(false);
  });
});

describe('comboboxQuerySchema', () => {
  it('validates a query with defaults', () => {
    const parsed = comboboxQuerySchema.safeParse({ query: 'excavator' });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.limit).toBe(20);
    }
  });

  it('validates query with selected values and custom limit', () => {
    const parsed = comboboxQuerySchema.safeParse({
      query: 'drill',
      limit: 50,
      selectedValues: ['dr-01', 'dr-02'],
      groupFilter: 'Drilling',
    });
    expect(parsed.success).toBe(true);
  });
});

describe('comboboxFilterResultSchema', () => {
  it('validates a filter result envelope', () => {
    const result = {
      options: [
        { value: 'haul_1', label: 'CAT 777D Truck 1' },
        { value: 'haul_2', label: 'CAT 777D Truck 2' },
      ],
      totalMatches: 42,
      hasMore: true,
    };

    const parsed = comboboxFilterResultSchema.safeParse(result);
    expect(parsed.success).toBe(true);
  });
});
