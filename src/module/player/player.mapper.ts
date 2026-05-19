import type { Selectable } from "kysely";
import type { PlayerBadges, PlayerProfiles, PlayerRanks, Players } from "../../db/types.js";
import type { PlayerResponse, PlayerSummaryResponse } from "./player.response.types.js";
import { int8ToString, int8ToStringOrDefault } from "../../shared/db/int8.js";

type PlayerBase = Pick<
  Selectable<Players>,
  | "id"
  | "username"
  | "flags"
  | "orbs"
  | "chat_channel"
  | "last_server_id"
  | "created_at_ms"
  | "last_seen_at_ms"
>;

type PlayerProfileBase = Pick<
  Selectable<PlayerProfiles>,
  "bio" | "pronouns" | "featured_badge_id" | "locale" | "preferences"
>;

type PlayerRankAssignmentBase = Pick<Selectable<PlayerRanks>, "group_key" | "rank_key">;

type PlayerBadgeAssignmentBase = Pick<Selectable<PlayerBadges>, "badge_id">;

type PlayerSummaryRow = Pick<
  Selectable<Players>,
  "id" | "username" | "flags" | "orbs" | "chat_channel"
>;

export function toPlayerSummaryResponse(row: PlayerSummaryRow): PlayerSummaryResponse {
  return {
    id: row.id,
    username: row.username,
    flags: int8ToStringOrDefault(row.flags, "0"),
    orbs: int8ToStringOrDefault(row.orbs, "0"),
    chatChannel: row.chat_channel ?? "global",
  };
}

export function toPlayerResponse(input: {
  player: PlayerBase;
  profile: PlayerProfileBase | null;
  rankAssignments: PlayerRankAssignmentBase[];
  badgeAssignments: PlayerBadgeAssignmentBase[];
}): PlayerResponse {
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
