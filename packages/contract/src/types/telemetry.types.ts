import type { z } from "zod";
import type { telemetryPushSchema } from "../schemas/telemetry.schema.js";

export type TelemetryPushInput = z.infer<typeof telemetryPushSchema>;
