import type { Selectable } from "kysely";
import type { Actors } from "../../db/types.js";
import type { ActorResponse } from "./actor.response.types.js";

export function toActorResponse(actor: Selectable<Actors>): ActorResponse {
  const actorWithPlayer = actor as Selectable<Actors> & { player_id?: string | null };

  return {
    id: actor.id,
    name: actor.name,
    type: actor.type,
    playerId: actorWithPlayer.player_id ?? null,
    createdAtMs: actor.created_at_ms,
    lastUpdatedAtMs: actor.last_updated_at_ms,
  };
}
