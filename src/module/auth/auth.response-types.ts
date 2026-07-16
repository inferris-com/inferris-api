import type { ArgusAccountRole, UserPrivilegeRole } from "../../db/types.js";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import z from "zod";

extendZodWithOpenApi(z);

export const authUserResponseSchema = z
  .object({
    id: z.string().uuid(),
    username: z.string(),
    email: z.string().email(),
    role: z.enum(["admin", "moderator"]),
    actorId: z.string().uuid().nullable(),
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
