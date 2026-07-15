import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import z from "zod";

extendZodWithOpenApi(z);

export const playerNicknameSummaryResponseSchema = z
  .object({
    nickname: z.string(),
    coverRankKey: z.string().nullable(),
  })
  .openapi("PlayerNicknameSummaryResponse");

export const playerRankSummaryResponseSchema = z
  .object({
    groupKey: z.string(),
    rankKey: z.string(),
  })
  .openapi("PlayerRankSummaryResponse");

export const playerProfileEmbeddedResponseSchema = z
  .object({
    bio: z.string().nullable(),
    pronouns: z.string().nullable(),
    featuredBadgeId: z.number().int().nullable(),
    locale: z.string(),
    preferences: z.unknown(),
  })
  .openapi("PlayerProfileEmbeddedResponse");

export const playerSummaryResponseSchema = z
  .object({
    id: z.string().uuid(),
    mojangId: z.string().uuid(),
    actorId: z.string().uuid(),
    username: z.string(),
    activeNickname: playerNicknameSummaryResponseSchema.nullable(),
    flags: z.string(),
    orbs: z.string(),
    chatChannel: z.string(),
  })
  .openapi("PlayerSummaryResponse");

export const playerFlagDefinitionResponseSchema = z
  .object({
    key: z.string(),
    bitPosition: z.number().int(),
    bitValue: z.string(),
    label: z.string(),
    description: z.string().nullable(),
    isActive: z.boolean(),
  })
  .openapi("PlayerFlagDefinitionResponse");

export const playerFlagBitmaskResponseSchema = z
  .object({
    value: z.string(),
    binary: z.string(),
    flags: z.array(playerFlagDefinitionResponseSchema),
    unknownBits: z.array(z.string()),
  })
  .openapi("PlayerFlagBitmaskResponse");

export const playerResponseSchema = z
  .object({
    id: z.string().uuid(),
    mojangId: z.string().uuid(),
    actorId: z.string().uuid(),
    username: z.string(),
    activeNickname: playerNicknameSummaryResponseSchema.optional(),
    flags: z.string(),
    orbs: z.string(),
    chatChannel: z.string(),
    profile: playerProfileEmbeddedResponseSchema.nullable(),
    badges: z.array(z.number().int()),
    rankAssignments: z.array(playerRankSummaryResponseSchema),
    createdAtMs: z.string(),
    lastSeenAtMs: z.string().nullable(),
    lastServerId: z.string().uuid().nullable(),
  })
  .openapi("PlayerResponse");

export const playerProfileResponseSchema = z
  .object({
    playerId: z.string().uuid(),
    bio: z.string().nullable(),
    pronouns: z.string().nullable(),
    featuredBadgeId: z.number().int().nullable(),
    locale: z.string(),
    preferences: z.unknown(),
  })
  .openapi("PlayerProfileResponse");

export const playerRankAssignmentResponseSchema = z
  .object({
    playerId: z.string().uuid(),
    groupKey: z.string(),
    rankKey: z.string(),
    assignedAtMs: z.string(),
    assignedByActorId: z.string().uuid().nullable(),
    source: z.string().nullable(),
  })
  .openapi("PlayerRankAssignmentResponse");

export const playerBadgeAssignmentResponseSchema = z
  .object({
    playerId: z.string().uuid(),
    badgeId: z.number().int(),
    earnedAtMs: z.string(),
    source: z.string().nullable(),
  })
  .openapi("PlayerBadgeAssignmentResponse");

export const playerNicknameResponseSchema = z
  .object({
    id: z.number().int(),
    playerId: z.string().uuid(),
    nickname: z.string(),
    coverRankKey: z.string().nullable(),
    meta: z.unknown(),
    isActive: z.boolean(),
    revokedByActorId: z.string().uuid().nullable(),
    createdAtMs: z.string(),
    revokedAtMs: z.string().nullable(),
  })
  .openapi("PlayerNicknameResponse");

export type ChatChannel = string;
export type PlayerSummaryResponse = z.infer<typeof playerSummaryResponseSchema>;
export type PlayerFlagDefinitionResponse = z.infer<typeof playerFlagDefinitionResponseSchema>;
export type PlayerFlagBitmaskResponse = z.infer<typeof playerFlagBitmaskResponseSchema>;
export type PlayerResponse = z.infer<typeof playerResponseSchema>;
export type PlayerProfileResponse = z.infer<typeof playerProfileResponseSchema>;
export type PlayerRankAssignmentResponse = z.infer<typeof playerRankAssignmentResponseSchema>;
export type PlayerBadgeAssignmentResponse = z.infer<typeof playerBadgeAssignmentResponseSchema>;
export type PlayerNicknameSummaryResponse = z.infer<typeof playerNicknameSummaryResponseSchema>;
export type PlayerNicknameResponse = z.infer<typeof playerNicknameResponseSchema>;
