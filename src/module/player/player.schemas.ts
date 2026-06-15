import z from "zod";
import { BigIntStringSchema, UsernameSchema } from "../../shared/common.schemas.js";

export const playerIdParamsSchema = z.object({
  playerId: z.guid({ message: "Invalid player UUID format." }),
});

export const playerRankAssignmentParamsSchema = playerIdParamsSchema.extend({
  groupKey: z.string().trim().min(1).max(64),
  rankKey: z.string().trim().min(1).max(64),
});

export const playerBadgeAssignmentParamsSchema = playerIdParamsSchema.extend({
  badgeId: z.coerce.number().int().positive(),
});

const flagKeysQuerySchema = z.preprocess(
  (value) => {
    if (Array.isArray(value)) {
      return value.flatMap((item) => String(item).split(","));
    }

    if (typeof value === "string") {
      return value.split(",");
    }

    return value;
  },
  z.array(z.string().trim().min(1).max(64)).min(1),
);

const includeInactiveQuerySchema = z
  .enum(["true", "false"])
  .optional()
  .transform((value) => value === "true");

export const listPlayersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
  username: z.string().trim().min(1).max(32).optional(),
});

export const listPlayerFlagDefinitionsQuerySchema = z
  .object({
    includeInactive: includeInactiveQuerySchema,
  })
  .strict();

export const encodePlayerFlagsQuerySchema = z
  .object({
    flags: flagKeysQuerySchema,
    includeInactive: includeInactiveQuerySchema,
  })
  .strict();

export const decodePlayerFlagsQuerySchema = z
  .object({
    value: BigIntStringSchema.refine((value) => BigInt(value) >= 0n, {
      message: "Flag bitmask value must be non-negative.",
    }),
    includeInactive: includeInactiveQuerySchema,
  })
  .strict();

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
    preferences: z.array(z.string()).optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: "At least one field must be provided.",
  })
  .refine((body) => Object.keys(body.preferences ?? {}).length === 0, {
    message: "Player preferences are not implemented yet.",
  });

export const replacePlayerRankAssignmentBodySchema = z
  .object({
    source: z.string().max(64).nullable().optional(),
    assignedByActorId: z.guid().nullable().optional(),
  })
  .strict();

export const createPlayerBadgeAssignmentBodySchema = z
  .object({
    badgeId: z.int().positive(),
    source: z.string().max(64).nullable().optional(),
  })
  .strict();

export const deletePlayerQuerySchema = z
  .object({
    hard: z
      .enum(["true", "false"])
      .optional()
      .transform((value) => value === "true"),
  })
  .strict();

export type PlayerIdParams = z.infer<typeof playerIdParamsSchema>;
export type PlayerRankAssignmentParams = z.infer<typeof playerRankAssignmentParamsSchema>;
export type PlayerBadgeAssignmentParams = z.infer<typeof playerBadgeAssignmentParamsSchema>;

export type ListPlayersQuery = z.infer<typeof listPlayersQuerySchema>;
export type ListPlayerFlagDefinitionsQuery = z.infer<typeof listPlayerFlagDefinitionsQuerySchema>;
export type EncodePlayerFlagsQuery = z.infer<typeof encodePlayerFlagsQuerySchema>;
export type DecodePlayerFlagsQuery = z.infer<typeof decodePlayerFlagsQuerySchema>;
export type DeletePlayerQuery = z.infer<typeof deletePlayerQuerySchema>;

export type CreatePlayerBody = z.infer<typeof createPlayerBodySchema>;
export type CreatePlayerBadgeAssignmentBody = z.infer<typeof createPlayerBadgeAssignmentBodySchema>;
export type ReplaceRankAssignmentBody = z.infer<typeof replacePlayerRankAssignmentBodySchema>;
export type UpdatePlayerBody = z.infer<typeof updatePlayerBodySchema>;
export type UpdateProfileBody = z.infer<typeof updatePlayerProfileBodySchema>;
