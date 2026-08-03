import type { Selectable } from "kysely";

import type { Badges } from "@/db/types.js";
import type { CreateBadgeBody, UpdateBadgeBody } from "@/module/badge/badge.schemas.js";

export function toBadgeResponse(row: Selectable<Badges>) {
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

export function toBadgeInsert(input: CreateBadgeBody) {
  return {
    key: input.key,
    label: input.label,
    description: input.description ?? null,
    color: input.color ?? null,
    emoji: input.emoji ?? null,
    display_order: input.displayOrder,
    is_active: input.isActive,
  };
}

export function toBadgeUpdate(input: UpdateBadgeBody) {
  return {
    ...(input.key !== undefined ? { key: input.key } : {}),
    ...(input.label !== undefined ? { label: input.label } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.color !== undefined ? { color: input.color } : {}),
    ...(input.emoji !== undefined ? { emoji: input.emoji } : {}),
    ...(input.displayOrder !== undefined ? { display_order: input.displayOrder } : {}),
    ...(input.isActive !== undefined ? { is_active: input.isActive } : {}),
  };
}
