import { int8ToString, int8ToStringOrNull } from "@/shared/db/int8.js";
import type {
  PlayerBadgeRow,
  PlayerDetailsRecord,
  PlayerNicknameRecord,
  PlayerProfileRow,
  PlayerRankRow,
  PlayerSearchRecord,
  PlayerSummaryRecord,
} from "@/module/player/player.repository.js";
import type {
  PlayerBadgeAssignmentResponse,
  PlayerNicknameResponse,
  PlayerProfileResponse,
  PlayerRankAssignmentResponse,
  PlayerResponse,
  PlayerSearchResultResponse,
  PlayerSummaryResponse,
} from "@/module/player/player.response.types.js";

export function toPlayerSummaryResponse(row: PlayerSummaryRecord): PlayerSummaryResponse {
  return {
    id: row.id,
    mojangId: row.mojang_id,
    actorId: row.actor_id,
    username: row.username,
    flags: int8ToString(row.flags),
    orbs: int8ToString(row.orbs),
    chatChannel: row.active_channel_key,
  };
}

export function toPlayerSearchResultResponse(row: PlayerSearchRecord): PlayerSearchResultResponse {
  return {
    id: row.id,
    mojangId: row.mojang_id,
    actorId: row.actor_id,
    username: row.username,
    deletedAtMs: int8ToStringOrNull(row.deleted_at_ms),
  };
}

export function toPlayerResponse(input: PlayerDetailsRecord): PlayerResponse {
  const { player, profile, rankAssignments, badgeAssignments } = input;

  return {
    id: player.id,
    mojangId: player.mojang_id,
    actorId: player.actor_id,
    username: player.username,
    flags: int8ToString(player.flags),
    orbs: int8ToString(player.orbs),
    chatChannel: player.active_channel_key,

    profile: profile
      ? {
          bio: profile.bio,
          pronouns: profile.pronouns,
          featuredBadgeId: profile.featured_badge_id,
          locale: profile.locale ?? "en_US",
          preferences: profile.preferences,
        }
      : null,

    badges: badgeAssignments.map((assignment) => assignment.badge_id),

    rankAssignments: rankAssignments.map((assignment) => ({
      groupKey: assignment.group_key,
      rankKey: assignment.rank_key,
    })),

    createdAtMs: player.created_at_ms,
    lastSeenAtMs: int8ToStringOrNull(player.last_seen_at_ms),
    lastServerId: player.last_server_id,
  };
}

export function toPlayerProfileResponse(input: PlayerProfileRow): PlayerProfileResponse {
  return {
    playerId: input.player_id,
    bio: input.bio,
    pronouns: input.pronouns,
    featuredBadgeId: input.featured_badge_id,
    locale: input.locale,
    preferences: input.preferences,
  };
}

export function toPlayerRankAssignmentResponse(input: PlayerRankRow): PlayerRankAssignmentResponse {
  return {
    playerId: input.player_id,
    groupKey: input.group_key,
    rankKey: input.rank_key,
    assignedAtMs: int8ToString(input.assigned_at_ms),
    assignedByActorId: input.assigned_by_actor_id,
    source: input.source,
  };
}

export function toPlayerBadgeAssignmentResponse(
  input: PlayerBadgeRow,
): PlayerBadgeAssignmentResponse {
  return {
    playerId: input.player_id,
    badgeId: input.badge_id,
    earnedAtMs: int8ToString(input.earned_at_ms),
    source: input.source,
  };
}

export function toPlayerNicknameResponse(input: PlayerNicknameRecord): PlayerNicknameResponse {
  return {
    id: input.id,
    playerId: input.player_id,
    nickname: input.nickname,
    coverRankKey: input.cover_rank_key,
    meta: input.meta,
    isActive: input.is_active,
    revokedByActorId: input.revoked_by_actor_id,
    createdAtMs: int8ToString(input.created_at_ms),
    revokedAtMs: int8ToStringOrNull(input.revoked_at_ms),
  };
}
