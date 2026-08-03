import type { Selectable } from "kysely";

import type { PrivilegedSubjects } from "@/db/types.js";
import type {
  CreateStaffPrivilegeBody,
  UpdateStaffPrivilegeBody,
} from "@/module/staff-privilege/staff-privilege.schemas.js";
import {
  staffPrivilegeRoleSchema,
  staffPrivilegeStatusSchema,
} from "@/module/staff-privilege/staff-privilege.schemas.js";
import type { StaffPrivilegeResponse } from "@/module/staff-privilege/staff-privilege.response-types.js";

export function toStaffPrivilegeResponse(
  row: Selectable<PrivilegedSubjects>,
): StaffPrivilegeResponse {
  return {
    id: row.id,
    actorId: row.actor_id,
    status: staffPrivilegeStatusSchema.parse(row.status),
    role: staffPrivilegeRoleSchema.parse(row.role),
    title: row.title,
    enrolledByActorId: row.enrolled_by_actor_id,
    revokedByActorId: row.revoked_by_actor_id,
    createdAtMs: row.created_at_ms,
    updatedAtMs: row.updated_at_ms,
  };
}

export function toStaffPrivilegeInsert(
  input: CreateStaffPrivilegeBody,
  enrolledByActorId: string | null,
) {
  return {
    actor_id: input.actorId,
    status: input.status,
    role: input.role,
    title: input.title ?? null,
    enrolled_by_actor_id: enrolledByActorId,
  };
}

export function toStaffPrivilegeUpdate(input: UpdateStaffPrivilegeBody) {
  return {
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.role !== undefined ? { role: input.role } : {}),
    ...(input.title !== undefined ? { title: input.title } : {}),
  };
}
