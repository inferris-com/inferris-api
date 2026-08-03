import type { Selectable } from "kysely";

import type { Punishments } from "@/db/types.js";
import { int8ToString, int8ToStringOrNull } from "@/shared/db/int8.js";
import type { PunishmentResponse } from "@/module/punishment/punishment.response-types.js";

export function toPunishmentResponse(row: Selectable<Punishments>): PunishmentResponse {
  const isEffectivelyActive = isPunishmentEffectivelyActive(row);
  const isEffectivelyExpired = isPunishmentEffectivelyExpired(row);

  return {
    id: row.id,
    code: row.code,
    subjectActorId: row.subject_actor_id,
    issuerActorId: row.issuer_actor_id,
    serverOriginId: row.server_origin_id,
    type: row.type,
    reason: row.reason,
    isSilent: row.is_silent,
    isActive: isEffectivelyActive,
    endsAtMs: int8ToStringOrNull(row.ends_at_ms),
    note: row.note,
    liftedCause: row.lifted_cause ?? (isEffectivelyExpired ? "expired" : null),
    liftedAtMs: int8ToStringOrNull(row.lifted_at_ms),
    liftedByActorId: row.lifted_by_actor_id,
    liftNote: row.lift_note,
    createdAtMs: int8ToString(row.created_at_ms),
    updatedAtMs: int8ToStringOrNull(row.updated_at_ms),
  };
}

function isPunishmentEffectivelyActive(row: Selectable<Punishments>): boolean {
  return (
    row.is_active &&
    (row.type === "ban" || row.type === "mute") &&
    row.lifted_cause === null &&
    !isPunishmentEffectivelyExpired(row)
  );
}

function isPunishmentEffectivelyExpired(row: Selectable<Punishments>): boolean {
  return (
    row.is_active &&
    (row.type === "ban" || row.type === "mute") &&
    row.lifted_cause === null &&
    row.ends_at_ms !== null &&
    BigInt(row.ends_at_ms) <= BigInt(Date.now())
  );
}
