import type { z } from "zod";
import type {
  operationalStatusEnum,
  truckTallySchema,
  excavatorHaulSchema,
  dozerRolloverEntrySchema,
  fleetSmuEntrySchema,
  breakdownReportEntrySchema,
  ancillaryReportEntrySchema,
  bredellReportEntrySchema,
  multiSiteShiftReportSchema,
} from "../schemas/multi-site-production.schema.js";

export type MachineOperationalStatus = z.infer<typeof operationalStatusEnum>;
export type TruckTally = z.infer<typeof truckTallySchema>;
export type ExcavatorHaul = z.infer<typeof excavatorHaulSchema>;
export type DozerRolloverEntry = z.infer<typeof dozerRolloverEntrySchema>;
export type FleetSmuEntry = z.infer<typeof fleetSmuEntrySchema>;
export type BreakdownReportEntry = z.infer<typeof breakdownReportEntrySchema>;
export type AncillaryReportEntry = z.infer<typeof ancillaryReportEntrySchema>;
export type BredellReportEntry = z.infer<typeof bredellReportEntrySchema>;
export type MultiSiteShiftReport = z.infer<typeof multiSiteShiftReportSchema>;
