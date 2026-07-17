import type { Json } from "../../db/types.js";
import type { BackendSessionSummary, PlayerSessionResponse } from "./player-session.response-types.js";

export type PlayerSessionRow = {
  id: string;
  player_id: string;
  player_username: string;
  player_mojang_id: string;
  actor_id: string;
  proxy_server_id: string;
  proxy_server_name: string;
  current_network_session_id: string | null;
  current_backend_server_id: string | null;
  current_backend_server_name: string | null;
  current_backend_session_id: string | null;
  connected_at_ms: string;
  disconnected_at_ms: string | null;
  disconnect_reason: string | null;
  meta: Json;
  updated_at_ms: string | null;
};

export type BackendSessionRow = {
  id: string;
  network_session_id: string;
  backend_server_id: string;
  backend_server_name: string;
  backend_server_instance_id: string | null;
  current_backend_session_id: string | null;
  joined_at_ms: string;
  left_at_ms: string | null;
  leave_reason: string | null;
  meta: Json;
  updated_at_ms: string | null;
};

function toBackendSessionSummary(row: BackendSessionRow): BackendSessionSummary {
  return {
    id: row.id,
    backendServerId: row.backend_server_id,
    backendServerName: row.backend_server_name,
    backendServerInstanceId: row.backend_server_instance_id,
    isActive: row.current_backend_session_id !== null,
    joinedAtMs: row.joined_at_ms,
    leftAtMs: row.left_at_ms,
    leaveReason: row.leave_reason,
    meta: row.meta,
    updatedAtMs: row.updated_at_ms,
  };
}

export function toPlayerSessionResponse(
  row: PlayerSessionRow,
  backendRows: BackendSessionRow[] = [],
  includeBackendSessions = false,
): PlayerSessionResponse {
  const response: PlayerSessionResponse = {
    id: row.id,
    playerId: row.player_id,
    playerUsername: row.player_username,
    playerMojangId: row.player_mojang_id,
    actorId: row.actor_id,
    proxyServerId: row.proxy_server_id,
    proxyServerName: row.proxy_server_name,
    currentBackendServerId: row.current_backend_server_id,
    currentBackendServerName: row.current_backend_server_name,
    currentBackendSessionId: row.current_backend_session_id,
    isLive: row.current_network_session_id !== null,
    connectedAtMs: row.connected_at_ms,
    disconnectedAtMs: row.disconnected_at_ms,
    disconnectReason: row.disconnect_reason,
    meta: row.meta,
    updatedAtMs: row.updated_at_ms,
  };

  if (includeBackendSessions) {
    response.backendSessions = backendRows.map(toBackendSessionSummary);
  }

  return response;
}
