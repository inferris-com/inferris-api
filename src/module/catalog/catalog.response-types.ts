import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import z from "zod";

extendZodWithOpenApi(z);

export const groupResponseSchema = z
  .object({
    key: z.string(),
    label: z.string(),
    priority: z.number().int(),
    isStaff: z.boolean(),
    createdAtMs: z.string(),
    updatedAtMs: z.string().nullable(),
  })
  .openapi("GroupResponse");

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
  .openapi("RankResponse");

export const badgeResponseSchema = z
  .object({
    id: z.number().int(),
    key: z.string(),
    label: z.string(),
    description: z.string().nullable(),
    color: z.string().nullable(),
    emoji: z.string().nullable(),
    displayOrder: z.number().int(),
    isActive: z.boolean(),
  })
  .openapi("BadgeResponse");

export type GroupResponse = z.infer<typeof groupResponseSchema>;
export type RankResponse = z.infer<typeof rankResponseSchema>;
export type BadgeResponse = z.infer<typeof badgeResponseSchema>;
