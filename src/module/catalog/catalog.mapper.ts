import type { Selectable } from "kysely";

import type { Badges, Groups, Ranks } from "@/db/types.js";
import { int8ToStringOrDefault, int8ToStringOrNull } from "@/shared/db/int8.js";
import type {
  BadgeResponse,
  GroupResponse,
  RankResponse,
} from "@/module/catalog/catalog.response-types.js";

export function toGroupResponse(row: Selectable<Groups>): GroupResponse {
  return {
    key: row.key,
    label: row.label,
    priority: row.priority,
    isStaff: row.is_staff,
    createdAtMs: int8ToStringOrDefault(row.created_at_ms, "0"),
    updatedAtMs: int8ToStringOrNull(row.updated_at_ms),
  };
}

export function toRankResponse(row: Selectable<Ranks>): RankResponse {
  return {
    key: row.key,
    groupKey: row.group_key,
    label: row.label,
    description: row.description,
    visuals: row.visuals,
    tier: row.tier,
    isStaff: row.is_staff,
    isActive: row.is_active,
    createdAtMs: int8ToStringOrDefault(row.created_at_ms, "0"),
    updatedAtMs: int8ToStringOrNull(row.updated_at_ms),
  };
}

export function toBadgeResponse(row: Selectable<Badges>): BadgeResponse {
  return {
    id: row.id,
    key: row.key,
    label: row.label,
    description: row.description,
    color: row.color,
    emoji: row.emoji,
    displayOrder: row.display_order,
    isActive: row.is_active,
  };
}
