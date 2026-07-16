import type { Selectable } from "kysely";

import type { Json, Ranks } from "../../db/types.js";
import type { CreateRankBody, UpdateRankBody } from "./rank.schemas.js";

export function toRankResponse(row: Selectable<Ranks>) {
  return {
    key: row.key,
    groupKey: row.group_key,
    label: row.label,
    description: row.description,
    visuals: row.visuals,
    tier: row.tier,
    isStaff: row.is_staff,
    isActive: row.is_active,
    createdAtMs: row.created_at_ms,
    updatedAtMs: row.updated_at_ms,
  };
}

export function toRankInsert(input: CreateRankBody) {
  return {
    key: input.key,
    group_key: input.groupKey ?? null,
    label: input.label,
    description: input.description ?? null,
    visuals: input.visuals as Json,
    tier: input.tier,
    is_staff: input.isStaff,
    is_active: input.isActive,
  };
}

export function toRankUpdate(input: UpdateRankBody) {
  return {
    ...(input.groupKey !== undefined ? { group_key: input.groupKey } : {}),
    ...(input.label !== undefined ? { label: input.label } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.visuals !== undefined ? { visuals: input.visuals as Json } : {}),
    ...(input.tier !== undefined ? { tier: input.tier } : {}),
    ...(input.isStaff !== undefined ? { is_staff: input.isStaff } : {}),
    ...(input.isActive !== undefined ? { is_active: input.isActive } : {}),
  };
}
