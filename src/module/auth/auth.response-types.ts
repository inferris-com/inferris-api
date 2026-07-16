import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import z from "zod";
import type { ArgusAccountRole, UserPrivilegeRole } from "../../db/types.js";
import {
  argusAccountIdentityResponseSchema,
  argusAccountSecurityLockSchema,
  argusAccountStateSchema,
} from "../argus-account/argus-account.schemas.js";

extendZodWithOpenApi(z);

export const authUserResponseSchema = z
  .object({
    ...argusAccountIdentityResponseSchema.shape,
    privilegedRole: z
      .enum(["administrator", "collaborator", "moderator", "none", "superadmin"])
      .nullable(),
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

export type AuthUserResponse = z.infer<typeof authUserResponseSchema> & {
  role: ArgusAccountRole;
  privilegedRole: UserPrivilegeRole | null;
};

export type AuthTokenResponse = Omit<z.infer<typeof authTokenResponseSchema>, "user"> & {
  user: AuthUserResponse;
};

export { argusAccountSecurityLockSchema, argusAccountStateSchema };
