import z from "zod";

import { paginationQuerySchema } from "../../shared/pagination.schemas.js";
import { accountRoleSchema, accountStateSchema } from "../account/account.schemas.js";

export const argusUserParamsSchema = z.object({ userId: z.string().uuid() }).strict();

export const listArgusUsersQuerySchema = paginationQuerySchema
  .extend({
    role: accountRoleSchema.optional(),
    accountState: accountStateSchema.optional(),
  })
  .strict();

export const resolveArgusUsersQuerySchema = z
  .object({
    q: z.string().trim().min(1).max(100),
    limit: z.coerce.number().int().min(1).max(50).default(10),
  })
  .strict();

export const createArgusUserBodySchema = z
  .object({
    username: z.string().trim().min(1).max(100),
    email: z.string().email().max(100),
    password: z.string().min(12).max(256).optional(),
    role: accountRoleSchema.default("moderator"),
    actorId: z.string().uuid().nullable().optional(),
    accountState: accountStateSchema.default("active"),
  })
  .strict();

export const updateArgusUserBodySchema = createArgusUserBodySchema
  .omit({ password: true })
  .partial()
  .strict();

export type ArgusUserParams = z.infer<typeof argusUserParamsSchema>;
export type ListArgusUsersQuery = z.infer<typeof listArgusUsersQuerySchema>;
export type ResolveArgusUsersQuery = z.infer<typeof resolveArgusUsersQuerySchema>;
export type CreateArgusUserBody = z.infer<typeof createArgusUserBodySchema>;
export type UpdateArgusUserBody = z.infer<typeof updateArgusUserBodySchema>;
