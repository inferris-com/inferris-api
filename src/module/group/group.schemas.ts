import z from "zod";

export const groupKeyParamsSchema = z.object({ groupKey: z.string().min(1).max(30) }).strict();

export const listGroupsQuerySchema = z
  .object({
    staffOnly: z
      .enum(["true", "false"])
      .optional()
      .transform((value) => value === "true"),
  })
  .strict();

export const createGroupBodySchema = z
  .object({
    key: z.string().trim().min(1).max(30),
    label: z.string().trim().min(1).max(50),
    priority: z.number().int().default(0),
    isStaff: z.boolean().default(false),
  })
  .strict();

export const updateGroupBodySchema = createGroupBodySchema.omit({ key: true }).partial().strict();

export type GroupKeyParams = z.infer<typeof groupKeyParamsSchema>;
export type ListGroupsQuery = z.infer<typeof listGroupsQuerySchema>;
export type CreateGroupBody = z.infer<typeof createGroupBodySchema>;
export type UpdateGroupBody = z.infer<typeof updateGroupBodySchema>;
