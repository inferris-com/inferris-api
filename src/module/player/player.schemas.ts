import z from "zod";
import { BigIntStringSchema, UsernameSchema } from "../../shared/common.schemas.js";

export const playerIdParamsSchema = z.object({
  playerId: z.guid({ message: "Invalid player UUID format." }),
});

export const groupKeyParamsSchema = z.object({
  groupKey: z.guid({ message: "Invalid group UUID format." }),
})

export const rankKeyParamsSchema = z.object({
  rankKey: z.guid({ message: "Invalid rank UUID format." }),
})

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

export const updatePlayerProfileBodySchema = z
  .object({
    bio: z.string().max(500).optional().nullable(),
    pronouns: z.string().max(16).optional().nullable(),
    featured_badge_id: z.int().optional().nullable(),
    locale: z.string().max(9).optional(),
    // Non-implemented, but allow to exist
    preferences: z.array(z.string()).optional()
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: "At least one field must be provided.",
  })
  .refine((body) => Object.keys(body.preferences ?? {}).length === 0, {
    message: "Player preferences are not implemented yet.",
  })

export const replacePlayerRankAssignmentBodySchema = z
  .object({
    groupKey: z.string().nonempty(),
    rankKey: z.string().nonempty(),

    source: z.string().nullable(),
    // We shouldn't make actor id null for `PUT`, but DB column can be null
    assignedByActorId: z.string()
  })

export const deletePlayerQuerySchema = z
  .object({
    hard: z
      .enum(["true", "false"])
      .optional()
      .transform((value) => value === "true"),
  })
  .strict();

export type PlayerIdParams = z.infer<typeof playerIdParamsSchema>;
export type GroupKeyParams = z.infer<typeof groupKeyParamsSchema>;
export type RankKeyParams = z.infer<typeof rankKeyParamsSchema>;

export type ListPlayersQuery = z.infer<typeof listPlayersQuerySchema>;
export type DeletePlayerQuery = z.infer<typeof deletePlayerQuerySchema>;

export type CreatePlayerBody = z.infer<typeof createPlayerBodySchema>;
export type ReplaceRankAssignmentBody = z.infer<typeof replacePlayerRankAssignmentBodySchema>;
export type UpdatePlayerBody = z.infer<typeof updatePlayerBodySchema>;
export type UpdateProfileBody = z.infer<typeof updatePlayerProfileBodySchema>;
