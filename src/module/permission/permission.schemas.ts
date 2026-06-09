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
  permissionId: z.uuid({ message: "Invalid player UUID format." }),
});

export const permissionKeyParamsSchema = z.object({
  permissionKey: z.string({ message: "Invalid permission string format." }),
});

export const createPermissionNodeBodySchema = z.object({
  key: z.string().nonempty(),
  description: z.string().nullable(),
  category: PermissionCategoryType,
  isActive: z.boolean(),
});

export const createPermissionRuleBodySchema = z.object({
  permission_id: z.uuid(),
  minRankKey: z.string().nullable(),
  effect: z.enum(["allow", "deny"]),
  priority: z.int().min(0),
});

export const updatePermissionNodeBodySchema = z.object({
  key: z.string().nonempty().optional(),
  description: z.string().nullable().optional(),
  category: PermissionCategoryType.optional(),
  isActive: z.boolean().optional(),
});

export const replacePermissionRuleBodySchema = z.object({
  permission_id: z.uuid(),
  minRankKey: z.string().nullable(),
  effect: z.enum(["allow", "deny"]),
  priority: z.int().min(0),
});

export type PermissionIdParams = z.infer<typeof permissionIdParamsSchema>;
export type CreatePermissionNodeBody = z.infer<typeof createPermissionNodeBodySchema>;
export type CreatePermissionRuleBody = z.infer<typeof createPermissionRuleBodySchema>;
export type UpdatePermissionNodeBody = z.infer<typeof updatePermissionNodeBodySchema>;
export type ReplacePermissionRuleBody = z.infer<typeof replacePermissionRuleBodySchema>;
