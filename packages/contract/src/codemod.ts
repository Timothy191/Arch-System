import { z } from 'zod';
export const CodemodResultSchema = z.object({
  modifiedFiles: z.array(z.string()),
  hooksReplacedCount: z.number(),
  importStatementsUpdated: z.number(),
  syntaxErrors: z.array(z.string()),
  compilationPassed: z.boolean()
});
export const HookMigrationMappingSchema = z.object({
  targetHookName: z.string(),
  sourceLibrary: z.string(),
  replacementLibrary: z.literal('@repo/shared/hooks'),
  isNamedExport: z.boolean()
});
