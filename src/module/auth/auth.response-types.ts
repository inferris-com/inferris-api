import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import z from "zod";

import { accountIdentityResponseSchema } from "@/module/argus/account/account.schemas.js";
import { staffPrivilegeRoleSchema } from "@/module/staff-privilege/staff-privilege.schemas.js";

extendZodWithOpenApi(z);

export const authUserResponseSchema = accountIdentityResponseSchema
  .extend({
    privilegedRole: staffPrivilegeRoleSchema.nullable(),
  })
  .openapi("AuthUserResponse");

export const authTokenResponseSchema = z
  .object({
    accessToken: z.string(),
    refreshToken: z.string(),
    tokenType: z.literal("Bearer"),
    expiresInSeconds: z.number().int().positive(),
    user: authUserResponseSchema,
  })
  .openapi("AuthTokenResponse");

export const argusSessionResponseSchema = z
  .object({
    id: z.string().uuid(),
    createdAtMs: z.number().int(),
    lastSeenAtMs: z.number().int(),
    expiresAtMs: z.number().int(),
    revokedAtMs: z.number().int().nullable(),
    isCurrent: z.boolean(),
    ipAddress: z.string().nullable(),
    userAgent: z.string().nullable(),
  })
  .openapi("ArgusSessionResponse");

export type AuthUserResponse = z.infer<typeof authUserResponseSchema>;
export type AuthTokenResponse = z.infer<typeof authTokenResponseSchema>;
export type ArgusSessionResponse = z.infer<typeof argusSessionResponseSchema>;
