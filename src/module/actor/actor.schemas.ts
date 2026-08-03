import { z } from "zod";
import { BigIntStringSchema } from "@/shared/common.schemas.js";

export const actorTypeSchema = z.enum(["system", "application", "user", "unspecified"]);

export const actorIdParamsSchema = z.object({
  actorId: z.guid({ message: "Invalid actor UUID format." }),
});

export const listActorsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).default(25),
  offset: z.coerce.number().int().min(0).default(0),
  name: z.string().trim().min(1).max(32).optional(),
  type: actorTypeSchema.optional(),
});

export const searchActorsQuerySchema = z
  .object({
    q: z.string().trim().min(1).max(64),
    limit: z.coerce.number().int().min(1).max(25).default(10),
  })
  .strict();

export const createActorBodySchema = z
  .object({
    id: z.guid(),
    name: z.string().nonempty(),
    type: actorTypeSchema,
    playerId: z.guid().nullable(),
  })
  .strict();

export const updateActorBodySchema = z
  .object({
    name: z.string().optional().nullable(),
    type: actorTypeSchema.optional(),
    playerId: z.guid().optional().nullable(),
    createdAtMs: BigIntStringSchema.optional(),
    lastUpdatedAtMs: BigIntStringSchema.optional().nullable(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: "At least one field must be provided.",
  });

export type ActorType = z.infer<typeof actorTypeSchema>;
export type ActorIdParams = z.infer<typeof actorIdParamsSchema>;
export type ListActorsQuery = z.infer<typeof listActorsQuerySchema>;
export type SearchActorsQuery = z.infer<typeof searchActorsQuerySchema>;
export type CreateActorBody = z.infer<typeof createActorBodySchema>;
export type UpdateActorBody = z.infer<typeof updateActorBodySchema>;
