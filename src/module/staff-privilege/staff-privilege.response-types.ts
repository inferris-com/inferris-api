import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import z from "zod";
import type { UserPrivilegeRole } from "../../db/types.js";

extendZodWithOpenApi(z);

export const staffPrivilegeResponseSchema = z
  .object({
    id: z.string().uuid(),
    actorId: z.string().uuid(),
    status: z.string(),
    role: z.enum(["none", "collaborator", "moderator", "administrator", "superadmin"]),
    title: z.string().nullable(),
    enrolledByActorId: z.string().uuid().nullable(),
    revokedByActorId: z.string().uuid().nullable(),
    createdAtMs: z.string(),
    updatedAtMs: z.string().nullable(),
  })
  .openapi("StaffPrivilegeResponse");

export type StaffPrivilegeResponse = {
  id: string;
  actorId: string;
  status: string;
  role: UserPrivilegeRole;
  title: string | null;
  enrolledByActorId: string | null;
  revokedByActorId: string | null;
  createdAtMs: string;
  updatedAtMs: string | null;
};
