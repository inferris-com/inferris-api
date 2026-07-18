import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import z from "zod";

import { staffPrivilegeRoleSchema, staffPrivilegeStatusSchema } from "./staff-privilege.schemas.js";

extendZodWithOpenApi(z);

export const staffPrivilegeResponseSchema = z
  .object({
    id: z.string().uuid(),
    actorId: z.string().uuid(),
    status: staffPrivilegeStatusSchema,
    role: staffPrivilegeRoleSchema,
    title: z.string().nullable(),
    enrolledByActorId: z.string().uuid().nullable(),
    revokedByActorId: z.string().uuid().nullable(),
    createdAtMs: z.string(),
    updatedAtMs: z.string().nullable(),
  })
  .openapi("StaffPrivilegeResponse");

export type StaffPrivilegeResponse = z.infer<typeof staffPrivilegeResponseSchema>;
