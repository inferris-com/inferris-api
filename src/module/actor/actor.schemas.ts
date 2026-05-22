import { z } from "zod";
import {BigIntStringSchema} from "../../shared/common.schemas.js";

export const actorTypeSchema = z.enum(["system", "application", "user", "unspecified"]);

export const actorIdParamsSchema = z.object({
  actorId: z.guid({ message: "Invalid actor UUID format." }),
});

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
  .strict();

export type ActorType = z.infer<typeof actorTypeSchema>;
export type ActorIdParams = z.infer<typeof actorIdParamsSchema>;
export type CreateActorBody = z.infer<typeof createActorBodySchema>;
export type UpdateActorBody = z.infer<typeof updateActorBodySchema>;
