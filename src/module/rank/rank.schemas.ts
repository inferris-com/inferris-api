import z from "zod";

const boolQuerySchema = z
  .enum(["true", "false"])
  .optional()
  .transform((value) => value === "true");

export const rankKeyParamsSchema = z.object({ rankKey: z.string().min(1).max(30) }).strict();

export const listRanksQuerySchema = z
  .object({
    groupKey: z.string().trim().min(1).max(30).optional(),
    staffOnly: boolQuerySchema,
    includeInactive: boolQuerySchema,
  })
  .strict();

export const createRankBodySchema = z
  .object({
    key: z.string().trim().min(1).max(30),
    groupKey: z.string().trim().min(1).max(30).nullable().optional(),
    label: z.string().trim().min(1).max(50),
    description: z.string().trim().max(1000).nullable().optional(),
    visuals: z.unknown().default({}),
    tier: z.number().int().default(0),
    isStaff: z.boolean().default(false),
    isActive: z.boolean().default(true),
  })
  .strict();

export const updateRankBodySchema = createRankBodySchema.omit({ key: true }).partial().strict();

export type RankKeyParams = z.infer<typeof rankKeyParamsSchema>;
export type ListRanksQuery = z.infer<typeof listRanksQuerySchema>;
export type CreateRankBody = z.infer<typeof createRankBodySchema>;
export type UpdateRankBody = z.infer<typeof updateRankBodySchema>;
