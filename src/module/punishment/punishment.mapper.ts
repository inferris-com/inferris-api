import type { Selectable } from "kysely";

import type { Punishments } from "../../db/types.js";
import { int8ToString, int8ToStringOrNull } from "../../shared/db/int8.js";
import type { PunishmentResponse } from "./punishment.response-types.js";

export function toPunishmentResponse(row: Selectable<Punishments>): PunishmentResponse {
  return {
    id: row.id,
    subjectActorId: row.subject_actor_id,
    issuerActorId: row.issuer_actor_id,
    serverOriginId: row.server_origin_id,
    type: row.type,
    reason: row.reason,
    isSilent: row.is_silent,
    isActive: row.is_active,
    endsAtMs: int8ToStringOrNull(row.ends_at_ms),
    revokedByActorId: row.revoked_by_actor_id,
    revokedAtMs: int8ToStringOrNull(row.revoked_at_ms),
    revocationReason: row.revocation_reason,
    createdAtMs: int8ToString(row.created_at_ms),
    updatedAtMs: int8ToStringOrNull(row.updated_at_ms),
  };
}
