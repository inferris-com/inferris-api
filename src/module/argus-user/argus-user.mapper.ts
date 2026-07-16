import type { Selectable } from "kysely";

import type { ArgusUsers } from "../../db/types.js";
import type { CreateArgusUserBody, UpdateArgusUserBody } from "./argus-user.schemas.js";

export function toArgusUserResponse(row: Selectable<ArgusUsers>) {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    role: row.role,
    actorId: row.actor_id,
    accountState: row.account_state,
    createdAtMs: row.created_at_ms,
    updatedAtMs: row.updated_at_ms,
  };
}

export function toArgusUserInsert(input: CreateArgusUserBody, passwordHash: string | null) {
  return {
    username: input.username,
    email: input.email,
    password_hash: passwordHash,
    role: input.role,
    actor_id: input.actorId ?? null,
    account_state: input.accountState,
  };
}

export function toArgusUserUpdate(input: UpdateArgusUserBody) {
  return {
    ...(input.username !== undefined ? { username: input.username } : {}),
    ...(input.email !== undefined ? { email: input.email } : {}),
    ...(input.role !== undefined ? { role: input.role } : {}),
    ...(input.actorId !== undefined ? { actor_id: input.actorId } : {}),
    ...(input.accountState !== undefined ? { account_state: input.accountState } : {}),
  };
}
