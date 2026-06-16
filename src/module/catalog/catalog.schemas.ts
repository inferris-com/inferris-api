import z from "zod";

const boolQuerySchema = z
  .enum(["true", "false"])
  .optional()
  .transform((value) => value === "true");

export const listGroupsQuerySchema = z
  .object({
    staffOnly: boolQuerySchema,
  })
  .strict();

export const listRanksQuerySchema = z
  .object({
    groupKey: z.string().trim().min(1).max(30).optional(),
    staffOnly: boolQuerySchema,
    includeInactive: boolQuerySchema,
  })
  .strict();

export const listBadgesQuerySchema = z
  .object({
    includeInactive: boolQuerySchema,
  })
  .strict();

export type ListGroupsQuery = z.infer<typeof listGroupsQuerySchema>;
export type ListRanksQuery = z.infer<typeof listRanksQuerySchema>;
export type ListBadgesQuery = z.infer<typeof listBadgesQuerySchema>;
