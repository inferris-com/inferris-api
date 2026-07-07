import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import z from "zod";

extendZodWithOpenApi(z);

export const permissionNodeResponseSchema = z
  .object({
    id: z.string().uuid(),
    key: z.string(),
    category: z.string(),
    description: z.string().nullable(),
    isActive: z.boolean(),
    createdAtMs: z.string(),
    updatedAtMs: z.string().nullable(),
  })
  .openapi("PermissionNodeResponse");

export const permissionRuleResponseSchema = z
  .object({
    permissionId: z.string().uuid(),
    permissionKey: z.string().optional(),
    rankKey: z.string().nullable(),
    effect: z.enum(["allow", "deny"]),
    createdAtMs: z.string(),
    updatedAtMs: z.string().nullable(),
  })
  .openapi("PermissionRuleResponse");

export type PermissionNodeResponse = z.infer<typeof permissionNodeResponseSchema>;
export type PermissionRuleResponse = z.infer<typeof permissionRuleResponseSchema>;
