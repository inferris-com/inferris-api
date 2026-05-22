import type { Selectable } from "kysely";
import type { Actors } from "../../db/types.js";
import type { ActorResponse } from "./actor.response.types.js";

export function toActorResponse(actor: Selectable<Actors>): ActorResponse {
  return {
    id: actor.id,
    name: actor.name,
    type: actor.type,
    playerId: actor.player_id,
    createdAtMs: actor.created_at_ms,
    lastUpdatedAtMs: actor.last_updated_at_ms,
  };
}
