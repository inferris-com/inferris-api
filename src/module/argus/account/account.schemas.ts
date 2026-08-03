import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import z from "zod";

extendZodWithOpenApi(z);

export const accountRoleSchema = z.enum(["moderator", "admin"]);

export const accountStateSchema = z.enum(["active", "suspended", "disabled", "verify_email"]);

export const accountSecurityLockSchema = z.enum(["change_password", "reset_password"]);

export const accountIdentityResponseSchema = z
  .object({
    id: z.string().uuid(),
    username: z.string(),
    email: z.string().email(),
    role: accountRoleSchema,
    actorId: z.string().uuid().nullable(),
    accountState: accountStateSchema,
    accountSecurityLock: accountSecurityLockSchema.nullable(),
  })
  .openapi("AccountIdentityResponse");

export const changePasswordBodySchema = z
  .object({
    currentPassword: z.string().min(1).max(256),
    newPassword: z.string().min(3).max(256),
  })
  .strict();

export const accountSessionParamsSchema = z
  .object({
    sessionId: z.string().uuid(),
  })
  .strict();

export const accountNotificationParamsSchema = z
  .object({
    notificationId: z.string().min(1).max(128),
  })
  .strict();

export type AccountRole = z.infer<typeof accountRoleSchema>;
export type AccountState = z.infer<typeof accountStateSchema>;
export type AccountSecurityLock = z.infer<typeof accountSecurityLockSchema>;
export type AccountIdentityResponse = z.infer<typeof accountIdentityResponseSchema>;
export type ChangePasswordBody = z.infer<typeof changePasswordBodySchema>;
export type AccountNotificationParams = z.infer<typeof accountNotificationParamsSchema>;
export type AccountSessionParams = z.infer<typeof accountSessionParamsSchema>;
