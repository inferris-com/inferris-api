import type { Insertable, Selectable, Updateable } from "kysely";

import type { ArgusAlerts } from "@/db/types.js";
import { int8ToStringOrDefault } from "@/shared/db/int8.js";
import type { ArgusAlertResponse } from "@/module/argus/alert/argus-alert.response-types.js";
import type {
  CreateArgusAlertBody,
  UpdateArgusAlertBody,
} from "@/module/argus/alert/argus-alert.schemas.js";

export function toArgusAlertResponse(alert: Selectable<ArgusAlerts>): ArgusAlertResponse {
  return {
    id: alert.id,
    title: alert.title,
    description: alert.description,
    priority: alert.priority,
    cssClass: alert.css_class,
    isActive: alert.is_active,
    createdAtMs: int8ToStringOrDefault(alert.created_at_ms, "0"),
  };
}

export function toArgusAlertInsert(input: CreateArgusAlertBody): Insertable<ArgusAlerts> {
  return {
    title: input.title,
    description: input.description ?? null,
    priority: input.priority,
    css_class: input.cssClass ?? null,
    is_active: input.isActive,
  };
}

export function toArgusAlertUpdate(input: UpdateArgusAlertBody): Updateable<ArgusAlerts> {
  return {
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.priority !== undefined ? { priority: input.priority } : {}),
    ...(input.cssClass !== undefined ? { css_class: input.cssClass } : {}),
    ...(input.isActive !== undefined ? { is_active: input.isActive } : {}),
  };
}
