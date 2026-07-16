import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import z from "zod";
import type {
  ArgusAccountRole,
  ArgusAccountSecurityLock,
  ArgusAccountStatus,
} from "../../db/types.js";
import { argusAccountIdentityResponseSchema } from "../argus-account/argus-account.schemas.js";

extendZodWithOpenApi(z);

export const argusUserResponseSchema = z
  .object({
    ...argusAccountIdentityResponseSchema.shape,
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
  accountSecurityLock: ArgusAccountSecurityLock | null;
  createdAtMs: string;
  updatedAtMs: string | null;
};
