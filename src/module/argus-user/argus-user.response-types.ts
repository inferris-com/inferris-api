import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import z from "zod";

import { accountIdentityResponseSchema } from "../account/account.schemas.js";

extendZodWithOpenApi(z);

export const argusUserResponseSchema = accountIdentityResponseSchema
  .extend({
    createdAtMs: z.string(),
    updatedAtMs: z.string().nullable(),
  })
  .openapi("ArgusUserResponse");

export type ArgusUserResponse = z.infer<typeof argusUserResponseSchema>;
