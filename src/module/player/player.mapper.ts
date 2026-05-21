import { int8ToString, int8ToStringOrDefault } from "../../shared/db/int8.js";
import type { PlayerDetailsRecord, PlayerSummaryRecord } from "./player.repository.js";
import type { PlayerResponse, PlayerSummaryResponse } from "./player.response.types.js";

export function toPlayerSummaryResponse(row: PlayerSummaryRecord): PlayerSummaryResponse {
  return {
    id: row.id,
    username: row.username,
    flags: int8ToStringOrDefault(row.flags, "0"),
    orbs: int8ToStringOrDefault(row.orbs, "0"),
    chatChannel: row.chat_channel ?? "global",
  };
}

export function toPlayerResponse(input: PlayerDetailsRecord): PlayerResponse {
  const { player, profile, rankAssignments, badgeAssignments } = input;

  return {
    id: player.id,
    username: player.username,
    flags: int8ToStringOrDefault(player.flags, "0"),
    orbs: int8ToStringOrDefault(player.orbs, "0"),
    chatChannel: player.chat_channel ?? "global",

    profile: profile
      ? {
          bio: profile.bio,
          pronouns: profile.pronouns,
          badges: badgeAssignments.map((assignment) => assignment.badge_id),
          featuredBadgeId: profile.featured_badge_id,
          locale: profile.locale ?? "en_US",
          preferences: profile.preferences,
        }
      : null,

    rankAssignments: rankAssignments.map((assignment) => ({
      groupKey: assignment.group_key,
      rankKey: assignment.rank_key,
    })),

    createdAtMs: int8ToStringOrDefault(player.created_at_ms, "0"),
    lastSeenAtMs: int8ToString(player.last_seen_at_ms),
    lastServerId: player.last_server_id,
  };
}
