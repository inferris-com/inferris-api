import type { Kysely } from "kysely";

import type { DB } from "../../db/types.js";
import type { PaginatedResult } from "../../shared/pagination.schemas.js";
import type { PlayerSessionRow } from "./player-session.mapper.js";
import type { ListPlayerSessionsQuery } from "./player-session.schemas.js";

export class PlayerSessionPgRepository {
  constructor(private readonly db: Kysely<DB>) {}

  async listSessions(query: ListPlayerSessionsQuery): Promise<PaginatedResult<PlayerSessionRow>> {
    const baseQuery = this.db
      .selectFrom("player_session_events")
      .innerJoin("players", "players.id", "player_session_events.player_id")
      .innerJoin("servers", "servers.id", "player_session_events.server_id")
      .leftJoin("player_sessions_current", (join) =>
        join.onRef(
          "player_sessions_current.session_event_id",
          "=",
          "player_session_events.id",
        ),
      )
      .$if(query.playerId !== undefined, (qb) =>
        qb.where("player_session_events.player_id", "=", query.playerId ?? ""),
      )
      .$if(query.serverId !== undefined, (qb) =>
        qb.where("player_session_events.server_id", "=", query.serverId ?? ""),
      )
      .$if(query.state === "live", (qb) =>
        qb.where("player_session_events.disconnected_at_ms", "is", null),
      )
      .$if(query.state === "historical", (qb) =>
        qb.where("player_session_events.disconnected_at_ms", "is not", null),
      );

    const [rows, totalRow] = await Promise.all([
      baseQuery
        .select([
          "player_session_events.id",
          "player_session_events.player_id",
          "players.username as player_username",
          "players.mojang_id as player_mojang_id",
          "players.actor_id",
          "player_session_events.server_id",
          "servers.name as server_name",
          "player_sessions_current.session_event_id as current_session_event_id",
          "player_session_events.connected_at_ms",
          "player_session_events.disconnected_at_ms",
          "player_session_events.disconnect_reason",
          "player_session_events.meta",
          "player_session_events.updated_at_ms",
        ])
        .orderBy("player_session_events.connected_at_ms", "desc")
        .limit(query.limit)
        .offset(query.offset)
        .execute(),
      baseQuery
        .select((eb) => eb.fn.countAll<string>().as("total"))
        .executeTakeFirstOrThrow(),
    ]);

    return {
      rows,
      total: Number(totalRow.total),
      limit: query.limit,
      offset: query.offset,
    };
  }

  async findSessionById(sessionId: string): Promise<PlayerSessionRow | null> {
    return (
      (await this.db
        .selectFrom("player_session_events")
        .innerJoin("players", "players.id", "player_session_events.player_id")
        .innerJoin("servers", "servers.id", "player_session_events.server_id")
        .leftJoin("player_sessions_current", (join) =>
          join.onRef(
            "player_sessions_current.session_event_id",
            "=",
            "player_session_events.id",
          ),
        )
        .select([
          "player_session_events.id",
          "player_session_events.player_id",
          "players.username as player_username",
          "players.mojang_id as player_mojang_id",
          "players.actor_id",
          "player_session_events.server_id",
          "servers.name as server_name",
          "player_sessions_current.session_event_id as current_session_event_id",
          "player_session_events.connected_at_ms",
          "player_session_events.disconnected_at_ms",
          "player_session_events.disconnect_reason",
          "player_session_events.meta",
          "player_session_events.updated_at_ms",
        ])
        .where("player_session_events.id", "=", sessionId)
        .executeTakeFirst()) ?? null
    );
  }
}
