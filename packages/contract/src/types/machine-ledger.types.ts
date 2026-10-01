import { z } from 'zod';
import {
  machineLedgerCloseoutSchema,
  machineTimeAllocationSchema,
} from '../schemas/machine-ledger.schema';

export type MachineTimeAllocationInput = z.infer<typeof machineTimeAllocationSchema>;
export type MachineLedgerCloseoutInput = z.infer<typeof machineLedgerCloseoutSchema>;
