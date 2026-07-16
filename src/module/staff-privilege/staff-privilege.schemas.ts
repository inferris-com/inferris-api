import z from "zod";

import { paginationQuerySchema } from "../../shared/pagination.schemas.js";

export const staffPrivilegeParamsSchema = z.object({ privilegeId: z.string().uuid() }).strict();
export const staffPrivilegeActorParamsSchema = z.object({ actorId: z.string().uuid() }).strict();

export const listStaffPrivilegesQuerySchema = paginationQuerySchema
  .extend({
    actorId: z.string().uuid().optional(),
    status: z.enum(["active", "suspended", "revoked", "pending"]).optional(),
    role: z.enum(["none", "collaborator", "moderator", "administrator", "superadmin"]).optional(),
  })
  .strict();

export const createStaffPrivilegeBodySchema = z
  .object({
    actorId: z.string().uuid(),
    status: z.enum(["active", "suspended", "revoked", "pending"]).default("active"),
    role: z.enum(["none", "collaborator", "moderator", "administrator", "superadmin"]),
    title: z.string().trim().max(100).nullable().optional(),
  })
  .strict();

export const updateStaffPrivilegeBodySchema = createStaffPrivilegeBodySchema
  .omit({ actorId: true })
  .partial()
  .strict();

export type StaffPrivilegeParams = z.infer<typeof staffPrivilegeParamsSchema>;
export type StaffPrivilegeActorParams = z.infer<typeof staffPrivilegeActorParamsSchema>;
export type ListStaffPrivilegesQuery = z.infer<typeof listStaffPrivilegesQuerySchema>;
export type CreateStaffPrivilegeBody = z.infer<typeof createStaffPrivilegeBodySchema>;
export type UpdateStaffPrivilegeBody = z.infer<typeof updateStaffPrivilegeBodySchema>;
