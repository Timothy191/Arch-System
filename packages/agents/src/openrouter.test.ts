import { z } from 'zod';
import {
  countPromptTokens,
  createOpenRouterProvider,
  executeOpenRouterStructuredObject,
} from './openrouter';

jest.mock('@openrouter/ai-sdk-provider', () => ({
  createOpenRouter: jest.fn(() => jest.fn((model: string) => `mock-model-${model}`)),
}));

jest.mock('ai', () => ({
  generateText: jest.fn().mockResolvedValue({
    text: '{"result": "success"}',
  }),
  generateObject: jest.fn().mockImplementation(async ({ schema }) => {
    const mockData = { status: 'healthy', confidence: 0.98 };
    const validated = schema.parse(mockData);
    return { object: validated };
  }),
}));

jest.mock('./langfuse', () => ({
  withAgentSpan: jest.fn((_name, _attributes, fn) => fn()),
}));

describe('OpenRouter & Outlines Structured Generation', () => {
  describe('countPromptTokens', () => {
    it('returns 0 for empty string', () => {
      expect(countPromptTokens('')).toBe(0);
    });

    it('returns token count greater than zero for non-empty text', () => {
      const count = countPromptTokens('Arch-System SCADA Telemetry Pipeline');
      expect(count).toBeGreaterThan(0);
    });
  });

  describe('createOpenRouterProvider', () => {
    it('creates an OpenRouter instance with custom headers', () => {
      const provider = createOpenRouterProvider({
        apiKey: 'test-api-key',
        headers: { 'X-Custom': 'Unit-Test' },
      });
      expect(provider).toBeDefined();
    });
  });

  describe('executeOpenRouterStructuredObject (Outlines Invariant)', () => {
    const testSchema = z.object({
      status: z.enum(['healthy', 'degraded', 'down']),
      confidence: z.number().min(0).max(1),
    });

    it('generates a schema-validated object conforming to the Outlines invariant', async () => {
      const result = await executeOpenRouterStructuredObject({
        systemPrompt: 'You are a SCADA health auditor.',
        userPrompt: 'Audit telemetry health.',
        schema: testSchema,
        schemaName: 'ScadaHealthAudit',
      });

      expect(result.object).toEqual({
        status: 'healthy',
        confidence: 0.98,
      });
      expect(result.model).toBeDefined();
      expect(result.promptTokensEstimate).toBeGreaterThan(0);
      expect(result.completionTokensEstimate).toBeGreaterThan(0);
    });
  });
});
