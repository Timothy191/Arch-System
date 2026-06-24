import { z } from "zod";

export const uuidSchema = z.string().uuid("Must be a valid UUID");

export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format");

export const dateMonthSchema = z.string().regex(/^\d{4}-\d{2}$/, "Must be YYYY-MM format");

export const nonEmptyString = z.string().min(1, "Must not be empty");
