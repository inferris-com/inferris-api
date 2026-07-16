import type { Json } from "../../db/types.js";
import type { PlayerSessionResponse } from "./player-session.response-types.js";

export type PlayerSessionRow = {
  id: string;
  player_id: string;
  player_username: string;
  player_mojang_id: string;
  actor_id: string;
  server_id: string;
  server_name: string;
  current_session_event_id: string | null;
  connected_at_ms: string;
  disconnected_at_ms: string | null;
  disconnect_reason: string | null;
  meta: Json;
  updated_at_ms: string | null;
};

export function toPlayerSessionResponse(row: PlayerSessionRow): PlayerSessionResponse {
  return {
    id: row.id,
    playerId: row.player_id,
    playerUsername: row.player_username,
    playerMojangId: row.player_mojang_id,
    actorId: row.actor_id,
    serverId: row.server_id,
    serverName: row.server_name,
    isLive: row.current_session_event_id !== null,
    connectedAtMs: row.connected_at_ms,
    disconnectedAtMs: row.disconnected_at_ms,
    disconnectReason: row.disconnect_reason,
    meta: row.meta,
    updatedAtMs: row.updated_at_ms,
  };
}
