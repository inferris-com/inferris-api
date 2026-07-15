import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import z from "zod";
import type { PaginatedResponse } from "../../shared/pagination.schemas.js";

extendZodWithOpenApi(z);

export const actorResponseSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().nullable(),
    type: z.enum(["system", "application", "user", "unspecified"]),
    playerId: z.string().uuid().nullable(),
    createdAtMs: z.string(),
    lastUpdatedAtMs: z.string().nullable(),
  })
  .openapi("ActorResponse");

export type ActorResponse = z.infer<typeof actorResponseSchema>;
