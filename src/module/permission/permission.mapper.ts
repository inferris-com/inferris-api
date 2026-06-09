import type { PermissionNodes, PermissionRules } from "../../db/types.js";
import type {
  PermissionNodeResponse,
  PermissionRuleResponse,
} from "./permission.response-types.js";
import type {ReplacePermissionRuleBody} from "./permission.schemas.js";
import type {Selectable, Updateable} from "kysely";

export function toPermissionNodeResponse(row: Selectable<PermissionNodes>): PermissionNodeResponse {
  return {
    id: row.id,
    key: row.key,
    description: row.description,
    isActive: row.is_active,
    createdAtMs: row.created_at_ms,
    updatedAtMs: row.updated_at_ms
  }
}
export function toPermissionRuleResponse(row: Selectable<PermissionRules>): PermissionRuleResponse {
  return {
    id: row.id,
    permissionId: row.permission_id,
    minRankKey: row.min_rank_key,
    effect: row.effect,
    priority: row.priority,
    createdAtMs: row.created_at_ms,
    updatedAtMs: row.updated_at_ms
  }
}

// Database rows
export function toPermissionRuleUpdate(input: ReplacePermissionRuleBody): Updateable<PermissionRules> {
  return {
    permission_id: input.permission_id,
    min_rank_key: input.minRankKey,
    effect: input.effect,
    priority: input.priority
  }
}
