import type { Kysely } from "kysely";

import type { DB } from "@/db/types.js";
import type { ActorSummaryResponse } from "@/module/actor/actor.response.types.js";

// List projections need labels and links, not player profiles, ranks, or badges.
export async function loadActorSummaries(
  db: Kysely<DB>,
  actorIds: string[],
): Promise<Map<string, ActorSummaryResponse>> {
  const ids = [...new Set(actorIds)];
  if (ids.length === 0) return new Map();

  const rows = await db
    .selectFrom("actors")
    .leftJoin("players", (join) =>
      join.onRef("players.actor_id", "=", "actors.id").on("players.deleted_at_ms", "is", null),
    )
    .leftJoin("player_nicknames as active_nicknames", (join) =>
      join
        .onRef("active_nicknames.player_id", "=", "players.id")
        .on("active_nicknames.is_active", "=", true),
    )
    .select([
      "actors.id",
      "actors.name",
      "actors.type",
      "players.id as player_id",
      "players.username as player_username",
      "active_nicknames.nickname as active_nickname",
      "active_nicknames.cover_rank_key as active_nickname_cover_rank_key",
    ])
    .where("actors.id", "in", ids)
    .execute();

  return new Map(
    rows.map((row) => [
      row.id,
      {
        id: row.id,
        name: row.name,
        type: row.type,
        player:
          row.player_id && row.player_username !== null
            ? {
                id: row.player_id,
                username: row.player_username,
                activeNickname:
                  row.active_nickname === null
                    ? null
                    : {
                        nickname: row.active_nickname,
                        coverRankKey: row.active_nickname_cover_rank_key,
                      },
              }
            : null,
      },
    ]),
  );
}
