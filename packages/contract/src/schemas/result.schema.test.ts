import { z } from 'zod';
import {
  basicOperationResultSchema,
  createOperationResultSchema,
  createPaginatedResultSchema,
} from './result.schema';

describe('createOperationResultSchema', () => {
  const userResultSchema = createOperationResultSchema(
    z.object({ id: z.string(), name: z.string() })
  );

  it('validates a successful result payload with typed data', () => {
    const successPayload = {
      success: true,
      data: { id: 'usr-101', name: 'Alice Walker' },
      message: 'User retrieved successfully',
    };

    const parsed = userResultSchema.safeParse(successPayload);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.success).toBe(true);
    }
  });

  it('validates a failure result payload with error message and details', () => {
    const failurePayload = {
      success: false,
      error: 'Validation failed',
      errors: [
        {
          code: 'INVALID_NAME',
          message: 'Name is required',
          field: 'name',
        },
      ],
    };

    const parsed = userResultSchema.safeParse(failurePayload);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.success).toBe(false);
    }
  });

  it('rejects a success payload missing the required data field', () => {
    const invalidPayload = {
      success: true,
      message: 'Operation succeeded but data missing',
    };

    const parsed = userResultSchema.safeParse(invalidPayload);
    expect(parsed.success).toBe(false);
  });
});

describe('createPaginatedResultSchema', () => {
  const itemSchema = z.object({ id: z.number(), title: z.string() });
  const paginatedSchema = createPaginatedResultSchema(itemSchema);

  it('validates a structured paginated result', () => {
    const payload = {
      items: [
        { id: 1, title: 'Item 1' },
        { id: 2, title: 'Item 2' },
      ],
      totalCount: 50,
      page: 1,
      pageSize: 2,
      totalPages: 25,
      hasNextPage: true,
      hasPreviousPage: false,
    };

    const parsed = paginatedSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
  });

  it('rejects invalid page or negative totalCount', () => {
    const payload = {
      items: [],
      totalCount: -1,
      page: 0,
      pageSize: 10,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    };

    const parsed = paginatedSchema.safeParse(payload);
    expect(parsed.success).toBe(false);
  });
});

describe('basicOperationResultSchema', () => {
  it('validates basic success without data', () => {
    const parsed = basicOperationResultSchema.safeParse({ success: true });
    expect(parsed.success).toBe(true);
  });
});
