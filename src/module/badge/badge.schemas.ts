import z from "zod";

export const badgeParamsSchema = z.object({ badgeId: z.coerce.number().int().positive() }).strict();

export const listBadgesQuerySchema = z
  .object({
    includeInactive: z
      .enum(["true", "false"])
      .optional()
      .transform((value) => value === "true"),
  })
  .strict();

export const createBadgeBodySchema = z
  .object({
    key: z.string().trim().min(1).max(80),
    label: z.string().trim().min(1).max(100),
    description: z.string().trim().max(1000).nullable().optional(),
    color: z.string().trim().max(32).nullable().optional(),
    emoji: z.string().trim().max(32).nullable().optional(),
    displayOrder: z.number().int().default(0),
    isActive: z.boolean().default(true),
  })
  .strict();

export const updateBadgeBodySchema = createBadgeBodySchema.partial().strict();

export type BadgeParams = z.infer<typeof badgeParamsSchema>;
export type ListBadgesQuery = z.infer<typeof listBadgesQuerySchema>;
export type CreateBadgeBody = z.infer<typeof createBadgeBodySchema>;
export type UpdateBadgeBody = z.infer<typeof updateBadgeBodySchema>;
