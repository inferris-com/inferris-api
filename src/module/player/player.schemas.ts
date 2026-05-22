import z from "zod";
import { BigIntStringSchema, UsernameSchema } from "../../shared/common.schemas.js";

export const playerIdParamsSchema = z.object({
  playerId: z.guid({ message: "Invalid player UUID format." }),
});

export const listPlayersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
  username: z.string().trim().min(1).max(32).optional(),
});

export const createPlayerBodySchema = z
  .object({
    id: z.guid(),

    username: UsernameSchema,

    // DB has no default for flags, so we should intentionally supply it.
    flags: BigIntStringSchema.default("0"),

    orbs: BigIntStringSchema.optional(),

    chatChannel: z.enum(["global", "staff", "testing"]).default("global"),
  })
  .strict();

export const updatePlayerBodySchema = z
  .object({
    username: UsernameSchema.optional(),

    flags: BigIntStringSchema.optional(),

    orbs: BigIntStringSchema.optional(),

    chatChannel: z.enum(["global", "staff", "testing"]).optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: "At least one field must be provided.",
  });

export const deletePlayerQuerySchema = z
  .object({
    hard: z
      .enum(["true", "false"])
      .optional()
      .transform((value) => value === "true"),
  })
  .strict();

export type PlayerIdParams = z.infer<typeof playerIdParamsSchema>;
export type ListPlayersQuery = z.infer<typeof listPlayersQuerySchema>;
export type CreatePlayerBody = z.infer<typeof createPlayerBodySchema>;
export type UpdatePlayerBody = z.infer<typeof updatePlayerBodySchema>;
export type DeletePlayerQuery = z.infer<typeof deletePlayerQuerySchema>;
