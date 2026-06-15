import type { z } from "zod";
import type { syncPlaybackSchema } from "../schemas/sync.schema.js";

export type SyncPlaybackInput = z.infer<typeof syncPlaybackSchema>;
