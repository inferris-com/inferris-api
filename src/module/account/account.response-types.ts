import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import z from "zod";
import type { ArgusAccountRole, ArgusAccountStatus, UserPrivilegeRole } from "../../db/types.js";

extendZodWithOpenApi(z);

export const passwordSecurityCueSchema = z
  .object({
    breached: z.boolean(),
    breachCount: z.number().int().nullable(),
    checkedAtMs: z.number().int(),
  })
  .openapi("PasswordSecurityCue");

export const accountResponseSchema = z
  .object({
    id: z.string().uuid(),
    username: z.string(),
    email: z.string().email(),
    role: z.enum(["moderator", "admin"]),
    actorId: z.string().uuid().nullable(),
    linkedActor: z
      .object({
        id: z.string().uuid(),
        name: z.string().nullable(),
        type: z.string(),
      })
      .nullable(),
    privileged: z
      .object({
        id: z.string().uuid(),
        role: z.enum(["none", "collaborator", "moderator", "administrator", "superadmin"]),
        title: z.string().nullable(),
        status: z.string(),
      })
      .nullable(),
    accountState: z.enum(["active", "suspended", "disabled", "verify_email", "reset_password"]),
    passwordSecurity: passwordSecurityCueSchema.nullable(),
    createdAtMs: z.string(),
    updatedAtMs: z.string().nullable(),
  })
  .openapi("AccountResponse");

export const accountNotificationResponseSchema = z
  .object({
    id: z.string(),
    type: z.enum(["notification", "password_security"]),
    title: z.string(),
    description: z.string().nullable(),
    priority: z.number().int(),
  })
  .openapi("AccountNotificationResponse");

export const passwordChangeResponseSchema = z
  .object({
    passwordSecurity: passwordSecurityCueSchema.nullable(),
  })
  .openapi("PasswordChangeResponse");

export type AccountResponse = {
  id: string;
  username: string;
  email: string;
  role: ArgusAccountRole;
  actorId: string | null;
  linkedActor: {
    id: string;
    name: string | null;
    type: string;
  } | null;
  privileged: {
    id: string;
    role: UserPrivilegeRole;
    title: string | null;
    status: string;
  } | null;
  accountState: ArgusAccountStatus;
  passwordSecurity: PasswordSecurityCue | null;
  createdAtMs: string;
  updatedAtMs: string | null;
};

export type PasswordSecurityCue = {
  breached: boolean;
  breachCount: number | null;
  checkedAtMs: number;
};

export type AccountNotificationResponse = {
  id: string;
  type: "notification" | "password_security";
  title: string;
  description: string | null;
  priority: number;
};

export type PasswordChangeResponse = {
  passwordSecurity: PasswordSecurityCue | null;
};
