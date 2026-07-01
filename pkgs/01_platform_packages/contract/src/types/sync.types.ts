import type { z } from "zod";
import type { syncPlaybackSchema } from "../schemas/sync.schema";

export type SyncPlaybackInput = z.infer<typeof syncPlaybackSchema>;
