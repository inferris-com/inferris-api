import type { Kysely } from "kysely";

import type { DB } from "../../db/types.js";
import type { PaginatedResult } from "../../shared/pagination.schemas.js";
import type { BackendSessionRow, PlayerSessionRow } from "./player-session.mapper.js";
import type { ListPlayerSessionsQuery } from "./player-session.schemas.js";

export class PlayerSessionPgRepository {
  constructor(private readonly db: Kysely<DB>) {}

  async listSessions(
    query: ListPlayerSessionsQuery,
  ): Promise<
    PaginatedResult<{ session: PlayerSessionRow; backendSessions: BackendSessionRow[] | null }>
  > {
    const baseQuery = this.db
      .selectFrom("network_sessions")
      .innerJoin("players", "players.id", "network_sessions.player_id")
      .innerJoin(
        "servers as proxy_servers",
        "proxy_servers.id",
        "network_sessions.proxy_server_id",
      )
      .leftJoin("network_sessions_current", (join) =>
        join.onRef(
          "network_sessions_current.network_session_id",
          "=",
          "network_sessions.id",
        ),
      )
      .leftJoin(
        "backend_sessions_current",
        "backend_sessions_current.network_session_id",
        "network_sessions.id",
      )
      .leftJoin(
        "servers as backend_servers",
        "backend_servers.id",
        "backend_sessions_current.backend_server_id",
      )
      .$if(query.playerId !== undefined, (qb) =>
        qb.where("network_sessions.player_id", "=", query.playerId ?? ""),
      )
      .$if(query.proxyServerId !== undefined, (qb) =>
        qb.where("network_sessions.proxy_server_id", "=", query.proxyServerId ?? ""),
      )
      .$if(query.backendServerId !== undefined, (qb) =>
        qb.where((eb) =>
          eb.exists(
            eb
              .selectFrom("backend_sessions")
              .select("backend_sessions.id")
              .whereRef("backend_sessions.network_session_id", "=", "network_sessions.id")
              .where("backend_sessions.backend_server_id", "=", query.backendServerId ?? ""),
          ),
        ),
      )
      .$if(query.serverId !== undefined, (qb) =>
        qb.where((eb) =>
          eb.or([
            eb("network_sessions.proxy_server_id", "=", query.serverId ?? ""),
            eb("backend_sessions_current.backend_server_id", "=", query.serverId ?? ""),
          ]),
        ),
      )
      .$if(query.state === "active", (qb) =>
        qb.where("network_sessions.disconnected_at_ms", "is", null),
      )
      .$if(query.state === "completed", (qb) =>
        qb.where("network_sessions.disconnected_at_ms", "is not", null),
      )
      .$if(query.fromMs !== undefined, (qb) =>
        qb.where((eb) =>
          eb.or([
            eb("network_sessions.disconnected_at_ms", "is", null),
            eb("network_sessions.disconnected_at_ms", ">=", query.fromMs ?? ""),
          ]),
        ),
      )
      .$if(query.toMs !== undefined, (qb) =>
        qb.where("network_sessions.connected_at_ms", "<=", query.toMs ?? ""),
      );

    const [rows, totalRow] = await Promise.all([
      baseQuery
        .select([
          "network_sessions.id",
          "network_sessions.player_id",
          "players.username as player_username",
          "players.mojang_id as player_mojang_id",
          "players.actor_id",
          "network_sessions.proxy_server_id",
          "proxy_servers.name as proxy_server_name",
          "network_sessions_current.network_session_id as current_network_session_id",
          "backend_sessions_current.backend_server_id as current_backend_server_id",
          "backend_servers.name as current_backend_server_name",
          "backend_sessions_current.backend_session_id as current_backend_session_id",
          "network_sessions.connected_at_ms",
          "network_sessions.disconnected_at_ms",
          "network_sessions.disconnect_reason",
          "network_sessions.meta",
          "network_sessions.updated_at_ms",
        ])
        .orderBy("network_sessions.connected_at_ms", "desc")
        .limit(query.limit)
        .offset(query.offset)
        .execute(),
      baseQuery.select((eb) => eb.fn.countAll<string>().as("total")).executeTakeFirstOrThrow(),
    ]);

    const backendSessions =
      query.include === "backendSessions"
        ? await this.listBackendSessionsForNetworkSessions(rows.map((row) => row.id))
        : null;

    return {
      rows: rows.map((session) => ({
        session,
        backendSessions:
          backendSessions?.filter((visit) => visit.network_session_id === session.id) ?? null,
      })),
      total: Number(totalRow.total),
      limit: query.limit,
      offset: query.offset,
    };
  }

  async findSessionById(
    sessionId: string,
    includeBackendSessions = false,
  ): Promise<{ session: PlayerSessionRow; backendSessions: BackendSessionRow[] | null } | null> {
    const session =
      (await this.db
        .selectFrom("network_sessions")
        .innerJoin("players", "players.id", "network_sessions.player_id")
        .innerJoin(
          "servers as proxy_servers",
          "proxy_servers.id",
          "network_sessions.proxy_server_id",
        )
        .leftJoin("network_sessions_current", (join) =>
          join.onRef(
            "network_sessions_current.network_session_id",
            "=",
            "network_sessions.id",
          ),
        )
        .leftJoin(
          "backend_sessions_current",
          "backend_sessions_current.network_session_id",
          "network_sessions.id",
        )
        .leftJoin(
          "servers as backend_servers",
          "backend_servers.id",
          "backend_sessions_current.backend_server_id",
        )
        .select([
          "network_sessions.id",
          "network_sessions.player_id",
          "players.username as player_username",
          "players.mojang_id as player_mojang_id",
          "players.actor_id",
          "network_sessions.proxy_server_id",
          "proxy_servers.name as proxy_server_name",
          "network_sessions_current.network_session_id as current_network_session_id",
          "backend_sessions_current.backend_server_id as current_backend_server_id",
          "backend_servers.name as current_backend_server_name",
          "backend_sessions_current.backend_session_id as current_backend_session_id",
          "network_sessions.connected_at_ms",
          "network_sessions.disconnected_at_ms",
          "network_sessions.disconnect_reason",
          "network_sessions.meta",
          "network_sessions.updated_at_ms",
        ])
        .where("network_sessions.id", "=", sessionId)
        .executeTakeFirst()) ?? null;

    if (!session) {
      return null;
    }

    return {
      session,
      backendSessions: includeBackendSessions
        ? await this.listBackendSessionsForNetworkSessions([sessionId])
        : null,
    };
  }

  private async listBackendSessionsForNetworkSessions(
    networkSessionIds: string[],
  ): Promise<BackendSessionRow[]> {
    if (networkSessionIds.length === 0) {
      return [];
    }

    return this.db
      .selectFrom("backend_sessions")
      .innerJoin("servers as backend_servers", "backend_servers.id", "backend_sessions.backend_server_id")
      .leftJoin("backend_sessions_current", (join) =>
        join.onRef("backend_sessions_current.backend_session_id", "=", "backend_sessions.id"),
      )
      .select([
        "backend_sessions.id",
        "backend_sessions.network_session_id",
        "backend_sessions.backend_server_id",
        "backend_servers.name as backend_server_name",
        "backend_sessions.backend_server_instance_id",
        "backend_sessions_current.backend_session_id as current_backend_session_id",
        "backend_sessions.joined_at_ms",
        "backend_sessions.left_at_ms",
        "backend_sessions.leave_reason",
        "backend_sessions.meta",
        "backend_sessions.updated_at_ms",
      ])
      .where("backend_sessions.network_session_id", "in", networkSessionIds)
      .orderBy("backend_sessions.joined_at_ms", "asc")
      .execute();
  }
}
