import { z } from "zod";

export const actorTypeSchema = z.enum(["system", "application", "user", "unspecified"]);

export const actorIdParamsSchema = z.object({
  actorId: z.guid({ message: "Invalid actor UUID format." }),
});

export const listActorsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).default(25),
  offset: z.coerce.number().int().min(0).default(0),
  name: z.string().trim().min(1).max(100).optional(),
  type: actorTypeSchema.optional(),
});

export const searchActorsQuerySchema = z
  .object({
    q: z.string().trim().min(1).max(100),
    limit: z.coerce.number().int().min(1).max(25).default(10),
  })
  .strict();

// Labels are editable; actor kind and identity links are not generic CRUD fields.
export const updateActorBodySchema = z
  .object({ name: z.string().trim().min(1).max(100).nullable() })
  .strict();

export type ActorType = z.infer<typeof actorTypeSchema>;
export type ActorIdParams = z.infer<typeof actorIdParamsSchema>;
export type ListActorsQuery = z.infer<typeof listActorsQuerySchema>;
export type SearchActorsQuery = z.infer<typeof searchActorsQuerySchema>;
export type UpdateActorBody = z.infer<typeof updateActorBodySchema>;
