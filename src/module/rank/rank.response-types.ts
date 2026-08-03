import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import z from "zod";
import type { Json } from "@/db/types.js";

extendZodWithOpenApi(z);

export const rankResponseSchema = z
  .object({
    key: z.string(),
    groupKey: z.string().nullable(),
    label: z.string(),
    description: z.string().nullable(),
    visuals: z.any(),
    tier: z.number().int(),
    isStaff: z.boolean(),
    isActive: z.boolean(),
    createdAtMs: z.string(),
    updatedAtMs: z.string().nullable(),
  })
  .openapi("RankManagementResponse");

export type RankResponse = {
  key: string;
  groupKey: string | null;
  label: string;
  description: string | null;
  visuals: Json;
  tier: number;
  isStaff: boolean;
  isActive: boolean;
  createdAtMs: string;
  updatedAtMs: string | null;
};
