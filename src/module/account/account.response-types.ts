import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import z from "zod";

import { actorTypeSchema } from "../actor/actor.schemas.js";
import { passwordSecurityCueSchema } from "../password-security/password-security.schemas.js";
import {
  staffPrivilegeRoleSchema,
  staffPrivilegeStatusSchema,
} from "../staff-privilege/staff-privilege.schemas.js";
import { accountIdentityResponseSchema } from "./account.schemas.js";

extendZodWithOpenApi(z);

export const accountResponseSchema = accountIdentityResponseSchema
  .extend({
    linkedActor: z
      .object({
        id: z.string().uuid(),
        name: z.string().nullable(),
        type: actorTypeSchema,
      })
      .nullable(),
    privileged: z
      .object({
        id: z.string().uuid(),
        role: staffPrivilegeRoleSchema,
        title: z.string().nullable(),
        status: staffPrivilegeStatusSchema,
      })
      .nullable(),
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

export type AccountResponse = z.infer<typeof accountResponseSchema>;
export type AccountNotificationResponse = z.infer<typeof accountNotificationResponseSchema>;
export type PasswordChangeResponse = z.infer<typeof passwordChangeResponseSchema>;
