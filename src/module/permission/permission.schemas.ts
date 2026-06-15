import z from "zod";

export const PermissionCategoryType = z.enum([
  "general",
  "feature",
  "command",
  "moderation",
  "administration",
  "development",
]);

export const permissionIdParamsSchema = z.object({
  permissionId: z.guid({ message: "Invalid permission UUID format." }),
});

export const permissionKeyParamsSchema = z.object({
  permissionKey: z.string({ message: "Invalid permission string format." }),
});

export const permissionMinRankKeyParamsSchema = z.object({
  minRankKey: z.string({ message: "Invalid min rank string format." }),
});

export const permissionRuleParamsSchema = z.object({
  permissionKey: z.string({ message: "Invalid permission string format." }),
  minRankKey: z.string({ message: "Invalid min rank string format." }),
});

export const createPermissionNodeBodySchema = z
  .object({
    key: z.string().nonempty(),
    description: z.string().nullable(),
    category: PermissionCategoryType,
    isActive: z.boolean(),
  })
  .strict();

export const updatePermissionNodeBodySchema = z
  .object({
    key: z.string().nonempty().optional(),
    description: z.string().nullable().optional(),
    category: PermissionCategoryType.optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export const replacePermissionRuleBodySchema = z
  .object({
    // Permission key and min rank key are in endpoint parameters: /permissions/:permissionKey/rules/:minRankKey
    effect: z.enum(["allow", "deny"]),
  })
  .strict();

export type PermissionIdParams = z.infer<typeof permissionIdParamsSchema>;
export type PermissionKeyParams = z.infer<typeof permissionKeyParamsSchema>;
export type PermissionMinRankKeyParams = z.infer<typeof permissionMinRankKeyParamsSchema>;
export type PermissionRuleKeyParams = z.infer<typeof permissionRuleParamsSchema>;

export type CreatePermissionNodeBody = z.infer<typeof createPermissionNodeBodySchema>;
export type ReplacePermissionRuleBody = z.infer<typeof replacePermissionRuleBodySchema>;
export type UpdatePermissionNodeBody = z.infer<typeof updatePermissionNodeBodySchema>;
