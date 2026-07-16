import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import z from "zod";

extendZodWithOpenApi(z);

export const argusAccountRoleSchema = z.enum(["moderator", "admin"]);

export const argusAccountStateSchema = z.enum([
  "active",
  "suspended",
  "disabled",
  "verify_email",
]);

export const argusAccountSecurityLockSchema = z
  .enum(["change_password", "reset_password"])
  .nullable();

export const argusAccountIdentityResponseSchema = z.object({
  id: z.string().uuid(),
  username: z.string(),
  email: z.string().email(),
  role: argusAccountRoleSchema,
  actorId: z.string().uuid().nullable(),
  accountState: argusAccountStateSchema,
  accountSecurityLock: argusAccountSecurityLockSchema,
});
