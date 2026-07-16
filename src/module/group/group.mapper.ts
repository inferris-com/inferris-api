import type { Selectable } from "kysely";

import type { Groups } from "../../db/types.js";
import type { CreateGroupBody, UpdateGroupBody } from "./group.schemas.js";

export function toGroupResponse(row: Selectable<Groups>) {
  return {
    key: row.key,
    label: row.label,
    priority: row.priority,
    isStaff: row.is_staff,
    createdAtMs: row.created_at_ms,
    updatedAtMs: row.updated_at_ms,
  };
}

export function toGroupInsert(input: CreateGroupBody) {
  return {
    key: input.key,
    label: input.label,
    priority: input.priority,
    is_staff: input.isStaff,
  };
}

export function toGroupUpdate(input: UpdateGroupBody) {
  return {
    ...(input.label !== undefined ? { label: input.label } : {}),
    ...(input.priority !== undefined ? { priority: input.priority } : {}),
    ...(input.isStaff !== undefined ? { is_staff: input.isStaff } : {}),
  };
}
