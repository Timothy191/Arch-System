import { z } from 'zod';

export const UltragoalStateSchema = z.enum(['PENDING', 'IN_PROGRESS', 'RE_LOOP_MAKER', 'VERIFY_EVIDENCE', 'COMPLETED', 'ABORTED']);

export const VerifierEvidenceSchema = z.object({
  taskName: z.string(),
  commandExecuted: z.string(),
  stdoutSnippet: z.string(),
  exitStatus: z.number(),
  zeroAllocationVerified: z.boolean(),
  oomSignalDetected: z.boolean(),
  verdict: z.enum(['VERIFY_PASS', 'VERIFY_FAIL'])
});

export const CompilerResourceLimitsSchema = z.object({
  maxJobs: z.number(),
  targetCrate: z.string(),
  memoryThresholdMb: z.number()
});
