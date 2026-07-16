import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import z from "zod";
import type { ArgusAccountRole, ArgusAccountStatus } from "../../db/types.js";

extendZodWithOpenApi(z);

export const argusUserResponseSchema = z
  .object({
    id: z.string().uuid(),
    username: z.string(),
    email: z.string().email(),
    role: z.enum(["moderator", "admin"]),
    actorId: z.string().uuid().nullable(),
    accountState: z.enum(["active", "suspended", "disabled", "verify_email", "reset_password"]),
    createdAtMs: z.string(),
    updatedAtMs: z.string().nullable(),
  })
  .openapi("ArgusUserResponse");

export type ArgusUserResponse = {
  id: string;
  username: string;
  email: string;
  role: ArgusAccountRole;
  actorId: string | null;
  accountState: ArgusAccountStatus;
  createdAtMs: string;
  updatedAtMs: string | null;
};
