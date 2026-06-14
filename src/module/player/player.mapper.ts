import { int8ToStringOrNull, int8ToStringOrDefault, int8ToString } from "../../shared/db/int8.js";
import type {
  PlayerBadgeRow,
  PlayerDetailsRecord,
  PlayerProfileRow,
  PlayerRankRow,
  PlayerSummaryRecord,
} from "./player.repository.js";
import type {
  PlayerBadgeAssignmentResponse,
  PlayerProfileResponse,
  PlayerRankAssignmentResponse,
  PlayerResponse,
  PlayerSummaryResponse,
} from "./player.response.types.js";

export function toPlayerSummaryResponse(row: PlayerSummaryRecord): PlayerSummaryResponse {
  return {
    id: row.id,
    username: row.username,
    flags: int8ToStringOrDefault(row.flags, "0"),
    orbs: int8ToStringOrDefault(row.orbs, "0"),
    chatChannel: row.active_channel_key,
  };
}

export function toPlayerResponse(input: PlayerDetailsRecord): PlayerResponse {
  const { player, profile, rankAssignments, badgeAssignments } = input;

  return {
    id: player.id,
    username: player.username,
    flags: int8ToStringOrDefault(player.flags, "0"),
    orbs: int8ToStringOrDefault(player.orbs, "0"),
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

    createdAtMs: int8ToStringOrDefault(player.created_at_ms, "0"),
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
