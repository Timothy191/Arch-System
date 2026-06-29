import type { z } from "zod";
import type { telemetryPushSchema } from "../schemas/telemetry.schema";

export type TelemetryPushInput = z.infer<typeof telemetryPushSchema>;
